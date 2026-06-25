import test from "node:test";
import assert from "node:assert/strict";
import {
  VISIO_SESSIONS,
  formatVisioDate,
  formatVisioWhen
} from "./live-sessions";

test("the December schedule lists the five announced sessions", () => {
  assert.equal(VISIO_SESSIONS.length, 5);
  assert.deepEqual(
    VISIO_SESSIONS.map(session => session.isoDate),
    ["2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23", "2026-12-30"]
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
  const readings = VISIO_SESSIONS.filter(session => session.kind === "reading");
  assert.deepEqual(
    readings.map(session => session.image),
    [
      "/images/visio-didache.jpg",
      "/images/visio-lettre-a-diognete.jpg",
      "/images/visio-clement-de-rome.jpg"
    ]
  );
});

test("formatVisioDate decomposes an ISO date into French parts", () => {
  assert.deepEqual(formatVisioDate("2026-12-02"), {
    weekday: "mercredi",
    day: 2,
    month: "décembre",
    monthShort: "déc."
  });
});

test("formatVisioDate rejects malformed dates", () => {
  assert.throws(() => formatVisioDate("2026/09/02"), /invalide/);
});

test("formatVisioWhen renders a capitalized, human-readable label", () => {
  assert.equal(
    formatVisioWhen(VISIO_SESSIONS[0]),
    "Mercredi 2 décembre · 20h30"
  );
});
