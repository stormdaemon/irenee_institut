-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoke that
-- implicit path and expose only the role lookup intentionally used by RLS.

revoke execute on all functions in schema public from public;

-- Some fresh/self-hosted installations do not define this optional RLS helper.
-- Harden and grant it when present without making a clean reconstruction fail.
do $$
begin
  if to_regprocedure('public.get_user_role()') is not null then
    alter function public.get_user_role() set search_path = pg_catalog, public, auth;
    grant execute on function public.get_user_role() to anon, authenticated, service_role;
  end if;
end $$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

do $$
begin
  if to_regprocedure('public.get_user_role()') is not null
     and exists (select 1 from pg_roles where rolname = 'irenee_app') then
    grant execute on function public.get_user_role() to irenee_app;
  end if;
  if to_regprocedure('public.get_user_role()') is not null
     and exists (select 1 from pg_roles where rolname = 'irenee_runtime') then
    grant execute on function public.get_user_role() to irenee_runtime;
  end if;
end $$;
