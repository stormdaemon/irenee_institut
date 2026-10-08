import { expect, test } from "bun:test";
import { getPublicAgenda } from "./public-agenda";

test("public agenda only exposes confirmed, upcoming, unrestricted sessions", async () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const row = { id: "confirmed-session", titre: "Étudier ensemble", description: "Lecture partagée", starts_at: "2026-10-14T18:30:00Z", status: "scheduled", course_id: null };
  const result = await getPublicAgenda(async () => [row, { ...row, id: "private", course_id: "restricted-course" }, { ...row, id: "cancelled", status: "cancelled" }, { ...row, id: "past", starts_at: "2026-10-01T18:30:00Z" }], now);
  expect(result.unavailable).toBe(false);
  expect(result.sessions.map(s => s.liveSessionId)).toEqual(["confirmed-session"]);
  expect(result.sessions[0]).toMatchObject({ isoDate: "2026-10-14", time: "20h30", title: "Étudier ensemble" });
});
test("empty or unavailable database never republishes the historical editorial schedule", async () => {
  expect((await getPublicAgenda(async () => [])).sessions).toEqual([]);
  expect(await getPublicAgenda(async () => { throw Error("unavailable"); })).toEqual({ sessions: [], unavailable: true });
});
