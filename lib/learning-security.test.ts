import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateModuleCompletionGate,
  evaluateModuleQuizAnswers,
  EXAM_ATTEMPT_COOLDOWN_MS,
  EXAM_MAX_ATTEMPTS_PER_DAY,
  evaluateExamAttemptWindow,
  hasPublishedCourseAccess,
  isActiveCourseEnrollment,
  normalizeFinalExamAnswers,
  parseModuleCompletion,
  parseModuleStart
} from "./learning-security";

const courseId = "11111111-1111-4111-8111-111111111111";
const moduleId = "22222222-2222-4222-8222-222222222222";

test("module completion accepts only a fixed, bounded completion transition", () => {
  assert.deepEqual(parseModuleCompletion({ course_id: courseId, module_id: moduleId, complete: true, progression: 100 }), {
    courseId,
    moduleId
  });

  assert.throws(() => parseModuleCompletion({ course_id: courseId, module_id: moduleId, complete: true, progression: 101 }), /progression/i);
  assert.throws(() => parseModuleCompletion({ course_id: courseId, module_id: moduleId, complete: true, progression: -1 }), /progression/i);
  assert.throws(() => parseModuleCompletion({ course_id: courseId, module_id: moduleId, complete: false }), /termin/i);
  assert.throws(() => parseModuleCompletion({ course_id: "not-a-uuid", module_id: moduleId, complete: true }), /course_id/i);
  assert.throws(() => parseModuleCompletion({ course_id: courseId, module_id: moduleId, complete: true, score_quiz: 100 }), /score/i);
});

test("module start accepts only identifiers and a server-owned start transition", () => {
  assert.deepEqual(parseModuleStart({ action: "start", course_id: courseId, module_id: moduleId }), {
    courseId,
    moduleId
  });
  assert.throws(() => parseModuleStart({ action: "start", course_id: courseId, module_id: moduleId, complete: true }), /serveur/i);
});

test("completion requires ordered modules and a server-recorded engagement window", () => {
  const first = "33333333-3333-4333-8333-333333333333";
  const startedAt = new Date(100_000).toISOString();
  assert.deepEqual(evaluateModuleCompletionGate({
    completedModuleIds: [], moduleId, now: 200_000, orderedModuleIds: [first, moduleId], startedAt
  }), { allowed: false, reason: "previous_module" });
  assert.deepEqual(evaluateModuleCompletionGate({
    completedModuleIds: [first], moduleId, now: 110_000, orderedModuleIds: [first, moduleId], startedAt
  }), { allowed: false, reason: "engagement_time", retryAfterSeconds: 20 });
  assert.deepEqual(evaluateModuleCompletionGate({
    completedModuleIds: [first], moduleId, now: 131_000, orderedModuleIds: [first, moduleId], startedAt
  }), { allowed: true });
});

test("course access requires publication and an active entitlement", () => {
  assert.equal(hasPublishedCourseAccess({ activeAnnualPass: true, activeEnrollment: false, isStaff: false, published: true }), true);
  assert.equal(hasPublishedCourseAccess({ activeAnnualPass: false, activeEnrollment: true, isStaff: false, published: true }), true);
  assert.equal(hasPublishedCourseAccess({ activeAnnualPass: false, activeEnrollment: false, isStaff: true, published: true }), true);
  assert.equal(hasPublishedCourseAccess({ activeAnnualPass: true, activeEnrollment: false, isStaff: false, published: false }), false);
  assert.equal(hasPublishedCourseAccess({ activeAnnualPass: false, activeEnrollment: false, isStaff: false, published: true }), false);
});

test("annual-pass enrollment provenance expires and follows pass revocation", () => {
  const now = Date.parse("2026-07-09T12:00:00.000Z");
  assert.equal(isActiveCourseEnrollment({
    accessExpiresAt: null,
    accessSource: "legacy",
    activeAnnualPass: false,
    now,
    status: "en_cours"
  }), true);
  assert.equal(isActiveCourseEnrollment({
    accessExpiresAt: null,
    accessSource: "payment",
    activeAnnualPass: false,
    now,
    status: "en_cours"
  }), true);
  assert.equal(isActiveCourseEnrollment({
    accessExpiresAt: "2026-07-10T12:00:00.000Z",
    accessSource: "annual_pass",
    activeAnnualPass: true,
    now,
    status: "en_cours"
  }), true);
  assert.equal(isActiveCourseEnrollment({
    accessExpiresAt: "2026-07-08T12:00:00.000Z",
    accessSource: "annual_pass",
    activeAnnualPass: true,
    now,
    status: "en_cours"
  }), false);
  assert.equal(isActiveCourseEnrollment({
    accessExpiresAt: "2026-07-10T12:00:00.000Z",
    accessSource: "annual_pass",
    activeAnnualPass: false,
    now,
    status: "en_cours"
  }), false);
  assert.equal(isActiveCourseEnrollment({
    accessExpiresAt: null,
    accessSource: "legacy",
    activeAnnualPass: false,
    now,
    status: "revoked"
  }), false);
});

test("final exam answers are complete, bounded and reduced to the server question set", () => {
  const questions = [
    { id: "q1", options: ["a", "b"], answer: 0 },
    { id: "q2", options: ["a", "b", "c"], answer: 2 }
  ];

  assert.deepEqual(normalizeFinalExamAnswers({ q1: 0, q2: 2, injected: "ignored" }, questions), { q1: 0, q2: 2 });
  assert.throws(() => normalizeFinalExamAnswers({ q1: 0 }, questions), /toutes les questions/i);
  assert.throws(() => normalizeFinalExamAnswers({ q1: 0, q2: 99 }, questions), /réponse invalide/i);
  assert.throws(() => normalizeFinalExamAnswers({ q1: 0, q2: 1.5 }, questions), /réponse invalide/i);
});

test("module quizzes are graded only against the private server answer key", () => {
  const quiz = [
    { id: "q1", options: ["a", "b"], answer: 0 },
    { id: "q2", options: ["a", "b", "c"], answer: 2 }
  ];
  assert.deepEqual(evaluateModuleQuizAnswers({ q1: 0, q2: 2, injectedScore: 100 }, quiz), { passed: true, score: 100 });
  assert.deepEqual(evaluateModuleQuizAnswers({ q1: 1, q2: 2 }, quiz), { passed: false, score: 50 });
  assert.throws(() => evaluateModuleQuizAnswers({ q1: 0 }, quiz), /toutes les questions/i);
  assert.throws(() => evaluateModuleQuizAnswers({ q1: 0, q2: 2 }, [{ id: "broken", options: ["a"], answer: 9 }]), /configuré/i);
});

test("exam attempt policy enforces cooldown and a daily ceiling", () => {
  const now = Date.parse("2026-07-09T12:00:00.000Z");
  assert.deepEqual(evaluateExamAttemptWindow({ attemptsLastDay: 0, latestAttemptAt: null, now }), { allowed: true });

  const coolingDown = evaluateExamAttemptWindow({
    attemptsLastDay: 1,
    latestAttemptAt: new Date(now - EXAM_ATTEMPT_COOLDOWN_MS + 1_000).toISOString(),
    now
  });
  assert.equal(coolingDown.allowed, false);
  if (!coolingDown.allowed) assert.ok(coolingDown.retryAfterSeconds > 0);

  const limited = evaluateExamAttemptWindow({
    attemptsLastDay: EXAM_MAX_ATTEMPTS_PER_DAY,
    latestAttemptAt: new Date(now - EXAM_ATTEMPT_COOLDOWN_MS - 1_000).toISOString(),
    now
  });
  assert.equal(limited.allowed, false);
});
