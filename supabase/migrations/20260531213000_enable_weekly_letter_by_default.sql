alter table public.profiles
  alter column marketing_opt_in set default true;

update public.profiles
set
  marketing_opt_in = true,
  marketing_opt_in_at = coalesce(marketing_opt_in_at, now()),
  marketing_opt_out_at = null,
  updated_at = now()
where role = 'etudiant';
