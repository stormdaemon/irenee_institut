import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GET as getAdminLive, POST as createAdminLive } from "@/app/api/admin/live/route";
import { PATCH as patchAdminLive } from "@/app/api/admin/live/[id]/route";
import { GET as getCourses } from "@/app/api/courses/route";
import { GET as getDocument } from "@/app/api/documents/[id]/route";
import { GET as getLive } from "@/app/api/live/route";
import { POST as joinLive } from "@/app/api/live/[id]/route";
import { GET as downloadScript } from "@/app/api/download/apps-script-partage/route";
import { GET as downloadReport } from "@/app/api/download/rapport/route";
import { query } from "@/lib/db";
import { beginEmailSignUp, verifyEmailToken } from "@/lib/local-auth";

type TestActor = { id: string; token: string };

function authenticatedRequest(path: string, token: string, body?: unknown, method = body === undefined ? "GET" : "PATCH") {
  return new Request(`https://irenee.test${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    method
  });
}

async function actor(role: "directeur" | "formateur" | "etudiant"): Promise<TestActor> {
  const suffix = randomUUID();
  const password = "Correct-horse-42!";
  const signup = await beginEmailSignUp({
    email: `authorization-${role}-${suffix}@example.test`,
    metadata: { nom: "Autorisation", prenom: role }
  });
  assert.ok(signup.user?.id && signup.verificationToken);
  const verified = await verifyEmailToken(signup.verificationToken!, password);
  assert.ok(verified.session?.access_token);
  await query("update public.profiles set role=$2 where id=$1", [signup.user!.id, role]);
  return { id: signup.user!.id, token: verified.session!.access_token };
}

test("course, Daily and document routes enforce resource ownership", async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "authorization tests must use the isolated security database");

  const trainerA = await actor("formateur");
  const trainerB = await actor("formateur");
  const director = await actor("directeur");
  const student = await actor("etudiant");
  const ownCourseId = randomUUID();
  const otherCourseId = randomUUID();
  const ownSessionId = randomUUID();
  const otherSessionId = randomUUID();
  const documentId = randomUUID();
  const suffix = randomUUID();

  try {
    for (const [path, download] of [
      ["/api/download/apps-script-partage", downloadScript],
      ["/api/download/rapport", downloadReport]
    ] as const) {
      assert.equal((await download(new Request(`https://irenee.test${path}?code=legacy-code`))).status, 401);
      assert.equal((await download(authenticatedRequest(path, student.token))).status, 403);
      assert.equal((await download(authenticatedRequest(path, trainerA.token))).status, 403);
    }
    await query(
      `insert into public.courses (id,titre,slug,description,statut,auteur_id)
       values ($1,'Cours A',$3,'','brouillon',$5),($2,'Cours B',$4,'','brouillon',$6)`,
      [ownCourseId, otherCourseId, `authz-a-${suffix}`, `authz-b-${suffix}`, trainerA.id, trainerB.id]
    );
    await query(
      `insert into public.live_sessions
        (id,titre,description,starts_at,ends_at,course_id,status,created_by)
       values
        ($1,'Séance A','',now() + interval '1 hour',now() + interval '2 hours',$3,'scheduled',$5),
        ($2,'Séance B','',now() + interval '1 hour',now() + interval '2 hours',$4,'scheduled',$6)`,
      [ownSessionId, otherSessionId, ownCourseId, otherCourseId, trainerA.id, trainerB.id]
    );
    await query(
      `insert into public.learning_documents
        (id,document_key,document_kind,user_id,recipient_name,course_title)
       values ($1,$2,'course_parchment',$3,'Étudiant Autorisé','Cours A')`,
      [documentId, `authz-document-${suffix}`, student.id]
    );

    const trainerCoursesResponse = await getCourses(authenticatedRequest("/api/courses", trainerA.token));
    assert.equal(trainerCoursesResponse.status, 200);
    const trainerCourses = await trainerCoursesResponse.json();
    assert.ok(trainerCourses.some((course: { id: string }) => course.id === ownCourseId));
    assert.equal(trainerCourses.some((course: { id: string }) => course.id === otherCourseId), false);

    const directorCoursesResponse = await getCourses(authenticatedRequest("/api/courses", director.token));
    assert.equal(directorCoursesResponse.status, 200);
    const directorCourses = await directorCoursesResponse.json();
    assert.ok(directorCourses.some((course: { id: string }) => course.id === ownCourseId));
    assert.ok(directorCourses.some((course: { id: string }) => course.id === otherCourseId));
    assert.equal((await getCourses(authenticatedRequest("/api/courses", student.token))).status, 403);
    assert.equal((await getCourses(new Request("https://irenee.test/api/courses"))).status, 401);

    const trainerLiveResponse = await getAdminLive(authenticatedRequest("/api/admin/live", trainerA.token));
    assert.equal(trainerLiveResponse.status, 200);
    const trainerSessions = (await trainerLiveResponse.json()).sessions;
    assert.ok(trainerSessions.some((session: { id: string }) => session.id === ownSessionId));
    assert.equal(trainerSessions.some((session: { id: string }) => session.id === otherSessionId), false);

    // Contrairement à /api/admin/live (scopé au créateur), tout formateur est
    // staff pour /api/live et /api/live/[id] : il voit et peut rejoindre les
    // séances des autres formateurs, pas seulement les siennes.
    const trainerPublicLiveResponse = await getLive(authenticatedRequest("/api/live", trainerA.token));
    assert.equal(trainerPublicLiveResponse.status, 200);
    const trainerPublicSessions = (await trainerPublicLiveResponse.json()).sessions;
    assert.ok(trainerPublicSessions.some((session: { id: string }) => session.id === ownSessionId));
    assert.ok(trainerPublicSessions.some((session: { id: string }) => session.id === otherSessionId));

    const otherSessionJoin = await joinLive(
      authenticatedRequest(`/api/live/${otherSessionId}`, trainerA.token, {}, "POST"),
      { params: Promise.resolve({ id: otherSessionId }) }
    );
    // L'accès est autorisé (pas de 403/404) ; seule l'absence de salle Daily
    // dans ce fixture de test bloque la suite, avec une erreur distincte.
    assert.equal(otherSessionJoin.status, 409);

    const forbiddenCreate = await createAdminLive(authenticatedRequest("/api/admin/live", trainerA.token, {
      course_id: otherCourseId,
      ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      starts_at: new Date(Date.now() + 3_600_000).toISOString(),
      titre: "Salle non autorisée"
    }, "POST"));
    assert.equal(forbiddenCreate.status, 403);
    const orphanRooms = await query<{ count: string }>(
      "select count(*)::text as count from public.live_sessions where titre='Salle non autorisée' and created_by=$1",
      [trainerA.id]
    );
    assert.equal(Number(orphanRooms.rows[0]?.count || 0), 0);

    const forbiddenPatch = await patchAdminLive(
      authenticatedRequest(`/api/admin/live/${otherSessionId}`, trainerA.token, { titre: "Séance détournée" }),
      { params: Promise.resolve({ id: otherSessionId }) }
    );
    assert.equal(forbiddenPatch.status, 404);
    const unchanged = await query<{ titre: string }>("select titre from public.live_sessions where id=$1", [otherSessionId]);
    assert.equal(unchanged.rows[0]?.titre, "Séance B");

    const ownPatch = await patchAdminLive(
      authenticatedRequest(`/api/admin/live/${ownSessionId}`, trainerA.token, { titre: "Séance A mise à jour" }),
      { params: Promise.resolve({ id: ownSessionId }) }
    );
    assert.equal(ownPatch.status, 200);
    const directorPatch = await patchAdminLive(
      authenticatedRequest(`/api/admin/live/${otherSessionId}`, director.token, { titre: "Séance B contrôlée" }),
      { params: Promise.resolve({ id: otherSessionId }) }
    );
    assert.equal(directorPatch.status, 200);

    const trainerDocument = await getDocument(
      authenticatedRequest(`/api/documents/${documentId}`, trainerA.token),
      { params: Promise.resolve({ id: documentId }) }
    );
    assert.equal(trainerDocument.status, 404);
    const ownerDocument = await getDocument(
      authenticatedRequest(`/api/documents/${documentId}`, student.token),
      { params: Promise.resolve({ id: documentId }) }
    );
    assert.equal(ownerDocument.status, 200);
    const directorDocument = await getDocument(
      authenticatedRequest(`/api/documents/${documentId}`, director.token),
      { params: Promise.resolve({ id: documentId }) }
    );
    assert.equal(directorDocument.status, 200);
  } finally {
    await query("delete from public.learning_documents where id=$1", [documentId]).catch(() => undefined);
    await query("delete from public.live_sessions where id = any($1::uuid[])", [[ownSessionId, otherSessionId]]).catch(() => undefined);
    await query("delete from public.courses where id = any($1::uuid[])", [[ownCourseId, otherCourseId]]).catch(() => undefined);
    await query("delete from auth.users where id = any($1::uuid[])", [[trainerA.id, trainerB.id, director.id, student.id]]).catch(() => undefined);
  }
});
