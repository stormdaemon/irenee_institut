-- One-time password reset credentials. Only the SHA-256 digest is persisted;
-- plaintext credentials exist solely long enough to be delivered by email.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint password_reset_expiry_check check (expires_at > created_at),
  constraint password_reset_token_hash_check check (length(token_hash) = 64)
);

create index if not exists password_reset_user_active_idx
  on public.password_reset_tokens (user_id, expires_at desc)
  where consumed_at is null;

create index if not exists password_reset_expiry_idx
  on public.password_reset_tokens (expires_at)
  where consumed_at is null;

alter table public.password_reset_tokens enable row level security;
revoke all on public.password_reset_tokens from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'irenee_app') then
    grant select, insert, update, delete on public.password_reset_tokens to irenee_app;
  end if;
  if exists (select 1 from pg_roles where rolname = 'irenee_runtime') then
    grant select, insert, update, delete on public.password_reset_tokens to irenee_runtime;
    drop policy if exists irenee_runtime_backend_access on public.password_reset_tokens;
    create policy irenee_runtime_backend_access
      on public.password_reset_tokens for all to irenee_runtime
      using (true) with check (true);
  end if;
end $$;
