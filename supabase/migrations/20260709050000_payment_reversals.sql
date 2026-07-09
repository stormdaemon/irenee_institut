-- Privacy-preserving, idempotent payment validation and reversal processing.
-- Provider payloads are intentionally never retained: only bounded identifiers,
-- amounts, currencies and transition statuses are stored.

update public.paypal_orders
set raw_order = null, raw_capture = null
where raw_order is not null or raw_capture is not null;

update public.payment_events
set raw_payload = null
where provider in ('paypal', 'stripe') and raw_payload is not null;

alter table public.paypal_orders
  drop constraint if exists paypal_orders_no_raw_provider_payload_check;
alter table public.paypal_orders
  add constraint paypal_orders_no_raw_provider_payload_check
  check (raw_order is null and raw_capture is null);

alter table public.payment_events
  drop constraint if exists payment_events_no_raw_provider_payload_check;
alter table public.payment_events
  add constraint payment_events_no_raw_provider_payload_check
  check (provider not in ('paypal', 'stripe') or raw_payload is null);

alter table public.course_enrollments
  add column if not exists payment_order_id text references public.paypal_orders(order_id) on delete set null;

alter table public.course_enrollments
  drop constraint if exists course_enrollments_access_source_check;
alter table public.course_enrollments
  add constraint course_enrollments_access_source_check
  check (access_source in ('legacy', 'annual_pass', 'payment'));

alter table public.course_enrollments
  drop constraint if exists course_enrollments_access_expiry_check;
alter table public.course_enrollments
  add constraint course_enrollments_access_expiry_check
  check (
    (access_source = 'annual_pass' and access_expires_at is not null and payment_order_id is null)
    or (access_source = 'payment' and access_expires_at is null and payment_order_id is not null)
    or (access_source = 'legacy' and access_expires_at is null and payment_order_id is null)
  );

-- Historical one-off course purchases predate payment_order_id. Link the most
-- recent still-valid purchase so a later refund or dispute revokes precisely
-- that paid entitlement instead of leaving permanent access behind.
with ranked_paid_orders as (
  select
    orders.order_id,
    orders.user_id,
    orders.course_id,
    orders.updated_at as order_updated_at,
    row_number() over (
      partition by orders.user_id, orders.course_id
      order by orders.updated_at desc, orders.created_at desc, orders.order_id desc
    ) as purchase_rank
  from public.paypal_orders orders
  where orders.product_type = 'legacy_course'
    and orders.status in ('completed', 'partially_refunded')
    and orders.course_id is not null
)
update public.course_enrollments enrollment
set
  access_source = 'payment',
  access_expires_at = null,
  payment_order_id = purchase.order_id,
  updated_at = now()
from ranked_paid_orders purchase
where purchase.purchase_rank = 1
  and enrollment.etudiant_id = purchase.user_id
  and enrollment.course_id = purchase.course_id
  and enrollment.statut = 'en_cours'
  and enrollment.access_source = 'legacy'
  and enrollment.payment_order_id is null
  -- The former checkout RPC inserted the enrollment when the pending order was
  -- captured. A manual entitlement predating the order remains durable.
  and enrollment.created_at >= purchase.order_updated_at - interval '5 minutes'
  and enrollment.created_at <= purchase.order_updated_at + interval '5 minutes';

create index if not exists course_enrollments_payment_order_idx
  on public.course_enrollments (payment_order_id)
  where payment_order_id is not null;

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paypal', 'stripe')),
  provider_refund_id text not null,
  provider_event_id text not null,
  order_id text not null references public.paypal_orders(order_id) on delete cascade,
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_refund_id),
  unique (provider, provider_event_id)
);

create index if not exists payment_refunds_order_idx
  on public.payment_refunds (provider, order_id);

alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;

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
  v_existing_order public.paypal_orders%rowtype;
  v_product_type text;
  v_profile_id uuid;
  v_provider text;
  v_was_completed boolean := false;
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
  if v_profile_id is null then raise exception 'profile % not found', p_user_id; end if;

  v_product_type := case
    when coalesce(p_product_type, '') = 'legacy_course' then 'legacy_course'
    when coalesce(p_product_type, '') = 'library_membership' then 'library_membership'
    else 'annual_pass'
  end;

  if v_product_type = 'legacy_course' then
    select id into v_course_id from public.courses where id = p_course_id;
    if v_course_id is null then raise exception 'course % not found', p_course_id; end if;
  end if;
  if v_product_type = 'library_membership' and coalesce(p_amount_total, 0) <> 1500 then
    raise exception 'library membership amount must be exactly 1500 cents';
  end if;

  select * into v_existing_order
  from public.paypal_orders
  where order_id = p_order_id
  for update;

  if v_existing_order.id is not null then
    v_was_completed := v_existing_order.status in ('completed', 'partially_refunded');
    if v_existing_order.status in ('refunded', 'reversed', 'denied', 'disputed') then
      raise exception 'payment order has been reversed';
    end if;
    if v_existing_order.provider <> v_provider
      or v_existing_order.user_id <> p_user_id
      or v_existing_order.product_type <> v_product_type
      or v_existing_order.amount_total <> p_amount_total
      or upper(v_existing_order.currency) <> upper(p_currency)
      or (v_product_type = 'legacy_course' and v_existing_order.course_id is distinct from v_course_id)
    then
      raise exception 'payment order does not match the server record';
    end if;
  end if;

  insert into public.paypal_orders (
    provider, order_id, user_id, course_id, product_type, amount_total, currency,
    status, book_requested, book_title, book_request_status, capture_id,
    raw_order, raw_capture, updated_at
  ) values (
    v_provider, p_order_id, p_user_id, v_course_id, v_product_type,
    greatest(coalesce(p_amount_total, 0), 0), upper(coalesce(nullif(p_currency, ''), 'EUR')),
    'completed', coalesce(p_book_requested, false), nullif(btrim(coalesce(p_book_title, '')), ''),
    case when coalesce(p_book_requested, false) then 'en_attente_direction' else 'none' end,
    p_capture_id, null, null, now()
  )
  on conflict (order_id) do update set
    status = case
      when public.paypal_orders.status = 'partially_refunded' then 'partially_refunded'
      else 'completed'
    end,
    book_requested = public.paypal_orders.book_requested or excluded.book_requested,
    book_title = coalesce(excluded.book_title, public.paypal_orders.book_title),
    book_request_status = case
      when public.paypal_orders.book_request_status in ('approuve', 'refuse') then public.paypal_orders.book_request_status
      when public.paypal_orders.book_requested or excluded.book_requested then 'en_attente_direction'
      else 'none'
    end,
    capture_id = excluded.capture_id,
    raw_order = null,
    raw_capture = null,
    updated_at = now();

  if v_product_type = 'annual_pass' then
    insert into public.annual_access_passes (
      user_id, provider, provider_order_id, amount_total, currency, status,
      starts_at, expires_at, updated_at
    ) values (
      p_user_id, v_provider, p_order_id, greatest(coalesce(p_amount_total, 0), 0),
      upper(coalesce(nullif(p_currency, ''), 'EUR')), 'active', now(), now() + interval '365 days', now()
    )
    on conflict (provider_order_id) do update set
      amount_total = excluded.amount_total,
      currency = excluded.currency,
      status = 'active',
      provider = excluded.provider,
      updated_at = now();

    update public.profiles set
      statut_inscription = 'validee', moyen_paiement = v_provider,
      modalite_paiement = 'annuel',
      formation_choisie = array['Pass annuel de l''institut d''apologetique saint Irenee'],
      updated_at = now()
    where id = p_user_id;
  elsif v_product_type = 'library_membership' then
    insert into public.library_memberships (
      user_id, provider, provider_order_id, amount_total, currency, status,
      starts_at, expires_at, updated_at
    ) values (
      p_user_id, v_provider, p_order_id, 1500,
      upper(coalesce(nullif(p_currency, ''), 'EUR')), 'active', now(), now() + interval '365 days', now()
    )
    on conflict (provider_order_id) do update set
      amount_total = excluded.amount_total,
      currency = excluded.currency,
      status = 'active',
      provider = excluded.provider,
      updated_at = now();
  else
    insert into public.course_enrollments (
      course_id, etudiant_id, statut, access_source, access_expires_at, payment_order_id
    ) values (
      v_course_id, p_user_id, 'en_cours', 'payment', null, p_order_id
    )
    on conflict (course_id, etudiant_id) do update set
      statut = 'en_cours',
      access_source = case
        when public.course_enrollments.access_source = 'legacy'
          and public.course_enrollments.statut <> 'abandonne' then 'legacy'
        else 'payment'
      end,
      access_expires_at = null::timestamptz,
      payment_order_id = case
        when public.course_enrollments.access_source = 'legacy'
          and public.course_enrollments.statut <> 'abandonne' then null::text
        when public.course_enrollments.access_source = 'payment'
          and exists (
            select 1 from public.paypal_orders current_order
            where current_order.order_id = public.course_enrollments.payment_order_id
              and current_order.status in ('completed', 'partially_refunded')
          ) then public.course_enrollments.payment_order_id
        else excluded.payment_order_id
      end,
      updated_at = now();

    update public.profiles set
      statut_inscription = 'validee', moyen_paiement = v_provider,
      modalite_paiement = '1x', formation_choisie = array[v_course_id::text], updated_at = now()
    where id = p_user_id;

    update public.courses set nb_etudiants = (
      select count(*)::integer from public.course_enrollments
      where course_id = v_course_id and statut = 'en_cours'
    ) where id = v_course_id;
  end if;

  v_event_id := coalesce(nullif(p_capture_id, ''), p_order_id);
  insert into public.payment_events (
    provider, provider_event_id, event_name, user_id, course_id, order_id,
    amount_total, currency, status, raw_payload
  ) values (
    v_provider, v_event_id, coalesce(nullif(p_event_name, ''), v_provider || '_payment_completed'),
    p_user_id, v_course_id, p_order_id, greatest(coalesce(p_amount_total, 0), 0),
    upper(coalesce(nullif(p_currency, ''), 'EUR')), 'validated', null
  )
  on conflict (provider, provider_event_id) do update set
    user_id = excluded.user_id, course_id = excluded.course_id, order_id = excluded.order_id,
    amount_total = excluded.amount_total, currency = excluded.currency,
    status = excluded.status, raw_payload = null;

  if not v_was_completed then
    insert into public.security_audit_events (event_type, metadata)
    values ('payment.webhook.validated', jsonb_build_object(
      'provider', v_provider, 'product_type', v_product_type, 'status', 'validated'
    ));
  end if;

  if coalesce(p_book_requested, false) then
    insert into public.book_requests (user_id, course_id, paypal_order_id, requested_title, status, updated_at)
    values (p_user_id, v_course_id, p_order_id, nullif(btrim(coalesce(p_book_title, '')), ''), 'en_attente_direction', now())
    on conflict (paypal_order_id) do update set
      user_id = excluded.user_id,
      course_id = excluded.course_id,
      requested_title = coalesce(excluded.requested_title, public.book_requests.requested_title),
      status = case when public.book_requests.status in ('approuve', 'refuse') then public.book_requests.status else 'en_attente_direction' end,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'ok', true, 'product_type', v_product_type,
    'annual_pass', v_product_type = 'annual_pass',
    'library_membership', v_product_type = 'library_membership',
    'provider', v_provider, 'order_id', p_order_id, 'capture_id', p_capture_id,
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
    'paypal', p_order_id, p_capture_id, p_user_id, p_course_id, p_amount_total,
    p_currency, p_event_name, null, p_book_requested, p_book_title, p_product_type
  );
$$;

create or replace function public.process_payment_reversal(
  p_provider text,
  p_provider_event_id text,
  p_event_name text,
  p_kind text,
  p_object_id text,
  p_order_id text default '',
  p_capture_id text default '',
  p_amount_total integer default 0,
  p_currency text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_pass public.annual_access_passes%rowtype;
  v_event_status text;
  v_order public.paypal_orders%rowtype;
  v_other_order_id text;
  v_refunded_total bigint := 0;
  v_revoked boolean := false;
begin
  p_provider := lower(btrim(coalesce(p_provider, '')));
  p_kind := lower(btrim(coalesce(p_kind, '')));
  p_provider_event_id := btrim(coalesce(p_provider_event_id, ''));
  p_object_id := btrim(coalesce(p_object_id, ''));
  if p_provider not in ('paypal', 'stripe') then raise exception 'invalid payment provider'; end if;
  if p_kind not in ('refunded', 'reversed', 'denied', 'disputed') then raise exception 'invalid reversal kind'; end if;
  if p_provider_event_id = '' or length(p_provider_event_id) > 255 then raise exception 'invalid provider event id'; end if;
  if p_object_id = '' or length(p_object_id) > 255 then raise exception 'invalid provider object id'; end if;

  -- Serialize duplicate deliveries before checking the idempotency marker.
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_event_id, 0));

  select status into v_event_status
  from public.payment_events
  where provider = p_provider and provider_event_id = p_provider_event_id
  for update;
  if v_event_status in ('partial_refund', 'revoked') then
    return jsonb_build_object('ok', true, 'already_processed', true, 'revoked', v_event_status = 'revoked');
  end if;

  select candidate.* into v_order
  from public.paypal_orders candidate
  where candidate.provider = p_provider
    and (
      (nullif(btrim(coalesce(p_order_id, '')), '') is not null and candidate.order_id = btrim(p_order_id))
      or (nullif(btrim(coalesce(p_capture_id, '')), '') is not null and candidate.capture_id = btrim(p_capture_id))
    )
  order by (candidate.order_id = btrim(coalesce(p_order_id, ''))) desc
  limit 1
  for update;

  if v_order.id is null then
    insert into public.payment_events (
      provider, provider_event_id, event_name, order_id, amount_total, currency, status, raw_payload
    ) values (
      p_provider, p_provider_event_id, left(coalesce(nullif(p_event_name, ''), p_kind), 200),
      nullif(btrim(coalesce(p_order_id, '')), ''), nullif(greatest(coalesce(p_amount_total, 0), 0), 0),
      nullif(upper(btrim(coalesce(p_currency, ''))), ''), 'order_not_found', null
    ) on conflict (provider, provider_event_id) do update set
      event_name = excluded.event_name, status = 'order_not_found', raw_payload = null;
    return jsonb_build_object('ok', false, 'reason', 'order_not_found', 'revoked', false);
  end if;

  if nullif(btrim(coalesce(p_capture_id, '')), '') is not null
    and nullif(btrim(coalesce(v_order.capture_id, '')), '') is not null
    and btrim(p_capture_id) <> btrim(v_order.capture_id)
  then
    insert into public.payment_events (
      provider, provider_event_id, event_name, user_id, course_id, order_id,
      amount_total, currency, status, raw_payload
    ) values (
      p_provider, p_provider_event_id, left(coalesce(nullif(p_event_name, ''), p_kind), 200),
      v_order.user_id, v_order.course_id, v_order.order_id,
      nullif(greatest(coalesce(p_amount_total, 0), 0), 0), nullif(upper(btrim(coalesce(p_currency, ''))), ''),
      'capture_mismatch', null
    ) on conflict (provider, provider_event_id) do update set status = 'capture_mismatch', raw_payload = null;
    return jsonb_build_object('ok', false, 'reason', 'capture_mismatch', 'revoked', false);
  end if;

  if nullif(btrim(coalesce(p_currency, '')), '') is not null
    and upper(btrim(p_currency)) <> upper(v_order.currency)
  then
    insert into public.payment_events (
      provider, provider_event_id, event_name, user_id, course_id, order_id,
      amount_total, currency, status, raw_payload
    ) values (
      p_provider, p_provider_event_id, left(coalesce(nullif(p_event_name, ''), p_kind), 200),
      v_order.user_id, v_order.course_id, v_order.order_id,
      nullif(greatest(coalesce(p_amount_total, 0), 0), 0), upper(btrim(p_currency)), 'currency_mismatch', null
    ) on conflict (provider, provider_event_id) do update set status = 'currency_mismatch', raw_payload = null;
    return jsonb_build_object('ok', false, 'reason', 'currency_mismatch', 'revoked', false);
  end if;

  if p_kind = 'refunded' then
    if coalesce(p_amount_total, 0) <= 0 then
      return jsonb_build_object('ok', false, 'reason', 'invalid_refund_amount', 'revoked', false);
    end if;
    insert into public.payment_refunds (
      provider, provider_refund_id, provider_event_id, order_id, amount_total, currency, updated_at
    ) values (
      p_provider, p_object_id, p_provider_event_id, v_order.order_id,
      p_amount_total, upper(v_order.currency), now()
    )
    on conflict (provider, provider_refund_id) do update set
      provider_event_id = excluded.provider_event_id,
      amount_total = greatest(public.payment_refunds.amount_total, excluded.amount_total),
      currency = excluded.currency,
      updated_at = now();

    select coalesce(sum(amount_total), 0) into v_refunded_total
    from public.payment_refunds
    where provider = p_provider and order_id = v_order.order_id;
    v_revoked := v_refunded_total >= v_order.amount_total;
  else
    v_revoked := true;
  end if;

  if v_revoked then
    update public.paypal_orders
    set status = p_kind, raw_order = null, raw_capture = null, updated_at = now()
    where id = v_order.id;

    if v_order.product_type = 'annual_pass' then
      update public.annual_access_passes set status = 'revoked', updated_at = now()
      where provider = p_provider and provider_order_id = v_order.order_id;
    elsif v_order.product_type = 'library_membership' then
      update public.library_memberships set status = 'revoked', updated_at = now()
      where provider = p_provider and provider_order_id = v_order.order_id;
    elsif v_order.product_type = 'legacy_course' then
      select replacement.order_id into v_other_order_id
      from public.paypal_orders replacement
      where replacement.user_id = v_order.user_id
        and replacement.course_id = v_order.course_id
        and replacement.product_type = 'legacy_course'
        and replacement.status in ('completed', 'partially_refunded')
        and replacement.order_id <> v_order.order_id
      order by replacement.updated_at desc, replacement.created_at desc
      limit 1;

      if v_other_order_id is not null then
        update public.course_enrollments set
          statut = 'en_cours', access_source = 'payment', access_expires_at = null,
          payment_order_id = v_other_order_id, updated_at = now()
        where etudiant_id = v_order.user_id and course_id = v_order.course_id
          and access_source = 'payment' and payment_order_id = v_order.order_id;
      else
        select pass.* into v_active_pass
        from public.annual_access_passes pass
        where pass.user_id = v_order.user_id and pass.status = 'active' and pass.expires_at > now()
        order by pass.expires_at desc
        limit 1;
        if v_active_pass.id is not null then
          update public.course_enrollments set
            statut = 'en_cours', access_source = 'annual_pass',
            access_expires_at = v_active_pass.expires_at, payment_order_id = null, updated_at = now()
          where etudiant_id = v_order.user_id and course_id = v_order.course_id
            and access_source = 'payment' and payment_order_id = v_order.order_id;
        else
          update public.course_enrollments set statut = 'abandonne', updated_at = now()
          where etudiant_id = v_order.user_id and course_id = v_order.course_id
            and access_source = 'payment' and payment_order_id = v_order.order_id;
        end if;
      end if;

      update public.courses set nb_etudiants = (
        select count(*)::integer from public.course_enrollments
        where course_id = v_order.course_id and statut = 'en_cours'
      ) where id = v_order.course_id;
    end if;
  else
    update public.paypal_orders
    set status = 'partially_refunded', raw_order = null, raw_capture = null, updated_at = now()
    where id = v_order.id and status not in ('refunded', 'reversed', 'denied', 'disputed');
  end if;

  insert into public.payment_events (
    provider, provider_event_id, event_name, user_id, course_id, order_id,
    amount_total, currency, status, raw_payload
  ) values (
    p_provider, p_provider_event_id, left(coalesce(nullif(p_event_name, ''), p_kind), 200),
    v_order.user_id, v_order.course_id, v_order.order_id,
    nullif(greatest(coalesce(p_amount_total, 0), 0), 0), upper(v_order.currency),
    case when v_revoked then 'revoked' else 'partial_refund' end, null
  ) on conflict (provider, provider_event_id) do update set
    user_id = excluded.user_id, course_id = excluded.course_id, order_id = excluded.order_id,
    amount_total = excluded.amount_total, currency = excluded.currency,
    status = excluded.status, raw_payload = null;

  insert into public.security_audit_events (event_type, metadata)
  values (
    case when v_revoked then 'payment.webhook.revoked' else 'payment.webhook.partial_refund' end,
    jsonb_build_object(
      'provider', p_provider, 'product_type', v_order.product_type,
      'status', case when v_revoked then p_kind else 'partially_refunded' end
    )
  );

  return jsonb_build_object(
    'ok', true, 'already_processed', false, 'revoked', v_revoked,
    'partial_refund', not v_revoked, 'order_id', v_order.order_id,
    'product_type', v_order.product_type, 'user_id', v_order.user_id,
    'refunded_total', v_refunded_total
  );
end;
$$;

revoke execute on function public.validate_payment(text,text,text,uuid,uuid,integer,text,text,jsonb,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.validate_payment(text,text,text,uuid,uuid,integer,text,text,jsonb,boolean,text,text)
  to service_role;
revoke execute on function public.validate_paypal_payment(text,text,uuid,uuid,integer,text,text,jsonb,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.validate_paypal_payment(text,text,uuid,uuid,integer,text,text,jsonb,boolean,text,text)
  to service_role;
revoke execute on function public.process_payment_reversal(text,text,text,text,text,text,text,integer,text)
  from public, anon, authenticated;
grant execute on function public.process_payment_reversal(text,text,text,text,text,text,text,integer,text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'irenee_app') then
    grant execute on function public.process_payment_reversal(text,text,text,text,text,text,text,integer,text) to irenee_app;
  end if;
  if exists (select 1 from pg_roles where rolname = 'irenee_runtime') then
    grant execute on function public.process_payment_reversal(text,text,text,text,text,text,text,integer,text) to irenee_runtime;
  end if;
end $$;
