--
-- PostgreSQL database dump
--

\restrict 5N6ZcuFhR33Mx6SLeFocaTA2horBYZVCHdsFviBxj2RgeLDrJLcy8v4r5X1TX1I

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: process_payment_reversal(text, text, text, text, text, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_payment_reversal(p_provider text, p_provider_event_id text, p_event_name text, p_kind text, p_object_id text, p_order_id text DEFAULT ''::text, p_capture_id text DEFAULT ''::text, p_amount_total integer DEFAULT 0, p_currency text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: validate_payment(text, text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_payment(p_provider text, p_order_id text, p_capture_id text, p_user_id uuid, p_course_id uuid, p_amount_total integer, p_currency text, p_event_name text DEFAULT 'payment_completed'::text, p_raw_payload jsonb DEFAULT '{}'::jsonb, p_book_requested boolean DEFAULT false, p_book_title text DEFAULT ''::text, p_product_type text DEFAULT 'annual_pass'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_paypal_payment(p_order_id text, p_capture_id text, p_user_id uuid, p_course_id uuid, p_amount_total integer, p_currency text, p_event_name text DEFAULT 'paypal_capture_completed'::text, p_raw_payload jsonb DEFAULT '{}'::jsonb, p_book_requested boolean DEFAULT false, p_book_title text DEFAULT ''::text, p_product_type text DEFAULT 'annual_pass'::text) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.validate_payment(
    'paypal', p_order_id, p_capture_id, p_user_id, p_course_id, p_amount_total,
    p_currency, p_event_name, null, p_book_requested, p_book_title, p_product_type
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text,
    phone_confirmed_at timestamp with time zone,
    banned_until timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL
);


--
-- Name: annual_access_passes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annual_access_passes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'paypal'::text NOT NULL,
    provider_order_id text,
    amount_total integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT annual_access_passes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: app_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    ip_hash text,
    user_agent_hash text,
    CONSTRAINT app_sessions_expiry_check CHECK ((expires_at > created_at)),
    CONSTRAINT app_sessions_token_hash_check CHECK ((length(token_hash) = 64))
);


--
-- Name: book_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid,
    paypal_order_id text,
    requested_title text,
    status text DEFAULT 'en_attente_direction'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    library_membership_id uuid,
    CONSTRAINT book_requests_status_check CHECK ((status = ANY (ARRAY['en_attente_direction'::text, 'approuve'::text, 'refuse'::text])))
);


--
-- Name: course_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    etudiant_id uuid NOT NULL,
    statut text DEFAULT 'en_cours'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    access_source text DEFAULT 'legacy'::text NOT NULL,
    access_expires_at timestamp with time zone,
    payment_order_id text,
    CONSTRAINT course_enrollments_access_expiry_check CHECK ((((access_source = 'annual_pass'::text) AND (access_expires_at IS NOT NULL) AND (payment_order_id IS NULL)) OR ((access_source = 'payment'::text) AND (access_expires_at IS NULL) AND (payment_order_id IS NOT NULL)) OR ((access_source = 'legacy'::text) AND (access_expires_at IS NULL) AND (payment_order_id IS NULL)))),
    CONSTRAINT course_enrollments_access_source_check CHECK ((access_source = ANY (ARRAY['legacy'::text, 'annual_pass'::text, 'payment'::text])))
);


--
-- Name: course_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    titre text NOT NULL,
    description text DEFAULT ''::text,
    ordre integer DEFAULT 0 NOT NULL,
    contenu text,
    contenu_html text,
    url_video text,
    url_sous_titres text,
    duree integer DEFAULT 0 NOT NULL,
    ressources jsonb DEFAULT '[]'::jsonb NOT NULL,
    type_contenu text DEFAULT 'texte'::text NOT NULL,
    quiz jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_modules_type_contenu_check CHECK ((type_contenu = ANY (ARRAY['texte'::text, 'video'::text, 'quiz'::text]))),
    CONSTRAINT course_modules_url_sous_titres_check CHECK (((url_sous_titres IS NULL) OR (octet_length(url_sous_titres) <= 4096))),
    CONSTRAINT course_modules_url_sous_titres_length CHECK (((url_sous_titres IS NULL) OR (octet_length(url_sous_titres) <= 4096)))
);


--
-- Name: course_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    etudiant_id uuid NOT NULL,
    note integer,
    commentaire text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image_url text,
    objectifs jsonb DEFAULT '[]'::jsonb NOT NULL,
    competences jsonb DEFAULT '[]'::jsonb NOT NULL,
    prerequis jsonb DEFAULT '[]'::jsonb NOT NULL,
    semestre integer,
    numero integer,
    duree integer,
    niveau text DEFAULT 'debutant'::text NOT NULL,
    auteur_id uuid,
    auteur_nom text,
    statut text DEFAULT 'brouillon'::text NOT NULL,
    publie_le timestamp with time zone,
    nb_etudiants integer DEFAULT 0 NOT NULL,
    nb_modules integer DEFAULT 0 NOT NULL,
    duree_totale_minutes integer DEFAULT 0 NOT NULL,
    note_moyenne numeric,
    prix integer DEFAULT 9900 NOT NULL,
    prix_reduit integer DEFAULT 9900 NOT NULL,
    duree_totale integer,
    url_paiement_paypal text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'en_preparation'::text, 'publie'::text, 'archive'::text])))
);


--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    CONSTRAINT email_verification_expiry_check CHECK ((expires_at > created_at)),
    CONSTRAINT email_verification_token_hash_check CHECK ((length(token_hash) = 64))
);


--
-- Name: final_exam_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.final_exam_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    score integer NOT NULL,
    passed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT final_exam_attempts_score_check CHECK (((score >= 0) AND (score <= 100)))
);


--
-- Name: homework; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    titre text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    date_limite timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auteur_id uuid,
    auteur_nom text
);


--
-- Name: homework_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    homework_id uuid NOT NULL,
    etudiant_id uuid NOT NULL,
    statut text DEFAULT 'assigne'::text NOT NULL,
    submitted_at timestamp with time zone,
    content text,
    file_url text,
    grade numeric,
    feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT homework_assignments_grade_check CHECK (((grade IS NULL) OR ((grade >= (0)::numeric) AND (grade <= (20)::numeric)))),
    CONSTRAINT homework_assignments_statut_check CHECK ((statut = ANY (ARRAY['assigne'::text, 'soumis'::text, 'corrige'::text, 'a_revoir'::text])))
);


--
-- Name: homework_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    homework_id uuid NOT NULL,
    student_id uuid NOT NULL,
    content text,
    file_url text,
    grade numeric,
    feedback text,
    statut text DEFAULT 'soumis'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_number text DEFAULT ('ISI-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    document_key text NOT NULL,
    document_kind text NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid,
    module_id uuid,
    recipient_name text NOT NULL,
    course_title text,
    module_title text,
    delivery_status text DEFAULT 'queued'::text NOT NULL,
    delivery_error text,
    email_provider_id text,
    emailed_at timestamp with time zone,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_documents_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['queued'::text, 'sent'::text]))),
    CONSTRAINT learning_documents_document_kind_check CHECK ((document_kind = ANY (ARRAY['module_parchment'::text, 'course_parchment'::text, 'final_certificate'::text])))
);


--
-- Name: legal_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legal_pages (
    slug text NOT NULL,
    titre text DEFAULT ''::text NOT NULL,
    contenu text DEFAULT ''::text NOT NULL,
    derniere_modification timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: library_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'paypal'::text NOT NULL,
    provider_order_id text NOT NULL,
    amount_total integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: live_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    course_id uuid,
    daily_room_name text,
    daily_room_url text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT live_sessions_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text, 'cancelled'::text])))
);


--
-- Name: marketing_campaign_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaign_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    campaign_key text NOT NULL,
    delivery_status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_email_optouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_email_optouts (
    profile_id uuid NOT NULL,
    source text DEFAULT 'lien-email'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: module_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid,
    module_id uuid NOT NULL,
    complete boolean DEFAULT false NOT NULL,
    temps_passe_minutes integer DEFAULT 0 NOT NULL,
    derniere_position integer DEFAULT 0 NOT NULL,
    date_debut timestamp with time zone,
    date_completion timestamp with time zone,
    etudiant_id uuid,
    course_id uuid,
    statut text DEFAULT 'en_cours'::text NOT NULL,
    progression integer DEFAULT 0 NOT NULL,
    score_quiz integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    CONSTRAINT password_reset_expiry_check CHECK ((expires_at > created_at)),
    CONSTRAINT password_reset_token_hash_check CHECK ((length(token_hash) = 64))
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'paypal'::text NOT NULL,
    provider_event_id text NOT NULL,
    event_name text NOT NULL,
    user_id uuid,
    course_id uuid,
    order_id text,
    amount_total integer,
    currency text,
    status text DEFAULT 'received'::text NOT NULL,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_events_no_raw_provider_payload_check CHECK (((provider <> ALL (ARRAY['paypal'::text, 'stripe'::text])) OR (raw_payload IS NULL)))
);


--
-- Name: payment_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    provider_refund_id text NOT NULL,
    provider_event_id text NOT NULL,
    order_id text NOT NULL,
    amount_total integer NOT NULL,
    currency text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_refunds_amount_total_check CHECK ((amount_total >= 0)),
    CONSTRAINT payment_refunds_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT payment_refunds_provider_check CHECK ((provider = ANY (ARRAY['paypal'::text, 'stripe'::text])))
);


--
-- Name: paypal_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paypal_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id text NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid,
    amount_total integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    book_requested boolean DEFAULT false NOT NULL,
    book_title text,
    book_request_status text DEFAULT 'none'::text NOT NULL,
    capture_id text,
    raw_order jsonb,
    raw_capture jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_type text DEFAULT 'legacy_course'::text NOT NULL,
    provider text DEFAULT 'paypal'::text NOT NULL,
    CONSTRAINT paypal_orders_amount_positive_check CHECK ((amount_total > 0)),
    CONSTRAINT paypal_orders_book_request_status_check CHECK ((book_request_status = ANY (ARRAY['none'::text, 'en_attente_direction'::text, 'approuve'::text, 'refuse'::text]))),
    CONSTRAINT paypal_orders_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT paypal_orders_no_raw_provider_payload_check CHECK (((raw_order IS NULL) AND (raw_capture IS NULL))),
    CONSTRAINT paypal_orders_provider_check CHECK ((provider = ANY (ARRAY['paypal'::text, 'stripe'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'etudiant'::text NOT NULL,
    civilite text,
    nom text DEFAULT ''::text NOT NULL,
    prenom text DEFAULT ''::text NOT NULL,
    date_naissance date,
    telephone text,
    adresse text,
    code_postal text,
    ville text,
    pays text DEFAULT 'France'::text,
    formation_choisie text[],
    tarif_applicable text,
    modalite_paiement text,
    moyen_paiement text,
    statut_inscription text DEFAULT 'en_attente'::text,
    avatar_url text,
    avatar_public_id text,
    bio text,
    profession text,
    bio_description text,
    specialites jsonb DEFAULT '[]'::jsonb NOT NULL,
    realisations jsonb DEFAULT '[]'::jsonb NOT NULL,
    formation_academique text,
    linkedin_url text,
    twitter_url text,
    instagram_url text,
    tiktok_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    onboarding_completed_at timestamp with time zone,
    CONSTRAINT profiles_modalite_paiement_check CHECK ((modalite_paiement = ANY (ARRAY['1x'::text, '3x'::text, '6x'::text, 'annuel'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['etudiant'::text, 'formateur'::text, 'directeur'::text])))
);


--
-- Name: registration_notification_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registration_notification_outbox (
    user_id uuid NOT NULL,
    delivery_status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT registration_notification_outbox_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: security_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audit_events (
    id bigint NOT NULL,
    event_type text NOT NULL,
    actor_user_id uuid,
    ip_hash text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_audit_event_type_check CHECK ((event_type ~ '^[a-z0-9_.-]{3,80}$'::text)),
    CONSTRAINT security_audit_metadata_size_check CHECK ((octet_length((metadata)::text) <= 8192))
);


--
-- Name: security_audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.security_audit_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.security_audit_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: security_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_rate_limits (
    key_hash text NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_rate_limits_count_check CHECK ((request_count >= 0)),
    CONSTRAINT security_rate_limits_key_hash_check CHECK ((length(key_hash) = 64))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_key UNIQUE (provider_id, provider);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: annual_access_passes annual_access_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_access_passes
    ADD CONSTRAINT annual_access_passes_pkey PRIMARY KEY (id);


--
-- Name: annual_access_passes annual_access_passes_provider_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_access_passes
    ADD CONSTRAINT annual_access_passes_provider_order_id_key UNIQUE (provider_order_id);


--
-- Name: app_sessions app_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_sessions
    ADD CONSTRAINT app_sessions_pkey PRIMARY KEY (id);


--
-- Name: app_sessions app_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_sessions
    ADD CONSTRAINT app_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: book_requests book_requests_paypal_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_paypal_order_id_key UNIQUE (paypal_order_id);


--
-- Name: book_requests book_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_pkey PRIMARY KEY (id);


--
-- Name: course_enrollments course_enrollments_course_id_etudiant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_etudiant_id_key UNIQUE (course_id, etudiant_id);


--
-- Name: course_enrollments course_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_pkey PRIMARY KEY (id);


--
-- Name: course_modules course_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT course_modules_pkey PRIMARY KEY (id);


--
-- Name: course_reviews course_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_reviews
    ADD CONSTRAINT course_reviews_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_key UNIQUE (slug);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: final_exam_attempts final_exam_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_attempts
    ADD CONSTRAINT final_exam_attempts_pkey PRIMARY KEY (id);


--
-- Name: homework_assignments homework_assignments_homework_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_homework_id_student_id_key UNIQUE (homework_id, etudiant_id);


--
-- Name: homework_assignments homework_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_pkey PRIMARY KEY (id);


--
-- Name: homework homework_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_pkey PRIMARY KEY (id);


--
-- Name: homework_submissions homework_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_pkey PRIMARY KEY (id);


--
-- Name: learning_documents learning_documents_document_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_documents
    ADD CONSTRAINT learning_documents_document_key_key UNIQUE (document_key);


--
-- Name: learning_documents learning_documents_document_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_documents
    ADD CONSTRAINT learning_documents_document_number_key UNIQUE (document_number);


--
-- Name: learning_documents learning_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_documents
    ADD CONSTRAINT learning_documents_pkey PRIMARY KEY (id);


--
-- Name: legal_pages legal_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_pages
    ADD CONSTRAINT legal_pages_pkey PRIMARY KEY (slug);


--
-- Name: library_memberships library_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_memberships
    ADD CONSTRAINT library_memberships_pkey PRIMARY KEY (id);


--
-- Name: library_memberships library_memberships_provider_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_memberships
    ADD CONSTRAINT library_memberships_provider_order_id_key UNIQUE (provider_order_id);


--
-- Name: live_sessions live_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_deliveries marketing_campaign_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_deliveries
    ADD CONSTRAINT marketing_campaign_deliveries_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_deliveries marketing_campaign_deliveries_profile_id_campaign_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_deliveries
    ADD CONSTRAINT marketing_campaign_deliveries_profile_id_campaign_key_key UNIQUE (profile_id, campaign_key);


--
-- Name: marketing_email_optouts marketing_email_optouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_optouts
    ADD CONSTRAINT marketing_email_optouts_pkey PRIMARY KEY (profile_id);


--
-- Name: module_progress module_progress_etudiant_id_module_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_etudiant_id_module_id_key UNIQUE (etudiant_id, module_id);


--
-- Name: module_progress module_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_provider_provider_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_provider_provider_event_id_key UNIQUE (provider, provider_event_id);


--
-- Name: payment_refunds payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_pkey PRIMARY KEY (id);


--
-- Name: payment_refunds payment_refunds_provider_provider_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_provider_provider_event_id_key UNIQUE (provider, provider_event_id);


--
-- Name: payment_refunds payment_refunds_provider_provider_refund_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_provider_provider_refund_id_key UNIQUE (provider, provider_refund_id);


--
-- Name: paypal_orders paypal_orders_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paypal_orders
    ADD CONSTRAINT paypal_orders_order_id_key UNIQUE (order_id);


--
-- Name: paypal_orders paypal_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paypal_orders
    ADD CONSTRAINT paypal_orders_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: registration_notification_outbox registration_notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_notification_outbox
    ADD CONSTRAINT registration_notification_outbox_pkey PRIMARY KEY (user_id);


--
-- Name: security_audit_events security_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_pkey PRIMARY KEY (id);


--
-- Name: security_rate_limits security_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_rate_limits
    ADD CONSTRAINT security_rate_limits_pkey PRIMARY KEY (key_hash);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: app_sessions_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_sessions_user_active_idx ON public.app_sessions USING btree (user_id, expires_at DESC) WHERE (revoked_at IS NULL);


--
-- Name: book_requests_user_requested_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_requests_user_requested_at_idx ON public.book_requests USING btree (user_id, requested_at DESC);


--
-- Name: course_enrollments_active_access_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_enrollments_active_access_idx ON public.course_enrollments USING btree (etudiant_id, statut, access_source, access_expires_at);


--
-- Name: course_enrollments_payment_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_enrollments_payment_order_idx ON public.course_enrollments USING btree (payment_order_id) WHERE (payment_order_id IS NOT NULL);


--
-- Name: email_verification_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_verification_user_active_idx ON public.email_verification_tokens USING btree (user_id, expires_at DESC) WHERE (consumed_at IS NULL);


--
-- Name: final_exam_attempts_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX final_exam_attempts_user_created_idx ON public.final_exam_attempts USING btree (user_id, created_at DESC);


--
-- Name: homework_assignments_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homework_assignments_student_idx ON public.homework_assignments USING btree (etudiant_id, created_at DESC);


--
-- Name: library_memberships_user_status_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_memberships_user_status_expires_idx ON public.library_memberships USING btree (user_id, status, expires_at DESC);


--
-- Name: live_sessions_created_by_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX live_sessions_created_by_starts_at_idx ON public.live_sessions USING btree (created_by, starts_at DESC);


--
-- Name: live_sessions_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX live_sessions_starts_at_idx ON public.live_sessions USING btree (starts_at DESC);


--
-- Name: live_sessions_status_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX live_sessions_status_starts_at_idx ON public.live_sessions USING btree (status, starts_at);


--
-- Name: password_reset_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_expiry_idx ON public.password_reset_tokens USING btree (expires_at) WHERE (consumed_at IS NULL);


--
-- Name: password_reset_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_user_active_idx ON public.password_reset_tokens USING btree (user_id, expires_at DESC) WHERE (consumed_at IS NULL);


--
-- Name: payment_refunds_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_refunds_order_idx ON public.payment_refunds USING btree (provider, order_id);


--
-- Name: paypal_orders_provider_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX paypal_orders_provider_order_id_idx ON public.paypal_orders USING btree (provider, order_id);


--
-- Name: security_audit_events_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_audit_events_actor_idx ON public.security_audit_events USING btree (actor_user_id, created_at DESC);


--
-- Name: security_audit_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_audit_events_created_idx ON public.security_audit_events USING btree (created_at DESC);


--
-- Name: security_rate_limits_reset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_rate_limits_reset_idx ON public.security_rate_limits USING btree (reset_at);


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: annual_access_passes annual_access_passes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_access_passes
    ADD CONSTRAINT annual_access_passes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: app_sessions app_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_sessions
    ADD CONSTRAINT app_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: book_requests book_requests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: book_requests book_requests_library_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_library_membership_id_fkey FOREIGN KEY (library_membership_id) REFERENCES public.library_memberships(id) ON DELETE SET NULL;


--
-- Name: book_requests book_requests_paypal_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_paypal_order_id_fkey FOREIGN KEY (paypal_order_id) REFERENCES public.paypal_orders(order_id) ON DELETE SET NULL;


--
-- Name: book_requests book_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: book_requests book_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: course_enrollments course_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_enrollments course_enrollments_etudiant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_etudiant_id_fkey FOREIGN KEY (etudiant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: course_enrollments course_enrollments_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES public.paypal_orders(order_id) ON DELETE SET NULL;


--
-- Name: course_modules course_modules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT course_modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_reviews course_reviews_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_reviews
    ADD CONSTRAINT course_reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_reviews course_reviews_etudiant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_reviews
    ADD CONSTRAINT course_reviews_etudiant_id_fkey FOREIGN KEY (etudiant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: courses courses_auteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_auteur_id_fkey FOREIGN KEY (auteur_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: final_exam_attempts final_exam_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_attempts
    ADD CONSTRAINT final_exam_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: homework_assignments homework_assignments_homework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES public.homework(id) ON DELETE CASCADE;


--
-- Name: homework_assignments homework_assignments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_student_id_fkey FOREIGN KEY (etudiant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: homework homework_auteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_auteur_id_fkey FOREIGN KEY (auteur_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: homework homework_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_homework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES public.homework(id) ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: learning_documents learning_documents_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_documents
    ADD CONSTRAINT learning_documents_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: learning_documents learning_documents_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_documents
    ADD CONSTRAINT learning_documents_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.course_modules(id) ON DELETE SET NULL;


--
-- Name: learning_documents learning_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_documents
    ADD CONSTRAINT learning_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: library_memberships library_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_memberships
    ADD CONSTRAINT library_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: live_sessions live_sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: live_sessions live_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: marketing_campaign_deliveries marketing_campaign_deliveries_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_deliveries
    ADD CONSTRAINT marketing_campaign_deliveries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: marketing_email_optouts marketing_email_optouts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_email_optouts
    ADD CONSTRAINT marketing_email_optouts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: module_progress module_progress_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: module_progress module_progress_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.course_enrollments(id) ON DELETE CASCADE;


--
-- Name: module_progress module_progress_etudiant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_etudiant_id_fkey FOREIGN KEY (etudiant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: module_progress module_progress_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.course_modules(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payment_events payment_events_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: payment_events payment_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: payment_refunds payment_refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.paypal_orders(order_id) ON DELETE CASCADE;


--
-- Name: paypal_orders paypal_orders_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paypal_orders
    ADD CONSTRAINT paypal_orders_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: paypal_orders paypal_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paypal_orders
    ADD CONSTRAINT paypal_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: registration_notification_outbox registration_notification_outbox_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_notification_outbox
    ADD CONSTRAINT registration_notification_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: security_audit_events security_audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: annual_access_passes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.annual_access_passes ENABLE ROW LEVEL SECURITY;

--
-- Name: app_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: book_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.book_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: course_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: course_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: course_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: email_verification_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: final_exam_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.final_exam_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: homework; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

--
-- Name: homework_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: homework_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: library_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.library_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: live_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: module_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: paypal_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.paypal_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: security_audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: security_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 5N6ZcuFhR33Mx6SLeFocaTA2horBYZVCHdsFviBxj2RgeLDrJLcy8v4r5X1TX1I
