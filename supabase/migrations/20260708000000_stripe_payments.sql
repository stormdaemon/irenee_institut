-- Provider-neutral payment validation for Stripe checkout while preserving the PayPal RPC.

alter table if exists public.paypal_orders
  add column if not exists provider text not null default 'paypal';

do $$
begin
  alter table public.paypal_orders
    add constraint paypal_orders_provider_check check (provider in ('paypal', 'stripe'));
exception
  when duplicate_object then null;
end;
$$;

create index if not exists paypal_orders_provider_order_id_idx
  on public.paypal_orders (provider, order_id);

create or replace function public.validate_payment(
  p_provider text,
  p_order_id text,
  p_capture_id text,
  p_user_id uuid,
  p_course_id uuid,
  p_amount_total integer,
  p_currency text,
  p_event_name text default 'payment_completed',
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
  v_event_id text;
  v_product_type text;
  v_profile_id uuid;
  v_provider text;
begin
  v_provider := lower(nullif(btrim(coalesce(p_provider, '')), ''));
  if v_provider not in ('paypal', 'stripe') then
    raise exception 'payment provider is required';
  end if;

  if nullif(btrim(coalesce(p_order_id, '')), '') is null then
    raise exception 'payment order id is required';
  end if;

  if nullif(btrim(coalesce(p_capture_id, '')), '') is null then
    raise exception 'payment capture id is required';
  end if;

  if coalesce(p_book_requested, false) and nullif(btrim(coalesce(p_book_title, '')), '') is null then
    raise exception 'book title is required';
  end if;

  select id into v_profile_id from public.profiles where id = p_user_id;
  if v_profile_id is null then
    raise exception 'profile % not found', p_user_id;
  end if;

  v_product_type := case
    when coalesce(p_product_type, '') = 'legacy_course' then 'legacy_course'
    when coalesce(p_product_type, '') = 'library_membership' then 'library_membership'
    else 'annual_pass'
  end;

  if v_product_type = 'legacy_course' then
    select id into v_course_id from public.courses where id = p_course_id;
    if v_course_id is null then
      raise exception 'course % not found', p_course_id;
    end if;
  end if;

  if v_product_type = 'library_membership' and coalesce(p_amount_total, 0) <> 1500 then
    raise exception 'library membership amount must be exactly 1500 cents';
  end if;

  insert into public.paypal_orders (
    provider,
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
    v_provider,
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
    provider = excluded.provider,
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
      v_provider,
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
      provider = excluded.provider,
      updated_at = now();

    update public.profiles
    set
      statut_inscription = 'validee',
      moyen_paiement = v_provider,
      modalite_paiement = 'annuel',
      formation_choisie = array['Pass annuel de l''institut d''apologetique saint Irenee'],
      updated_at = now()
    where id = p_user_id;
  elsif v_product_type = 'library_membership' then
    insert into public.library_memberships (
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
      v_provider,
      p_order_id,
      1500,
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
      provider = excluded.provider,
      updated_at = now();
  else
    insert into public.course_enrollments (course_id, etudiant_id, statut)
    values (v_course_id, p_user_id, 'en_cours')
    on conflict (course_id, etudiant_id) do update set statut = 'en_cours';

    update public.profiles
    set
      statut_inscription = 'validee',
      moyen_paiement = v_provider,
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
    v_provider,
    v_event_id,
    coalesce(nullif(p_event_name, ''), v_provider || '_payment_completed'),
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
    'library_membership', v_product_type = 'library_membership',
    'provider', v_provider,
    'order_id', p_order_id,
    'capture_id', p_capture_id,
    'book_requested', coalesce(p_book_requested, false),
    'book_title', nullif(btrim(coalesce(p_book_title, '')), '')
  );
end;
$$;

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
language sql
security definer
set search_path = public
as $$
  select public.validate_payment(
    'paypal',
    p_order_id,
    p_capture_id,
    p_user_id,
    p_course_id,
    p_amount_total,
    p_currency,
    p_event_name,
    p_raw_payload,
    p_book_requested,
    p_book_title,
    p_product_type
  );
$$;

revoke execute on function public.validate_payment(text, text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.validate_payment(text, text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text)
  to service_role;

revoke execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text)
  to service_role;
