-- Align the recovered production constraints with the annual curriculum API.

alter table public.module_progress
  add constraint module_progress_etudiant_id_module_id_key unique (etudiant_id, module_id);

alter table public.profiles
  drop constraint if exists profiles_modalite_paiement_check;

alter table public.profiles
  add constraint profiles_modalite_paiement_check
  check (modalite_paiement = any (array['1x'::text, '3x'::text, '6x'::text, 'annuel'::text]));
