import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GET as getFinalExam, POST as postFinalExam } from "@/app/api/final-exam/route";
import { GET as getCourseModule } from "@/app/api/learning/courses/[slug]/modules/[moduleId]/route";
import { GET as getMe } from "@/app/api/me/route";
import { POST as updateProgress } from "@/app/api/progress/update/route";
import { FINAL_EXAM_QUESTIONS } from "@/lib/curriculum";
import { query } from "@/lib/db";
import { beginEmailSignUp, verifyEmailToken } from "@/lib/local-auth";

function authenticatedRequest(path: string, token: string, body?: unknown) {
  return new Request(`https://irenee.test${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    method: body === undefined ? "GET" : "POST"
  });
}

test("learning routes enforce published entitlements, immutable completion and exam cooldown", async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "learning route tests must use the isolated security database");

  const suffix = randomUUID();
  const courseId = randomUUID();
  const draftCourseId = randomUUID();
  const moduleId = randomUUID();
  const quizModuleId = randomUUID();
  const draftModuleId = randomUUID();
  const publishedSlug = `published-security-${suffix}`;
  let userId = "";

  try {
    const signup = await beginEmailSignUp({
      email: `learning-security-${suffix}@example.test`,
      metadata: { nom: "Security", prenom: "Learning" }
    });
    assert.equal(signup.error, null);
    assert.ok(signup.user?.id);
    assert.ok(signup.verificationToken);
    userId = signup.user!.id;

    const verified = await verifyEmailToken(signup.verificationToken!, "Correct-horse-42!");
    assert.equal(verified.error, null);
    assert.ok(verified.session?.access_token);
    const token = verified.session!.access_token;

    await query(
      `insert into public.courses (id,titre,slug,description,statut)
       values ($1,'Published security course',$2,'','publie'),($3,'Draft security course',$4,'','brouillon')`,
      [courseId, publishedSlug, draftCourseId, `draft-security-${suffix}`]
    );
    await query(
      `insert into public.course_modules (id,course_id,titre,ordre,type_contenu,quiz)
       values
         ($1,$2,'Published module',1,'texte',$5::jsonb),
         ($6,$2,'Server-graded quiz',2,'quiz',$7::jsonb),
         ($3,$4,'Draft module',1,'texte','[]'::jsonb)`,
      [
        moduleId,
        courseId,
        draftModuleId,
        draftCourseId,
        JSON.stringify([{
          answer: 1,
          correctAnswer: 1,
          explanation: "La réponse privée ne doit jamais quitter le serveur.",
          id: "q-secret",
          options: ["Nicée", "Constantinople"],
          question: "Quel concile ?",
          solution: "Constantinople"
        }]),
        quizModuleId,
        JSON.stringify([{ answer: 1, id: "quiz-1", options: ["Faux", "Vrai"], question: "Réponse attendue ?" }])
      ]
    );
    await query(
      `insert into public.annual_access_passes (user_id,provider_order_id,amount_total,currency,status,expires_at)
       values ($1,$2,9900,'EUR','active',now() + interval '1 day')`,
      [userId, `TEST-PASS-${suffix}`]
    );

    const initialMe = await getMe(authenticatedRequest("/api/me", token));
    assert.equal(initialMe.status, 200);
    const initialPayload = await initialMe.json();
    assert.ok(initialPayload.courses.some((course: { id: string }) => course.id === courseId));
    assert.equal(initialPayload.courses.some((course: { id: string }) => course.id === draftCourseId), false);
    const dashboardModule = initialPayload.courses
      .find((course: { id: string }) => course.id === courseId)
      ?.modules.find((module: { id: string }) => module.id === moduleId);
    assert.ok(dashboardModule);
    assert.equal(Object.hasOwn(dashboardModule, "quiz"), false);
    assert.equal(Object.hasOwn(dashboardModule, "contenu_html"), false);

    const moduleResponse = await getCourseModule(
      authenticatedRequest(`/api/learning/courses/${publishedSlug}/modules/${moduleId}`, token),
      { params: Promise.resolve({ slug: publishedSlug, moduleId }) }
    );
    assert.equal(moduleResponse.status, 200);
    const publicQuiz = (await moduleResponse.json()).module.quiz;
    assert.deepEqual(publicQuiz, [{
      id: "q-secret",
      options: ["Nicée", "Constantinople"],
      question: "Quel concile ?"
    }]);

    const manipulated = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      complete: true,
      course_id: courseId,
      module_id: moduleId,
      progression: 101
    }));
    assert.equal(manipulated.status, 400);

    await query(
      `insert into public.module_progress
        (etudiant_id,course_id,module_id,complete,progression,statut,date_debut)
       values ($1,$2,$3,false,0,'en_cours',null)`,
      [userId, courseId, moduleId]
    );

    const started = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      action: "start",
      course_id: courseId,
      module_id: moduleId
    }));
    assert.equal(started.status, 200);
    const startedPayload = await started.json();
    assert.ok(Number.isFinite(Date.parse(String(startedPayload.data.date_debut || ""))));
    const repairedStart = await query<{ date_debut: string | null }>(
      "select date_debut from public.module_progress where etudiant_id=$1 and module_id=$2",
      [userId, moduleId]
    );
    assert.ok(Number.isFinite(Date.parse(String(repairedStart.rows[0]?.date_debut || ""))));
    const repeatedStart = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      action: "start",
      course_id: courseId,
      module_id: moduleId
    }));
    assert.equal(repeatedStart.status, 200);
    assert.equal((await repeatedStart.json()).data.date_debut, startedPayload.data.date_debut);
    await query(
      "update public.module_progress set date_debut=now()-interval '31 seconds' where etudiant_id=$1 and module_id=$2",
      [userId, moduleId]
    );

    const completed = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      complete: true,
      course_id: courseId,
      module_id: moduleId,
      progression: 100
    }));
    assert.equal(completed.status, 200);
    const completedPayload = await completed.json();
    assert.equal(completedPayload.data.complete, true);
    assert.equal(completedPayload.data.progression, 100);

    const quizStarted = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      action: "start",
      course_id: courseId,
      module_id: quizModuleId
    }));
    assert.equal(quizStarted.status, 200);
    await query(
      "update public.module_progress set date_debut=now()-interval '31 seconds' where etudiant_id=$1 and module_id=$2",
      [userId, quizModuleId]
    );
    const failedQuiz = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      answers: { "quiz-1": 0 },
      complete: true,
      course_id: courseId,
      module_id: quizModuleId,
      progression: 100
    }));
    assert.equal(failedQuiz.status, 422);
    assert.equal((await failedQuiz.json()).score, 0);
    const passedQuiz = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      answers: { "quiz-1": 1 },
      complete: true,
      course_id: courseId,
      module_id: quizModuleId,
      progression: 100
    }));
    assert.equal(passedQuiz.status, 200);
    assert.equal((await passedQuiz.json()).data.score_quiz, 100);

    const passEnrollment = await query<{ count: string }>(
      "select count(*)::text as count from public.course_enrollments where etudiant_id=$1 and course_id=$2",
      [userId, courseId]
    );
    assert.equal(Number(passEnrollment.rows[0]?.count || 0), 0);

    const draftAttempt = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      complete: true,
      course_id: draftCourseId,
      module_id: draftModuleId,
      progression: 100
    }));
    assert.equal(draftAttempt.status, 404);

    await query(
      "update public.annual_access_passes set status='expired',expires_at=now()-interval '1 minute' where user_id=$1",
      [userId]
    );
    await query(
      `insert into public.course_enrollments
        (course_id,etudiant_id,statut,access_source,access_expires_at)
       values ($1,$2,'en_cours','annual_pass',now()-interval '1 minute')`,
      [courseId, userId]
    );

    const expiredMe = await getMe(authenticatedRequest("/api/me", token));
    assert.equal(expiredMe.status, 200);
    const expiredPayload = await expiredMe.json();
    assert.equal(expiredPayload.courses.some((course: { id: string }) => course.id === courseId), false);

    const expiredProgress = await updateProgress(authenticatedRequest("/api/progress/update", token, {
      complete: true,
      course_id: courseId,
      module_id: moduleId,
      progression: 100
    }));
    assert.equal(expiredProgress.status, 403);

    await query(
      "update public.course_enrollments set access_source='legacy',access_expires_at=null where etudiant_id=$1 and course_id=$2",
      [userId, courseId]
    );
    const legacyMe = await getMe(authenticatedRequest("/api/me", token));
    const legacyPayload = await legacyMe.json();
    assert.ok(legacyPayload.courses.some((course: { id: string }) => course.id === courseId));

    await query(
      "update public.annual_access_passes set status='active',expires_at=now()+interval '1 day' where user_id=$1",
      [userId]
    );
    await query(
      `insert into public.module_progress
        (etudiant_id,course_id,module_id,complete,progression,statut,date_completion,updated_at)
       select $1,module.course_id,module.id,true,100,'termine',now(),now()
       from public.course_modules module
       join public.courses course on course.id=module.course_id
       where course.statut='publie'
       on conflict (etudiant_id,module_id) do update set
         course_id=excluded.course_id,
         complete=true,
         progression=100,
         statut='termine',
         date_completion=now(),
         updated_at=now()`,
      [userId]
    );

    const examStatus = await getFinalExam(authenticatedRequest("/api/final-exam", token));
    assert.ok(examStatus);
    assert.equal(examStatus.status, 200);
    assert.equal((await examStatus.json()).eligible, true);

    const wrongAnswers = Object.fromEntries(FINAL_EXAM_QUESTIONS.map(question => [
      question.id,
      (question.answer + 1) % question.options.length
    ]));
    const firstAttempt = await postFinalExam(authenticatedRequest("/api/final-exam", token, { answers: wrongAnswers }));
    assert.ok(firstAttempt);
    assert.equal(firstAttempt.status, 200);
    assert.equal((await firstAttempt.json()).passed, false);

    const immediateRetry = await postFinalExam(authenticatedRequest("/api/final-exam", token, { answers: wrongAnswers }));
    assert.ok(immediateRetry);
    assert.equal(immediateRetry.status, 429);
    assert.ok(Number(immediateRetry.headers.get("retry-after")) > 0);
  } finally {
    if (userId) await query("delete from auth.users where id=$1", [userId]).catch(() => undefined);
    await query("delete from public.courses where id = any($1::uuid[])", [[courseId, draftCourseId]]).catch(() => undefined);
  }
});
