import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GET as getCourseOverview } from "@/app/api/learning/courses/[slug]/route";
import { GET as getCourseModule } from "@/app/api/learning/courses/[slug]/modules/[moduleId]/route";
import { GET as getStudentDashboard } from "@/app/api/me/route";
import { POST as updateModuleProgress } from "@/app/api/progress/update/route";
import { query } from "@/lib/db";
import { beginEmailSignUp, verifyEmailToken } from "@/lib/local-auth";

function authenticatedRequest(path: string, token: string) {
  return new Request(`https://irenee.test${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

function authenticatedJsonRequest(path: string, token: string, body: Record<string, unknown>) {
  return new Request(`https://irenee.test${path}`, {
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    method: "POST"
  });
}

const privateFields = ["contenu", "contenu_html", "url_video", "ressources", "quiz"] as const;

test("course overview is metadata-only and module content is delivered in sequence", async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "learning content tests must use the isolated security database");

  const suffix = randomUUID();
  const courseId = randomUUID();
  const firstModuleId = randomUUID();
  const secondModuleId = randomUUID();
  const slug = `content-delivery-${suffix}`;
  const firstSecret = `FIRST_ALLOWED_${suffix}`;
  const lockedSecret = `SECOND_LOCKED_${suffix}`;
  let userId = "";

  try {
    const signup = await beginEmailSignUp({
      email: `learning-content-${suffix}@example.test`,
      metadata: { nom: "Contenu", prenom: "Séquentiel" }
    });
    assert.equal(signup.error, null);
    assert.ok(signup.user?.id && signup.verificationToken);
    userId = signup.user!.id;

    const verified = await verifyEmailToken(signup.verificationToken!, "Correct-horse-42!");
    assert.equal(verified.error, null);
    assert.ok(verified.session?.access_token);
    const token = verified.session!.access_token;

    await query(
      `insert into public.courses (id,titre,slug,description,statut)
       values ($1,'Cours à livraison séquentielle',$2,'Métadonnées publiques du cours','publie')`,
      [courseId, slug]
    );
    await query(
      `insert into public.course_modules
       (id,course_id,titre,description,ordre,type_contenu,contenu,contenu_html,url_video,ressources,quiz)
       values
        ($1,$3,'Premier module','Premier résumé',1,'quiz','Premier texte',$4,'https://cdn.example.test/first.mp4',$6::jsonb,$7::jsonb),
        ($2,$3,'Module verrouillé','Second résumé',2,'texte','Second texte',$5,'https://cdn.example.test/locked.mp4',$8::jsonb,'[]'::jsonb)`,
      [
        firstModuleId,
        secondModuleId,
        courseId,
        `<p>${firstSecret}</p>`,
        `<p>${lockedSecret}</p>`,
        JSON.stringify([{ label: "Support", url: "https://example.test/support" }]),
        JSON.stringify([{
          answer: 1,
          explanation: "Correction privée",
          id: "private-answer",
          options: ["Non", "Oui"],
          question: "La correction reste-t-elle serveur ?",
          solution: "Oui"
        }]),
        JSON.stringify([{ label: "Secret", url: "https://example.test/locked" }])
      ]
    );
    await query(
      `insert into public.annual_access_passes
        (user_id,provider_order_id,amount_total,currency,status,expires_at)
       values ($1,$2,9900,'EUR','active',now() + interval '1 day')`,
      [userId, `TEST-CONTENT-${suffix}`]
    );

    const overviewResponse = await getCourseOverview(
      authenticatedRequest(`/api/learning/courses/${slug}`, token),
      { params: Promise.resolve({ slug }) }
    );
    assert.equal(overviewResponse.status, 200);
    assert.equal(overviewResponse.headers.get("cache-control"), "private, no-store");
    const overview = await overviewResponse.json();
    assert.equal(overview.ok, true);
    assert.equal(overview.course.modules.length, 2);
    for (const module of overview.course.modules) {
      for (const field of privateFields) assert.equal(Object.hasOwn(module, field), false, `${field} must not be in the course outline`);
    }
    const serializedOverview = JSON.stringify(overview);
    assert.equal(serializedOverview.includes(firstSecret), false);
    assert.equal(serializedOverview.includes(lockedSecret), false);
    assert.equal(serializedOverview.includes("Correction privée"), false);

    const dashboardResponse = await getStudentDashboard(authenticatedRequest("/api/me", token));
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardResponse.headers.get("cache-control"), "private, no-store");
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboard.ok, true);
    const dashboardCourse = dashboard.courses.find((item: { id: string }) => item.id === courseId);
    assert.ok(dashboardCourse);
    for (const module of dashboardCourse.modules) {
      for (const field of privateFields) assert.equal(Object.hasOwn(module, field), false, `${field} must not be in /api/me`);
    }
    assert.equal(JSON.stringify(dashboard).includes(firstSecret), false);
    assert.equal(JSON.stringify(dashboard).includes(lockedSecret), false);
    assert.equal(JSON.stringify(dashboard).includes("Correction privée"), false);

    const lockedResponse = await getCourseModule(
      authenticatedRequest(`/api/learning/courses/${slug}/modules/${secondModuleId}`, token),
      { params: Promise.resolve({ slug, moduleId: secondModuleId }) }
    );
    assert.equal(lockedResponse.status, 409);
    assert.equal(lockedResponse.headers.get("cache-control"), "private, no-store");
    const locked = await lockedResponse.json();
    assert.equal(locked.ok, false);
    assert.equal(locked.resumeModuleId, firstModuleId);
    assert.equal(JSON.stringify(locked).includes(lockedSecret), false);
    assert.equal(Object.hasOwn(locked, "module"), false);

    const firstResponse = await getCourseModule(
      authenticatedRequest(`/api/learning/courses/${slug}/modules/${firstModuleId}`, token),
      { params: Promise.resolve({ slug, moduleId: firstModuleId }) }
    );
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    assert.equal(first.module.contenu_html, `<p>${firstSecret}</p>`);
    assert.deepEqual(first.module.quiz, [{
      id: "private-answer",
      options: ["Non", "Oui"],
      question: "La correction reste-t-elle serveur ?"
    }]);
    assert.equal(JSON.stringify(first).includes(lockedSecret), false);
    assert.equal(JSON.stringify(first).includes("Correction privée"), false);

    await query(
      `insert into public.module_progress
        (etudiant_id,course_id,module_id,complete,progression,statut,date_debut,date_completion)
       values ($1,$2,$3,true,100,'termine',now() - interval '1 minute',now())`,
      [userId, courseId, firstModuleId]
    );

    const unlockedResponse = await getCourseModule(
      authenticatedRequest(`/api/learning/courses/${slug}/modules/${secondModuleId}`, token),
      { params: Promise.resolve({ slug, moduleId: secondModuleId }) }
    );
    assert.equal(unlockedResponse.status, 200);
    const unlocked = await unlockedResponse.json();
    assert.equal(unlocked.module.id, secondModuleId);
    assert.equal(unlocked.module.contenu_html, `<p>${lockedSecret}</p>`);
    assert.equal(JSON.stringify(unlocked.course.modules).includes(firstSecret), false);

    // Staff access is derived exclusively from the server-owned profile role.
    // It must not depend on a paid pass or an enrollment, while the normal
    // sequential module rules continue to apply.
    await query("delete from public.annual_access_passes where user_id=$1", [userId]);
    await query("delete from public.module_progress where etudiant_id=$1 and course_id=$2", [userId, courseId]);
    for (const role of ["formateur", "directeur"] as const) {
      await query("update public.profiles set role=$2 where id=$1", [userId, role]);

      const staffOverview = await getCourseOverview(
        authenticatedRequest(`/api/learning/courses/${slug}`, token),
        { params: Promise.resolve({ slug }) }
      );
      assert.equal(staffOverview.status, 200, `${role} must read a published course without an annual pass`);

      const staffModule = await getCourseModule(
        authenticatedRequest(`/api/learning/courses/${slug}/modules/${firstModuleId}`, token),
        { params: Promise.resolve({ slug, moduleId: firstModuleId }) }
      );
      assert.equal(staffModule.status, 200, `${role} must read a module without an annual pass`);

      const staffStart = await updateModuleProgress(authenticatedJsonRequest("/api/progress/update", token, {
        action: "start",
        course_id: courseId,
        module_id: firstModuleId
      }));
      assert.equal(staffStart.status, 200, `${role} must be able to start the reader without an annual pass`);
    }

    await query(
      "update public.module_progress set date_debut=now()-interval '31 seconds' where etudiant_id=$1 and module_id=$2",
      [userId, firstModuleId]
    );
    const staffCompletion = await updateModuleProgress(authenticatedJsonRequest("/api/progress/update", token, {
      answers: { "private-answer": 1 },
      complete: true,
      course_id: courseId,
      module_id: firstModuleId,
      progression: 100
    }));
    assert.equal(staffCompletion.status, 200);
    assert.deepEqual((await staffCompletion.json()).documents, [], "staff preview progress must never mint student credentials");
    const staffDocuments = await query<{ count: string }>(
      "select count(*)::text as count from public.learning_documents where user_id=$1 and course_id=$2",
      [userId, courseId]
    );
    assert.equal(staffDocuments.rows[0]?.count, "0");
  } finally {
    await query("delete from public.courses where id=$1", [courseId]).catch(() => undefined);
    if (userId) await query("delete from auth.users where id=$1", [userId]).catch(() => undefined);
  }
});
