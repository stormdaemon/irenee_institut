import { query } from "./db";
import type { VisioSession } from "./live-sessions";

type AgendaRow = { id: string; titre: string; description: string | null; starts_at: string | Date; status: string; course_id: string | null };
async function readConfirmedSessions(): Promise<AgendaRow[]> {
  const result = await query<AgendaRow>(`select id, titre, description, starts_at, status, course_id from public.live_sessions
    where course_id is null and status in ('scheduled','live') and starts_at > now() order by starts_at asc limit 8`);
  return result.rows;
}
export async function getPublicAgenda(read: () => Promise<AgendaRow[]> = readConfirmedSessions, now = Date.now()): Promise<{ sessions: VisioSession[]; unavailable: boolean }> {
  try {
    const rows = await read();
    const sessions = rows.filter(row => !row.course_id && ["scheduled", "live"].includes(row.status) && new Date(row.starts_at).getTime() > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).map(row => {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(row.starts_at));
        const part = (type: string) => parts.find(p => p.type === type)?.value || "";
        return { liveSessionId: row.id, isoDate: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}h${part("minute")}`, title: row.titre, description: row.description || "", image: "/images/apostolos/manuscrits.png", imageAlt: "Manuscrit enluminé dans un scriptorium", imagePosition: "center", kind: "reading" as const };
      });
    return { sessions, unavailable: false };
  } catch {
    return { sessions: [], unavailable: true };
  }
}
