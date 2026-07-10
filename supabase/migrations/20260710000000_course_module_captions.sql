alter table public.course_modules
  add column if not exists url_sous_titres text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'course_modules_url_sous_titres_length'
      and conrelid = 'public.course_modules'::regclass
  ) then
    alter table public.course_modules
      add constraint course_modules_url_sous_titres_length
      check (url_sous_titres is null or octet_length(url_sous_titres) <= 4096);
  end if;
end
$$;
