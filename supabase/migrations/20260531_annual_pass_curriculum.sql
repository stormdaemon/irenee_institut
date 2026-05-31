-- Annual curriculum, educational documents and final examination.

alter table if exists public.paypal_orders alter column course_id drop not null;
alter table if exists public.paypal_orders add column if not exists product_type text not null default 'legacy_course';
alter table if exists public.book_requests alter column course_id drop not null;

create table if not exists public.annual_access_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'paypal',
  provider_order_id text unique,
  amount_total integer not null default 0,
  currency text not null default 'EUR',
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique default ('ISI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  document_key text not null unique,
  document_kind text not null check (document_kind in ('module_parchment', 'course_parchment', 'final_certificate')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  module_id uuid references public.course_modules(id) on delete set null,
  recipient_name text not null,
  course_title text,
  module_title text,
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent')),
  delivery_error text,
  email_provider_id text,
  emailed_at timestamptz,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score integer not null,
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.annual_access_passes enable row level security;
alter table public.learning_documents enable row level security;
alter table public.final_exam_attempts enable row level security;

drop function if exists public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean);
drop function if exists public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text);
drop function if exists public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text);

create or replace function public.validate_paypal_payment(
  p_order_id text,
  p_capture_id text,
  p_user_id uuid,
  p_course_id uuid,
  p_amount_total integer,
  p_currency text,
  p_event_name text default 'paypal_capture_completed',
  p_raw_payload jsonb default '{}'::jsonb,
  p_book_requested boolean default false,
  p_book_title text default '',
  p_product_type text default 'annual_pass'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_profile_id uuid;
  v_event_id text;
  v_product_type text;
begin
  if nullif(btrim(coalesce(p_order_id, '')), '') is null then
    raise exception 'paypal order id is required';
  end if;

  if nullif(btrim(coalesce(p_capture_id, '')), '') is null then
    raise exception 'paypal capture id is required';
  end if;

  if coalesce(p_book_requested, false) and nullif(btrim(coalesce(p_book_title, '')), '') is null then
    raise exception 'book title is required';
  end if;

  select id into v_profile_id from public.profiles where id = p_user_id;
  if v_profile_id is null then
    raise exception 'profile % not found', p_user_id;
  end if;

  v_product_type := case when coalesce(p_product_type, '') = 'legacy_course' then 'legacy_course' else 'annual_pass' end;

  if v_product_type = 'legacy_course' then
    select id into v_course_id from public.courses where id = p_course_id;
    if v_course_id is null then
      raise exception 'course % not found', p_course_id;
    end if;
  end if;

  insert into public.paypal_orders (
    order_id,
    user_id,
    course_id,
    product_type,
    amount_total,
    currency,
    status,
    book_requested,
    book_title,
    book_request_status,
    capture_id,
    raw_capture,
    updated_at
  )
  values (
    p_order_id,
    p_user_id,
    v_course_id,
    v_product_type,
    greatest(coalesce(p_amount_total, 0), 0),
    upper(coalesce(nullif(p_currency, ''), 'EUR')),
    'completed',
    coalesce(p_book_requested, false),
    nullif(btrim(coalesce(p_book_title, '')), ''),
    case when coalesce(p_book_requested, false) then 'en_attente_direction' else 'none' end,
    p_capture_id,
    coalesce(p_raw_payload, '{}'::jsonb),
    now()
  )
  on conflict (order_id) do update set
    amount_total = excluded.amount_total,
    currency = excluded.currency,
    status = 'completed',
    product_type = excluded.product_type,
    book_requested = public.paypal_orders.book_requested or excluded.book_requested,
    book_title = coalesce(excluded.book_title, public.paypal_orders.book_title),
    book_request_status = case
      when public.paypal_orders.book_request_status in ('approuve', 'refuse') then public.paypal_orders.book_request_status
      when public.paypal_orders.book_requested or excluded.book_requested then 'en_attente_direction'
      else 'none'
    end,
    capture_id = excluded.capture_id,
    raw_capture = excluded.raw_capture,
    updated_at = now();

  if v_product_type = 'annual_pass' then
    insert into public.annual_access_passes (
      user_id,
      provider,
      provider_order_id,
      amount_total,
      currency,
      status,
      starts_at,
      expires_at,
      updated_at
    )
    values (
      p_user_id,
      'paypal',
      p_order_id,
      greatest(coalesce(p_amount_total, 0), 0),
      upper(coalesce(nullif(p_currency, ''), 'EUR')),
      'active',
      now(),
      now() + interval '365 days',
      now()
    )
    on conflict (provider_order_id) do update set
      amount_total = excluded.amount_total,
      currency = excluded.currency,
      status = 'active',
      updated_at = now();

    update public.profiles
    set
      statut_inscription = 'validee',
      moyen_paiement = 'paypal',
      modalite_paiement = 'annuel',
      formation_choisie = array['Pass annuel de l''institut d''apologétique saint Irénée'],
      updated_at = now()
    where id = p_user_id;
  else
    insert into public.course_enrollments (course_id, etudiant_id, statut)
    values (v_course_id, p_user_id, 'en_cours')
    on conflict (course_id, etudiant_id) do update set statut = 'en_cours';

    update public.profiles
    set
      statut_inscription = 'validee',
      moyen_paiement = 'paypal',
      modalite_paiement = '1x',
      formation_choisie = array[v_course_id::text],
      updated_at = now()
    where id = p_user_id;

    update public.courses
    set nb_etudiants = (
      select count(*)::integer
      from public.course_enrollments
      where course_id = v_course_id and statut = 'en_cours'
    )
    where id = v_course_id;
  end if;

  v_event_id := coalesce(nullif(p_capture_id, ''), p_order_id);

  insert into public.payment_events (
    provider,
    provider_event_id,
    event_name,
    user_id,
    course_id,
    order_id,
    amount_total,
    currency,
    status,
    raw_payload
  )
  values (
    'paypal',
    v_event_id,
    coalesce(nullif(p_event_name, ''), 'paypal_capture_completed'),
    p_user_id,
    v_course_id,
    p_order_id,
    greatest(coalesce(p_amount_total, 0), 0),
    upper(coalesce(nullif(p_currency, ''), 'EUR')),
    'validated',
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) do update set
    user_id = excluded.user_id,
    course_id = excluded.course_id,
    order_id = excluded.order_id,
    amount_total = excluded.amount_total,
    currency = excluded.currency,
    status = excluded.status,
    raw_payload = excluded.raw_payload;

  if coalesce(p_book_requested, false) then
    insert into public.book_requests (user_id, course_id, paypal_order_id, requested_title, status, updated_at)
    values (p_user_id, v_course_id, p_order_id, nullif(btrim(coalesce(p_book_title, '')), ''), 'en_attente_direction', now())
    on conflict (paypal_order_id) do update set
      user_id = excluded.user_id,
      course_id = excluded.course_id,
      requested_title = coalesce(excluded.requested_title, public.book_requests.requested_title),
      status = case
        when public.book_requests.status in ('approuve', 'refuse') then public.book_requests.status
        else 'en_attente_direction'
      end,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'ok', true,
    'product_type', v_product_type,
    'annual_pass', v_product_type = 'annual_pass',
    'provider', 'paypal',
    'order_id', p_order_id,
    'capture_id', p_capture_id,
    'book_requested', coalesce(p_book_requested, false),
    'book_title', nullif(btrim(coalesce(p_book_title, '')), '')
  );
end;
$$;

grant execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text) to service_role;

