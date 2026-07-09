-- Security primitives used by the local PostgreSQL authentication layer.

create table if not exists public.app_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  constraint app_sessions_expiry_check check (expires_at > created_at),
  constraint app_sessions_token_hash_check check (length(token_hash) = 64)
);

create index if not exists app_sessions_user_active_idx
  on public.app_sessions (user_id, expires_at desc)
  where revoked_at is null;

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint email_verification_expiry_check check (expires_at > created_at),
  constraint email_verification_token_hash_check check (length(token_hash) = 64)
);

create index if not exists email_verification_user_active_idx
  on public.email_verification_tokens (user_id, expires_at desc)
  where consumed_at is null;

create table if not exists public.security_rate_limits (
  key_hash text primary key,
  request_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint security_rate_limits_count_check check (request_count >= 0),
  constraint security_rate_limits_key_hash_check check (length(key_hash) = 64)
);

create index if not exists security_rate_limits_reset_idx on public.security_rate_limits (reset_at);

create table if not exists public.security_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_audit_event_type_check check (event_type ~ '^[a-z0-9_.-]{3,80}$'),
  constraint security_audit_metadata_size_check check (octet_length(metadata::text) <= 8192)
);

create index if not exists security_audit_events_created_idx on public.security_audit_events (created_at desc);
create index if not exists security_audit_events_actor_idx on public.security_audit_events (actor_user_id, created_at desc);

alter table public.app_sessions enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.security_rate_limits enable row level security;
alter table public.security_audit_events enable row level security;

revoke all on public.app_sessions from public, anon, authenticated;
revoke all on public.email_verification_tokens from public, anon, authenticated;
revoke all on public.security_rate_limits from public, anon, authenticated;
revoke all on public.security_audit_events from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'irenee_app') then
    grant select, insert, update, delete on public.app_sessions to irenee_app;
    grant select, insert, update, delete on public.email_verification_tokens to irenee_app;
    grant select, insert, update, delete on public.security_rate_limits to irenee_app;
    grant select, insert on public.security_audit_events to irenee_app;
    grant usage, select on sequence public.security_audit_events_id_seq to irenee_app;
  end if;
end $$;

alter table public.courses drop constraint if exists courses_statut_check;
alter table public.courses add constraint courses_statut_check
  check (statut = any (array['brouillon'::text, 'en_preparation'::text, 'publie'::text, 'archive'::text]));

alter table public.course_modules drop constraint if exists course_modules_type_contenu_check;
alter table public.course_modules add constraint course_modules_type_contenu_check
  check (type_contenu = any (array['texte'::text, 'video'::text, 'quiz'::text]));

alter table public.final_exam_attempts drop constraint if exists final_exam_attempts_score_check;
alter table public.final_exam_attempts add constraint final_exam_attempts_score_check check (score between 0 and 100);
create index if not exists final_exam_attempts_user_created_idx
  on public.final_exam_attempts (user_id, created_at desc);

alter table public.paypal_orders drop constraint if exists paypal_orders_amount_positive_check;
alter table public.paypal_orders add constraint paypal_orders_amount_positive_check check (amount_total > 0);
alter table public.paypal_orders drop constraint if exists paypal_orders_currency_check;
alter table public.paypal_orders add constraint paypal_orders_currency_check check (currency ~ '^[A-Z]{3}$');
