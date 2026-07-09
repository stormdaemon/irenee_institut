import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDailyMeetingUrl,
  closeDailyRoom,
  createDailyMeetingToken,
  createDailyRoom,
  ensureDailyRoomPrivate,
  getDailyRoomTimeBounds,
  getAccessibleLiveCourseIds,
  getLiveJoinDecision,
  canManageCourseLiveSessions,
  canManageLiveSession,
  isAllowedLiveStatusTransition,
  updateDailyRoomTimeBounds,
  type LiveSession
} from "./live";

type CapturedRequest = {
  input: string;
  init: RequestInit;
};

function jsonFetch(responseBody: unknown, status = 200) {
  const requests: CapturedRequest[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ input: String(input), init: init || {} });
    return new Response(JSON.stringify(responseBody), {
      headers: { "Content-Type": "application/json" },
      status
    });
  }) as typeof fetch;
  return { fetcher, requests };
}

function session(overrides: Partial<LiveSession> = {}): LiveSession {
  return {
    id: "4e7f680c-b040-4e11-ad61-f16c96797f4d",
    titre: "Patristique",
    description: "",
    starts_at: "2026-09-02T18:30:00.000Z",
    ends_at: "2026-09-02T20:00:00.000Z",
    course_id: null,
    created_by: null,
    daily_room_name: "patristique-secure",
    daily_room_url: "https://irenee.daily.co/patristique-secure",
    status: "scheduled",
    ...overrides
  };
}

test("Daily rooms are private, token-only and bounded in time", async () => {
  const { fetcher, requests } = jsonFetch({
    name: "patristique-secure",
    url: "https://irenee.daily.co/patristique-secure"
  });

  const room = await createDailyRoom("daily-test-api-key", {
    name: "patristique-secure",
    nbf: 1_788_373_800,
    exp: 1_788_381_600
  }, fetcher);

  assert.equal(room.name, "patristique-secure");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, "https://api.daily.co/v1/rooms");
  assert.equal(requests[0].init.method, "POST");
  const body = JSON.parse(String(requests[0].init.body));
  assert.equal(body.privacy, "private");
  assert.deepEqual(body.properties, {
    nbf: 1_788_373_800,
    exp: 1_788_381_600,
    eject_at_room_exp: true,
    enable_prejoin_ui: true,
    enable_knocking: false,
    enable_chat: true,
    enable_screenshare: true,
    enforce_unique_user_ids: true,
    lang: "fr"
  });
});

test("room availability includes staff preparation and a short end grace period", () => {
  assert.deepEqual(
    getDailyRoomTimeBounds("2026-09-02T18:30:00.000Z", "2026-09-02T20:00:00.000Z"),
    {
      nbf: Date.parse("2026-09-02T17:30:00.000Z") / 1000,
      exp: Date.parse("2026-09-02T20:15:00.000Z") / 1000
    }
  );
  assert.deepEqual(
    getDailyRoomTimeBounds("2026-09-02T18:30:00.000Z", null),
    {
      nbf: Date.parse("2026-09-02T17:30:00.000Z") / 1000,
      exp: Date.parse("2026-09-02T22:45:00.000Z") / 1000
    }
  );
  assert.throws(
    () => getDailyRoomTimeBounds("2026-09-02T18:30:00.000Z", "2026-09-02T18:00:00.000Z"),
    /horaire/i
  );
});

test("existing Daily rooms are upgraded to private before issuing access", async () => {
  const { fetcher, requests } = jsonFetch({ name: "patristique-secure" });

  await ensureDailyRoomPrivate("daily-test-api-key", "patristique-secure", fetcher);

  assert.equal(requests[0].input, "https://api.daily.co/v1/rooms/patristique-secure");
  assert.equal(requests[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
    privacy: "private",
    properties: {
      enable_knocking: false,
      enforce_unique_user_ids: true
    }
  });
});

test("ending a session expires the Daily room and ejects connected participants", async () => {
  const { fetcher, requests } = jsonFetch({ name: "patristique-secure" });

  await closeDailyRoom("daily-test-api-key", "patristique-secure", 1_788_377_100, fetcher);

  assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
    privacy: "private",
    properties: {
      nbf: 1_788_377_099,
      exp: 1_788_377_100,
      eject_at_room_exp: true,
      enable_knocking: false,
      enforce_unique_user_ids: true
    }
  });
});

test("rescheduling keeps a private room aligned with the new server-side window", async () => {
  const { fetcher, requests } = jsonFetch({ name: "patristique-secure" });

  await updateDailyRoomTimeBounds(
    "daily-test-api-key",
    "patristique-secure",
    { nbf: 1_788_373_800, exp: 1_788_381_600 },
    fetcher
  );

  assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
    privacy: "private",
    properties: {
      nbf: 1_788_373_800,
      exp: 1_788_381_600,
      eject_at_room_exp: true,
      enable_knocking: false,
      enforce_unique_user_ids: true
    }
  });
});

test("live-session statuses follow a terminal state machine", () => {
  assert.equal(isAllowedLiveStatusTransition("scheduled", "live"), true);
  assert.equal(isAllowedLiveStatusTransition("scheduled", "cancelled"), true);
  assert.equal(isAllowedLiveStatusTransition("live", "ended"), true);
  assert.equal(isAllowedLiveStatusTransition("live", "cancelled"), true);
  assert.equal(isAllowedLiveStatusTransition("ended", "live"), false);
  assert.equal(isAllowedLiveStatusTransition("cancelled", "scheduled"), false);
});

test("Daily session management is owner-scoped for trainers and global for directors", () => {
  const createdBy = "d9428888-122b-11e1-b85c-61cd3cbb3210";
  assert.equal(canManageLiveSession("directeur", "another-user", { created_by: createdBy }), true);
  assert.equal(canManageLiveSession("formateur", createdBy, { created_by: createdBy }), true);
  assert.equal(canManageLiveSession("formateur", "another-user", { created_by: createdBy }), false);
  assert.equal(canManageLiveSession("formateur", createdBy, { created_by: null }), false);
  assert.equal(canManageLiveSession("etudiant", createdBy, { created_by: createdBy }), false);
  assert.equal(canManageCourseLiveSessions("directeur", "another-user", { auteur_id: createdBy }), true);
  assert.equal(canManageCourseLiveSessions("formateur", createdBy, { auteur_id: createdBy }), true);
  assert.equal(canManageCourseLiveSessions("formateur", "another-user", { auteur_id: createdBy }), false);
});

test("expired annual-pass enrollments never retain live-session access", () => {
  const now = Date.parse("2026-09-02T18:00:00.000Z");
  const enrollments = [
    { course_id: "legacy-course", statut: "en_cours", access_source: "legacy", access_expires_at: null },
    { course_id: "expired-pass-course", statut: "en_cours", access_source: "annual_pass", access_expires_at: "2026-09-01T00:00:00.000Z" },
    { course_id: "active-pass-course", statut: "en_cours", access_source: "annual_pass", access_expires_at: "2026-10-01T00:00:00.000Z" },
    { course_id: "finished-course", statut: "termine", access_source: "legacy", access_expires_at: null }
  ];

  assert.deepEqual(
    [...getAccessibleLiveCourseIds(enrollments, true, now)],
    ["legacy-course", "active-pass-course"]
  );
  assert.deepEqual(
    [...getAccessibleLiveCourseIds(enrollments, false, now)],
    ["legacy-course"]
  );
});

test("meeting tokens are user-bound, room-bound, short-lived and least-privileged", async () => {
  const { fetcher, requests } = jsonFetch({ token: "header.payload.signature" });

  const token = await createDailyMeetingToken("daily-test-api-key", {
    roomName: "patristique-secure",
    userId: "4e7f680c-b040-4e11-ad61-f16c96797f4d",
    userName: "Marie Curie",
    isOwner: false,
    expiresAt: 1_788_377_100
  }, fetcher);

  assert.equal(token, "header.payload.signature");
  assert.equal(requests[0].input, "https://api.daily.co/v1/meeting-tokens");
  const body = JSON.parse(String(requests[0].init.body));
  assert.deepEqual(body.properties, {
    room_name: "patristique-secure",
    user_id: "4e7f680c-b040-4e11-ad61-f16c96797f4d",
    user_name: "Marie Curie",
    is_owner: false,
    exp: 1_788_377_100,
    eject_at_token_exp: false,
    enable_prejoin_ui: true,
    enable_screenshare: false,
    lang: "fr",
    permissions: {
      hasPresence: true,
      canSend: ["video", "audio"],
      canAdmin: false
    }
  });
});

test("staff tokens grant ownership without weakening room or identity scope", async () => {
  const { fetcher, requests } = jsonFetch({ token: "header.payload.signature" });

  await createDailyMeetingToken("daily-test-api-key", {
    roomName: "patristique-secure",
    userId: "4e7f680c-b040-4e11-ad61-f16c96797f4d",
    userName: "Père Irénée",
    isOwner: true,
    expiresAt: 1_788_377_100
  }, fetcher);

  const properties = JSON.parse(String(requests[0].init.body)).properties;
  assert.equal(properties.room_name, "patristique-secure");
  assert.equal(properties.user_id, "4e7f680c-b040-4e11-ad61-f16c96797f4d");
  assert.equal(properties.is_owner, true);
  assert.deepEqual(properties.permissions, {
    hasPresence: true,
    canSend: true,
    canAdmin: true
  });
});

test("Daily join URLs only accept the expected HTTPS Daily room", () => {
  assert.equal(
    buildDailyMeetingUrl(
      "https://irenee.daily.co/patristique-secure",
      "patristique-secure",
      "header.payload.signature"
    ),
    "https://irenee.daily.co/patristique-secure?t=header.payload.signature"
  );

  assert.throws(
    () => buildDailyMeetingUrl("https://evil.example/collect", "patristique-secure", "header.payload.signature"),
    /Daily/i
  );
  assert.throws(
    () => buildDailyMeetingUrl("https://daily.co.evil.example/patristique-secure", "patristique-secure", "header.payload.signature"),
    /Daily/i
  );
  assert.throws(
    () => buildDailyMeetingUrl("https://irenee.daily.co/another-room", "patristique-secure", "header.payload.signature"),
    /Daily/i
  );
});

test("students cannot mint tokens before the 15-minute join window", () => {
  const decision = getLiveJoinDecision(session(), false, Date.parse("2026-09-02T18:14:59.000Z"));
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, "too_early");
  assert.equal(decision.retryAfterSeconds, 1);
});

test("staff may prepare one hour early and tokens expire within five minutes", () => {
  const now = Date.parse("2026-09-02T17:45:00.000Z");
  const decision = getLiveJoinDecision(session(), true, now);
  assert.equal(decision.allowed, true);
  if (!decision.allowed) return;
  assert.equal(decision.expiresAt, Math.floor(now / 1000) + 300);
});

test("token expiry is capped by the session end and access closes afterwards", () => {
  const justBefore = getLiveJoinDecision(session(), false, Date.parse("2026-09-02T19:59:30.000Z"));
  assert.equal(justBefore.allowed, true);
  if (justBefore.allowed) {
    assert.equal(justBefore.expiresAt, Date.parse("2026-09-02T20:00:00.000Z") / 1000);
  }

  const after = getLiveJoinDecision(session(), false, Date.parse("2026-09-02T20:00:00.000Z"));
  assert.equal(after.allowed, false);
  if (!after.allowed) assert.equal(after.reason, "ended");
});

test("Daily helper validation rejects unsafe room names and malformed provider responses", async () => {
  const validFetcher = jsonFetch({ token: "header.payload.signature" }).fetcher;
  await assert.rejects(
    () => createDailyMeetingToken("daily-test-api-key", {
      roomName: "../another-room",
      userId: "4e7f680c-b040-4e11-ad61-f16c96797f4d",
      userName: "Participant",
      isOwner: false,
      expiresAt: 1_788_377_100
    }, validFetcher),
    /Daily/i
  );

  const malformedFetcher = jsonFetch({ token: "not a token" }).fetcher;
  await assert.rejects(
    () => createDailyMeetingToken("daily-test-api-key", {
      roomName: "patristique-secure",
      userId: "4e7f680c-b040-4e11-ad61-f16c96797f4d",
      userName: "Participant",
      isOwner: false,
      expiresAt: 1_788_377_100
    }, malformedFetcher),
    /Daily/i
  );
});

test("the live join route mints access server-side and never returns a bare room URL", () => {
  const route = readFileSync("app/api/live/[id]/route.ts", "utf8");
  assert.match(route, /export async function POST/);
  assert.match(route, /ensureDailyRoomPrivate/);
  assert.match(route, /createDailyMeetingToken/);
  assert.match(route, /getLiveJoinDecision/);
  assert.match(route, /checkRateLimit/);
  assert.doesNotMatch(route, /room_url:\s*session\.daily_room_url/);
  assert.match(route, /Cache-Control["']?:\s*["']no-store/);
});

test("admin Daily creation validates course ownership before creating an external room", () => {
  const route = readFileSync("app/api/admin/live/route.ts", "utf8");
  const ownershipCheck = route.indexOf("if (!canManageCourseLiveSessions(");
  const externalRoomCreation = route.indexOf("createDailyRoom(");
  assert.ok(ownershipCheck >= 0, "course ownership must be checked");
  assert.ok(externalRoomCreation > ownershipCheck, "ownership must be proven before the Daily API call");
  assert.match(route, /created_by:\s*auth\.user\.id/);
  assert.match(route, /admin_live_persist_failed[\s\S]*closeDailyRoom\(/);
});

test("legacy Daily hardening restores privacy and server-side time bounds", () => {
  const script = readFileSync("scripts/harden-daily-rooms.ts", "utf8");
  assert.match(script, /select id,daily_room_name,starts_at,ends_at from public\.live_sessions/);
  assert.match(script, /getDailyRoomTimeBounds\(room\.starts_at, room\.ends_at\)/);

  const privacyUpdate = script.indexOf("await ensureDailyRoomPrivate(");
  const timeBoundsUpdate = script.indexOf("await updateDailyRoomTimeBounds(");
  assert.ok(privacyUpdate >= 0, "legacy rooms must be made private");
  assert.ok(timeBoundsUpdate > privacyUpdate, "legacy rooms must receive nbf/exp bounds after privacy hardening");
});

test("the embedded live client requests a token with CSRF-protected POST and suppresses referrers", () => {
  const page = readFileSync("app/direct/[id]/page.tsx", "utf8");
  assert.match(page, /authenticatedFetch\(`\/api\/live\/\$\{id\}`,[\s\S]*method:\s*["']POST["']/);
  assert.match(page, /referrerPolicy="no-referrer"/);
});
