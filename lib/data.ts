import type { Course, Profile } from "./types";

export const courses: Course[] = [
  {
    id: "intro-apologetique",
    slug: "introduction-generale-apologetique-chretienne",
    titre: "Introduction générale à l'apologétique chrétienne",
    description:
      "Comprendre les bases intellectuelles et bibliques de la défense de la foi chrétienne, explorer les différentes approches apologétiques et développer les qualités essentielles d'un apologète.",
    niveau: "debutant",
    duree_totale: 750,
    nb_modules: 5,
    prix: 9900,
    prix_reduit: 9900,
    auteur_nom: "Institut Saint Irénée",
    objectifs: [
      "Maîtriser les fondements bibliques et historiques de l'apologétique chrétienne",
      "Connaître les trois grandes approches apologétiques",
      "Développer les qualités spirituelles et intellectuelles d'un apologète efficace"
    ],
    modules: [
      {
        id: "m1",
        titre: "Définir l'apologétique : défense rationnelle ou témoignage spirituel ?",
        description:
          "Introduction aux fondements bibliques, historiques et méthodologiques de l'apologétique chrétienne.",
        duree: 150,
        type: "texte",
        contenu_html:
          "<h2>Définir l'apologétique chrétienne</h2><p>L'apologétique n'est pas une agressivité rhétorique, mais l'art de rendre raison de l'espérance chrétienne avec intelligence, précision et charité.</p><blockquote>Sanctifiez dans vos coeurs le Christ Seigneur, toujours prêts à présenter une défense devant quiconque vous demande raison de l'espérance qui est en vous.</blockquote><p>Cette introduction pose les bases bibliques, historiques et pastorales d'une défense de la foi enracinée dans la vérité et la bienveillance.</p>"
      },
      {
        id: "m2",
        titre: "La vérité, la raison et la foi",
        description: "Explorer la relation entre vérité objective, raison humaine et foi chrétienne.",
        duree: 150,
        type: "texte"
      },
      {
        id: "m3",
        titre: "Les grandes approches apologétiques",
        description:
          "Comprendre les trois grandes écoles d'apologétique : classique, présuppositionnelle et cumulative.",
        duree: 150,
        type: "texte"
      },
      {
        id: "m4",
        titre: "Le contexte contemporain : scepticisme, relativisme et pluralisme",
        description: "Comprendre et répondre aux défis culturels de notre époque.",
        duree: 150,
        type: "texte"
      },
      {
        id: "m5",
        titre: "Les qualités essentielles d'un apologète",
        description:
          "Développer les qualités spirituelles, intellectuelles et relationnelles d'un défenseur de la foi.",
        duree: 150,
        type: "texte"
      }
    ]
  },
  {
    id: "engagement-public",
    slug: "apologetique-avancee-engagement-public",
    titre: "Apologétique avancée et engagement public",
    description: "Synthèse des méthodes apologétiques et formation à l'engagement public et culturel.",
    niveau: "avance",
    duree_totale: 750,
    nb_modules: 5,
    prix: 9900,
    prix_reduit: 9900,
    objectifs: ["Argumenter avec rigueur", "Répondre aux objections contemporaines", "Construire une présence publique chrétienne"],
    modules: []
  },
  {
    id: "philosophie",
    slug: "philosophie-apologetique-avancee",
    titre: "Philosophie et apologétique avancée",
    description: "Approfondir les arguments philosophiques pour Dieu et répondre aux objections sophistiquées.",
    niveau: "avance",
    duree_totale: 750,
    nb_modules: 5,
    prix: 9900,
    prix_reduit: 9900,
    objectifs: ["Maîtriser les arguments classiques", "Identifier les sophismes", "Dialoguer avec la philosophie contemporaine"],
    modules: []
  },
  {
    id: "interreligieux",
    slug: "dialogue-interreligieux-defense-foi-unique",
    titre: "Dialogue interreligieux et défense de la foi unique",
    description: "Comprendre les autres religions et défendre l'unicité de Christ dans un contexte pluraliste.",
    niveau: "intermediaire",
    duree_totale: 750,
    nb_modules: 5,
    prix: 9900,
    prix_reduit: 9900,
    objectifs: ["Comparer les doctrines", "Dialoguer sans relativisme", "Expliquer l'unicité du Christ"],
    modules: []
  },
  {
    id: "science-raison-foi",
    slug: "science-raison-et-foi",
    titre: "Science, raison et foi",
    description: "Montrer la compatibilité entre science et foi chrétienne, répondre aux objections scientifiques.",
    niveau: "intermediaire",
    duree_totale: 750,
    nb_modules: 5,
    prix: 9900,
    prix_reduit: 9900,
    objectifs: ["Distinguer science et scientisme", "Répondre aux objections courantes", "Articuler foi et raison"],
    modules: []
  }
];

export const fallbackProfile: Profile = {
  id: "local-directeur",
  email: "demo@institut-irenee.fr",
  prenom: "Théo",
  nom: "Lafont",
  role: "directeur",
  civilite: "M.",
  telephone: "0768519568",
  adresse: "3 RUE AC VICTIMES DE GUERRES",
  code_postal: "16440",
  ville: "Nersac",
  pays: "France",
  date_naissance: "2000-09-24",
  created_at: new Date().toISOString()
};

export const stats = { cours: courses.length, etudiants: 4, inscriptions: 0 };

export const profiles: Profile[] = [
  fallbackProfile,
  {
    id: "student-1",
    email: "anne.martin@example.com",
    prenom: "Anne",
    nom: "Martin",
    role: "etudiant",
    created_at: "2026-01-15T10:00:00.000Z"
  },
  {
    id: "student-2",
    email: "paul.bernard@example.com",
    prenom: "Paul",
    nom: "Bernard",
    role: "etudiant",
    created_at: "2026-02-02T10:00:00.000Z"
  },
  {
    id: "trainer-1",
    email: "formateur@institut-irenee.fr",
    prenom: "Jean",
    nom: "Moreau",
    role: "formateur",
    created_at: "2026-02-20T10:00:00.000Z"
  }
];

export const inscriptions = [
  {
    id: "insc-1",
    prenom: "Claire",
    nom: "Durand",
    email: "claire.durand@example.com",
    telephone: "0601020304",
    formationChoisie: ["parcours-complet"],
    tarifApplicable: "reduit",
    modalitePaiement: "3x",
    moyenPaiement: "virement",
    statut: "en_attente",
    montant: 168000,
    created_at: "2026-05-02T09:00:00.000Z"
  },
  {
    id: "insc-2",
    prenom: "Louis",
    nom: "Petit",
    email: "louis.petit@example.com",
    telephone: "0605060708",
    formationChoisie: ["semestre-1"],
    tarifApplicable: "plein",
    modalitePaiement: "1x",
    moyenPaiement: "stripe",
    statut: "validee",
    montant: 130000,
    created_at: "2026-05-06T11:30:00.000Z"
  }
];

export const homework = [
  {
    id: "hw-1",
    course_id: courses[0].id,
    titre: "Dissertation sur l'argument cosmologique",
    description: "Présentez l'argument, ses présupposés et une objection contemporaine.",
    date_limite: "2026-06-15T23:59",
    assigned_students: ["student-1", "student-2"]
  }
];

export const trainers = [
  {
    name: "Giulio Maspero",
    title: "Directeur d'études",
    image: "/images/guillaume-maspero.jpg",
    tags: ["Théologie dogmatique", "Foi catholique", "Transmission", "Enseignement"],
    description:
      "Prêtre catholique, professeur ordinaire de théologie dogmatique à l'Université pontificale de la Sainte-Croix et doyen de sa Faculté de théologie depuis 2024. Auteur de Il mistero di Dio uno e trino.",
    achievements: [
      "Professeur ordinaire de théologie dogmatique",
      "Doyen de la Faculté de théologie",
      "Auteur de Il mistero di Dio uno e trino",
      "Enseignement consacré au mystère de Dieu",
      "Formation académique en physique théorique et en théologie",
      "Transmission de la foi catholique"
    ]
  },
  {
    name: "Nezchristos",
    title: "Influenceur Apologétique sur TikTok",
    image: "/images/nezchristos.jpeg",
    tags: ["Apologétique", "Évangélisation numérique", "Foi catholique", "Réseaux sociaux"],
    description:
      "Créateur de contenu catholique passionné par l'évangélisation numérique. À travers des vidéos courtes et percutantes, il partage la richesse de la foi catholique.",
    achievements: [
      "Plus de 50K vues sur TikTok avec des contenus sur l'Église catholique",
      "Participation au réseau Acutis des influenceurs catholiques",
      "Création de contenus sur les conciles et l'histoire de l'Église",
      "Vidéos sur la prière et la vie spirituelle"
    ]
  }
];

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

export const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
