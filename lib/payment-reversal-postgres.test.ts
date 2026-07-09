import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { query } from "./db";

const userId = randomUUID();
const courseId = randomUUID();
const secondCourseId = randomUUID();
const moduleId = randomUUID();

async function createPendingOrder(input: {
  amount?: number;
  courseId?: string | null;
  orderId: string;
  productType: "annual_pass" | "legacy_course" | "library_membership";
  provider?: "paypal" | "stripe";
}) {
  const provider = input.provider || "stripe";
  await query(
    `insert into public.paypal_orders
      (provider,order_id,user_id,course_id,product_type,amount_total,currency,status,book_requested,book_request_status)
     values ($1,$2,$3,$4,$5,$6,'EUR','open',false,'none')`,
    [provider, input.orderId, userId, input.courseId || null, input.productType, input.amount || 9900]
  );
}

async function validateOrder(input: {
  amount?: number;
  captureId: string;
  courseId?: string | null;
  orderId: string;
  productType: "annual_pass" | "legacy_course" | "library_membership";
  provider?: "paypal" | "stripe";
}) {
  return query<{ result: Record<string, unknown> }>(
    `select public.validate_payment($1,$2,$3,$4,$5,$6,'EUR','test.completed',$7::jsonb,false,'',$8) as result`,
    [
      input.provider || "stripe",
      input.orderId,
      input.captureId,
      userId,
      input.courseId || null,
      input.amount || 9900,
      JSON.stringify({ card: { number: "should-never-be-stored" } }),
      input.productType
    ]
  );
}

async function reverse(input: {
  amount?: number;
  captureId: string;
  eventId: string;
  kind: "denied" | "disputed" | "refunded" | "reversed";
  objectId: string;
  orderId?: string;
  provider?: "paypal" | "stripe";
}) {
  return query<{ result: Record<string, unknown> }>(
    `select public.process_payment_reversal($1,$2,$3,$4,$5,$6,$7,$8,'EUR') as result`,
    [
      input.provider || "stripe",
      input.eventId,
      `test.${input.kind}`,
      input.kind,
      input.objectId,
      input.orderId || "",
      input.captureId,
      input.amount || 0
    ]
  );
}

before(async () => {
  await query(
    `insert into auth.users
      (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
     values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'{}','{}',now(),now(),false,false)`,
    [userId, `payment-reversal-${userId}@example.test`]
  );
  await query(
    `insert into public.profiles (id,email,nom,prenom,role)
     values ($1,$2,'Reversal','Payment','etudiant')`,
    [userId, `payment-reversal-${userId}@example.test`]
  );
  await query(
    `insert into public.courses (id,titre,slug,description,statut)
     values ($1,'Paid course',$2,'Test','publie'),($3,'Independent course',$4,'Test','publie')`,
    [courseId, `paid-${courseId}`, secondCourseId, `independent-${secondCourseId}`]
  );
  await query(
    `insert into public.course_modules (id,course_id,titre,description,ordre,type_contenu)
     values ($1,$2,'Paid module','Test',1,'texte')`,
    [moduleId, courseId]
  );
});

after(async () => {
  await query("delete from auth.users where id=$1", [userId]).catch(() => undefined);
  await query("delete from public.courses where id=any($1::uuid[])", [[courseId, secondCourseId]]).catch(() => undefined);
});

test("a full refund revokes only its annual pass, is idempotent, and stores no raw provider payload", async () => {
  const firstOrder = `cs_test_${randomUUID()}`;
  const secondOrder = `cs_test_${randomUUID()}`;
  const firstCapture = `pi_${randomUUID()}`;
  const secondCapture = `pi_${randomUUID()}`;
  await createPendingOrder({ orderId: firstOrder, productType: "annual_pass" });
  await createPendingOrder({ orderId: secondOrder, productType: "annual_pass" });
  await validateOrder({ captureId: firstCapture, orderId: firstOrder, productType: "annual_pass" });
  await validateOrder({ captureId: secondCapture, orderId: secondOrder, productType: "annual_pass" });

  const mismatch = await reverse({
    captureId: `pi_${randomUUID()}`,
    eventId: `evt_${randomUUID()}`,
    kind: "disputed",
    objectId: `dp_${randomUUID()}`,
    orderId: firstOrder
  });
  assert.equal(mismatch.rows[0]?.result.reason, "capture_mismatch");
  const beforeRefund = await query<{ status: string }>(
    "select status from public.annual_access_passes where provider_order_id=$1",
    [firstOrder]
  );
  assert.equal(beforeRefund.rows[0]?.status, "active");

  const chargeId = `ch_${randomUUID()}`;
  const partial = await reverse({
    amount: 1000,
    captureId: firstCapture,
    eventId: `evt_${randomUUID()}`,
    kind: "refunded",
    objectId: chargeId,
    orderId: firstOrder
  });
  assert.equal(partial.rows[0]?.result.partial_refund, true);

  const eventId = `evt_${randomUUID()}`;
  const full = await reverse({ amount: 9900, captureId: firstCapture, eventId, kind: "refunded", objectId: chargeId, orderId: firstOrder });
  assert.equal(full.rows[0]?.result.revoked, true);
  const duplicate = await reverse({ amount: 9900, captureId: firstCapture, eventId, kind: "refunded", objectId: chargeId, orderId: firstOrder });
  assert.equal(duplicate.rows[0]?.result.already_processed, true);

  const passes = await query<{ provider_order_id: string; status: string }>(
    "select provider_order_id,status from public.annual_access_passes where provider_order_id=any($1::text[]) order by provider_order_id",
    [[firstOrder, secondOrder]]
  );
  assert.equal(passes.rows.find(pass => pass.provider_order_id === firstOrder)?.status, "revoked");
  assert.equal(passes.rows.find(pass => pass.provider_order_id === secondOrder)?.status, "active");

  const raw = await query<{ raw_capture: unknown; raw_order: unknown }>(
    "select raw_order,raw_capture from public.paypal_orders where order_id=$1",
    [firstOrder]
  );
  assert.equal(raw.rows[0]?.raw_order, null);
  assert.equal(raw.rows[0]?.raw_capture, null);
  const eventRaw = await query<{ count: string }>(
    `select count(*)::text as count from public.payment_events
     where provider in ('stripe','paypal') and raw_payload is not null and order_id=any($1::text[])`,
    [[firstOrder, secondOrder]]
  );
  assert.equal(eventRaw.rows[0]?.count, "0");
});

test("manual course access survives a chargeback while payment-only access is withdrawn without deleting progress", async () => {
  await query(
    `insert into public.course_enrollments
      (course_id,etudiant_id,statut,access_source,access_expires_at,payment_order_id)
     values ($1,$2,'en_cours','legacy',null,null)`,
    [secondCourseId, userId]
  );

  const manualOrder = `ORDER-${randomUUID()}`;
  const manualCapture = `CAPTURE-${randomUUID()}`;
  await createPendingOrder({ courseId: secondCourseId, orderId: manualOrder, productType: "legacy_course", provider: "paypal" });
  await validateOrder({ courseId: secondCourseId, captureId: manualCapture, orderId: manualOrder, productType: "legacy_course", provider: "paypal" });
  await reverse({ captureId: manualCapture, eventId: `WH-${randomUUID()}`, kind: "reversed", objectId: manualCapture, orderId: manualOrder, provider: "paypal" });

  const manual = await query<{ access_source: string; payment_order_id: string | null; statut: string }>(
    "select access_source,payment_order_id,statut from public.course_enrollments where etudiant_id=$1 and course_id=$2",
    [userId, secondCourseId]
  );
  assert.deepEqual(manual.rows[0], { access_source: "legacy", payment_order_id: null, statut: "en_cours" });

  await query("update public.annual_access_passes set status='revoked' where user_id=$1", [userId]);

  const paidOrder = `cs_test_${randomUUID()}`;
  const paidCapture = `pi_${randomUUID()}`;
  await createPendingOrder({ courseId, orderId: paidOrder, productType: "legacy_course" });
  await validateOrder({ courseId, captureId: paidCapture, orderId: paidOrder, productType: "legacy_course" });
  await query(
    `insert into public.module_progress (etudiant_id,course_id,module_id,statut,progression)
     values ($1,$2,$3,'en_cours',10)`,
    [userId, courseId, moduleId]
  );
  await reverse({ captureId: paidCapture, eventId: `evt_${randomUUID()}`, kind: "disputed", objectId: `dp_${randomUUID()}`, orderId: paidOrder });

  const paid = await query<{ access_source: string; payment_order_id: string | null; statut: string }>(
    "select access_source,payment_order_id,statut from public.course_enrollments where etudiant_id=$1 and course_id=$2",
    [userId, courseId]
  );
  assert.deepEqual(paid.rows[0], { access_source: "payment", payment_order_id: paidOrder, statut: "abandonne" });
  const progress = await query<{ count: string }>(
    "select count(*)::text as count from public.module_progress where etudiant_id=$1 and module_id=$2",
    [userId, moduleId]
  );
  assert.equal(progress.rows[0]?.count, "1");

  const replacementOrder = `cs_test_${randomUUID()}`;
  const replacementCapture = `pi_${randomUUID()}`;
  await createPendingOrder({ courseId, orderId: replacementOrder, productType: "legacy_course" });
  await validateOrder({ courseId, captureId: replacementCapture, orderId: replacementOrder, productType: "legacy_course" });
  const reacquired = await query<{ access_source: string; payment_order_id: string | null; statut: string }>(
    "select access_source,payment_order_id,statut from public.course_enrollments where etudiant_id=$1 and course_id=$2",
    [userId, courseId]
  );
  assert.deepEqual(reacquired.rows[0], { access_source: "payment", payment_order_id: replacementOrder, statut: "en_cours" });
});
