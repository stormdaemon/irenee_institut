-- Live sessions (Daily.co) for the weekly online classes embedded in the site.

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  course_id uuid references public.courses(id) on delete set null,
  daily_room_name text,
  daily_room_url text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the server (service role) reads/writes live sessions; students and the
-- admin UI go through the server-side API routes, never directly. RLS is enabled
-- with no policies, mirroring public.library_memberships.
alter table public.live_sessions enable row level security;

create index if not exists live_sessions_starts_at_idx
  on public.live_sessions (starts_at desc);

create index if not exists live_sessions_status_starts_at_idx
  on public.live_sessions (status, starts_at);
