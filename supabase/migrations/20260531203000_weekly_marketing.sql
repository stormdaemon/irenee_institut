create extension if not exists pg_cron with schema pg_catalog;

alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists marketing_opt_in_at timestamptz;
alter table public.profiles add column if not exists marketing_opt_out_at timestamptz;
alter table public.profiles add column if not exists marketing_unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_marketing_unsubscribe_token_idx
  on public.profiles (marketing_unsubscribe_token);

create table if not exists public.marketing_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  campaign_key text not null,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, campaign_key)
);

alter table public.marketing_campaign_deliveries enable row level security;
revoke all on table public.marketing_campaign_deliveries from anon, authenticated;

create or replace function private.dispatch_weekly_marketing_campaign()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
  request_id bigint;
begin
  select value
  into webhook_secret
  from private.registration_notification_config
  where key = 'webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise exception 'registration notification webhook secret is missing';
  end if;

  select net.http_post(
    url := 'https://dessfamxswtuyzzkcuet.supabase.co/functions/v1/send-weekly-marketing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 5000
  )
  into request_id;

  return request_id;
end
$$;

revoke execute on function private.dispatch_weekly_marketing_campaign() from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'send-weekly-marketing-campaign';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'send-weekly-marketing-campaign',
    '0 8 * * *',
    'select private.dispatch_weekly_marketing_campaign();'
  );
end
$$;
