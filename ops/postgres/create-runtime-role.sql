\set ON_ERROR_STOP on
\if :{?runtime_password}
\else
  \echo 'runtime_password is required'
  \quit 1
\endif

select format(
  'create role irenee_runtime login password %L nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 30',
  :'runtime_password'
)
where not exists (select 1 from pg_roles where rolname = 'irenee_runtime')
\gexec

alter role irenee_runtime login password :'runtime_password'
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 30;
alter role irenee_runtime set statement_timeout = '30s';
alter role irenee_runtime set lock_timeout = '5s';
alter role irenee_runtime set idle_in_transaction_session_timeout = '15s';
alter role irenee_runtime set search_path = public, auth;

grant connect on database :DBNAME to irenee_runtime;
-- TEMP is granted to PUBLIC by default, so revoking it only from the runtime
-- role would not remove the effective privilege.
revoke temporary on database :DBNAME from public;
revoke temporary on database :DBNAME from irenee_runtime;
grant usage on schema public, auth to irenee_runtime;
revoke create on schema public, auth from irenee_runtime;

revoke all privileges on all tables in schema public from irenee_runtime;
grant select, insert, update, delete on all tables in schema public to irenee_runtime;
grant usage, select on all sequences in schema public to irenee_runtime;

revoke all privileges on all tables in schema auth from irenee_runtime;
grant select, insert, update, delete on auth.users, auth.identities to irenee_runtime;

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from irenee_runtime;
select 'grant execute on function public.get_user_role() to irenee_runtime'
where to_regprocedure('public.get_user_role()') is not null
\gexec
grant execute on function public.validate_payment(text,text,text,uuid,uuid,integer,text,text,jsonb,boolean,text,text) to irenee_runtime;
grant execute on function public.validate_paypal_payment(text,text,uuid,uuid,integer,text,text,jsonb,boolean,text,text) to irenee_runtime;
grant execute on function public.process_payment_reversal(text,text,text,text,text,text,text,integer,text) to irenee_runtime;

do $$
declare
  item record;
begin
  for item in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p')
      and c.relrowsecurity
      and (
        n.nspname = 'public'
        or (n.nspname = 'auth' and c.relname in ('users','identities'))
      )
  loop
    execute format('drop policy if exists irenee_runtime_backend_access on %I.%I', item.schema_name, item.table_name);
    execute format(
      'create policy irenee_runtime_backend_access on %I.%I for all to irenee_runtime using (true) with check (true)',
      item.schema_name,
      item.table_name
    );
  end loop;
end $$;

alter default privileges in schema public
  grant select, insert, update, delete on tables to irenee_runtime;
alter default privileges in schema public
  grant usage, select on sequences to irenee_runtime;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
