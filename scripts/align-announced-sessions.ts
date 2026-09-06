import { getPool, query } from "../lib/db";
import { getVisioSessionWindow, VISIO_SESSIONS } from "../lib/live-sessions";
import { getDailyApiKey, getDailyRoomTimeBounds, updateDailyRoomTimeBounds } from "../lib/live";
import { createServerClient } from "../lib/supabase";

const apply = process.argv.includes("--apply");
const targetDates = new Set(["2026-10-28", "2026-11-04"]);
try {
  const database = await query("select current_database() as name");
  if (database.rows[0].name !== "irenee_staging") throw new Error("Unexpected database; refusing schedule correction.");
  const client = createServerClient();
  if (!client) throw new Error("Database unavailable.");
  for (const announced of VISIO_SESSIONS.filter(item => targetDates.has(item.isoDate))) {
    const result = await query("select id,starts_at,ends_at,daily_room_name,status from live_sessions where id=$1", [announced.liveSessionId]);
    const session = result.rows[0];
    if (!session || session.status !== "scheduled") throw new Error("Unexpected session state.");
    const window = getVisioSessionWindow(announced);
    const startsAt = new Date(window.startsAt).toISOString();
    const endsAt = new Date(window.endsAt).toISOString();
    if (new Date(session.starts_at).getTime() === window.startsAt && new Date(session.ends_at).getTime() === window.endsAt) continue;
    if (new Date(session.starts_at).getTime() !== window.startsAt - 3600000 || new Date(session.ends_at).getTime() !== window.endsAt - 3600000) {
      throw new Error("The session was edited since the audit; refusing to overwrite it.");
    }
    console.log(JSON.stringify({ date: announced.isoDate, startsAt, endsAt, apply }));
    if (!apply) continue;
    const key = session.daily_room_name ? await getDailyApiKey(client) : "";
    if (session.daily_room_name) {
      await updateDailyRoomTimeBounds(key, session.daily_room_name, getDailyRoomTimeBounds(startsAt, endsAt));
    }
    try {
      const updated = await query(`update live_sessions set starts_at=$2,ends_at=$3,updated_at=now()
        where id=$1 and starts_at=$4 and ends_at=$5 and status='scheduled' returning id`,
      [session.id, startsAt, endsAt, session.starts_at, session.ends_at]);
      if (updated.rowCount !== 1) throw new Error("Concurrent session change.");
    } catch (error) {
      if (session.daily_room_name) await updateDailyRoomTimeBounds(key, session.daily_room_name,
        getDailyRoomTimeBounds(new Date(session.starts_at).toISOString(), new Date(session.ends_at).toISOString()));
      throw error;
    }
  }
} finally {
  await getPool().end();
}
