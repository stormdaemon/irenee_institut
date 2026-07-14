-- The migration runner applies this statement inside its global transaction.
-- Restore only confirmed, non-deleted authentication users that are missing the
-- public profile required by checkout and authorization flows.
insert into public.profiles (
  id,
  email,
  nom,
  prenom,
  role,
  statut_inscription,
  updated_at
)
select
  users.id,
  lower(btrim(users.email)),
  left(btrim(regexp_replace(
    coalesce(users.raw_user_meta_data ->> 'nom', users.raw_user_meta_data ->> 'last_name', ''),
    '[[:space:]]+',
    ' ',
    'g'
  )), 120),
  left(btrim(regexp_replace(
    coalesce(users.raw_user_meta_data ->> 'prenom', users.raw_user_meta_data ->> 'first_name', ''),
    '[[:space:]]+',
    ' ',
    'g'
  )), 120),
  'etudiant',
  'en_attente',
  now()
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
  and users.email_confirmed_at is not null
  and users.deleted_at is null
  and nullif(btrim(users.email), '') is not null
on conflict (id) do nothing;
