export type Role = "etudiant" | "formateur" | "directeur";

export type Course = {
  id: string;
  slug: string;
  titre: string;
  description: string;
  image_url?: string | null;
  niveau: string;
  duree_totale: number;
  duree_totale_minutes?: number | null;
  nb_modules: number;
  nb_etudiants?: number | null;
  prix: number;
  prix_reduit: number;
  url_paiement_paypal?: string | null;
  auteur_nom?: string;
  statut?: string | null;
  semestre?: number | null;
  numero?: number | null;
  objectifs: string[];
  competences?: string[];
  prerequis?: string[];
  modules: CourseModule[];
};

export type CourseModule = {
  id: string;
  course_id?: string;
  titre: string;
  description: string;
  ordre?: number;
  duree: number;
  type: "texte" | "video" | "quiz" | string;
  type_contenu?: string | null;
  url_video?: string | null;
  ressources?: unknown;
  contenu?: string | null;
  contenu_html?: string;
  quiz?: { question: string; options: string[]; answer: number }[];
};

export type Profile = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  civilite?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  pays?: string;
  profession?: string;
  bio?: string;
  bio_description?: string;
  formation_academique?: string;
  specialites?: string[];
  realisations?: string[];
  linkedin_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  formation_choisie?: string[] | string;
  tarif_applicable?: string;
  modalite_paiement?: string;
  moyen_paiement?: string;
  statut_inscription?: string;
  date_naissance?: string;
  avatar_url?: string;
  avatar_public_id?: string;
  created_at?: string;
};

export type Homework = {
  id: string;
  course_id?: string;
  titre: string;
  description?: string;
  date_limite?: string;
  created_at?: string;
  homework_assignments?: unknown[];
};

export type ModuleProgress = {
  id?: string;
  etudiant_id?: string;
  course_id: string;
  module_id: string;
  statut?: string;
  progression?: number;
  complete?: boolean;
};
