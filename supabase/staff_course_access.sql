-- Directors and trainers both receive free pedagogical access.
drop policy if exists modules_read_enrolled_or_director on public.course_modules;
drop policy if exists modules_read_enrolled_or_staff on public.course_modules;

create policy modules_read_enrolled_or_staff
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
        and profiles.role in ('directeur', 'formateur')
    )
  );
