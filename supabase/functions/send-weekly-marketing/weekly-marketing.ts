export type MarketingProfile = {
  id: string;
  email: string;
  prenom?: string;
  nom?: string;
  marketing_unsubscribe_token: string;
  course_enrollments?: { id: string }[];
};

export type MarketingEmail = {
  campaignKey: string;
  subject: string;
  body: string;
  htmlBody: string;
};

type CampaignTemplate = {
  key: string;
  month: number;
  day: number;
  subject: string;
  heading: string;
  reflection: string;
  benefit: string;
};

export const campaignTemplates: CampaignTemplate[] = [
  { key: "epiphanie", month: 1, day: 6, subject: "{{prenom}}, avancer avec les mages", heading: "Chercher avec intelligence", reflection: "L'Epiphanie rappelle que la foi n'a pas peur des questions. Les mages se mettent en route parce qu'ils ont aperçu un signe et qu'ils veulent aller plus loin.", benefit: "Nos formations donnent des repères solides pour éclairer vos questions et parler de la foi avec justesse." },
  { key: "saint-paul", month: 1, day: 25, subject: "{{prenom}}, une foi capable de répondre", heading: "A l'école de saint Paul", reflection: "La conversion de saint Paul montre qu'une rencontre peut transformer une vie, mais aussi ouvrir un chemin d'étude, de transmission et de mission.", benefit: "Approfondissez les raisons de croire afin de répondre avec clarté sans perdre la charité." },
  { key: "presentation", month: 2, day: 2, subject: "{{prenom}}, porter une lumière claire", heading: "Une lumière pour discerner", reflection: "A la Présentation du Seigneur, Syméon reconnaît une lumière offerte à tous. Cette lumière mérite d'être accueillie et mieux comprise.", benefit: "Progressez pas à pas avec une formation structurée qui unit foi, raison et pédagogie." },
  { key: "lourdes", month: 2, day: 11, subject: "{{prenom}}, approfondir pour mieux transmettre", heading: "Une foi simple n'est pas une foi simpliste", reflection: "A Lourdes, la simplicité de Bernadette rejoint des générations entières. La simplicité chrétienne ne refuse pas l'intelligence : elle conduit à l'essentiel.", benefit: "Formez-vous pour présenter la foi avec des mots accessibles et des fondations solides." },
  { key: "saint-joseph", month: 3, day: 19, subject: "{{prenom}}, bâtir sur des fondations solides", heading: "La patience des fondations", reflection: "Saint Joseph agit avec discrétion et fidélité. Il rappelle qu'une œuvre durable se construit par des choix concrets et réguliers.", benefit: "Choisissez une formation et avancez à votre rythme avec un parcours en ligne clair." },
  { key: "annonciation", month: 3, day: 25, subject: "{{prenom}}, donner une réponse éclairée", heading: "Répondre librement", reflection: "L'Annonciation place au cœur de la foi une réponse libre et confiante. Comprendre davantage permet souvent de répondre plus pleinement.", benefit: "Nos cours vous aident à approfondir ce que l'Eglise croit et pourquoi elle le croit." },
  { key: "paques", month: 4, day: 20, subject: "{{prenom}}, explorer le cœur de la foi", heading: "Le cœur historique de la foi chrétienne", reflection: "La Résurrection n'est pas un détail secondaire : elle est au centre de l'espérance chrétienne et mérite une réflexion rigoureuse.", benefit: "Découvrez une démarche apologétique qui prend les objections au sérieux et conduit vers l'essentiel." },
  { key: "divine-misericorde", month: 4, day: 27, subject: "{{prenom}}, répondre avec vérité et douceur", heading: "La vérité au service de la miséricorde", reflection: "La miséricorde n'efface pas la vérité. Elle lui donne un visage : celui d'une parole qui éclaire sans écraser.", benefit: "Apprenez à répondre aux questions difficiles avec précision, patience et respect." },
  { key: "pentecote", month: 6, day: 8, subject: "{{prenom}}, trouver les mots pour témoigner", heading: "Une parole reçue pour être transmise", reflection: "A la Pentecôte, les disciples sortent de la peur et deviennent capables de parler à chacun dans une langue qu'il peut entendre.", benefit: "Développez une parole plus claire pour vos échanges, vos proches et vos engagements." },
  { key: "saint-irenee", month: 6, day: 28, subject: "{{prenom}}, apprendre avec saint Irénée", heading: "Recevoir, comprendre, transmettre", reflection: "Saint Irénée a défendu la foi en revenant à sa cohérence profonde et à la tradition reçue des Apôtres.", benefit: "Entrez dans un parcours qui forme l'intelligence sans séparer la doctrine de la vie chrétienne." },
  { key: "saints-pierre-paul", month: 6, day: 29, subject: "{{prenom}}, affermir votre témoignage", heading: "Deux témoins, une même mission", reflection: "Pierre et Paul ont des histoires différentes, mais une même fidélité au Christ et un même désir de transmettre l'Evangile.", benefit: "Approfondissez vos fondations pour témoigner avec assurance et humilité." },
  { key: "transfiguration", month: 8, day: 6, subject: "{{prenom}}, prendre de la hauteur cet été", heading: "Voir plus clairement", reflection: "La Transfiguration invite à lever les yeux et à regarder le Christ avec une attention renouvelée.", benefit: "Profitez d'un temps plus calme pour commencer une formation accessible en ligne." },
  { key: "assomption", month: 8, day: 15, subject: "{{prenom}}, approfondir sans perdre l'essentiel", heading: "Une espérance qui engage toute la personne", reflection: "L'Assomption rappelle que l'espérance chrétienne concerne toute notre vie. Elle donne une direction et une profondeur au quotidien.", benefit: "Explorez les grandes questions de la foi dans un cadre progressif et exigeant." },
  { key: "nativite-marie", month: 9, day: 8, subject: "{{prenom}}, faire grandir votre formation", heading: "Reprendre un chemin de croissance", reflection: "La Nativité de Marie ouvre discrètement une histoire immense. Les commencements modestes peuvent porter beaucoup de fruit.", benefit: "Commencez par un premier module et construisez peu à peu une compréhension plus solide." },
  { key: "saint-michel", month: 9, day: 29, subject: "{{prenom}}, discerner avec plus de clarté", heading: "Former son discernement", reflection: "La fête des archanges rappelle que la vie spirituelle demande lucidité, confiance et persévérance.", benefit: "Donnez-vous des outils pour distinguer les objections sérieuses, les caricatures et les vraies questions." },
  { key: "toussaint", month: 11, day: 1, subject: "{{prenom}}, une foi vécue et comprise", heading: "La sainteté n'est pas une abstraction", reflection: "La Toussaint montre la foi devenue vie dans des histoires très différentes. Elle invite chacun à avancer concrètement.", benefit: "Approfondissez votre foi pour mieux l'habiter et mieux la partager autour de vous." },
  { key: "christ-roi", month: 11, day: 23, subject: "{{prenom}}, remettre le Christ au centre", heading: "Revenir au centre", reflection: "La fête du Christ Roi recentre le regard : la foi chrétienne n'est pas d'abord une collection d'idées, mais une rencontre qui ordonne toute la vie.", benefit: "Choisissez une formation pour relier vos questions à une vision cohérente de la foi." },
  { key: "avent", month: 12, day: 1, subject: "{{prenom}}, préparer aussi l'intelligence", heading: "Veiller, c'est aussi se former", reflection: "L'Avent est un temps d'attente active. Il invite à préparer le cœur, mais aussi à rendre notre espérance plus consciente.", benefit: "Avancez avec un cours en ligne conçu pour nourrir une foi plus réfléchie et plus transmissible." },
  { key: "immaculee-conception", month: 12, day: 8, subject: "{{prenom}}, mieux comprendre pour mieux aimer", heading: "Comprendre ouvre à l'émerveillement", reflection: "L'Immaculée Conception rappelle que les affirmations de la foi méritent d'être découvertes dans leur cohérence, au-delà des raccourcis.", benefit: "Approfondissez les enseignements catholiques avec une méthode claire et respectueuse des questions." },
  { key: "noel", month: 12, day: 25, subject: "{{prenom}}, contempler et approfondir Noël", heading: "Le Verbe s'est fait chair", reflection: "Noël unit la simplicité de la crèche et la profondeur vertigineuse de l'Incarnation. Ce mystère peut nourrir toute une vie de réflexion.", benefit: "Prolongez votre contemplation par une formation qui aide à comprendre et transmettre la foi." }
];

const DAY_MS = 24 * 60 * 60 * 1000;

function occurrenceDistance(date: Date, template: CampaignTemplate) {
  const year = date.getUTCFullYear();
  return [-1, 0, 1]
    .map(offset => Math.abs(Date.UTC(year + offset, template.month - 1, template.day) - date.getTime()) / DAY_MS)
    .sort((a, b) => a - b)[0];
}

export function selectCampaignTemplate(date: Date) {
  return [...campaignTemplates].sort((left, right) => occurrenceDistance(date, left) - occurrenceDistance(date, right))[0];
}

function isoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return `${target.getUTCFullYear()}-${String(Math.ceil((((target.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7)).padStart(2, "0")}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildMarketingEmail(profile: MarketingProfile, date: Date, siteUrl: string): MarketingEmail {
  const template = selectCampaignTemplate(date);
  const firstName = profile.prenom?.trim() || "bonjour";
  const subject = template.subject.replace("{{prenom}}", firstName);
  const formationsUrl = `${siteUrl.replace(/\/$/, "")}/formations`;
  const unsubscribeUrl = `${siteUrl.replace(/\/$/, "")}/desabonnement?token=${encodeURIComponent(profile.marketing_unsubscribe_token)}`;
  const progress = profile.course_enrollments?.length
    ? "Vous avez déjà commencé à vous former. Une prochaine formation peut prolonger cet élan."
    : "Vous avez créé votre espace étudiant. Il ne vous reste qu'à choisir la formation qui vous aidera à avancer.";
  const callToAction = "Découvrir les formations";

  return {
    campaignKey: `${isoWeek(date)}-${template.key}`,
    subject,
    body: [
      `Bonjour ${firstName},`,
      "",
      template.reflection,
      "",
      progress,
      "",
      template.benefit,
      "",
      `${callToAction} : ${formationsUrl}`,
      "",
      `Vous recevez ce message car vous avez choisi de recevoir les actualités de l'Institut Irénée. Se désabonner : ${unsubscribeUrl}`
    ].join("\n"),
    htmlBody: `
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <h2>${escapeHtml(template.heading)}</h2>
      <p>${escapeHtml(template.reflection)}</p>
      <p>${escapeHtml(progress)}</p>
      <p>${escapeHtml(template.benefit)}</p>
      <p><a href="${escapeHtml(formationsUrl)}"><strong>${escapeHtml(callToAction)}</strong></a></p>
      <hr>
      <p style="font-size:12px;color:#666">
        Vous recevez ce message car vous avez choisi de recevoir les actualités de l'Institut Irénée.
        <a href="${escapeHtml(unsubscribeUrl)}">Se désabonner</a>.
      </p>
    `.trim()
  };
}
