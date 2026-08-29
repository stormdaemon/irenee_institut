// Planning éditorial des séances en visio hebdomadaires de septembre 2026.
// Données statiques : ces dates sont annoncées publiquement sur la page d'accueil.
// L'accès effectif aux salles se gère via /espace-etudiant (cf. NextLiveSession).

const FR_WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FR_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

const FR_MONTH_SHORTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Photo de Samuel Armanios, identique à celle utilisée sur la page équipe.
export const SAMUEL_PHOTO_URL =
  "https://bilan-previsionnel.fr/wp-content/uploads/2020/11/Bilan-Previsionnel-presentation-portrait-img-1.jpg";

// "person" : portrait d'un intervenant (image déjà présente dans le repo).
// "reading" : illustration patristique à déposer dans public/images (voir filenames ci-dessous).
export type VisioSessionKind = "person" | "reading";

export type VisioSession = {
  isoDate: string;
  time: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  imagePosition: string;
  kind: VisioSessionKind;
};

export const VISIO_SESSIONS: VisioSession[] = [
  {
    isoDate: "2026-09-02",
    time: "20h30",
    title: "Rentrée et présentation des inscrits",
    description:
      "Sam ouvre l'année avec les nouveaux inscrits : tour de table de la promotion, objectifs de la formation et déroulé des séances hebdomadaires.",
    image: SAMUEL_PHOTO_URL,
    imageAlt: "Samuel Armanios, directeur de l'Institut Saint-Irénée",
    imagePosition: "52% 16%",
    kind: "person"
  },
  {
    isoDate: "2026-09-09",
    time: "20h30",
    title: "Présentation du site et de la plateforme",
    description:
      "Théo fait découvrir l'espace étudiant : accès aux cours, bibliothèque apologétique et ouverture des séances en visio directement depuis le site.",
    image: "/images/theo-lafont.jpg",
    imageAlt: "Théo Lafont, directeur du développement de l'Institut Saint-Irénée",
    imagePosition: "50% 18%",
    kind: "person"
  },
  {
    isoDate: "2026-09-16",
    time: "20h30",
    title: "Lecture de la Didachè",
    description:
      "Lecture commentée de la Didachè, l'un des plus anciens écrits chrétiens, et de son enseignement sur la vie de l'Église des premiers temps.",
    image: "/images/visio-didache.jpg",
    imageAlt: "Manuscrit ancien de la Didachè éclairé à la lumière d'une bougie",
    imagePosition: "50% 50%",
    kind: "reading"
  },
  {
    isoDate: "2026-09-23",
    time: "20h30",
    title: "Lecture de la Lettre à Diognète",
    description:
      "Étude de la Lettre à Diognète, joyau de l'apologétique des premiers siècles sur la place et la mission des chrétiens dans le monde.",
    image: "/images/visio-lettre-a-diognete.jpg",
    imageAlt: "Parchemin de la Lettre à Diognète posé sur une table d'étude monastique",
    imagePosition: "50% 50%",
    kind: "reading"
  },
  {
    isoDate: "2026-09-30",
    time: "20h30",
    title: "Lecture des lettres de Clément de Rome",
    description:
      "Lecture des lettres de saint Clément de Rome, témoin de la communion des Églises et de l'autorité naissante du siège romain.",
    image: "/images/visio-clement-de-rome.jpg",
    imageAlt: "Lettre de saint Clément de Rome calligraphiée sur un parchemin antique",
    imagePosition: "50% 50%",
    kind: "reading"
  }
];

export type VisioDateParts = {
  weekday: string;
  day: number;
  month: string;
  monthShort: string;
};

// Formate une date ISO "AAAA-MM-JJ" en éléments français déterministes,
// indépendamment du fuseau horaire (calcul en UTC).
export function formatVisioDate(isoDate: string): VisioDateParts {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Date de séance invalide : ${isoDate}`);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  const monthName = FR_MONTHS[month - 1];
  return {
    weekday: FR_WEEKDAYS[date.getUTCDay()],
    day,
    month: monthName,
    monthShort: FR_MONTH_SHORTS[month - 1]
  };
}

// Libellé prêt à l'affichage : "Mercredi 2 septembre · 20h30".
export function formatVisioWhen(session: VisioSession): string {
  const { weekday, day, month } = formatVisioDate(session.isoDate);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${day} ${month} · ${session.time}`;
}

// Lien "wa.me" pré-rempli pour partager une séance dans un groupe WhatsApp.
export function buildVisioWhatsAppShareUrl(session: VisioSession): string {
  const message = [
    `📅 ${session.title}`,
    `${formatVisioWhen(session)} — Institut Saint-Irénée (visio)`,
    "https://irenee-institut.org/#agenda"
  ].join("\n");
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
