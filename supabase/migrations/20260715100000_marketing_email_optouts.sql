-- Désinscription des emails marketing (invitation hebdomadaire au pass annuel).
-- Un profil présent dans cette table ne doit plus recevoir aucune campagne marketing.

create table if not exists public.marketing_email_optouts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  source text not null default 'lien-email',
  created_at timestamptz not null default now()
);

do $$
declare
  role_name text;
begin
  foreach role_name in array array['irenee_app', 'irenee_runtime', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('grant select, insert, update, delete on public.marketing_email_optouts to %I', role_name);
    end if;
  end loop;
end
$$;
