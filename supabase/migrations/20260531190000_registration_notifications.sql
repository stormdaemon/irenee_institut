create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.registration_notification_config (
  key text primary key,
  value text not null
);

revoke all on table private.registration_notification_config from public, anon, authenticated;

insert into private.registration_notification_config (key, value)
values (
  'webhook_secret',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (key) do nothing;

create table if not exists public.registration_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  prenom text not null default '',
  nom text not null default '',
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registration_notification_outbox enable row level security;
revoke all on table public.registration_notification_outbox from anon, authenticated;

create or replace function public.queue_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.registration_notification_outbox (
    user_id,
    email,
    prenom,
    nom
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(metadata ->> 'prenom', metadata ->> 'first_name', ''),
    coalesce(metadata ->> 'nom', metadata ->> 'last_name', '')
  )
  on conflict (user_id) do nothing;

  return new;
end
$$;

revoke execute on function public.queue_registration_notification() from public, anon, authenticated;

drop trigger if exists queue_registration_notification_after_signup on auth.users;
create trigger queue_registration_notification_after_signup
  after insert on auth.users
  for each row
  execute function public.queue_registration_notification();

create or replace function public.dispatch_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select value
  into webhook_secret
  from private.registration_notification_config
  where key = 'webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise warning 'registration_notification_webhook_secret is missing';
    return new;
  end if;

  perform net.http_post(
    url := 'https://dessfamxswtuyzzkcuet.supabase.co/functions/v1/notify-registration',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(new)
    ),
    timeout_milliseconds := 5000
  );

  return new;
end
$$;

revoke execute on function public.dispatch_registration_notification() from public, anon, authenticated;

drop trigger if exists dispatch_registration_notification_after_queue on public.registration_notification_outbox;
create trigger dispatch_registration_notification_after_queue
  after insert on public.registration_notification_outbox
  for each row
  execute function public.dispatch_registration_notification();
