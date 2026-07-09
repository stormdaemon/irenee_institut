import { getPool, query } from "../lib/db";
import {
  closeDailyRoom,
  ensureDailyRoomPrivate,
  getDailyApiKey,
  getDailyRoomTimeBounds,
  isDailyRoomNotFoundError,
  updateDailyRoomTimeBounds
} from "../lib/live";
import { createServerClient } from "../lib/supabase";

type RoomRow = {
  id: string;
  daily_room_name: string | null;
  starts_at: string;
  ends_at: string | null;
};

async function main() {
  const databaseResult = await query<{ name: string }>("select current_database() as name");
  const databaseName = databaseResult.rows[0]?.name || "";
  const rooms = await query<RoomRow>(
    `select id,daily_room_name,starts_at,ends_at from public.live_sessions
     where status in ('scheduled','live') and nullif(btrim(daily_room_name),'') is not null
     order by starts_at,id`
  );
  console.info(`Base ciblée: ${databaseName}. Salles Daily actives à durcir: ${rooms.rowCount}.`);
  if (!process.argv.includes("--apply")) {
    console.info("Audit en lecture seule terminé. Ajoutez --apply et DAILY_HARDENING_DATABASE pour appliquer.");
    return;
  }

  if (String(process.env.DAILY_HARDENING_DATABASE || "") !== databaseName) {
    throw new Error("DAILY_HARDENING_DATABASE doit correspondre exactement à la base ciblée.");
  }
  const supabase = createServerClient();
  if (!supabase) throw new Error("Le client serveur est indisponible.");
  const apiKey = await getDailyApiKey(supabase);
  if (!apiKey) throw new Error("La clé Daily côté serveur n'est pas configurée.");

  let hardened = 0;
  let reconciled = 0;
  for (const room of rooms.rows) {
    const roomName = String(room.daily_room_name || "");
    const bounds = getDailyRoomTimeBounds(room.starts_at, room.ends_at);
    if (bounds.exp <= Math.floor(Date.now() / 1000)) {
      try {
        await closeDailyRoom(apiKey, roomName, Math.floor(Date.now() / 1000) + 10);
      } catch (error) {
        if (!isDailyRoomNotFoundError(error)) throw error;
      }
      await query(
        `update public.live_sessions set status='ended',updated_at=now()
         where id=$1 and status in ('scheduled','live')`,
        [room.id]
      );
      reconciled += 1;
      continue;
    }
    await ensureDailyRoomPrivate(apiKey, roomName);
    await updateDailyRoomTimeBounds(apiKey, roomName, bounds);
    hardened += 1;
  }
  console.info(`${hardened} salle(s) Daily configurée(s) en mode privé avec une fenêtre temporelle stricte.`);
  console.info(`${reconciled} séance(s) Daily expirée(s) fermée(s) ou réconciliée(s).`);
}

try {
  await main();
} finally {
  await getPool().end();
}
