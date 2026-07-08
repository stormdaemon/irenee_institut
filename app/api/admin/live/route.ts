import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { createDailyRoom, getDailyApiKey, slugifyRoomName } from "@/lib/live";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("live_sessions")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, sessions: data || [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const titre = String(body.titre || "").trim();
  const startsAtRaw = String(body.starts_at || "").trim();

  if (!titre) {
    return NextResponse.json({ ok: false, error: "Le titre est requis." }, { status: 400 });
  }
  if (!startsAtRaw || Number.isNaN(Date.parse(startsAtRaw))) {
    return NextResponse.json({ ok: false, error: "La date de début est invalide." }, { status: 400 });
  }

  const description = String(body.description || "").trim();
  const startsAt = new Date(startsAtRaw).toISOString();
  const endsAt = body.ends_at && !Number.isNaN(Date.parse(String(body.ends_at)))
    ? new Date(String(body.ends_at)).toISOString()
    : null;
  const courseId = body.course_id ? String(body.course_id) : null;

  // Create the Daily room server-side using the key stored in system_settings.
  let dailyRoom: { name: string; url: string };
  try {
    const apiKey = await getDailyApiKey(auth.supabase);
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "La clé API Daily n'est pas configurée." }, { status: 400 });
    }
    // Room expires one hour after the session ends (or 5h after start by default).
    const endMs = endsAt ? Date.parse(endsAt) : Date.parse(startsAt) + 4 * 3600 * 1000;
    const expSeconds = Math.floor(endMs / 1000) + 3600;
    const roomName = `${slugifyRoomName(titre)}-${Date.now().toString(36)}`;
    dailyRoom = await createDailyRoom(apiKey, { name: roomName, exp: expSeconds });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "La salle Daily n'a pas pu être créée." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("live_sessions")
    .insert({
      titre,
      description,
      starts_at: startsAt,
      ends_at: endsAt,
      course_id: courseId,
      daily_room_name: dailyRoom.name,
      daily_room_url: dailyRoom.url,
      status: "scheduled"
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, session: data });
}
