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
  // Identifiant de la séance réelle (table live_sessions) dont la salle Daily
  // n'ouvre que le jour même : voir getLiveJoinDecision dans lib/live.ts.
  liveSessionId: string;
  // Formateur qui anime la séance, affiché sur la carte si renseigné.
  presenter?: string;
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
    kind: "person",
    liveSessionId: "992a69ad-702c-4453-b137-fccf8775445c"
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
    kind: "person",
    liveSessionId: "396922a5-0080-4e89-87cf-33b3b8d10641"
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
    kind: "reading",
    liveSessionId: "36587d83-1ba5-4f86-b956-8ebb16616b02"
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
    kind: "reading",
    liveSessionId: "1dc8ec1d-550b-416e-bd78-cc35fca9be8c"
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
    kind: "reading",
    liveSessionId: "3121b388-eb13-4d1c-9878-393d72a5ee99"
  },
  {
    isoDate: "2026-10-07",
    time: "20h30",
    title: "Les voies de l'existence de Dieu chez Thomas d'Aquin et Aristote",
    description:
      "Étude des voies thomistes de la preuve de l'existence de Dieu et de leur enracinement dans la philosophie d'Aristote, de la cause première au moteur immobile.",
    image: "/images/visio-thomas-aquin-aristote.jpg",
    imageAlt: "Statue de saint Thomas d'Aquin tenant un livre ouvert",
    imagePosition: "50% 50%",
    kind: "reading",
    liveSessionId: "4a8c54df-f459-43a3-9727-93397cc8c4ea",
    presenter: "Vivien Hoch"
  },
  {
    isoDate: "2026-10-14",
    time: "20h30",
    title: "Big Bang, évolution et créationnisme : relire Adam et Ève",
    description:
      "Big Bang, évolutionnisme et créationnisme : ce que nous dit l'histoire d'Adam et Ève, les difficultés soulevées par le Big Bang et l'évolution, peut-on être créationniste, et la création de l'homme à l'image et à la ressemblance de Dieu.",
    image: "/images/visio-adam-eve-creation.jpg",
    imageAlt: "Fresque de la création d'Adam et Ève",
    imagePosition: "50% 50%",
    kind: "reading",
    liveSessionId: "6aa5159c-15ba-46ca-836f-9dc0473b0692",
    presenter: "Vivien Hoch"
  },
  {
    isoDate: "2026-10-21",
    time: "20h30",
    title: "La preuve ontologique chez saint Anselme",
    description:
      "Étude de la preuve ontologique de l'existence de Dieu formulée par saint Anselme dans le Proslogion, et des débats philosophiques qu'elle a suscités jusqu'à aujourd'hui.",
    image: "/images/visio-anselme-proslogion.jpg",
    imageAlt: "Manuscrit ancien du Proslogion de saint Anselme",
    imagePosition: "50% 50%",
    kind: "reading",
    liveSessionId: "f5df5a8d-4188-4808-ab89-887969870c9a",
    presenter: "Vivien Hoch"
  },
  {
    isoDate: "2026-10-28",
    time: "20h30",
    title: "Le Dieu de Pascal",
    description:
      "Le \"Dieu d'Abraham, d'Isaac et de Jacob\", non celui des philosophes et des savants : la pensée de Blaise Pascal sur la connaissance de Dieu par le cœur et par la raison.",
    image: "/images/visio-dieu-de-pascal.jpg",
    imageAlt: "Portrait de Blaise Pascal",
    imagePosition: "50% 50%",
    kind: "reading",
    liveSessionId: "3773e7b2-a420-4b98-8929-4a5d3696e79d",
    presenter: "Vivien Hoch"
  },
  {
    isoDate: "2026-11-04",
    time: "20h30",
    title: "Vocabulaire théologique : ousia, hypostase, prosôpon...",
    description:
      "Étude des notions fondamentales du vocabulaire théologique : ousia, nature, essence, hypostase, prosôpon, homoousios et substance.",
    image: "/images/visio-vocabulaire-theologique.jpg",
    imageAlt: "Icône antique illustrant le vocabulaire christologique conciliaire",
    imagePosition: "50% 50%",
    kind: "reading",
    liveSessionId: "608e23aa-47c0-413c-bab1-82fbb853229a",
    presenter: "Vivien Hoch"
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

export function getVisioSessionWindow(session: VisioSession) {
  const time = /^(\d{1,2})h(\d{2})$/.exec(session.time);
  if (!time) throw new Error("Horaire de séance invalide.");
  const wallClock = Date.parse(`${session.isoDate}T${time[1].padStart(2, "0")}:${time[2]}:00Z`);
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
    .formatToParts(new Date(wallClock)).find(part => part.type === "timeZoneName")?.value;
  const hours = Number(offset?.replace("GMT", ""));
  if (!Number.isFinite(hours)) throw new Error("Fuseau de séance invalide.");
  const startsAt = wallClock - hours * 60 * 60 * 1000;
  return { startsAt, endsAt: startsAt + 90 * 60 * 1000 };
}

export function getUpcomingVisioSessions(now = Date.now(), sessions = VISIO_SESSIONS) {
  return sessions.filter(session => getVisioSessionWindow(session).endsAt > now)
    .sort((a, b) => getVisioSessionWindow(a).startsAt - getVisioSessionWindow(b).startsAt);
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
