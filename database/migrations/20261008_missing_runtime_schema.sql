alter table public.homework add column if not exists auteur_id uuid references public.profiles(id) on delete set null;
alter table public.homework add column if not exists auteur_nom text;

create table if not exists public.registration_notification_outbox (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
create table if not exists public.marketing_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  campaign_key text not null,
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (profile_id,campaign_key)
);
revoke all on public.registration_notification_outbox, public.marketing_campaign_deliveries from public;
grant select,insert,update,delete on public.registration_notification_outbox, public.marketing_campaign_deliveries to irenee_app;
