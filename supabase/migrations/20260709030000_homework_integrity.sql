-- Align homework assignments with the application contract and enforce bounded grades/statuses.

alter table public.homework_assignments add column if not exists statut text not null default 'assigne';
alter table public.homework_assignments add column if not exists submitted_at timestamptz;
alter table public.homework_assignments add column if not exists content text;
alter table public.homework_assignments add column if not exists file_url text;
alter table public.homework_assignments add column if not exists grade numeric;
alter table public.homework_assignments add column if not exists feedback text;
alter table public.homework_assignments add column if not exists updated_at timestamptz not null default now();

alter table public.homework_assignments drop constraint if exists homework_assignments_statut_check;
alter table public.homework_assignments add constraint homework_assignments_statut_check
  check (statut in ('assigne','soumis','corrige','a_revoir'));

alter table public.homework_assignments drop constraint if exists homework_assignments_grade_check;
alter table public.homework_assignments add constraint homework_assignments_grade_check
  check (grade is null or (grade >= 0 and grade <= 20));

create index if not exists homework_assignments_student_idx
  on public.homework_assignments (etudiant_id, created_at desc);
