import { getPool, query } from "../lib/db";
import {
  ensureDailyRoomPrivate,
  getDailyApiKey,
  getDailyRoomTimeBounds,
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
  for (const room of rooms.rows) {
    const roomName = String(room.daily_room_name || "");
    await ensureDailyRoomPrivate(apiKey, roomName);
    await updateDailyRoomTimeBounds(
      apiKey,
      roomName,
      getDailyRoomTimeBounds(room.starts_at, room.ends_at)
    );
    hardened += 1;
  }
  console.info(`${hardened} salle(s) Daily configurée(s) en mode privé avec une fenêtre temporelle stricte.`);
}

try {
  await main();
} finally {
  await getPool().end();
}
