export type LegalPageKey = "mentions-legales" | "politique-confidentialite" | "cgv";

export const legalPages: Record<LegalPageKey, { title: string; intro: string; content: string }> = {
  "mentions-legales": {
    title: "Mentions légales",
    intro: "Informations légales de l'Institut Irénée et de l'association Parole et Partage.",
    content: `Éditeur du site

Institut Irénée est une initiative de l'association Parole et Partage.
SIREN : 841 890 692
Siège : Paris, France
Email : oeuvrecatholiquefrance@gmail.com
Téléphone : 01.71.68.15.38

Responsable de publication

La direction de publication est assurée par l'équipe administrative de l'Institut Irénée.

Objet du site

Le site présente les formations, contenus pédagogiques, inscriptions, devoirs, espaces étudiants et outils administratifs de l'Institut Irénée.

Propriété intellectuelle

Les textes, supports pédagogiques, vidéos, documents, logos, marques, éléments graphiques et contenus de formation sont protégés. Toute reproduction, diffusion ou adaptation sans autorisation écrite préalable est interdite.

Responsabilité

L'Institut Irénée veille à l'exactitude des informations publiées, sans garantir l'absence totale d'erreur ou d'interruption. Les liens externes sont fournis à titre informatif.`
  },
  "politique-confidentialite": {
    title: "Politique de confidentialité",
    intro: "Gestion des données personnelles des étudiants, formateurs et administrateurs.",
    content: `Données collectées

Les données collectées peuvent comprendre : identité, email, téléphone, adresse, date de naissance, choix de formation, informations de paiement, rôle utilisateur, progression pédagogique, devoirs, rendus, notes et échanges administratifs.

Lorsque l'option de réception des actualités, ressources et offres de formations de l'Institut Irénée est activée, votre préférence est enregistrée. Vous pouvez la modifier à tout moment depuis vos paramètres ou au moyen du lien de désabonnement présent dans chaque message.

Finalités

Ces données servent à créer le compte utilisateur, gérer l'accès aux formations, suivre la progression pédagogique, administrer les devoirs, traiter les inscriptions, assurer le support et respecter les obligations légales.

Base légale

Les traitements reposent sur l'exécution du contrat de formation, l'intérêt légitime de l'Institut Irénée, le consentement lorsque nécessaire et les obligations légales applicables.

Conservation

Les données sont conservées pendant la durée nécessaire au suivi pédagogique, administratif et comptable. Les demandes de suppression sont traitées sous réserve des obligations légales de conservation.

Sous-traitants

Le site peut utiliser des prestataires d'hébergement, d'authentification, de médias et de paiement pour fournir le service.

Droits des personnes

Vous pouvez demander l'accès, la rectification, l'opposition, la limitation ou la suppression de vos données en écrivant à oeuvrecatholiquefrance@gmail.com.`
  },
  cgv: {
    title: "Conditions générales de vente",
    intro: "Conditions applicables aux inscriptions, paiements et accès aux formations.",
    content: `Objet

Les présentes conditions encadrent l'inscription aux formations proposées par l'Institut Irénée, l'accès aux contenus en ligne et les services pédagogiques associés.

Inscription

L'inscription devient effective après création du compte, transmission des informations requises et validation du paiement ou de la modalité de règlement acceptée.

Prix et paiement

Les prix sont indiqués en euros. Des tarifs réduits peuvent être proposés selon les conditions précisées lors de l'inscription. Le paiement peut être effectué selon les moyens acceptés par l'Institut.

Accès aux formations

L'accès est personnel, nominatif et non transférable. Les contenus restent disponibles selon les modalités annoncées pour chaque formation.

Devoirs et certification

La validation des modules, devoirs ou examens dépend des critères pédagogiques communiqués dans l'espace étudiant. La délivrance d'un certificat peut être conditionnée à l'assiduité, au rendu des devoirs et à la réussite des évaluations.

Rétractation et remboursement

Les demandes sont étudiées selon la réglementation applicable et l'état d'accès aux contenus numériques. Une demande doit être adressée par email à l'équipe administrative.

Comportement utilisateur

Tout partage non autorisé de compte, extraction massive de contenu, diffusion de supports ou comportement contraire au cadre pédagogique peut entraîner une suspension d'accès.`
  }
};
