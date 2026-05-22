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
  formation_choisie jsonb,
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
  prix integer not null default 0,
  prix_reduit integer not null default 0,
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
  statut text not null default 'actif',
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
  provider text not null default 'lemon_squeezy',
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
