create table if not exists public.legal_pages (
  slug text primary key,
  titre text not null default '',
  contenu text not null default '',
  derniere_modification timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on public.legal_pages from public;
grant select, insert, update, delete on public.legal_pages to irenee_app;
