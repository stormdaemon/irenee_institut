import test from "node:test";
import assert from "node:assert/strict";
import {
  VISIO_SESSIONS,
  formatVisioDate,
  formatVisioWhen,
  getUpcomingVisioSessions,
  getVisioSessionWindow
} from "./live-sessions";

test("the September schedule lists the five announced sessions", () => {
  assert.deepEqual(
    VISIO_SESSIONS.filter(session => session.isoDate.startsWith("2026-09")).map(session => session.isoDate),
    ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"]
  );
});

test("every session is a Wednesday at 20h30", () => {
  for (const session of VISIO_SESSIONS) {
    assert.equal(session.time, "20h30");
    assert.equal(formatVisioDate(session.isoDate).weekday, "mercredi");
  }
});

test("every session exposes an image and a non-empty alt text", () => {
  for (const session of VISIO_SESSIONS) {
    assert.ok(session.image.length > 0, `image manquante pour ${session.isoDate}`);
    assert.ok(session.imageAlt.trim().length > 0, `alt manquant pour ${session.isoDate}`);
  }
});

test("the three patristic readings expect dedicated static illustrations", () => {
  const readings = VISIO_SESSIONS.filter(session => session.kind === "reading" && session.isoDate.startsWith("2026-09"));
  assert.deepEqual(
    readings.map(session => session.image),
    [
      "/images/visio-didache.jpg",
      "/images/visio-lettre-a-diognete.jpg",
      "/images/visio-clement-de-rome.jpg"
    ]
  );
});

test("the agenda advances after a session ends and handles an exhausted schedule", () => {
  assert.equal(getUpcomingVisioSessions(Date.parse("2026-09-06T12:00:00Z"))[0].isoDate, "2026-09-09");
  assert.equal(getUpcomingVisioSessions(Date.parse("2026-09-09T19:59:59Z"))[0].isoDate, "2026-09-09");
  assert.equal(getUpcomingVisioSessions(Date.parse("2026-09-09T20:00:00Z"))[0].isoDate, "2026-09-16");
  assert.deepEqual(getUpcomingVisioSessions(Date.parse("2027-01-01T00:00:00Z")), []);
});

test("20h30 Paris stays at 20h30 after the October clock change", () => {
  const summer = getVisioSessionWindow(VISIO_SESSIONS.find(session => session.isoDate === "2026-10-21")!);
  const winter = getVisioSessionWindow(VISIO_SESSIONS.find(session => session.isoDate === "2026-10-28")!);
  assert.equal(new Date(summer.startsAt).toISOString(), "2026-10-21T18:30:00.000Z");
  assert.equal(new Date(winter.startsAt).toISOString(), "2026-10-28T19:30:00.000Z");
});

test("formatVisioDate decomposes an ISO date into French parts", () => {
  assert.deepEqual(formatVisioDate("2026-09-02"), {
    weekday: "mercredi",
    day: 2,
    month: "septembre",
    monthShort: "sept."
  });
});

test("formatVisioDate rejects malformed dates", () => {
  assert.throws(() => formatVisioDate("2026/09/02"), /invalide/);
});

test("formatVisioWhen renders a capitalized, human-readable label", () => {
  assert.equal(
    formatVisioWhen(VISIO_SESSIONS[0]),
    "Mercredi 2 septembre · 20h30"
  );
});
