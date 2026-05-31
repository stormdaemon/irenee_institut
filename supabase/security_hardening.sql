-- Security incident hardening: paid course contents must never be public.
do $$
declare
  policy record;
begin
  for policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'courses',
        'course_modules',
        'course_enrollments',
        'module_progress',
        'course_reviews',
        'homework',
        'homework_assignments',
        'homework_submissions',
        'system_settings',
        'payment_events',
        'paypal_orders',
        'book_requests'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy.policyname, policy.schemaname, policy.tablename);
  end loop;
end
$$;

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

create policy courses_public_catalog
  on public.courses
  for select
  to anon, authenticated
  using (statut = 'publie');

create policy profiles_read_self
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy enrollments_read_self
  on public.course_enrollments
  for select
  to authenticated
  using (etudiant_id = auth.uid());

create policy progress_read_self
  on public.module_progress
  for select
  to authenticated
  using (etudiant_id = auth.uid());

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
