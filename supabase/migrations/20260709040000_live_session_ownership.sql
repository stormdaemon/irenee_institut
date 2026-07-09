-- Attribute Daily sessions to their creator. Legacy sessions are backfilled from
-- their course author when possible; null remains director-only and therefore
-- fails closed for trainers.

alter table public.live_sessions
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

update public.live_sessions as session
set created_by = course.auteur_id
from public.courses as course
where session.created_by is null
  and session.course_id = course.id
  and course.auteur_id is not null;

create index if not exists live_sessions_created_by_starts_at_idx
  on public.live_sessions (created_by, starts_at desc);
