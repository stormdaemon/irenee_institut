-- Distinguish durable legacy enrollments from enrollments historically created
-- as a side effect of an annual pass, so expired or revoked passes cannot leave
-- permanent course access behind.

alter table public.course_enrollments
  add column if not exists access_source text not null default 'legacy';

alter table public.course_enrollments
  add column if not exists access_expires_at timestamptz;

with enrollment_activity as (
  select
    enrollment.id,
    enrollment.etudiant_id,
    enrollment.created_at as enrollment_created_at,
    min(progress.date_debut) as first_started_at
  from public.course_enrollments enrollment
  left join public.module_progress progress
    on progress.enrollment_id = enrollment.id
    or (
      progress.enrollment_id is null
      and progress.etudiant_id = enrollment.etudiant_id
      and progress.course_id = enrollment.course_id
    )
  group by enrollment.id, enrollment.etudiant_id, enrollment.created_at
), pass_candidates as (
  select
    activity.id as enrollment_id,
    pass.expires_at,
    row_number() over (
      partition by activity.id
      order by pass.starts_at desc, pass.expires_at asc
    ) as candidate_rank
  from enrollment_activity activity
  join public.annual_access_passes pass
    on pass.user_id = activity.etudiant_id
   and (
     (
       activity.first_started_at is not null
       and activity.first_started_at >= pass.starts_at
       and activity.first_started_at < pass.expires_at
     )
     or (
       activity.enrollment_created_at >= pass.starts_at
       and activity.enrollment_created_at < pass.expires_at
     )
   )
), matched_passes as (
  select enrollment_id, expires_at
  from pass_candidates
  where candidate_rank = 1
)
update public.course_enrollments enrollment
set
  access_source = 'annual_pass',
  access_expires_at = matched.expires_at
from matched_passes matched
where enrollment.id = matched.enrollment_id
  -- A later migration may already have linked this entitlement to a durable
  -- one-off purchase. Replays must never overwrite that payment provenance.
  and enrollment.access_source <> 'payment';

do $$
begin
  -- Before payment provenance exists, establish the initial two-state
  -- invariant. After the payment migration, retain its stricter three-state
  -- constraints instead of accidentally weakening or invalidating them.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course_enrollments'
      and column_name = 'payment_order_id'
  ) then
    alter table public.course_enrollments
      drop constraint if exists course_enrollments_access_source_check;
    alter table public.course_enrollments
      add constraint course_enrollments_access_source_check
      check (access_source in ('legacy', 'annual_pass'));

    alter table public.course_enrollments
      drop constraint if exists course_enrollments_access_expiry_check;
    alter table public.course_enrollments
      add constraint course_enrollments_access_expiry_check
      check (access_source <> 'annual_pass' or access_expires_at is not null);
  end if;
end $$;

create index if not exists course_enrollments_active_access_idx
  on public.course_enrollments (etudiant_id, statut, access_source, access_expires_at);
