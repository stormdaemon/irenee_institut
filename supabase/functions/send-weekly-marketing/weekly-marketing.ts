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

type DateRule = "easter" | "divine-misericorde" | "pentecote" | "christ-roi" | "avent";

type CampaignTemplate = {
  key: string;
  month?: number;
  day?: number;
  dateRule?: DateRule;
  event: string;
  subject: string;
  heading: string;
  hook: string;
  reflection: string;
  stakes: string;
  benefit: string;
  urgency: string;
};

export const campaignTemplates: CampaignTemplate[] = [
  {
    key: "epiphanie",
    month: 1,
    day: 6,
    event: "l'Épiphanie",
    subject: "{{prenom}}, ne laissez pas vos questions sans réponse",
    heading: "La foi n'a jamais demandé de cesser de chercher",
    hook: "Les mages ne se sont pas contentés d'apercevoir un signe. Ils se sont mis en route.",
    reflection: "L'Épiphanie rappelle que l'intelligence peut conduire vers le Christ. Une question sincère n'est pas une menace pour la foi : c'est souvent le début d'un chemin.",
    stakes: "Mais une question laissée sans réponse finit rarement par disparaître. Elle revient au détour d'une discussion, d'une vidéo ou d'une objection entendue mille fois. Sans méthode, on hésite, on improvise ou l'on se tait.",
    benefit: "Une formation structurée vous aide à relier les questions aux sources, à distinguer les vraies objections des raccourcis et à répondre avec davantage de précision.",
    urgency: "L'Épiphanie est le bon moment pour sortir de l'intention vague. Choisissez votre premier parcours pendant que cette invitation à chercher est encore vive."
  },
  {
    key: "saint-paul",
    month: 1,
    day: 25,
    event: "la conversion de saint Paul",
    subject: "{{prenom}}, préparez votre prochaine réponse",
    heading: "Une conviction forte mérite des fondations solides",
    hook: "Saint Paul ne s'est pas arrêté à une émotion forte. Il a consacré sa vie à comprendre, annoncer et répondre.",
    reflection: "Sa conversion montre qu'une rencontre avec le Christ ouvre un chemin de mission, mais aussi d'approfondissement. La ferveur ne remplace pas la formation : elle lui donne son sens.",
    stakes: "Quand une objection surgit sur l'Église, l'Écriture ou la crédibilité de la foi, la bonne volonté ne suffit pas toujours. Une réponse floue peut laisser l'autre sur sa faim et vous donner l'impression de ne pas être prêt.",
    benefit: "Nos cours vous donnent une méthode pour ordonner vos idées, retrouver les sources utiles et parler avec clarté sans perdre la charité.",
    urgency: "Ne laissez pas votre prochaine conversation vous prendre au dépourvu. Commencez maintenant à construire la réponse que vous aimeriez pouvoir donner demain."
  },
  {
    key: "presentation",
    month: 2,
    day: 2,
    event: "la Présentation du Seigneur",
    subject: "{{prenom}}, apportez une réponse plus claire",
    heading: "Une lumière n'est utile que si elle éclaire vraiment",
    hook: "Syméon reconnaît une lumière offerte à tous. Encore faut-il apprendre à la présenter sans la rendre floue.",
    reflection: "La Présentation du Seigneur invite à recevoir la foi avec profondeur, puis à la rendre intelligible. Une parole catholique claire n'abaisse pas le mystère : elle aide à y entrer.",
    stakes: "Beaucoup de discussions s'enlisent parce que les mots ne sont pas définis et que les sujets sont abordés dans le désordre. On parle beaucoup, mais personne ne comprend mieux.",
    benefit: "La formation vous apprend à poser les bases, à distinguer les questions et à construire une réponse progressive, accessible et fidèle.",
    urgency: "Cette semaine, ne collectionnez pas une ressource de plus à consulter un jour. Choisissez un parcours et faites le premier pas."
  },
  {
    key: "lourdes",
    month: 2,
    day: 11,
    event: "Notre-Dame de Lourdes",
    subject: "{{prenom}}, simplicité ne veut pas dire imprécision",
    heading: "Une foi simple n'est pas une foi simpliste",
    hook: "La simplicité de Bernadette touche encore parce qu'elle n'est ni creuse ni artificielle.",
    reflection: "À Lourdes, une parole simple rejoint des générations entières. La simplicité chrétienne ne refuse pas l'intelligence : elle va à l'essentiel et parle juste.",
    stakes: "À force de chercher une formule rapide, on finit parfois par donner une réponse fragile. Et face à une objection sérieuse, une formule fragile s'effondre vite.",
    benefit: "Formez-vous pour expliquer la foi avec des mots accessibles, des repères solides et la capacité de reconnaître honnêtement les nuances.",
    urgency: "Vous n'avez pas besoin d'attendre de tout savoir. Vous avez besoin de commencer. Ouvrez votre premier parcours cette semaine."
  },
  {
    key: "saint-joseph",
    month: 3,
    day: 19,
    event: "la fête de saint Joseph",
    subject: "{{prenom}}, bâtissez des fondations solides",
    heading: "Une conviction durable se construit",
    hook: "Saint Joseph rappelle une vérité peu spectaculaire mais décisive : ce qui dure se bâtit par des actes concrets.",
    reflection: "On ne devient pas capable de répondre avec calme et précision en accumulant des onglets ouverts. Il faut un chemin, un ordre et une régularité.",
    stakes: "Sans fondations, chaque nouvelle objection semble recommencer la discussion à zéro. Vous perdez du temps, vous doutez de vos réponses et vous laissez les sujets importants dans la pile des choses à revoir.",
    benefit: "Un parcours en ligne vous permet d'avancer à votre rythme tout en suivant une progression conçue pour consolider réellement vos bases.",
    urgency: "Ne reportez pas encore votre formation à une semaine plus calme qui n'arrivera probablement pas. Posez aujourd'hui la première pierre."
  },
  {
    key: "annonciation",
    month: 3,
    day: 25,
    event: "l'Annonciation",
    subject: "{{prenom}}, donnez une réponse éclairée",
    heading: "Répondre librement suppose de comprendre",
    hook: "Au cœur de l'Annonciation, il y a une réponse libre. Une réponse qui écoute, discerne et s'engage.",
    reflection: "Approfondir la foi n'est pas ajouter une couche intellectuelle froide à la vie chrétienne. C'est donner davantage de profondeur à son oui.",
    stakes: "Lorsque la foi reste composée de souvenirs dispersés, les objections les plus banales peuvent sembler plus fortes qu'elles ne le sont. Ce n'est pas une fatalité.",
    benefit: "Nos formations vous aident à comprendre ce que l'Église croit, pourquoi elle le croit et comment l'expliquer sans réciter une réponse toute faite.",
    urgency: "L'Annonciation est une invitation à répondre. Faites de cette semaine le moment où votre intention de vous former devient un choix concret."
  },
  {
    key: "paques",
    dateRule: "easter",
    event: "Pâques",
    subject: "{{prenom}}, allez au cœur de la foi",
    heading: "Tout se joue autour de la Résurrection",
    hook: "Si la Résurrection est au centre de la foi chrétienne, elle ne peut pas rester un sujet que l'on connaît seulement de loin.",
    reflection: "Pâques annonce un événement décisif. Le tombeau vide, le témoignage des apôtres et la transformation des disciples méritent mieux qu'une réponse improvisée.",
    stakes: "Quand la conversation touche à la crédibilité du christianisme, contourner la question ne protège personne. Cela laisse simplement le terrain aux caricatures et aux réponses toutes faites.",
    benefit: "Une démarche apologétique rigoureuse vous aide à prendre les objections au sérieux, à examiner les faits avec prudence et à revenir au centre : le Christ vivant.",
    urgency: "Ne laissez pas retomber l'élan de Pâques sans approfondir son cœur historique. Choisissez votre parcours pendant ce temps pascal."
  },
  {
    key: "divine-misericorde",
    dateRule: "divine-misericorde",
    event: "la Divine Miséricorde",
    subject: "{{prenom}}, répondez sans écraser",
    heading: "La vérité n'a pas besoin de brutalité",
    hook: "Répondre clairement ne veut pas dire parler plus fort. Cela veut dire servir la vérité sans oublier la personne.",
    reflection: "La Divine Miséricorde rappelle que la vérité chrétienne a un visage. Une réponse juste éclaire ; elle ne cherche pas à humilier.",
    stakes: "Sans formation, on bascule facilement entre deux mauvaises options : éviter les sujets difficiles ou répondre trop vite. Dans les deux cas, la conversation se ferme.",
    benefit: "Apprenez à identifier l'objection réelle, à répondre avec précision et à garder une parole à la fois ferme, patiente et respectueuse.",
    urgency: "Cette semaine, transformez votre désir de mieux répondre en discipline concrète. Un premier cours vaut mieux qu'une nouvelle bonne résolution."
  },
  {
    key: "pentecote",
    dateRule: "pentecote",
    event: "la Pentecôte",
    subject: "{{prenom}}, ne restez plus sans réponse",
    heading: "Il est temps de trouver les mots",
    hook: "À la Pentecôte, les disciples sortent de la peur. Ils parlent enfin dans une langue que chacun peut entendre.",
    reflection: "Vous connaissez peut-être cette sensation : une vraie question arrive, vous avez l'intuition de la réponse, mais les mots ne viennent pas assez clairement. Puis la conversation passe à autre chose.",
    stakes: "À force de remettre la formation à plus tard, les mêmes occasions se perdent : une discussion en famille, une objection au travail, une vidéo trompeuse partagée sans réponse, un proche qui cherche sincèrement.",
    benefit: "L'Institut Irénée vous aide à construire une parole claire, documentée et charitable pour ne plus dépendre de l'improvisation au moment décisif.",
    urgency: "La Pentecôte n'est pas une invitation à attendre passivement. Profitez de cette semaine pour choisir le parcours qui donnera plus de structure à votre témoignage."
  },
  {
    key: "saint-irenee",
    month: 6,
    day: 28,
    event: "la fête de saint Irénée",
    subject: "{{prenom}}, ne laissez pas le flou gagner",
    heading: "Recevoir, comprendre, transmettre",
    hook: "Saint Irénée n'a pas défendu la foi avec des slogans. Il est revenu à sa cohérence, à ses sources et à la tradition reçue.",
    reflection: "C'est exactement l'ambition de l'Institut qui porte son nom : former des catholiques capables de comprendre ce qu'ils croient et de le transmettre avec rigueur.",
    stakes: "Le flou coûte cher. Il laisse les objections circuler sans réponse, fatigue les échanges et donne l'impression que la foi ne pourrait être défendue qu'en évitant les questions difficiles.",
    benefit: "Nos formations rassemblent les repères qui manquent souvent : sources, méthode, ordre des questions et articulation entre vérité et charité.",
    urgency: "La fête de saint Irénée est le moment le plus naturel pour commencer. Ne laissez pas passer une nouvelle semaine avant de choisir votre parcours."
  },
  {
    key: "saints-pierre-paul",
    month: 6,
    day: 29,
    event: "la fête des saints Pierre et Paul",
    subject: "{{prenom}}, affermissez votre témoignage",
    heading: "Des parcours différents, une même mission",
    hook: "Pierre et Paul n'avaient ni le même tempérament ni la même histoire. Mais ils savaient pour qui ils parlaient.",
    reflection: "Leur fête rappelle qu'un témoignage solide ne consiste pas à imiter un style. Il consiste à approfondir la même foi pour la transmettre avec fidélité.",
    stakes: "Sans cadre, on accumule des arguments isolés sans savoir quand les utiliser. Cela donne des conversations désordonnées et une confiance fragile.",
    benefit: "La formation vous aide à relier les sujets, à progresser dans le bon ordre et à adapter votre réponse à la personne qui se trouve devant vous.",
    urgency: "Ne laissez pas votre désir de témoigner rester abstrait. Choisissez cette semaine le parcours qui affermira votre prochaine prise de parole."
  },
  {
    key: "transfiguration",
    month: 8,
    day: 6,
    event: "la Transfiguration",
    subject: "{{prenom}}, prenez enfin de la hauteur",
    heading: "Voir plus clairement change la manière de parler",
    hook: "La Transfiguration invite à lever les yeux. À quitter la réaction immédiate pour retrouver le centre.",
    reflection: "L'été peut être un temps de respiration, mais aussi le moment idéal pour prendre du recul et ordonner ce que vous voulez vraiment approfondir.",
    stakes: "Si vous attendez la rentrée parfaite, votre formation risque de revenir derrière toutes les urgences du quotidien. Les questions, elles, continueront d'arriver.",
    benefit: "Profitez d'un rythme plus calme pour commencer en ligne une formation progressive, exigeante et accessible depuis votre espace étudiant.",
    urgency: "Utilisez cette fenêtre d'été. Commencez maintenant, avant que les semaines plus chargées ne reprennent toute la place."
  },
  {
    key: "assomption",
    month: 8,
    day: 15,
    event: "l'Assomption",
    subject: "{{prenom}}, votre foi mérite plus que des raccourcis",
    heading: "L'espérance chrétienne engage toute la personne",
    hook: "L'Assomption ne se comprend pas en une formule expédiée. Elle ouvre une vision cohérente de l'homme, du salut et de l'espérance.",
    reflection: "Les enseignements catholiques sont souvent réduits à des caricatures. Pour y répondre, il faut retrouver l'ensemble plutôt que juxtaposer des fragments.",
    stakes: "Une foi composée de réponses isolées devient vite vulnérable aux raccourcis. Chaque question paraît indépendante alors qu'elle appartient souvent à une cohérence plus vaste.",
    benefit: "Nos parcours vous apprennent à relier les grandes questions de la foi dans un cadre progressif et exigeant.",
    urgency: "Ne laissez pas une nouvelle objection vous rappeler que vous vouliez vous former. Commencez avant la fin de cette semaine."
  },
  {
    key: "nativite-marie",
    month: 9,
    day: 8,
    event: "la Nativité de Marie",
    subject: "{{prenom}}, commencez petit, mais commencez",
    heading: "Les commencements modestes portent du fruit",
    hook: "La Nativité de Marie ouvre discrètement une histoire immense. Tout n'a pas besoin d'être spectaculaire pour être décisif.",
    reflection: "Commencer une formation ne demande pas de réorganiser toute votre vie. Cela demande de choisir une première étape et de lui faire réellement une place.",
    stakes: "Le piège le plus courant n'est pas de manquer de ressources. C'est d'en accumuler sans jamais suivre un chemin assez longtemps pour progresser.",
    benefit: "Un premier module vous donne une direction claire, puis chaque étape consolide votre capacité à comprendre et à transmettre.",
    urgency: "N'attendez pas d'avoir davantage de temps. Choisissez un premier parcours et donnez-lui une place réelle dans votre semaine."
  },
  {
    key: "saint-michel",
    month: 9,
    day: 29,
    event: "la fête de saint Michel",
    subject: "{{prenom}}, apprenez à discerner les objections",
    heading: "Toutes les objections ne se valent pas",
    hook: "Former son discernement, c'est apprendre à reconnaître la vraie question derrière le bruit.",
    reflection: "Certaines objections méritent une réponse précise. D'autres reposent sur un malentendu. D'autres encore cherchent seulement le conflit. Répondre à tout de la même manière est une erreur.",
    stakes: "Sans méthode, vous dépensez votre énergie sur de faux débats et vous passez parfois à côté de la personne qui posait une question sincère.",
    benefit: "La formation vous donne des critères pour distinguer les caricatures, les objections sérieuses et les occasions réelles de dialogue.",
    urgency: "Ne perdez plus une semaine à subir le bruit ambiant. Donnez-vous les outils pour discerner et répondre plus justement."
  },
  {
    key: "toussaint",
    month: 11,
    day: 1,
    event: "la Toussaint",
    subject: "{{prenom}}, une foi vécue doit aussi être comprise",
    heading: "La sainteté n'est pas une abstraction",
    hook: "Les saints n'ont pas vécu une foi vague. Leur vie avait un centre, une cohérence et une direction.",
    reflection: "La Toussaint montre la foi devenue vie dans des histoires très différentes. Elle rappelle que comprendre davantage n'est pas un luxe réservé aux spécialistes.",
    stakes: "Lorsque la foi reste imprécise, elle devient plus difficile à transmettre et plus facile à réduire à quelques habitudes. Ce que l'on ne sait pas expliquer finit souvent par sembler secondaire.",
    benefit: "Approfondissez votre foi pour mieux l'habiter, mieux en parler et mieux répondre aux questions de ceux qui vous entourent.",
    urgency: "La Toussaint vous place devant des vies qui ont choisi d'avancer. Faites vous aussi un choix concret cette semaine."
  },
  {
    key: "christ-roi",
    dateRule: "christ-roi",
    event: "la fête du Christ Roi",
    subject: "{{prenom}}, revenez au centre",
    heading: "Ne laissez pas les questions secondaires prendre toute la place",
    hook: "La fête du Christ Roi recentre le regard : la foi chrétienne n'est pas une collection d'opinions dispersées.",
    reflection: "On peut passer beaucoup de temps à répondre à des objections isolées tout en perdant la cohérence d'ensemble. Le Christ demeure le centre à partir duquel tout s'ordonne.",
    stakes: "Sans vision structurée, vous risquez de courir d'un sujet à l'autre et de rester dépendant de la dernière vidéo ou du dernier débat rencontré en ligne.",
    benefit: "Choisissez une formation qui relie les questions à une vision cohérente de la foi catholique et vous aide à progresser sans vous disperser.",
    urgency: "À la fin de l'année liturgique, revenez au centre. Décidez maintenant du parcours qui donnera une direction à votre approfondissement."
  },
  {
    key: "avent",
    dateRule: "avent",
    event: "l'Avent",
    subject: "{{prenom}}, préparez aussi votre intelligence",
    heading: "Attendre activement, c'est aussi se former",
    hook: "L'Avent n'est pas un temps vide. C'est un temps de préparation, d'attention et de décisions simples.",
    reflection: "Préparer son cœur n'exclut pas de préparer son intelligence. Une espérance mieux comprise devient aussi une espérance plus facile à transmettre.",
    stakes: "Décembre passe vite. Si vous ne choisissez pas une étape concrète, la formation restera probablement dans la liste des choses importantes repoussées à janvier.",
    benefit: "Commencez un cours en ligne conçu pour nourrir une foi plus réfléchie, plus cohérente et plus transmissible.",
    urgency: "N'attendez pas une résolution de janvier. Faites de l'Avent un vrai temps de préparation et choisissez votre parcours cette semaine."
  },
  {
    key: "immaculee-conception",
    month: 12,
    day: 8,
    event: "l'Immaculée Conception",
    subject: "{{prenom}}, sortez des réponses approximatives",
    heading: "Comprendre ouvre à l'émerveillement",
    hook: "Les affirmations catholiques deviennent vite des caricatures lorsque personne ne prend le temps d'expliquer leur cohérence.",
    reflection: "L'Immaculée Conception en est un exemple évident. Une réponse juste demande des distinctions, des sources et un peu de méthode.",
    stakes: "Une réponse approximative ne convainc pas. Pire : elle peut renforcer le malentendu que vous essayiez précisément de corriger.",
    benefit: "Approfondissez les enseignements catholiques avec une démarche claire, fidèle aux sources et respectueuse des questions réelles.",
    urgency: "Ne laissez pas les mêmes confusions revenir chaque année. Faites de cette semaine le début d'un approfondissement plus sérieux."
  },
  {
    key: "noel",
    month: 12,
    day: 25,
    event: "Noël",
    subject: "{{prenom}}, ne réduisez pas Noël à une habitude",
    heading: "Le Verbe s'est fait chair",
    hook: "La crèche paraît familière. Pourtant, l'Incarnation reste l'une des affirmations les plus vertigineuses de la foi chrétienne.",
    reflection: "Noël unit la simplicité d'une naissance et la profondeur d'un mystère qui peut nourrir toute une vie de réflexion.",
    stakes: "Ce qui devient familier peut finir par sembler évident, puis secondaire. Sans approfondissement, on peine à expliquer pourquoi Noël change réellement la vision chrétienne de Dieu et de l'homme.",
    benefit: "Prolongez votre contemplation par une formation qui vous aide à comprendre, structurer et transmettre la foi avec davantage de force.",
    urgency: "Ne laissez pas Noël disparaître derrière le rythme des fêtes. Choisissez avant la fin de cette semaine le parcours qui prolongera votre réflexion."
  }
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SALES_BULLETS = [
  "Structurer vos réponses au lieu d'improviser lorsque la discussion devient sérieuse.",
  "Identifier la vraie objection et retrouver les sources utiles sans vous disperser.",
  "Parler de la foi catholique avec davantage de clarté, de rigueur et de charité."
];

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + (days * DAY_MS));
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = ((19 * a) + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + (2 * e) + (2 * i) - h - k) % 7;
  const m = Math.floor((a + (11 * h) + (22 * l)) / 451);
  const month = Math.floor((h + l - (7 * m) + 114) / 31);
  const day = ((h + l - (7 * m) + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function firstSundayOfAdvent(year: number) {
  for (let day = 27; day <= 33; day += 1) {
    const candidate = new Date(Date.UTC(year, 10, day));
    if (candidate.getUTCDay() === 0) return candidate;
  }
  throw new Error(`Unable to resolve Advent for ${year}`);
}

export function resolveCampaignDate(template: CampaignTemplate, year: number) {
  switch (template.dateRule) {
    case "easter":
      return easterSunday(year);
    case "divine-misericorde":
      return addUtcDays(easterSunday(year), 7);
    case "pentecote":
      return addUtcDays(easterSunday(year), 49);
    case "avent":
      return firstSundayOfAdvent(year);
    case "christ-roi":
      return addUtcDays(firstSundayOfAdvent(year), -7);
    default:
      if (!template.month || !template.day) throw new Error(`Missing date for ${template.key}`);
      return new Date(Date.UTC(year, template.month - 1, template.day));
  }
}

function occurrenceDistance(date: Date, template: CampaignTemplate) {
  const year = date.getUTCFullYear();
  return [-1, 0, 1]
    .map(offset => Math.abs(resolveCampaignDate(template, year + offset).getTime() - date.getTime()) / DAY_MS)
    .sort((left, right) => left - right)[0];
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

function nextSunday(date: Date) {
  const daysUntilSunday = 7 - date.getUTCDay();
  return addUtcDays(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())), daysUntilSunday);
}

function formatFrenchDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC"
  }).format(date);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCta(url: string) {
  return `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:26px 0 28px">
      <tr>
        <td bgcolor="#e5bd34" style="border-radius:4px">
          <a href="${escapeHtml(url)}" class="cta" style="display:inline-block;padding:15px 22px;color:#071d49;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:20px;text-decoration:none">
            Voir les formations
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildMarketingEmail(profile: MarketingProfile, date: Date, siteUrl: string): MarketingEmail {
  const template = selectCampaignTemplate(date);
  const firstName = profile.prenom?.trim() || "cher étudiant";
  const subject = template.subject.replace("{{prenom}}", firstName);
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const formationsUrl = `${normalizedSiteUrl}/formations`;
  const unsubscribeUrl = `${normalizedSiteUrl}/desabonnement?token=${encodeURIComponent(profile.marketing_unsubscribe_token)}`;
  const logoUrl = `${normalizedSiteUrl}/images/logo_with_text.png`;
  const deadline = formatFrenchDate(nextSunday(date));
  const hasStarted = Boolean(profile.course_enrollments?.length);
  const progressHeading = hasStarted
    ? "Vous avez déjà commencé. Ne restez pas au milieu du chemin."
    : "Votre espace étudiant est prêt. La prochaine étape vous appartient.";
  const progress = hasStarted
    ? "Vous avez déjà ouvert une première formation. C'est une bonne décision, mais une progression réelle vient de la régularité. Choisissez maintenant la suite qui consolidera ce que vous avez commencé."
    : "Vous avez créé votre espace étudiant, mais vous n'avez pas encore choisi votre première formation. Tant que ce choix reste à faire, vos questions restent exactement au même point.";
  const preheader = `${template.heading}. Choisissez votre parcours avant ${deadline}.`;
  const deadlineCopy = `Si vous voulez profiter de l'élan de ${template.event}, prenez dix minutes avant ${deadline} pour choisir votre parcours.`;
  const cta = renderCta(formationsUrl);

  return {
    campaignKey: `${isoWeek(date)}-${template.key}`,
    subject,
    body: [
      `Bonjour ${firstName},`,
      "",
      template.hook,
      "",
      template.reflection,
      "",
      template.stakes,
      "",
      progressHeading,
      progress,
      "",
      "Ne remettez pas votre formation à plus tard.",
      template.urgency,
      deadlineCopy,
      "",
      "Voir les formations :",
      formationsUrl,
      "",
      "Vous allez pouvoir :",
      ...SALES_BULLETS.map(bullet => `- ${bullet}`),
      "",
      template.benefit,
      "",
      "Vous n'avez pas besoin de tout savoir avant de commencer. Vous avez besoin d'un chemin assez clair pour avancer sérieusement.",
      "",
      "Ne laissez pas passer une nouvelle semaine :",
      formationsUrl,
      "",
      `P.S. Une nouvelle objection arrivera tôt ou tard. La vraie question est simple : voulez-vous encore improviser, ou commencer à vous préparer dès maintenant ? ${formationsUrl}`,
      "",
      `Vous recevez cette lettre hebdomadaire car vous avez activé les actualités, ressources et offres de formations de l'Institut Irénée. Se désabonner : ${unsubscribeUrl}`
    ].join("\n"),
    htmlBody: `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            @media screen and (max-width: 640px) {
              .email-shell { width: 100% !important; }
              .email-pad { padding: 26px 20px !important; }
              .cta { display: block !important; text-align: center !important; }
              h1 { font-size: 28px !important; line-height: 34px !important; }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;background:#f4efe5">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4efe5">
            <tr>
              <td align="center" style="padding:24px 12px">
                <table role="presentation" class="email-shell" width="640" border="0" cellspacing="0" cellpadding="0" bgcolor="#fffdf8" style="width:640px;max-width:640px;background:#fffdf8;border:1px solid #e5d8bc">
                  <tr>
                    <td align="center" bgcolor="#071d49" style="padding:24px 20px 20px;background:#071d49">
                      <a href="${escapeHtml(normalizedSiteUrl)}" style="text-decoration:none">
                        <img src="${escapeHtml(logoUrl)}" width="184" alt="Institut d&#039;Apologétique Saint Irénée" style="display:block;width:184px;max-width:100%;height:auto;border:0">
                      </a>
                      <p style="margin:16px 0 0;color:#e5bd34;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase">
                        Lettre hebdomadaire · Formation catholique en ligne
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-pad" style="padding:38px 44px;color:#071630;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.7;text-align:left">
                      <p style="margin:0 0 18px">Bonjour ${escapeHtml(firstName)},</p>
                      <p style="margin:0 0 12px;color:#9a2020;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(template.event)}</p>
                      <h1 style="margin:0 0 20px;color:#071d49;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:40px">${escapeHtml(template.heading)}</h1>
                      <p style="margin:0 0 18px;font-size:19px;line-height:1.6"><strong>${escapeHtml(template.hook)}</strong></p>
                      <p style="margin:0 0 18px">${escapeHtml(template.reflection)}</p>
                      <p style="margin:0 0 20px">${escapeHtml(template.stakes)}</p>
                      ${cta}
                      <h2 style="margin:30px 0 12px;color:#071d49;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px">${escapeHtml(progressHeading)}</h2>
                      <p style="margin:0 0 20px">${escapeHtml(progress)}</p>
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#fff8dd" style="margin:26px 0;background:#fff8dd;border-left:4px solid #e5bd34">
                        <tr>
                          <td style="padding:18px 20px">
                            <p style="margin:0 0 8px;color:#9a2020;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Ne remettez pas votre formation à plus tard</p>
                            <p style="margin:0 0 8px"><strong>${escapeHtml(template.urgency)}</strong></p>
                            <p style="margin:0">${escapeHtml(deadlineCopy)}</p>
                          </td>
                        </tr>
                      </table>
                      <h2 style="margin:30px 0 12px;color:#071d49;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px">Vous allez pouvoir :</h2>
                      <ul style="margin:0 0 20px;padding-left:22px">
                        ${SALES_BULLETS.map(bullet => `<li style="margin:0 0 10px">${escapeHtml(bullet)}</li>`).join("")}
                      </ul>
                      <p style="margin:0 0 18px">${escapeHtml(template.benefit)}</p>
                      <p style="margin:0 0 18px"><strong>Vous n'avez pas besoin de tout savoir avant de commencer.</strong> Vous avez besoin d'un chemin assez clair pour avancer sérieusement.</p>
                      ${cta}
                      <p style="margin:0 0 18px">Ne laissez pas passer une nouvelle semaine en espérant être mieux préparé la prochaine fois. Choisissez votre parcours et commencez.</p>
                      ${cta}
                      <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e5d8bc;font-size:15px"><strong>P.S.</strong> Une nouvelle objection arrivera tôt ou tard. La vraie question est simple : voulez-vous encore improviser, ou commencer à vous préparer dès maintenant ?</p>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#071d49" style="padding:22px 28px;background:#071d49;color:#f5ecd9;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;text-align:center">
                      <p style="margin:0 0 8px"><strong>Institut d'Apologétique Saint Irénée</strong></p>
                      <p style="margin:0">Vous recevez cette lettre hebdomadaire car vous avez activé les actualités, ressources et offres de formations de l'Institut Irénée.</p>
                      <p style="margin:8px 0 0"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#e5bd34;text-decoration:underline">Se désabonner</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `.trim()
  };
}
