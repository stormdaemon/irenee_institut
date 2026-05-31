-- Schema aligned with the recovered Institut Irénée Supabase project.
-- It documents the live tables the Next.js app now reads/writes.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'etudiant' check (role in ('etudiant', 'formateur', 'directeur')),
  civilite text,
  nom text not null default '',
  prenom text not null default '',
  date_naissance date,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  pays text default 'France',
  formation_choisie text[],
  tarif_applicable text,
  modalite_paiement text,
  moyen_paiement text,
  statut_inscription text default 'en_attente',
  avatar_url text,
  avatar_public_id text,
  bio text,
  profession text,
  bio_description text,
  specialites jsonb not null default '[]'::jsonb,
  realisations jsonb not null default '[]'::jsonb,
  formation_academique text,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  tiktok_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  objectifs jsonb not null default '[]'::jsonb,
  competences jsonb not null default '[]'::jsonb,
  prerequis jsonb not null default '[]'::jsonb,
  semestre integer,
  numero integer,
  duree integer,
  niveau text not null default 'debutant',
  auteur_id uuid references public.profiles(id) on delete set null,
  auteur_nom text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'en_preparation', 'publie', 'archive')),
  publie_le timestamptz,
  nb_etudiants integer not null default 0,
  nb_modules integer not null default 0,
  duree_totale_minutes integer not null default 0,
  note_moyenne numeric,
  prix integer not null default 9900,
  prix_reduit integer not null default 9900,
  duree_totale integer,
  url_paiement_paypal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  titre text not null,
  description text default '',
  ordre integer not null default 0,
  contenu text,
  contenu_html text,
  url_video text,
  duree integer not null default 0,
  ressources jsonb not null default '[]'::jsonb,
  type_contenu text not null default 'texte',
  quiz jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  etudiant_id uuid not null references public.profiles(id) on delete cascade,
  statut text not null default 'en_cours',
  created_at timestamptz not null default now(),
  unique(course_id, etudiant_id)
);

create table if not exists public.module_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.course_enrollments(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  complete boolean not null default false,
  temps_passe_minutes integer not null default 0,
  derniere_position integer not null default 0,
  date_debut timestamptz,
  date_completion timestamptz,
  etudiant_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  statut text not null default 'en_cours',
  progression integer not null default 0,
  score_quiz integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(etudiant_id, module_id)
);

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  etudiant_id uuid not null references public.profiles(id) on delete cascade,
  note integer,
  commentaire text,
  created_at timestamptz not null default now()
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  titre text not null,
  description text not null default '',
  date_limite timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  statut text not null default 'assigne',
  submitted_at timestamptz,
  content text,
  file_url text,
  grade numeric,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(homework_id, student_id)
);

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  file_url text,
  grade numeric,
  feedback text,
  statut text not null default 'soumis',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paypal',
  provider_event_id text not null,
  event_name text not null,
  user_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  order_id text,
  amount_total integer,
  currency text,
  status text not null default 'received',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.paypal_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  amount_total integer not null,
  currency text not null default 'EUR',
  status text not null default 'created',
  book_requested boolean not null default false,
  book_title text,
  book_request_status text not null default 'none' check (book_request_status in ('none', 'en_attente_direction', 'approuve', 'refuse')),
  capture_id text,
  raw_order jsonb,
  raw_capture jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  paypal_order_id text references public.paypal_orders(order_id) on delete set null,
  requested_title text,
  status text not null default 'en_attente_direction' check (status in ('en_attente_direction', 'approuve', 'refuse')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(paypal_order_id)
);

alter table if exists public.courses alter column prix set default 9900;
alter table if exists public.courses alter column prix_reduit set default 9900;
alter table if exists public.paypal_orders add column if not exists book_title text;
alter table if exists public.book_requests add column if not exists requested_title text;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.module_progress enable row level security;
alter table public.course_reviews enable row level security;
alter table public.homework enable row level security;
alter table public.homework_assignments enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.system_settings enable row level security;
alter table public.payment_events enable row level security;
alter table public.paypal_orders enable row level security;
alter table public.book_requests enable row level security;

drop function if exists public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean);

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
  p_book_title text default ''
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

  select id into v_course_id from public.courses where id = p_course_id;
  if v_course_id is null then
    raise exception 'course % not found', p_course_id;
  end if;

  insert into public.paypal_orders (
    order_id,
    user_id,
    course_id,
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
    p_course_id,
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

  insert into public.course_enrollments (course_id, etudiant_id, statut)
  values (p_course_id, p_user_id, 'en_cours')
  on conflict (course_id, etudiant_id) do update set statut = 'en_cours';

  update public.profiles
  set
    statut_inscription = 'validee',
    moyen_paiement = 'paypal',
    modalite_paiement = '1x',
    formation_choisie = array[p_course_id::text],
    updated_at = now()
  where id = p_user_id;

  update public.courses
  set nb_etudiants = (
    select count(*)::integer
    from public.course_enrollments
    where course_id = p_course_id and statut = 'en_cours'
  )
  where id = p_course_id;

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
    p_course_id,
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
    values (p_user_id, p_course_id, p_order_id, nullif(btrim(coalesce(p_book_title, '')), ''), 'en_attente_direction', now())
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
    'enrolled', true,
    'provider', 'paypal',
    'order_id', p_order_id,
    'capture_id', p_capture_id,
    'book_requested', coalesce(p_book_requested, false),
    'book_title', nullif(btrim(coalesce(p_book_title, '')), '')
  );
end;
$$;

grant execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text) to service_role;

-- Browser clients only receive the published catalog and their own paid content.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.courses from anon, authenticated;
revoke all on table public.course_modules from anon, authenticated;
revoke all on table public.course_enrollments from anon, authenticated;
revoke all on table public.module_progress from anon, authenticated;
revoke all on table public.course_reviews from anon, authenticated;
revoke all on table public.homework from anon, authenticated;
revoke all on table public.homework_assignments from anon, authenticated;
revoke all on table public.homework_submissions from anon, authenticated;
revoke all on table public.system_settings from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
revoke all on table public.paypal_orders from anon, authenticated;
revoke all on table public.book_requests from anon, authenticated;

grant select on table public.courses to anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.course_modules to authenticated;
grant select on table public.course_enrollments to authenticated;
grant select on table public.module_progress to authenticated;

drop policy if exists courses_public_catalog on public.courses;
create policy courses_public_catalog
  on public.courses
  for select
  to anon, authenticated
  using (statut = 'publie');

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists enrollments_read_self on public.course_enrollments;
create policy enrollments_read_self
  on public.course_enrollments
  for select
  to authenticated
  using (etudiant_id = auth.uid());

drop policy if exists progress_read_self on public.module_progress;
create policy progress_read_self
  on public.module_progress
  for select
  to authenticated
  using (etudiant_id = auth.uid());

drop policy if exists modules_read_enrolled_or_director on public.course_modules;
create policy modules_read_enrolled_or_director
  on public.course_modules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.course_enrollments
      where course_enrollments.course_id = course_modules.course_id
        and course_enrollments.etudiant_id = auth.uid()
        and course_enrollments.statut = 'en_cours'
    )
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'directeur'
    )
  );

revoke execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text)
  from public, anon, authenticated;
grant execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text)
  to service_role;
