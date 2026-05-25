import { schoolArticles } from "./blog-school";

export type BlogSource = {
  id: string;
  label: string;
  url: string;
};

export type BlogSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readingMinutes: number;
  image: string;
  imageAlt: string;
  tags: string[];
  featured?: boolean;
  intro: string[];
  sections: BlogSection[];
  takeaways: string[];
  sources: BlogSource[];
};

type ArticleSeed = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readingMinutes: number;
  image: keyof typeof imageLibrary;
  tags: string[];
  featured?: boolean;
  intro: [string, string];
  fact: string;
  anchor: string;
  shepherd: string;
  response: string;
  takeaways: string[];
  sources: string[];
};

const imageLibrary = {
  institut: {
    src: "/images/blog/institut-apologetique-france.png",
    alt: "Salle d'etude gothique avec manuscrits ouverts, carte de France sur parchemin et lumiere de vitrail"
  },
  shepherd: {
    src: "/images/blog/ecole-bon-pasteur.png",
    alt: "Evangile ouvert, houlette pastorale et lumiere de vitrail pour evoquer le Bon Pasteur"
  },
  reason: {
    src: "/images/blog/foi-raison.png",
    alt: "Manuscrit, astrolabe et telescope dans une bibliotheque monastique"
  },
  scripture: {
    src: "/images/blog/ecriture-tradition-magistere.png",
    alt: "Bible ancienne, parchemin scelle et cordon tresse dans une chapelle bibliotheque"
  },
  science: {
    src: "/images/blog/science-foi.png",
    alt: "Telescope et carte du ciel devant une fenetre gothique ouverte sur les etoiles"
  },
  fathers: {
    src: "/images/blog/peres-eglise.png",
    alt: "Scriptorium ancien avec codices, papyrus et lueur de mosaique byzantine"
  },
  dialogue: {
    src: "/images/blog/dialogue-charite.png",
    alt: "Table de cloître avec livres ouverts, bougie et jardin paisible"
  },
  resurrection: {
    src: "/images/blog/resurrection-credibilite.png",
    alt: "Tombeau de pierre ouvert au lever du soleil dans un jardin ancien"
  },
  history: {
    src: "/images/blog/histoire-eglise-conciles.png",
    alt: "Frise manuscrite illuminee avec sceaux, cierges et silhouettes de cathedrales"
  },
  digital: {
    src: "/images/blog/mission-numerique.png",
    alt: "Telephone moderne pose sur un bureau ancien avec livres, carnet et bougie"
  },
  marian: {
    src: "/images/blog/marie-saints-devotion.png",
    alt: "Autel lateral, rosace mariale, cierges, lys et livre de priere ferme"
  }
} as const;

const sourceCatalog: Record<string, BlogSource> = {
  ireneeFormations: {
    id: "ireneeFormations",
    label: "Institut Irénée - Nos formations",
    url: "/formations"
  },
  ireneeAPropos: {
    id: "ireneeAPropos",
    label: "Institut Irénée - À propos",
    url: "/a-propos"
  },
  fidesRatio: {
    id: "fidesRatio",
    label: "Jean-Paul II, Fides et Ratio",
    url: "https://www.vatican.va/content/john-paul-ii/fr/encyclicals/documents/hf_jp-ii_enc_14091998_fides-et-ratio.html"
  },
  deiVerbum: {
    id: "deiVerbum",
    label: "Concile Vatican II, Dei Verbum",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_fr.html"
  },
  catechism: {
    id: "catechism",
    label: "Catéchisme de l'Église catholique",
    url: "https://www.vatican.va/archive/FRA0013/_INDEX.HTM"
  },
  nostraAetate: {
    id: "nostraAetate",
    label: "Concile Vatican II, Nostra Aetate",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_fr.html"
  },
  dignitatisHumanae: {
    id: "dignitatisHumanae",
    label: "Concile Vatican II, Dignitatis Humanae",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651207_dignitatis-humanae_fr.html"
  },
  lumenGentium: {
    id: "lumenGentium",
    label: "Concile Vatican II, Lumen Gentium",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_fr.html"
  },
  aelfJohn10: {
    id: "aelfJohn10",
    label: "AELF, Évangile selon saint Jean 10",
    url: "https://www.aelf.org/bible/Jn/10"
  },
  saintIrenee: {
    id: "saintIrenee",
    label: "Vatican, saint Irénée de Lyon docteur de l'unité",
    url: "https://www.vatican.va/content/francesco/fr/apost_letters/documents/20220121-santireneo-dottoredellachiesa.html"
  },
  justin: {
    id: "justin",
    label: "Britannica, Justin Martyr",
    url: "https://www.britannica.com/biography/Saint-Justin-Martyr"
  },
  tertullian: {
    id: "tertullian",
    label: "Britannica, Tertullian",
    url: "https://www.britannica.com/biography/Tertullian"
  },
  origen: {
    id: "origen",
    label: "Britannica, Origen",
    url: "https://www.britannica.com/biography/Origen"
  },
  augustine: {
    id: "augustine",
    label: "Britannica, Saint Augustine",
    url: "https://www.britannica.com/biography/Saint-Augustine"
  },
  aquinas: {
    id: "aquinas",
    label: "Vatican, saint Thomas d'Aquin",
    url: "https://www.vatican.va/content/benedict-xvi/fr/audiences/2010/documents/hf_ben-xvi_aud_20100602.html"
  },
  britannicaNicaea: {
    id: "britannicaNicaea",
    label: "Britannica, Council of Nicaea",
    url: "https://www.britannica.com/event/First-Council-of-Nicaea-325"
  },
  codexSinaiticus: {
    id: "codexSinaiticus",
    label: "British Library, Codex Sinaiticus",
    url: "https://www.bl.uk/collection-items/codex-sinaiticus"
  },
  deadSeaScrolls: {
    id: "deadSeaScrolls",
    label: "Britannica, Dead Sea Scrolls",
    url: "https://www.britannica.com/topic/Dead-Sea-Scrolls"
  },
  vaticanObservatory: {
    id: "vaticanObservatory",
    label: "Vatican Observatory",
    url: "https://www.vaticanobservatory.org/"
  },
  lemaltre: {
    id: "lemaltre",
    label: "Vatican Observatory, Georges Lemaître",
    url: "https://www.vaticanobservatory.org/sacred-space-astronomy/georges-lemaitre-the-priest-who-conceived-the-big-bang/"
  },
  pasEvolution: {
    id: "pasEvolution",
    label: "Académie pontificale des sciences, message de Jean-Paul II sur l'évolution",
    url: "https://www.pas.va/en/magisterium/john-paul-ii/1996-22-october.html"
  },
  ibp: {
    id: "ibp",
    label: "Institut du Bon Pasteur",
    url: "https://institutdubonpasteur.org/"
  }
};

function sources(ids: string[]) {
  return ids.map(id => sourceCatalog[id]).filter(Boolean);
}

function makeArticle(seed: ArticleSeed): BlogArticle {
  return {
    slug: seed.slug,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    date: seed.date,
    readingMinutes: seed.readingMinutes,
    image: `/images/blog/articles/${seed.slug}.webp`,
    imageAlt: `Illustration éditoriale de l'article « ${seed.title} »`,
    tags: seed.tags,
    featured: seed.featured,
    intro: [...seed.intro],
    sections: [
      {
        heading: "Le point de départ",
        paragraphs: [
          seed.fact,
          "Une vraie formation ne se contente pas d'empiler des réponses toutes faites. Elle apprend à regarder la question, à distinguer ce qui relève d'un fait, d'une blessure, d'une confusion ou d'un préjugé, puis à répondre avec une parole droite. C'est cette patience qui donne à l'apologétique catholique son visage le plus humain."
        ]
      },
      {
        heading: "Un repère solide pour penser",
        paragraphs: [
          seed.anchor,
          "La foi catholique ne demande donc pas de choisir entre l'intelligence et la prière. Elle demande plutôt que l'intelligence soit purifiée par l'humilité, et que la prière ne devienne pas une fuite devant les questions. C'est l'une des raisons pour lesquelles un Institut d'Apologétique a une place particulière dans le paysage français : il relie ce qui est souvent séparé."
        ]
      },
      {
        heading: "À l'école du Bon Pasteur",
        paragraphs: [
          seed.shepherd,
          "À l'école du Bon Pasteur, on n'apprend pas seulement à gagner un débat. On apprend à reconnaître une voix, à marcher derrière le Christ, à entrer par la porte de la vérité sans brutalité. L'expression dit bien le cap : suivre le Bon Pasteur, c'est laisser la clarté devenir service, et la doctrine devenir une manière de prendre soin des âmes."
        ]
      },
      {
        heading: "Comment en parler aujourd'hui",
        paragraphs: [
          seed.response,
          "Pour un étudiant de l'Institut Irénée, ce travail devient concret : lire les sources, comprendre les objections, parler simplement, ne jamais humilier l'interlocuteur et ne pas renoncer à la vérité. Comme premier Institut d'Apologétique en France, l'Institut Irénée veut former cette présence catholique capable de répondre avec netteté, douceur et courage."
        ]
      }
    ],
    takeaways: seed.takeaways,
    sources: sources(seed.sources)
  };
}

const seeds: ArticleSeed[] = [
  {
    slug: "institut-d-apologetique-irenee-france",
    title: "Institut d'Apologétique : pourquoi l'Institut Irénée compte en France",
    description: "Comprendre la place de l'Institut Irénée comme premier Institut d'Apologétique en France, au service d'une foi catholique claire, argumentée et charitable.",
    category: "Institut d'Apologétique",
    date: "2026-05-20",
    readingMinutes: 8,
    image: "institut",
    tags: ["Institut d'Apologétique", "Institut Irénée", "formation catholique"],
    featured: true,
    intro: [
      "La France possède une longue tradition de débats religieux, philosophiques et publics. Dans ce paysage, l'Institut Irénée assume une mission nette : offrir une formation catholique structurée pour rendre compte de la crédibilité de la foi.",
      "Être le premier Institut d'Apologétique en France ne signifie pas seulement ouvrir une porte nouvelle. Cela oblige à tenir ensemble la rigueur, la fidélité à l'Église, la pédagogie et la charité envers ceux qui interrogent, doutent ou contestent."
    ],
    fact: "L'apologétique chrétienne part d'un mot ancien qui signifie défense ou réponse raisonnée. Dans la tradition catholique, elle ne désigne pas une attitude agressive, mais l'effort pour présenter les raisons de croire, les sources de la foi, les faits historiques et la cohérence de la doctrine.",
    anchor: "L'encyclique Fides et Ratio rappelle que foi et raison ne sont pas deux ennemies. Cette conviction irrigue l'histoire catholique : l'intelligence humaine peut chercher le vrai, et la Révélation éclaire ce que l'homme ne peut pas atteindre seul.",
    shepherd: "À l'école du Bon Pasteur, la première leçon est de ne pas confondre force et dureté. Le Christ conduit parce qu'il connaît, appelle et donne sa vie. Un Institut d'Apologétique fidèle à cet esprit forme donc des témoins capables de parler sans écraser.",
    response: "Aujourd'hui, les objections circulent vite : vidéos courtes, discussions familiales, débats d'étudiants, questions sur la science, la morale, l'histoire de l'Église ou la Bible. Un institut donne une colonne vertébrale pour ne pas répondre au hasard et pour ne pas laisser les caricatures dicter le ton.",
    takeaways: [
      "L'apologétique catholique est une réponse raisonnée, pas une querelle.",
      "L'Institut Irénée assume une place pionnière en France.",
      "La formation unit sources, méthode, clarté et charité.",
      "Le Bon Pasteur donne le style : vérité ferme, coeur humble."
    ],
    sources: ["ireneeFormations", "fidesRatio", "catechism", "aelfJohn10"]
  },
  {
    slug: "premier-institut-apologetique-france",
    title: "Premier Institut d'Apologétique en France : ce que cela change pour les étudiants",
    description: "Pourquoi une formation dédiée à l'apologétique change la manière d'étudier, de répondre et de transmettre la foi catholique.",
    category: "Institut d'Apologétique",
    date: "2026-05-19",
    readingMinutes: 8,
    image: "institut",
    tags: ["Institut d'Apologétique", "étudiants", "formation"],
    featured: true,
    intro: [
      "La nouveauté d'un premier Institut d'Apologétique en France tient à sa concentration : au lieu de laisser chacun rassembler seul des fragments de réponses, l'étudiant reçoit un itinéraire complet.",
      "Cette forme d'étude est précieuse parce que l'apologétique touche à tout : Écriture, histoire, philosophie, liturgie, morale, science, psychologie du dialogue et vie spirituelle."
    ],
    fact: "Dans beaucoup de discussions, la difficulté ne vient pas d'une seule question, mais de plusieurs niveaux mêlés. Une objection sur les croisades peut cacher une question sur la sainteté de l'Église ; une objection sur les miracles peut engager la raison, l'histoire et l'idée même de Dieu.",
    anchor: "Le Catéchisme distingue les raisons de croire, les signes de crédibilité, l'acte de foi et le rôle de la grâce. Cette distinction empêche de réduire la foi à un sentiment ou à une démonstration froide.",
    shepherd: "À l'école du Bon Pasteur, apprendre revient à se laisser conduire pas à pas. Le berger ne disperse pas le troupeau : il rassemble. Une formation sérieuse fait pareil avec les idées, en reliant les thèmes pour que la foi apparaisse dans son unité.",
    response: "Pour l'étudiant, cela change le quotidien. Il ne se contente plus de mémoriser une formule ; il sait situer une objection, reconnaître ce qu'il ignore, chercher la source juste et répondre dans un langage accessible.",
    takeaways: [
      "La formation évite les réponses dispersées.",
      "Les grandes objections demandent plusieurs repères à la fois.",
      "Le Catéchisme aide à distinguer preuve, signe, foi et grâce.",
      "Un étudiant formé devient plus paisible dans le dialogue."
    ],
    sources: ["ireneeFormations", "catechism", "fidesRatio", "aelfJohn10"]
  },
  {
    slug: "qu-est-ce-que-l-apologetique-catholique",
    title: "Qu'est-ce que l'apologétique catholique ?",
    description: "Une introduction claire à l'apologétique catholique : défendre la foi, répondre aux objections et témoigner sans agressivité.",
    category: "Fondamentaux",
    date: "2026-05-18",
    readingMinutes: 7,
    image: "reason",
    tags: ["apologétique", "foi catholique", "raison"],
    featured: true,
    intro: [
      "L'apologétique catholique est souvent mal comprise. Certains imaginent un art de la polémique ; d'autres une simple collection de citations. Elle est plus noble que cela.",
      "Elle consiste à rendre la foi intelligible, à répondre aux objections honnêtes, à montrer que le christianisme n'est pas une fuite hors du réel mais une lumière posée sur le réel."
    ],
    fact: "La première lettre de saint Pierre invite les chrétiens à rendre compte de l'espérance qui est en eux, avec douceur et respect. Ce double mouvement est décisif : rendre compte, donc parler avec intelligence ; le faire avec douceur, donc refuser la violence du ton.",
    anchor: "La tradition catholique ne sépare pas la vérité de la charité. Elle sait qu'une réponse exacte peut être mal donnée, et qu'une parole aimable peut devenir floue si elle n'ose plus nommer le vrai.",
    shepherd: "À l'école du Bon Pasteur, l'apologétique devient une manière de conduire vers la source. La houlette n'est pas un bâton pour frapper : elle sert à ramener, guider, protéger et ouvrir un chemin.",
    response: "Dans une conversation concrète, l'apologète commence par écouter. Il reformule la question, vérifie qu'il l'a comprise, puis propose une réponse ajustée : biblique si l'objection porte sur l'Écriture, historique si elle porte sur les faits, philosophique si elle touche à Dieu, morale si elle touche à la vie humaine.",
    takeaways: [
      "L'apologétique est une réponse intelligente à une question réelle.",
      "La douceur n'affaiblit pas la vérité.",
      "Les objections doivent être écoutées avant d'être traitées.",
      "La finalité reste la rencontre avec le Christ."
    ],
    sources: ["catechism", "fidesRatio", "aelfJohn10"]
  },
  {
    slug: "pourquoi-former-des-apologetes-aujourd-hui",
    title: "Pourquoi former des apologètes aujourd'hui ?",
    description: "Les raisons concrètes de former des catholiques capables de répondre aux objections contemporaines avec clarté et charité.",
    category: "Fondamentaux",
    date: "2026-05-17",
    readingMinutes: 7,
    image: "dialogue",
    tags: ["formation", "témoignage", "mission"],
    intro: [
      "Former des apologètes aujourd'hui n'est pas un luxe intellectuel. Dans de nombreuses familles, universités, paroisses et discussions en ligne, les questions religieuses arrivent vite et parfois brutalement.",
      "Sans formation, le catholique peut se taire par peur de mal répondre, ou parler trop vite par peur de perdre le terrain. L'apologétique apprend un troisième chemin : la parole juste."
    ],
    fact: "Les objections contemporaines portent souvent sur des thèmes récurrents : existence de Dieu, fiabilité des Évangiles, scandales dans l'Église, rapport à la science, liberté religieuse, morale sexuelle, place de Marie, Eucharistie ou histoire des conciles.",
    anchor: "Vatican II a insisté sur la dignité de la conscience, le dialogue avec le monde et la fidélité à la Révélation. Ces textes montrent que parler au monde ne signifie pas diluer la foi, mais l'exposer de manière audible.",
    shepherd: "À l'école du Bon Pasteur, on apprend à ne pas abandonner celui qui questionne. Une objection peut être une porte entrouverte. Le témoin catholique ne s'y engouffre pas pour dominer ; il y entre pour accompagner vers plus de vérité.",
    response: "La formation rend aussi plus humble. Elle révèle la taille des sujets, oblige à citer correctement, à reconnaître les nuances, à ne pas inventer une réponse lorsque l'on ne sait pas. Cette humilité est une force dans un monde saturé d'assurance immédiate.",
    takeaways: [
      "Les questions contemporaines demandent des catholiques formés.",
      "Répondre ne veut pas dire tout savoir.",
      "Les textes de l'Église donnent un cadre sûr.",
      "La parole juste naît de la vérité et de la patience."
    ],
    sources: ["deiVerbum", "dignitatisHumanae", "nostraAetate", "ireneeFormations"]
  },
  {
    slug: "rendre-compte-esperance-1-pierre-3-15",
    title: "1 Pierre 3,15 : rendre compte de l'espérance",
    description: "Pourquoi l'appel biblique à rendre compte de l'espérance demeure le coeur spirituel de l'apologétique catholique.",
    category: "Écriture",
    date: "2026-05-16",
    readingMinutes: 7,
    image: "scripture",
    tags: ["Bible", "espérance", "témoignage"],
    intro: [
      "L'apologétique chrétienne commence dans une phrase biblique très simple : être prêt à rendre compte de l'espérance. Cette formule donne la source et le style de toute réponse chrétienne.",
      "Elle ne demande pas seulement de posséder des arguments. Elle demande de vivre de telle sorte que l'espérance soit visible et qu'une question puisse naître."
    ],
    fact: "La première lettre de Pierre s'adresse à des chrétiens qui connaissent l'épreuve, la minorité et parfois la méfiance. Le témoignage demandé n'est donc pas un exercice confortable : il se déploie dans un monde qui ne comprend pas toujours la foi.",
    anchor: "La Bible lie l'espérance au Christ ressuscité. Ce n'est pas un optimisme vague, mais une confiance enracinée dans un événement, une personne et une promesse.",
    shepherd: "À l'école du Bon Pasteur, rendre compte de l'espérance signifie d'abord rester près de celui qui donne cette espérance. Une réponse chrétienne perd son âme lorsqu'elle devient seulement une performance verbale.",
    response: "Dans la vie quotidienne, cette phrase invite à préparer son intelligence et son coeur. Préparer son intelligence, c'est étudier. Préparer son coeur, c'est refuser le mépris. Les deux sont nécessaires pour que la réponse soit réellement chrétienne.",
    takeaways: [
      "L'espérance chrétienne demande à être rendue intelligible.",
      "Le contexte biblique suppose parfois l'incompréhension ou l'épreuve.",
      "La réponse naît du Christ ressuscité.",
      "Préparer son coeur compte autant que préparer ses arguments."
    ],
    sources: ["catechism", "deiVerbum", "aelfJohn10"]
  },
  {
    slug: "foi-et-raison-deux-lumieres",
    title: "Foi et raison : deux lumières pour une même quête",
    description: "Pourquoi la tradition catholique refuse l'opposition simpliste entre croire et penser.",
    category: "Foi et raison",
    date: "2026-05-15",
    readingMinutes: 8,
    image: "reason",
    tags: ["foi et raison", "philosophie", "Fides et Ratio"],
    intro: [
      "On entend souvent que la foi commencerait là où la raison s'arrête. La tradition catholique dit autre chose : la raison cherche le vrai, et la foi reçoit une lumière qui dépasse sans détruire.",
      "Cette nuance change tout. Le croyant n'a pas besoin d'éteindre son intelligence pour croire ; il doit plutôt apprendre à l'ordonner, à la purifier et à l'ouvrir."
    ],
    fact: "Fides et Ratio présente la foi et la raison comme deux voies appelées à se soutenir. L'histoire catholique en donne de nombreux exemples, des Pères de l'Église aux grandes universités médiévales.",
    anchor: "La raison peut reconnaître des signes du vrai : l'ordre du monde, la profondeur de la conscience, la soif de sens, la question de l'origine. La foi annonce ensuite le Dieu vivant, non comme une idée abstraite, mais comme Celui qui parle et sauve.",
    shepherd: "À l'école du Bon Pasteur, l'intelligence n'est pas traitée comme une ennemie. Le Christ appelle l'homme tout entier : mémoire, volonté, corps, coeur et raison.",
    response: "Face à une personne qui oppose croire et penser, il vaut mieux éviter les slogans. On peut commencer par demander ce qu'elle entend par raison, puis montrer que la foi catholique n'a jamais canonisé l'irrationalité. Elle demande une confiance raisonnable, éclairée par des signes et portée par la grâce.",
    takeaways: [
      "La foi catholique ne méprise pas la raison.",
      "La raison peut préparer le terrain de la foi.",
      "Fides et Ratio offre un repère majeur.",
      "Croire engage toute la personne, intelligence comprise."
    ],
    sources: ["fidesRatio", "catechism", "aquinas"]
  },
  {
    slug: "preuves-de-dieu-chemins-de-raison",
    title: "Les preuves de Dieu : chemins de raison et non recettes magiques",
    description: "Comment parler des arguments en faveur de l'existence de Dieu sans promettre une démonstration mécanique.",
    category: "Foi et raison",
    date: "2026-05-14",
    readingMinutes: 8,
    image: "reason",
    tags: ["existence de Dieu", "raison", "saint Thomas"],
    intro: [
      "Les arguments en faveur de l'existence de Dieu sont parfois présentés comme des coups de massue. C'est une erreur. Dans la tradition catholique, ils sont des chemins de raison.",
      "Ils ne remplacent pas la rencontre avec Dieu, mais ils montrent que croire en Dieu n'est pas absurde, et que l'intelligence humaine peut remonter du monde vers une source."
    ],
    fact: "Saint Thomas d'Aquin a formulé plusieurs voies pour parler de Dieu à partir du mouvement, de la causalité, de la contingence, des degrés de perfection et de l'ordre du monde. Ces voies ne sont pas des slogans, mais des raisonnements à comprendre patiemment.",
    anchor: "Le Catéchisme affirme que l'homme peut connaître Dieu avec certitude à partir de ses oeuvres, tout en rappelant que cette connaissance est blessée par les limites et le péché. Il faut donc unir raison, purification du regard et grâce.",
    shepherd: "À l'école du Bon Pasteur, les preuves de Dieu ne deviennent pas des pièges tendus à l'interlocuteur. Elles sont des sentiers. On les propose comme on montre une route, sans forcer quelqu'un à marcher plus vite que sa conscience.",
    response: "Dans un dialogue, il est souvent plus fécond de partir d'une vraie question : pourquoi y a-t-il quelque chose plutôt que rien ? Pourquoi le monde est-il intelligible ? Pourquoi le bien oblige-t-il la conscience ? Ces questions ouvrent un espace où la raison respire.",
    takeaways: [
      "Les arguments pour Dieu sont des chemins, pas des machines.",
      "Saint Thomas reste un repère majeur.",
      "La raison peut ouvrir à la question de Dieu.",
      "La manière de présenter l'argument compte autant que sa forme."
    ],
    sources: ["aquinas", "catechism", "fidesRatio"]
  },
  {
    slug: "probleme-du-mal-repondre-sans-durcir-le-coeur",
    title: "Le problème du mal : répondre sans durcir le coeur",
    description: "Aborder l'une des objections les plus douloureuses contre Dieu avec vérité, respect et espérance chrétienne.",
    category: "Objections",
    date: "2026-05-13",
    readingMinutes: 8,
    image: "dialogue",
    tags: ["mal", "souffrance", "espérance"],
    intro: [
      "La question du mal est l'une des plus graves. Elle n'est pas seulement théorique : elle touche les deuils, les injustices, la maladie, les scandales et les blessures intimes.",
      "Répondre à cette objection demande donc une grande prudence. Une phrase vraie peut devenir cruelle si elle est donnée au mauvais moment ou sans compassion."
    ],
    fact: "La foi chrétienne ne nie pas la réalité du mal. Elle affirme que Dieu n'est pas l'auteur du mal, que la liberté humaine est réelle, que la création est blessée, et que le Christ entre lui-même dans la souffrance jusqu'à la Croix.",
    anchor: "Le Catéchisme traite le mal à partir de la création, de la chute et de la Providence. Il refuse une réponse simpliste : le mystère du mal n'est pleinement éclairé qu'à la lumière du Christ mort et ressuscité.",
    shepherd: "À l'école du Bon Pasteur, on apprend d'abord à rester auprès de celui qui souffre. Le berger ne donne pas une conférence à la brebis blessée ; il la porte. Cette image rappelle que l'apologétique doit parfois devenir silence, présence et prière.",
    response: "Lorsque la discussion devient possible, on peut distinguer le mal moral, né de la liberté blessée, et le mal physique, lié à la condition créée. On peut ensuite montrer que le christianisme ne promet pas une explication froide, mais une victoire finale de l'amour sur la mort.",
    takeaways: [
      "La souffrance exige compassion avant argument.",
      "Le christianisme ne nie pas le mal.",
      "La Croix change la manière de parler de Dieu et de la douleur.",
      "La réponse chrétienne est une espérance, pas une pirouette."
    ],
    sources: ["catechism", "fidesRatio", "aelfJohn10"]
  },
  {
    slug: "resurrection-de-jesus-coeur-historique-foi",
    title: "La Résurrection de Jésus : coeur historique et vivant de la foi",
    description: "Pourquoi la Résurrection n'est pas un symbole vague, mais le centre du témoignage chrétien.",
    category: "Christ",
    date: "2026-05-12",
    readingMinutes: 8,
    image: "resurrection",
    tags: ["Résurrection", "Jésus", "crédibilité"],
    featured: true,
    intro: [
      "La foi chrétienne tient ou tombe avec la Résurrection de Jésus. Si elle n'est qu'une métaphore, l'annonce apostolique change de nature ; si elle est réelle, toute l'histoire humaine reçoit une lumière nouvelle.",
      "Voilà pourquoi l'apologétique catholique revient souvent à ce point central. On ne défend pas d'abord une morale ou une institution : on rend compte d'un Christ vivant."
    ],
    fact: "Les premières communautés chrétiennes annoncent la Résurrection comme un événement. Elles parlent du tombeau vide, des apparitions, du témoignage des apôtres et de la transformation de ceux qui avaient fui.",
    anchor: "Le Catéchisme présente la Résurrection comme un événement historique et transcendant. Historique, car il laisse des traces et des témoins ; transcendant, car il dépasse les limites ordinaires de l'histoire.",
    shepherd: "À l'école du Bon Pasteur, la Résurrection n'est pas une pièce de musée. Le berger vivant continue de conduire. L'apologétique ne peut donc pas parler du Christ comme d'un simple personnage admirable du passé.",
    response: "Dans un dialogue, il faut éviter deux raccourcis : réduire la Résurrection à une émotion collective, ou prétendre la saisir comme un fait banal. La réponse catholique tient la singularité de l'événement et la force des témoignages qui l'ont porté jusqu'à nous.",
    takeaways: [
      "La Résurrection est le coeur du christianisme.",
      "L'Église la présente comme historique et transcendante.",
      "Les témoins apostoliques sont décisifs.",
      "Le Christ vivant donne son centre à toute apologétique."
    ],
    sources: ["catechism", "deiVerbum"]
  },
  {
    slug: "tombeau-vide-prudence-et-credibilite",
    title: "Le tombeau vide : ce que la foi en dit avec prudence",
    description: "Comprendre la place du tombeau vide dans l'annonce de la Résurrection sans en faire un argument isolé.",
    category: "Christ",
    date: "2026-05-11",
    readingMinutes: 7,
    image: "resurrection",
    tags: ["tombeau vide", "Évangiles", "Résurrection"],
    intro: [
      "Le tombeau vide fascine parce qu'il semble être une preuve simple. Pourtant, la tradition chrétienne le présente avec plus de finesse.",
      "Il est un signe important, mais il prend tout son sens avec les apparitions du Ressuscité, le témoignage des apôtres et la foi pascale de l'Église."
    ],
    fact: "Les Évangiles mentionnent la découverte du tombeau vide, notamment par des femmes disciples. Dans le contexte antique, ce détail est souvent relevé comme significatif, car il ne correspond pas à une fabrication destinée à maximiser la crédibilité sociale du témoignage.",
    anchor: "Le Catéchisme distingue le tombeau vide, les linges, les apparitions et la rencontre personnelle avec le Ressuscité. Cette distinction évite de demander à un seul signe de porter tout le poids de la foi.",
    shepherd: "À l'école du Bon Pasteur, les signes ne remplacent pas la voix du Christ. Ils orientent, ils invitent, ils ouvrent une enquête intérieure et historique, mais ils appellent aussi la liberté.",
    response: "Face à l'objection selon laquelle tout serait légende, on peut montrer la sobriété des récits, leur ancrage juif, la difficulté initiale des disciples à croire et la naissance rapide d'une annonce centrée sur le Christ ressuscité.",
    takeaways: [
      "Le tombeau vide est un signe, non un argument solitaire.",
      "Les récits évangéliques sont sobres et résistants aux simplifications.",
      "Les apparitions et le témoignage apostolique complètent le signe.",
      "La foi accueille une lumière qui respecte la liberté."
    ],
    sources: ["catechism", "deiVerbum"]
  },
  {
    slug: "miracles-et-credibilite-eglise",
    title: "Miracles et crédibilité : pourquoi l'Église ne fuit pas les signes",
    description: "Comment comprendre les miracles sans naïveté ni fermeture rationaliste.",
    category: "Objections",
    date: "2026-05-10",
    readingMinutes: 7,
    image: "resurrection",
    tags: ["miracles", "signes", "crédibilité"],
    intro: [
      "Les miracles provoquent souvent deux réactions opposées : l'enthousiasme trop rapide ou le rejet automatique. L'Église cherche un chemin plus exigeant.",
      "Elle reconnaît que Dieu peut agir dans l'histoire, mais elle demande aussi prudence, discernement et respect de la vérité des faits."
    ],
    fact: "Dans la Bible, les miracles ne sont pas des effets spectaculaires pour eux-mêmes. Ils manifestent la compassion de Dieu, confirment une mission, appellent à la conversion et orientent vers le Royaume.",
    anchor: "Le Catéchisme parle de signes de crédibilité : miracles, prophéties, sainteté de l'Église, fécondité de la foi. Ces signes ne contraignent pas la liberté, mais ils rendent l'acte de foi raisonnable.",
    shepherd: "À l'école du Bon Pasteur, le signe n'est jamais séparé du soin. Le Christ guérit, nourrit, relève et pardonne. Le miracle chrétien n'est pas une mise en scène de puissance ; il révèle un coeur qui sauve.",
    response: "Dans une conversation, on peut d'abord demander ce que l'interlocuteur entend par impossible. Si Dieu existe, l'action de Dieu dans le monde n'est pas absurde. La vraie question devient alors historique et spirituelle : quel signe, dans quel contexte, avec quels fruits ?",
    takeaways: [
      "L'Église ne réduit pas les miracles à du spectacle.",
      "Les signes rendent la foi raisonnable sans la forcer.",
      "Le discernement protège de la crédulité.",
      "Le miracle chrétien révèle la compassion de Dieu."
    ],
    sources: ["catechism", "deiVerbum", "aelfJohn10"]
  },
  {
    slug: "bible-tradition-magistere-une-meme-parole",
    title: "Bible, Tradition, Magistère : trois voix pour une même Parole",
    description: "Comprendre l'unité catholique entre l'Écriture, la Tradition vivante et le Magistère de l'Église.",
    category: "Écriture et Tradition",
    date: "2026-05-09",
    readingMinutes: 8,
    image: "scripture",
    tags: ["Bible", "Tradition", "Magistère"],
    featured: true,
    intro: [
      "Une objection revient souvent : pourquoi l'Église catholique ne s'en tient-elle pas à la Bible seule ? La réponse exige de comprendre comment la Parole de Dieu a été transmise.",
      "La foi catholique ne met pas la Bible en concurrence avec la Tradition et le Magistère. Elle voit leur unité au service d'une même Révélation."
    ],
    fact: "Dei Verbum enseigne que la Tradition apostolique et l'Écriture Sainte jaillissent d'une même source divine et tendent vers une même fin. Le Magistère n'est pas au-dessus de la Parole de Dieu : il la sert.",
    anchor: "Historiquement, l'Église a vécu, prié, célébré et transmis la foi avant que le canon du Nouveau Testament ne soit fixé dans sa forme reçue. La Bible est donc un livre de l'Église, sans devenir la propriété arbitraire de l'Église.",
    shepherd: "À l'école du Bon Pasteur, on apprend à reconnaître une voix transmise fidèlement. Le berger ne change pas d'appel à chaque génération ; il conduit son peuple par une mémoire vivante.",
    response: "Pour expliquer cela simplement, on peut prendre l'image d'une source, d'un fleuve et d'un gardien. La source est Dieu qui se révèle ; le fleuve est la transmission vivante ; le gardien est le service de l'Église pour que l'eau ne soit pas détournée.",
    takeaways: [
      "Écriture et Tradition viennent d'une même source.",
      "Le Magistère sert la Parole de Dieu.",
      "Le canon biblique lui-même suppose la vie de l'Église.",
      "La transmission catholique est une mémoire vivante."
    ],
    sources: ["deiVerbum", "catechism", "lumenGentium"]
  },
  {
    slug: "eglise-ne-lit-pas-bible-seule",
    title: "Pourquoi l'Église ne lit pas la Bible seule ?",
    description: "Une réponse catholique aux questions sur l'Écriture, la communauté et l'interprétation.",
    category: "Écriture et Tradition",
    date: "2026-05-08",
    readingMinutes: 7,
    image: "scripture",
    tags: ["Bible", "interprétation", "Église"],
    intro: [
      "Lire la Bible est indispensable. Mais la question est de savoir comment la lire, avec qui, et dans quelle mémoire.",
      "La réponse catholique insiste sur l'Église comme lieu vivant de réception de la Parole. La Bible n'est pas un message tombé dans des consciences isolées."
    ],
    fact: "Les Évangiles, les lettres apostoliques et les autres écrits du Nouveau Testament sont nés dans des communautés croyantes. Ils ont été proclamés, copiés, priés, discutés et reçus dans la vie de l'Église.",
    anchor: "Dei Verbum demande de lire l'Écriture dans l'Esprit où elle a été écrite, en tenant compte de l'unité de toute la Bible, de la Tradition vivante et de l'analogie de la foi.",
    shepherd: "À l'école du Bon Pasteur, écouter la Parole suppose de ne pas s'inventer berger de soi-même. Le Christ confie une Église, des apôtres, une mission et une transmission.",
    response: "Dans le dialogue avec des chrétiens séparés ou des personnes curieuses, il est utile de partir d'un accord : la Bible est Parole de Dieu. Puis on peut poser la question suivante : qui reconnaît le canon, qui tranche les lectures incompatibles, qui garde la foi apostolique ?",
    takeaways: [
      "La Bible doit être lue dans l'Église.",
      "Le Nouveau Testament naît dans une communauté croyante.",
      "L'unité de l'Écriture protège des lectures isolées.",
      "La Tradition n'étouffe pas la Bible, elle la porte."
    ],
    sources: ["deiVerbum", "catechism", "lumenGentium"]
  },
  {
    slug: "manuscrits-bibliques-histoire-solide",
    title: "Les manuscrits bibliques : une histoire plus solide qu'on ne l'imagine",
    description: "Découvrir quelques repères sur la transmission des textes bibliques, du Codex Sinaiticus aux manuscrits de la mer Morte.",
    category: "Histoire",
    date: "2026-05-07",
    readingMinutes: 8,
    image: "scripture",
    tags: ["manuscrits", "Bible", "histoire"],
    intro: [
      "Beaucoup imaginent la Bible comme un texte transmis au hasard, déformé de siècle en siècle sans possibilité de vérification. L'histoire réelle est plus intéressante.",
      "Les manuscrits bibliques ne suppriment pas toutes les questions, mais ils donnent un terrain sérieux pour parler de transmission, de variantes et de confiance raisonnable."
    ],
    fact: "Le Codex Sinaiticus, conservé en grande partie à la British Library, est l'un des plus anciens manuscrits chrétiens contenant une large portion de la Bible grecque. Les manuscrits de la mer Morte, découverts au XXe siècle, éclairent la transmission de textes juifs anciens.",
    anchor: "La critique des manuscrits ne détruit pas la foi ; elle aide à comprendre comment les textes ont été copiés et conservés. L'Église n'a pas peur de cette étude lorsqu'elle est menée honnêtement.",
    shepherd: "À l'école du Bon Pasteur, la Parole n'est pas suspendue dans le vide. Dieu passe par une histoire, des témoins, des langues, des parchemins, des communautés et une mémoire.",
    response: "Face à l'objection de la déformation totale, il faut distinguer variantes de copie et invention doctrinale. Les variantes existent, comme dans toute transmission manuscrite ancienne, mais elles ne permettent pas de conclure que le coeur de la foi aurait été fabriqué tardivement.",
    takeaways: [
      "Les manuscrits bibliques offrent un terrain historique solide.",
      "Le Codex Sinaiticus et les manuscrits de la mer Morte sont des repères connus.",
      "Les variantes ne signifient pas falsification globale.",
      "L'étude historique peut servir la confiance."
    ],
    sources: ["codexSinaiticus", "deadSeaScrolls", "deiVerbum"]
  },
  {
    slug: "credo-nicee-garder-visage-du-christ",
    title: "Le Credo de Nicée : des mots pour garder le visage du Christ",
    description: "Pourquoi le concile de Nicée reste central pour comprendre la foi chrétienne en Jésus vrai Dieu et vrai homme.",
    category: "Histoire de l'Église",
    date: "2026-05-06",
    readingMinutes: 8,
    image: "history",
    tags: ["Nicée", "Credo", "Christ"],
    intro: [
      "Le Credo n'est pas une formule froide récitée par habitude. Il garde le visage du Christ contre les simplifications qui le réduiraient à un maître moral, à un prophète ou à une créature supérieure.",
      "Nicée demeure ainsi un repère majeur pour l'apologétique, parce que beaucoup d'objections modernes recyclent d'anciennes hésitations sur l'identité de Jésus."
    ],
    fact: "Le premier concile de Nicée, en 325, a répondu à la crise arienne en confessant la divinité du Fils. Le vocabulaire conciliaire cherchait à protéger la foi reçue, non à inventer un christianisme nouveau.",
    anchor: "Le Catéchisme reprend cette confession trinitaire et christologique : le Fils est vrai Dieu, engendré non pas créé. Cette précision n'est pas une subtilité abstraite ; elle touche le salut lui-même.",
    shepherd: "À l'école du Bon Pasteur, reconnaître la voix du Christ suppose de savoir qui il est. Si le berger n'est qu'une créature parmi d'autres, il ne peut pas donner la vie divine.",
    response: "Quand quelqu'un dit que la divinité de Jésus aurait été décidée tardivement, on peut rappeler que Nicée répond à une crise en s'appuyant sur l'Écriture, la prière et la foi déjà vécue par les chrétiens.",
    takeaways: [
      "Nicée protège l'identité du Christ.",
      "Le concile répond à une crise, il ne crée pas la foi de toutes pièces.",
      "Le Credo garde une vérité liée au salut.",
      "Comprendre Nicée aide à répondre à des objections très actuelles."
    ],
    sources: ["britannicaNicaea", "catechism", "lumenGentium"]
  },
  {
    slug: "saint-irenee-docteur-unite-foi-recue",
    title: "Saint Irénée de Lyon : le docteur de l'unité et la foi reçue",
    description: "Pourquoi saint Irénée inspire un institut catholique dédié à la transmission fidèle de la foi.",
    category: "Pères de l'Église",
    date: "2026-05-05",
    readingMinutes: 8,
    image: "fathers",
    tags: ["saint Irénée", "Pères de l'Église", "Tradition"],
    featured: true,
    intro: [
      "Saint Irénée de Lyon est un guide naturel pour un Institut d'Apologétique catholique. Il unit la défense de la foi, l'amour de l'Église, la mémoire apostolique et la patience doctrinale.",
      "Son époque connaissait déjà des discours séduisants qui prétendaient dépasser la foi reçue. Sa réponse fut de revenir à la règle de foi, aux apôtres et à l'unité de l'Église."
    ],
    fact: "Le pape François a proclamé saint Irénée docteur de l'Église avec le titre de docteur de l'unité. Ce titre souligne son rôle entre Orient et Occident, mais aussi sa manière de défendre la foi en la rattachant à la transmission apostolique.",
    anchor: "Irénée insiste sur la continuité : le Dieu créateur est le Dieu sauveur, le Christ récapitule l'histoire, et l'Église garde la foi reçue des apôtres. Cette vision demeure très actuelle face aux spiritualités fragmentées.",
    shepherd: "À l'école du Bon Pasteur, l'unité n'est pas un slogan. Le berger rassemble les voix dispersées autour de la vérité du Christ. Irénée montre que l'unité se reçoit dans la foi commune, pas dans l'improvisation individuelle.",
    response: "Pour parler aujourd'hui avec Irénée, il faut refuser deux pièges : une foi sans mémoire, qui change au gré du moment, et une mémoire sans vie, qui récite sans transmettre. L'apologétique catholique doit garder les deux ensemble.",
    takeaways: [
      "Saint Irénée relie défense de la foi et transmission apostolique.",
      "Son titre de docteur de l'unité est un repère fort.",
      "Il répond aux spiritualités fragmentées par la foi reçue.",
      "Son exemple éclaire la mission de l'Institut Irénée."
    ],
    sources: ["saintIrenee", "deiVerbum", "ireneeAPropos"]
  },
  {
    slug: "justin-martyr-philosophe-defend-chretiens",
    title: "Justin Martyr : quand un philosophe défend les chrétiens",
    description: "Découvrir Justin, philosophe converti et apologiste, témoin d'une foi capable de dialoguer avec la raison antique.",
    category: "Pères de l'Église",
    date: "2026-05-04",
    readingMinutes: 7,
    image: "fathers",
    tags: ["Justin Martyr", "philosophie", "apologétique"],
    intro: [
      "Justin Martyr montre que l'apologétique chrétienne a très tôt parlé le langage de la raison publique. Philosophe converti, il ne renie pas la quête de vérité qui l'a conduit jusqu'au Christ.",
      "Il écrit pour expliquer les chrétiens, répondre aux accusations et montrer que la foi chrétienne n'est pas une superstition dangereuse."
    ],
    fact: "Au IIe siècle, Justin adresse des apologies aux autorités romaines. Il y présente la vie chrétienne, le culte, la morale et la foi au Christ, dans un monde où les chrétiens sont souvent incompris.",
    anchor: "Son exemple rappelle que l'Église n'a pas attendu l'époque moderne pour dialoguer avec la philosophie. Dès les premiers siècles, elle a cherché des mots accessibles au monde cultivé de son temps.",
    shepherd: "À l'école du Bon Pasteur, la vérité n'a pas peur de sortir sur la place publique. Justin ne parle pas pour flatter Rome ; il parle pour que l'injustice recule et que le Christ soit connu.",
    response: "Aujourd'hui, son attitude invite les catholiques à connaître le langage de leur époque. Il ne suffit pas de répéter des formules internes : il faut traduire sans trahir, expliquer sans diluer, témoigner sans perdre la patience.",
    takeaways: [
      "Justin unit philosophie et foi chrétienne.",
      "Ses apologies répondent à des accusations publiques.",
      "L'apologétique chrétienne est ancienne.",
      "Traduire la foi n'est pas la trahir."
    ],
    sources: ["justin", "fidesRatio", "catechism"]
  },
  {
    slug: "tertullien-parler-juste-monde-hostile",
    title: "Tertullien : parler juste dans un monde hostile",
    description: "Ce que Tertullien apprend sur la vigueur du langage, la défense des chrétiens et le risque d'un ton trop dur.",
    category: "Pères de l'Église",
    date: "2026-05-03",
    readingMinutes: 7,
    image: "fathers",
    tags: ["Tertullien", "apologétique", "histoire"],
    intro: [
      "Tertullien est une figure puissante, parfois déroutante. Son style est nerveux, juridique, incisif. Il défend les chrétiens dans un monde qui les accuse et les méconnaît.",
      "Le lire aujourd'hui aide à comprendre la force et le danger de la parole apologétique : elle doit être claire, mais elle doit aussi rester évangélique."
    ],
    fact: "Son Apologeticum répond aux accusations portées contre les chrétiens dans l'Empire romain. Tertullien dénonce l'injustice, expose la conduite chrétienne et retourne certaines critiques contre la société païenne.",
    anchor: "L'histoire de Tertullien rappelle que les apologistes ne sont pas des statues parfaites. Ils ont un contexte, un tempérament, des limites. Les recevoir avec intelligence permet d'apprendre sans copier aveuglément.",
    shepherd: "À l'école du Bon Pasteur, la vigueur doit rester au service de la brebis. Une parole forte peut défendre les faibles ; elle peut aussi blesser si elle devient goût de la domination.",
    response: "Pour aujourd'hui, la leçon est précieuse : ne pas avoir peur de répondre aux injustices, mais purifier son ton. La vérité catholique n'a pas besoin d'être molle, mais elle perd en crédibilité lorsqu'elle semble jouir du conflit.",
    takeaways: [
      "Tertullien montre une apologétique vigoureuse.",
      "Son contexte d'injustice explique une partie de son ton.",
      "On peut apprendre d'un auteur sans imiter tous ses excès.",
      "La force chrétienne doit rester ordonnée à la charité."
    ],
    sources: ["tertullian", "catechism", "aelfJohn10"]
  },
  {
    slug: "origene-contre-celse-repondre-point-par-point",
    title: "Origène contre Celse : répondre point par point sans perdre l'âme",
    description: "Comment Origène offre un modèle ancien de réponse structurée aux objections contre le christianisme.",
    category: "Pères de l'Église",
    date: "2026-05-02",
    readingMinutes: 8,
    image: "fathers",
    tags: ["Origène", "Contra Celsum", "objections"],
    intro: [
      "Origène est l'un des grands intellectuels chrétiens de l'Antiquité. Face aux critiques de Celse, il ne répond pas par le mépris, mais par une réfutation patiente.",
      "Son exemple est très actuel : beaucoup d'objections modernes ne sont pas nouvelles dans leur structure. Elles changent de vocabulaire, mais reviennent souvent aux mêmes soupçons."
    ],
    fact: "Dans Contra Celsum, Origène répond à une critique païenne du christianisme. Il aborde l'Écriture, la personne du Christ, la morale chrétienne, les miracles et la place des croyants dans la société.",
    anchor: "Cette méthode point par point montre qu'il faut prendre l'adversaire au sérieux. Répondre ne signifie pas caricaturer la question pour gagner plus facilement.",
    shepherd: "À l'école du Bon Pasteur, une objection est traitée comme une personne à rejoindre, pas comme une cible à abattre. Origène rappelle que la patience intellectuelle peut être un acte de charité.",
    response: "Aujourd'hui, on peut imiter cette patience : identifier précisément l'objection, chercher ce qu'elle suppose, répondre avec ordre, puis revenir au Christ. Sans ce retour, l'apologétique devient une gymnastique sans âme.",
    takeaways: [
      "Origène offre un modèle de réponse structurée.",
      "Prendre l'adversaire au sérieux est une exigence de justice.",
      "Beaucoup d'objections anciennes reviennent sous des formes nouvelles.",
      "Toute réponse doit revenir au Christ."
    ],
    sources: ["origen", "deiVerbum", "fidesRatio"]
  },
  {
    slug: "saint-augustin-cite-de-dieu-rome-tremble",
    title: "Saint Augustin et La Cité de Dieu : espérer quand Rome tremble",
    description: "Pourquoi Augustin reste un guide pour répondre aux accusations contre l'Église dans les périodes de crise.",
    category: "Histoire de l'Église",
    date: "2026-05-01",
    readingMinutes: 8,
    image: "history",
    tags: ["saint Augustin", "Cité de Dieu", "crise"],
    intro: [
      "Lorsque Rome est ébranlée, certains accusent le christianisme d'avoir affaibli la cité. Augustin répond avec une ampleur impressionnante : il replace l'histoire humaine devant Dieu.",
      "La Cité de Dieu n'est pas seulement un monument littéraire. C'est aussi une leçon d'apologétique en temps de crise culturelle."
    ],
    fact: "Augustin écrit après le sac de Rome de 410. Il répond aux accusations païennes et distingue la cité terrestre, marquée par l'amour de soi jusqu'au mépris de Dieu, et la cité de Dieu, marquée par l'amour de Dieu.",
    anchor: "Son oeuvre montre que la foi chrétienne ne promet pas l'immunité politique ou culturelle. Elle apprend à juger l'histoire avec profondeur, sans idolâtrer les empires.",
    shepherd: "À l'école du Bon Pasteur, l'espérance ne dépend pas de la solidité apparente de Rome, de Paris ou d'une civilisation. Elle dépend du Christ qui conduit son peuple même lorsque les repères visibles tremblent.",
    response: "Quand l'Église est accusée d'être responsable de tous les maux, Augustin invite à répondre sans panique. Il faut reconnaître les fautes réelles, refuser les accusations injustes, et rappeler que le coeur humain blessé traverse toutes les sociétés.",
    takeaways: [
      "Augustin répond à une crise historique majeure.",
      "La Cité de Dieu apprend à ne pas idolâtrer les puissances terrestres.",
      "L'espérance chrétienne dépasse les cycles politiques.",
      "Répondre aux accusations demande justice et profondeur."
    ],
    sources: ["augustine", "catechism", "lumenGentium"]
  },
  {
    slug: "saint-thomas-aquin-raison-service-foi",
    title: "Saint Thomas d'Aquin : la raison au service de la foi",
    description: "Pourquoi saint Thomas demeure un maître pour apprendre à penser clairement sans réduire le mystère chrétien.",
    category: "Foi et raison",
    date: "2026-04-30",
    readingMinutes: 8,
    image: "reason",
    tags: ["saint Thomas", "raison", "théologie"],
    intro: [
      "Saint Thomas d'Aquin impressionne par sa clarté. Il pose les objections, les prend au sérieux, répond avec ordre et ne confond jamais précision et sécheresse.",
      "Pour un Institut d'Apologétique, son exemple est précieux : il enseigne que penser la foi n'est pas l'appauvrir."
    ],
    fact: "Thomas a travaillé à articuler philosophie et théologie, notamment dans la Somme théologique. Benoît XVI a souligné sa confiance dans l'accord profond entre foi et raison.",
    anchor: "Chez Thomas, la raison peut atteindre certaines vérités sur Dieu, mais la Révélation donne accès aux mystères que l'homme ne pouvait pas découvrir seul, comme la Trinité ou l'Incarnation.",
    shepherd: "À l'école du Bon Pasteur, la méthode de Thomas devient une ascèse : écouter l'objection, éviter la caricature, répondre avec ordre, puis laisser le mystère demeurer plus grand que nos formules.",
    response: "Dans un débat contemporain, son esprit aide énormément. On peut distinguer les plans, définir les mots, identifier les causes de confusion et montrer que la foi catholique n'a pas besoin de brouillard pour être profonde.",
    takeaways: [
      "Thomas prend les objections au sérieux.",
      "Il unit philosophie et théologie sans les confondre.",
      "La clarté sert le mystère.",
      "Sa méthode reste utile pour les débats actuels."
    ],
    sources: ["aquinas", "fidesRatio", "catechism"]
  },
  {
    slug: "science-et-foi-sortir-des-caricatures",
    title: "Science et foi : sortir des caricatures",
    description: "Pourquoi le conflit automatique entre science et foi ne rend justice ni à la science ni à la tradition catholique.",
    category: "Science et foi",
    date: "2026-04-29",
    readingMinutes: 8,
    image: "science",
    tags: ["science", "foi", "raison"],
    intro: [
      "On présente souvent la science et la foi comme deux camps destinés à s'affronter. Cette image est commode, mais elle est trop pauvre.",
      "La science cherche à comprendre le monde selon ses méthodes propres. La foi parle du Créateur, du sens, du salut et de la vocation humaine. Les deux plans doivent être distingués sans être séparés."
    ],
    fact: "Le Catéchisme affirme que les recherches méthodiques dans tous les domaines du savoir, si elles sont menées de manière vraiment scientifique et selon les normes morales, ne s'opposeront jamais à la foi.",
    anchor: "L'existence de la Vatican Observatory rappelle aussi que l'Église n'a pas renoncé à la contemplation scientifique du cosmos. Le problème naît plutôt lorsque la science est transformée en philosophie fermée qui prétend répondre à tout.",
    shepherd: "À l'école du Bon Pasteur, la création n'est pas un écran entre Dieu et l'homme. Elle peut devenir un chemin d'émerveillement, à condition de ne pas demander à une lunette astronomique de répondre à la place de la conscience.",
    response: "Pour dialoguer, il faut éviter de forcer la Bible à devenir un manuel de sciences naturelles, et éviter aussi de transformer la science en tribunal universel du sens. La paix vient de la distinction juste des questions.",
    takeaways: [
      "La science et la foi n'ont pas la même méthode.",
      "Le Catéchisme refuse l'opposition automatique.",
      "La Vatican Observatory manifeste une tradition d'étude du cosmos.",
      "Distinguer les plans apaise beaucoup de faux conflits."
    ],
    sources: ["catechism", "vaticanObservatory", "fidesRatio"]
  },
  {
    slug: "georges-lemaitre-pretre-big-bang",
    title: "Georges Lemaître : un prêtre au seuil du Big Bang",
    description: "L'histoire de Georges Lemaître, prêtre et scientifique, permet de dépasser les clichés sur l'Église et la cosmologie.",
    category: "Science et foi",
    date: "2026-04-28",
    readingMinutes: 7,
    image: "science",
    tags: ["Georges Lemaître", "Big Bang", "cosmologie"],
    intro: [
      "Georges Lemaître est une figure idéale pour bousculer les caricatures. Prêtre catholique et scientifique, il a joué un rôle décisif dans l'histoire de la cosmologie moderne.",
      "Son parcours ne prouve pas la foi à lui seul, mais il rend difficile l'idée selon laquelle l'intelligence scientifique devrait nécessairement s'éloigner du catholicisme."
    ],
    fact: "Lemaître a proposé l'idée d'un univers en expansion et d'un atome primitif, souvent rapprochée de ce que l'on appellera plus tard la théorie du Big Bang. La Vatican Observatory rappelle son importance dans l'histoire de l'astronomie et de la cosmologie.",
    anchor: "Il distinguait soigneusement les plans : une théorie cosmologique n'est pas un argument religieux automatique. Cette prudence est aussi catholique que scientifique.",
    shepherd: "À l'école du Bon Pasteur, l'intelligence du monde ne devient pas prétexte à récupérer la science de force. Le berger conduit dans la vérité, et la vérité demande de respecter les méthodes de chaque domaine.",
    response: "Quand quelqu'un oppose foi et cosmologie, Lemaître permet de répondre avec calme. On peut montrer qu'un prêtre a contribué à une grande intuition scientifique, tout en refusant de confondre commencement physique et doctrine de la création.",
    takeaways: [
      "Lemaître unit vocation sacerdotale et travail scientifique.",
      "Il a contribué à l'idée d'un univers en expansion.",
      "Sa prudence évite de transformer la science en slogan religieux.",
      "Son exemple nuance fortement les clichés."
    ],
    sources: ["lemaltre", "vaticanObservatory", "catechism"]
  },
  {
    slug: "galilee-histoire-regarder-en-face",
    title: "Galilée : une histoire à regarder en face",
    description: "Parler de Galilée avec lucidité, sans nier les torts ni réduire l'histoire à un slogan contre l'Église.",
    category: "Science et foi",
    date: "2026-04-27",
    readingMinutes: 8,
    image: "science",
    tags: ["Galilée", "science", "Église"],
    intro: [
      "Galilée revient presque toujours dans les discussions sur science et foi. Le nom suffit parfois à fermer le débat : l'Église aurait été simplement contre la science.",
      "L'histoire mérite mieux qu'un slogan. Elle comporte de vrais torts, des maladresses, des conflits de personnes, des questions d'interprétation biblique et un contexte scientifique encore en formation."
    ],
    fact: "L'affaire Galilée concerne le soutien au système héliocentrique dans un contexte où les preuves, les autorités savantes et l'interprétation de certains passages bibliques étaient discutées. L'Église a reconnu des erreurs dans la manière dont cette affaire a été traitée.",
    anchor: "Cette histoire invite à distinguer la doctrine de la foi, les prudences ou imprudences institutionnelles, et l'état des connaissances scientifiques à une époque donnée.",
    shepherd: "À l'école du Bon Pasteur, regarder une faute en face ne détruit pas la foi. Le berger conduit dans la vérité, pas dans la défense crispée de tout ce qui a été fait par des catholiques.",
    response: "Face à l'objection, la meilleure réponse n'est pas de minimiser. On peut reconnaître la blessure, expliquer le contexte, puis montrer que l'affaire Galilée ne résume ni l'histoire de l'Église ni la relation entre science et catholicisme.",
    takeaways: [
      "Galilée doit être abordé avec lucidité.",
      "Reconnaître les torts n'affaiblit pas la vérité.",
      "Le contexte historique compte.",
      "Un épisode ne suffit pas à définir toute la relation science-foi."
    ],
    sources: ["vaticanObservatory", "catechism", "fidesRatio"]
  },
  {
    slug: "evolution-et-creation-distinguer-questions",
    title: "Évolution et création : apprendre à distinguer les questions",
    description: "Comment parler de création et d'évolution sans confondre le langage scientifique et le langage théologique.",
    category: "Science et foi",
    date: "2026-04-26",
    readingMinutes: 8,
    image: "science",
    tags: ["évolution", "création", "science"],
    intro: [
      "La création et l'évolution sont souvent opposées comme si elles répondaient exactement à la même question. Or ce n'est pas le cas.",
      "L'évolution décrit des processus du vivant. La création affirme que tout ce qui existe dépend radicalement de Dieu, reçoit l'être de lui et demeure porté par lui."
    ],
    fact: "Jean-Paul II a reconnu l'importance des recherches sur l'évolution tout en rappelant que la personne humaine ne peut pas être réduite à un pur mécanisme matériel. La question de l'âme spirituelle dépasse le champ des sciences naturelles.",
    anchor: "Le Catéchisme présente la création comme un acte libre de Dieu, source de bonté et d'ordre. Cette affirmation ne concurrence pas une description biologique ; elle se situe à un autre niveau.",
    shepherd: "À l'école du Bon Pasteur, distinguer les niveaux est une forme de paix. Le Christ ne demande pas de fabriquer de faux conflits pour défendre Dieu.",
    response: "Dans un dialogue, on peut demander : parlons-nous du mécanisme par lequel les espèces changent, ou du fait que l'univers dépend de Dieu ? Cette simple distinction dissipe beaucoup de malentendus.",
    takeaways: [
      "Création et évolution ne répondent pas au même type de question.",
      "Jean-Paul II a reconnu la valeur des recherches scientifiques.",
      "La dignité de la personne humaine dépasse le seul biologique.",
      "Distinguer les niveaux évite les faux conflits."
    ],
    sources: ["pasEvolution", "catechism", "fidesRatio"]
  },
  {
    slug: "a-l-ecole-du-bon-pasteur-suivre-une-voix",
    title: "À l'école du Bon Pasteur : suivre une voix et non une rumeur",
    description: "Une méditation doctrinale et concrète sur Jean 10 pour apprendre à suivre la voix du Christ.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-25",
    readingMinutes: 7,
    image: "shepherd",
    tags: ["À l'école du Bon Pasteur", "Jean 10", "discernement"],
    featured: true,
    intro: [
      "À l'école du Bon Pasteur, le chrétien apprend d'abord à écouter. Jean 10 ne met pas en scène une idée vague de bienveillance : il présente le Christ qui connaît, appelle et conduit.",
      "Dans un monde saturé de rumeurs, cette voix devient un critère. Tout ce qui parle fort n'est pas vrai ; tout ce qui rassure n'est pas fidèle ; tout ce qui accuse n'est pas prophétique."
    ],
    fact: "Dans l'Évangile selon saint Jean, Jésus se présente comme le Bon Pasteur et comme la porte. Il donne sa vie pour ses brebis et les conduit vers la vie.",
    anchor: "Cette image biblique rejoint toute la tradition pastorale de l'Église : la vérité chrétienne n'est jamais séparée de la conduite des âmes.",
    shepherd: "À l'école du Bon Pasteur, suivre une voix signifie apprendre à reconnaître le timbre du Christ : vérité sans mensonge, miséricorde sans mollesse, autorité sans brutalité.",
    response: "Dans les débats de foi, la question devient très concrète : ma réponse aide-t-elle quelqu'un à mieux entendre le Christ, ou ajoute-t-elle seulement du bruit au bruit ? Cette interrogation purifie la manière de parler.",
    takeaways: [
      "Jean 10 donne un critère d'écoute spirituelle.",
      "Le Bon Pasteur conduit par la vérité et le don de soi.",
      "Toutes les voix religieuses ne portent pas le même fruit.",
      "Répondre dans la foi suppose de réduire le bruit."
    ],
    sources: ["aelfJohn10", "catechism", "ireneeFormations"]
  },
  {
    slug: "a-l-ecole-du-bon-pasteur-entrer-par-la-porte",
    title: "À l'école du Bon Pasteur : entrer par la porte du Christ",
    description: "Pourquoi le Christ porte de l'enclos aide à comprendre la vérité, la liberté et l'appartenance à l'Église.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-24",
    readingMinutes: 7,
    image: "shepherd",
    tags: ["Bon Pasteur", "Église", "vérité"],
    intro: [
      "La formule de Jean 10 est forte : le Christ n'est pas seulement celui qui guide, il est aussi la porte. Une porte n'est pas un mur ; elle permet d'entrer, de sortir, d'être gardé et conduit.",
      "À l'école du Bon Pasteur, cette image aide à parler de l'Église sans la réduire à une frontière administrative."
    ],
    fact: "Dans l'Évangile, le Christ associe la porte, la voix, la garde et le don de la vie. Il ne s'agit pas d'un enfermement, mais d'une communion qui protège et ouvre vers la vie en abondance.",
    anchor: "Lumen Gentium présente l'Église comme peuple de Dieu et corps du Christ. Cette appartenance n'efface pas la liberté ; elle donne un lieu où la foi est reçue, nourrie et transmise.",
    shepherd: "À l'école du Bon Pasteur, entrer par la porte du Christ signifie refuser les raccourcis : ni fuite hors de l'Église, ni dureté qui transformerait l'Église en forteresse sans visage.",
    response: "Quand quelqu'un voit l'Église comme une prison, on peut repartir de cette image : une porte protège, mais elle ouvre. La vraie question est de savoir vers quelle vie elle conduit.",
    takeaways: [
      "Le Christ se présente comme porte et pasteur.",
      "L'Église protège pour conduire vers la vie.",
      "L'appartenance chrétienne n'est pas un enfermement.",
      "La vérité du Christ ouvre un chemin."
    ],
    sources: ["aelfJohn10", "lumenGentium", "catechism"]
  },
  {
    slug: "a-l-ecole-du-bon-pasteur-verite-conduit-au-large",
    title: "À l'école du Bon Pasteur : la vérité qui conduit au large",
    description: "La vérité chrétienne n'est pas une cage : elle libère, oriente et ouvre la personne à sa vocation.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-23",
    readingMinutes: 7,
    image: "shepherd",
    tags: ["Bon Pasteur", "liberté", "vérité"],
    intro: [
      "Beaucoup craignent la vérité comme une limite. La foi catholique affirme au contraire que la vérité libère parce qu'elle met l'homme en accord avec ce qu'il est.",
      "À l'école du Bon Pasteur, cette vérité n'est jamais une masse jetée sur les épaules. Elle conduit au large parce qu'elle vient de Celui qui connaît le coeur humain."
    ],
    fact: "La tradition chrétienne lie vérité et liberté. La liberté n'est pas seulement la possibilité de choisir n'importe quoi ; elle est la capacité de choisir le bien.",
    anchor: "Dignitatis Humanae rappelle la dignité de la personne et l'importance de la liberté religieuse. La foi ne se transmet pas par contrainte, car l'acte religieux engage la conscience.",
    shepherd: "À l'école du Bon Pasteur, la houlette de la vérité ne casse pas la liberté. Elle la redresse, l'oriente, la sauve de l'errance et lui apprend à marcher vers le bien.",
    response: "Dans une conversation, il est utile de demander ce que signifie être libre. Si la liberté devient simple absence de repères, elle peut se retourner contre la personne. La vérité chrétienne propose une liberté habitée.",
    takeaways: [
      "La vérité chrétienne libère au lieu d'enfermer.",
      "La liberté religieuse respecte la conscience.",
      "Choisir le bien accomplit la liberté.",
      "Le Bon Pasteur conduit au large, pas vers la peur."
    ],
    sources: ["dignitatisHumanae", "aelfJohn10", "catechism"]
  },
  {
    slug: "a-l-ecole-du-bon-pasteur-houlette-charite",
    title: "À l'école du Bon Pasteur : répondre avec une houlette de charité",
    description: "Pourquoi la charité donne à l'apologétique catholique son ton, sa patience et sa crédibilité.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-22",
    readingMinutes: 7,
    image: "dialogue",
    tags: ["charité", "dialogue", "Bon Pasteur"],
    intro: [
      "Une réponse catholique peut être exacte et pourtant mal donnée. La charité n'est donc pas une décoration ajoutée après la vérité ; elle appartient au mode chrétien de la vérité.",
      "À l'école du Bon Pasteur, la houlette de charité rappelle que l'on guide mieux en aimant qu'en écrasant."
    ],
    fact: "Le Nouveau Testament unit constamment vérité, patience, douceur et correction fraternelle. Le Christ lui-même parle avec autorité, mais son autorité est ordonnée au salut.",
    anchor: "Le Catéchisme présente la charité comme la forme des vertus. Sans charité, la connaissance peut devenir orgueil ; avec elle, la connaissance devient service.",
    shepherd: "À l'école du Bon Pasteur, répondre avec charité ne veut pas dire éviter les sujets difficiles. Cela signifie les aborder sans jouir de la blessure que pourrait produire une phrase bien tournée.",
    response: "Avant de répondre, on peut se poser une question simple : est-ce que je veux vraiment le bien de cette personne ? Si la réponse est non, il vaut mieux se taire un instant et demander au Christ de convertir son intention.",
    takeaways: [
      "La charité appartient à la vérité chrétienne.",
      "La connaissance sans charité devient vite orgueil.",
      "Les sujets difficiles peuvent être abordés avec douceur.",
      "L'intention intérieure change la qualité de la réponse."
    ],
    sources: ["catechism", "aelfJohn10", "ireneeFormations"]
  },
  {
    slug: "a-l-ecole-du-bon-pasteur-doctrine-soin-ames",
    title: "À l'école du Bon Pasteur : quand la doctrine devient soin des âmes",
    description: "Comprendre la doctrine catholique comme une lumière qui soigne, oriente et protège.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-21",
    readingMinutes: 7,
    image: "shepherd",
    tags: ["doctrine", "pastorale", "Bon Pasteur"],
    intro: [
      "Le mot doctrine sonne parfois dur. On l'imagine comme une liste froide d'interdits ou de définitions. Pourtant, dans l'Église, la doctrine est au service de la vie.",
      "À l'école du Bon Pasteur, elle devient soin des âmes : elle protège des impasses, nomme le vrai bien, éclaire les blessures et ouvre à la miséricorde."
    ],
    fact: "Les définitions doctrinales naissent souvent pour protéger un mystère ou une personne : l'identité du Christ, la dignité humaine, la réalité des sacrements, la bonté de la création.",
    anchor: "Lumen Gentium et le Catéchisme montrent que l'enseignement de l'Église vise la sainteté du peuple chrétien, pas la simple conservation d'un vocabulaire.",
    shepherd: "À l'école du Bon Pasteur, la doctrine est une clôture vivante : non pour empêcher la vie, mais pour empêcher ce qui la dévore. Elle protège afin que la liberté grandisse.",
    response: "Quand quelqu'un rejette la doctrine comme rigidité, on peut demander quelle vérité il aimerait voir protégée. Chacun comprend qu'une parole juste peut sauver de l'arbitraire. La doctrine catholique veut servir cette justesse à la lumière du Christ.",
    takeaways: [
      "La doctrine protège les mystères de la foi.",
      "Elle est ordonnée à la sainteté et à la vie.",
      "La vérité peut être un soin.",
      "Le Bon Pasteur enseigne pour sauver."
    ],
    sources: ["lumenGentium", "catechism", "aelfJohn10"]
  },
  {
    slug: "a-la-suite-du-bon-pasteur-jean-10-aujourd-hui",
    title: "À la suite du Bon Pasteur : comprendre Jean 10 aujourd'hui",
    description: "Relire Jean 10 pour apprendre le discernement, la fidélité et l'espérance dans la vie chrétienne actuelle.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-20",
    readingMinutes: 7,
    image: "shepherd",
    tags: ["Jean 10", "Bon Pasteur", "discernement"],
    intro: [
      "Dire À la suite du Bon Pasteur, c'est dire une direction. La foi chrétienne n'est pas une errance inspirée ; elle suit Quelqu'un.",
      "Jean 10 donne des mots très simples pour cela : voix, porte, vie, connaissance, don. Ces mots suffisent à renouveler toute une manière de croire."
    ],
    fact: "Dans Jean 10, la voix du pasteur est reconnue par les siens. Cette reconnaissance n'est pas magique : elle suppose une familiarité, une écoute, une histoire commune.",
    anchor: "La vie chrétienne forme cette oreille intérieure par la prière, la liturgie, l'Écriture, les sacrements et l'enseignement de l'Église.",
    shepherd: "À l'école du Bon Pasteur, le discernement n'est pas un jeu d'intuition privée. Il s'apprend dans la fidélité concrète, en revenant aux lieux où le Christ parle avec sûreté.",
    response: "Pour un lecteur qui se sent perdu, Jean 10 offre une première étape : revenir à la voix du Christ. Lire l'Évangile, chercher une formation solide, poser ses questions et refuser les voix qui nourrissent seulement la peur.",
    takeaways: [
      "Suivre le Bon Pasteur donne une direction.",
      "La voix du Christ se reconnaît par familiarité.",
      "Le discernement se forme dans la vie de l'Église.",
      "Jean 10 reste très actuel pour les croyants désorientés."
    ],
    sources: ["aelfJohn10", "deiVerbum", "catechism"]
  },
  {
    slug: "bon-pasteur-et-liberte-foi-ne-se-force-pas",
    title: "Bon Pasteur et liberté : la foi ne se force pas",
    description: "Pourquoi l'annonce catholique doit respecter la liberté de conscience sans renoncer à la vérité.",
    category: "À l'école du Bon Pasteur",
    date: "2026-04-19",
    readingMinutes: 7,
    image: "shepherd",
    tags: ["liberté religieuse", "Bon Pasteur", "annonce"],
    intro: [
      "Le Bon Pasteur appelle ; il ne manipule pas. Cette distinction est essentielle pour parler de mission catholique aujourd'hui.",
      "La foi ne se force pas, parce qu'elle engage la conscience et la réponse libre de la personne. Mais respecter la liberté ne veut pas dire se taire sur la vérité."
    ],
    fact: "Dignitatis Humanae enseigne que la personne humaine a droit à la liberté religieuse. Ce droit ne signifie pas que toutes les croyances se valent, mais que la vérité doit être cherchée et accueillie librement.",
    anchor: "L'annonce chrétienne vit donc une tension féconde : proposer clairement le Christ, sans pression indigne ; respecter la conscience, sans relativisme.",
    shepherd: "À l'école du Bon Pasteur, l'appel du Christ demeure ferme et doux. Le berger connaît la brebis par son nom ; il ne la traite pas comme un numéro à faire entrer de force.",
    response: "Dans la pratique, cela demande une parole transparente : dire ce que l'Église croit, expliquer pourquoi, répondre aux questions, puis laisser à l'autre l'espace d'une vraie décision.",
    takeaways: [
      "La foi demande une réponse libre.",
      "La liberté religieuse n'est pas le relativisme.",
      "L'annonce catholique propose sans manipuler.",
      "Le Bon Pasteur appelle chacun par son nom."
    ],
    sources: ["dignitatisHumanae", "aelfJohn10", "catechism"]
  },
  {
    slug: "dialogue-avec-islam-clarte-respect-christ",
    title: "Dialogue avec l'islam : clarté, respect et annonce du Christ",
    description: "Comment aborder le dialogue avec les musulmans en tenant ensemble respect, vérité et confession du Christ.",
    category: "Dialogue",
    date: "2026-04-18",
    readingMinutes: 8,
    image: "dialogue",
    tags: ["islam", "dialogue interreligieux", "Christ"],
    intro: [
      "Le dialogue avec l'islam demande à la fois respect réel et clarté doctrinale. Il ne s'agit ni de flatter, ni de provoquer, ni de masquer les différences.",
      "L'apologétique catholique doit apprendre à parler du Christ, de la Trinité, de l'Incarnation, de l'Écriture et de l'Église avec des mots compréhensibles et une attitude paisible."
    ],
    fact: "Nostra Aetate invite les catholiques à regarder avec estime ce qui est vrai et saint dans les traditions religieuses, tout en gardant la mission d'annoncer le Christ.",
    anchor: "Les divergences entre christianisme et islam sont profondes : identité de Jésus, Croix, Trinité, Révélation, Église. Les reconnaître n'empêche pas la bienveillance ; cela rend le dialogue honnête.",
    shepherd: "À l'école du Bon Pasteur, le respect ne consiste pas à devenir flou. Le berger ne cesse pas d'être berger parce qu'il parle doucement. Il conduit vers le Christ avec patience.",
    response: "Concrètement, il vaut mieux commencer par écouter la foi réelle de son interlocuteur, sans projeter des clichés. Puis l'on peut expliquer le coeur chrétien : le Verbe s'est fait chair, le Fils révèle le Père, la Croix est amour sauveur.",
    takeaways: [
      "Le dialogue avec l'islam demande respect et clarté.",
      "Nostra Aetate donne un cadre de bienveillance.",
      "Les différences doctrinales doivent être nommées honnêtement.",
      "L'annonce du Christ reste centrale."
    ],
    sources: ["nostraAetate", "catechism", "deiVerbum"]
  },
  {
    slug: "dialogue-avec-judaisme-racines-bibliques-fraternite",
    title: "Dialogue avec le judaïsme : racines bibliques et fraternité",
    description: "Pourquoi le catholicisme ne peut pas comprendre sa propre foi sans reconnaître ses racines juives.",
    category: "Dialogue",
    date: "2026-04-17",
    readingMinutes: 8,
    image: "dialogue",
    tags: ["judaïsme", "Bible", "Nostra Aetate"],
    intro: [
      "Le dialogue avec le judaïsme touche aux racines mêmes de la foi chrétienne. Jésus, Marie, les apôtres, les premières communautés et les Écritures d'Israël appartiennent à cette histoire.",
      "Parler du judaïsme avec légèreté serait donc parler avec légèreté de la propre mémoire chrétienne."
    ],
    fact: "Nostra Aetate rappelle le lien spirituel qui unit le peuple du Nouveau Testament à la lignée d'Abraham. Le texte rejette aussi toute forme de haine, persécution ou antisémitisme.",
    anchor: "La foi catholique lit l'Ancien Testament comme Parole de Dieu et comme préparation au Christ, sans effacer l'histoire d'Israël ni la dignité du peuple juif.",
    shepherd: "À l'école du Bon Pasteur, la mémoire biblique devient gratitude. Le Christ conduit l'Église, mais il le fait à travers une histoire commencée avec Abraham, Moïse, les prophètes et les psaumes.",
    response: "Dans une discussion, il faut éviter les raccourcis sur les pharisiens, l'Ancien Testament ou la responsabilité de la mort du Christ. Une apologétique sérieuse protège la vérité en refusant les simplifications injustes.",
    takeaways: [
      "Le christianisme a des racines juives profondes.",
      "Nostra Aetate rejette l'antisémitisme.",
      "L'Ancien Testament demeure Parole de Dieu.",
      "Le dialogue exige mémoire et gratitude."
    ],
    sources: ["nostraAetate", "deiVerbum", "catechism"]
  },
  {
    slug: "parler-aux-athees-sans-mepris",
    title: "Parler aux athées sans mépris",
    description: "Une méthode catholique pour dialoguer avec l'athéisme sans caricature ni complexe.",
    category: "Dialogue",
    date: "2026-04-16",
    readingMinutes: 8,
    image: "dialogue",
    tags: ["athéisme", "dialogue", "existence de Dieu"],
    intro: [
      "Parler à une personne athée demande de renoncer à deux facilités : supposer qu'elle refuse Dieu par mauvaise volonté, ou supposer que le croyant devrait s'excuser de croire.",
      "Le vrai dialogue commence lorsque chacun accepte que l'autre puisse poser une question sérieuse."
    ],
    fact: "Les motifs de l'athéisme sont multiples : expérience du mal, confiance exclusive dans les sciences, scandales religieux, blessures personnelles, conception inadéquate de Dieu ou simple absence de transmission.",
    anchor: "Gaudium et Spes, le Catéchisme et Fides et Ratio invitent à prendre au sérieux les questions de l'homme contemporain sans renoncer à affirmer Dieu créateur et sauveur.",
    shepherd: "À l'école du Bon Pasteur, la brebis éloignée n'est pas un adversaire abstrait. Elle a une histoire. La charité commence par refuser de réduire une personne à une étiquette.",
    response: "Une bonne conversation peut commencer par cette question : quel Dieu rejetez-vous ? Très souvent, l'apologétique découvre alors qu'il faut d'abord purifier une image fausse de Dieu avant de présenter le Dieu vivant.",
    takeaways: [
      "L'athéisme a des causes variées.",
      "Le mépris ferme la discussion.",
      "Il faut parfois purifier une fausse image de Dieu.",
      "Le croyant peut parler sans complexe et sans dureté."
    ],
    sources: ["fidesRatio", "catechism", "dignitatisHumanae"]
  },
  {
    slug: "reseaux-sociaux-apologetique-verite-visage-humain",
    title: "Réseaux sociaux et apologétique : la vérité avec visage humain",
    description: "Comment témoigner en ligne sans réduire la foi à des punchlines ou à des querelles permanentes.",
    category: "Mission",
    date: "2026-04-15",
    readingMinutes: 7,
    image: "digital",
    tags: ["réseaux sociaux", "mission", "témoignage"],
    intro: [
      "Les réseaux sociaux peuvent porter une parole catholique très loin. Ils peuvent aussi l'abîmer en la réduisant à des phrases courtes, des réactions rapides et des conflits sans profondeur.",
      "L'apologétique en ligne demande donc une discipline intérieure : préférer la vérité durable à la victoire instantanée."
    ],
    fact: "Les formats courts favorisent la simplification. Cela ne les rend pas inutiles, mais oblige à préparer des contenus qui ouvrent une porte au lieu de prétendre tout régler en quelques secondes.",
    anchor: "La mission de l'Église est d'annoncer le Christ à toutes les générations. Les moyens changent ; la responsabilité demeure : ne pas séparer la clarté doctrinale du témoignage visible.",
    shepherd: "À l'école du Bon Pasteur, même un commentaire en ligne doit garder quelque chose de la voix du Christ. La houlette devient alors une retenue : ne pas répondre à tout, ne pas humilier, ne pas mentir pour obtenir de l'attention.",
    response: "Une règle simple aide beaucoup : publier pour conduire, non pour se mettre en scène. Si un contenu donne envie de lire l'Évangile, de chercher une formation, de poser une vraie question ou de prier, il porte déjà un fruit.",
    takeaways: [
      "Les réseaux sociaux sont des lieux de mission exigeants.",
      "Les formats courts doivent ouvrir plutôt que réduire.",
      "La vérité ne doit pas perdre son visage humain.",
      "Publier pour conduire vaut mieux que publier pour briller."
    ],
    sources: ["ireneeFormations", "catechism", "aelfJohn10"]
  },
  {
    slug: "marie-dans-foi-catholique-sans-caricature",
    title: "Marie dans la foi catholique : comprendre sans caricaturer",
    description: "Pourquoi la place de Marie dans le catholicisme renvoie toujours au Christ et à l'oeuvre de la grâce.",
    category: "Vie catholique",
    date: "2026-04-14",
    readingMinutes: 8,
    image: "marian",
    tags: ["Marie", "catholicisme", "doctrine"],
    intro: [
      "Marie est l'un des sujets les plus mal compris du catholicisme. Certains imaginent que les catholiques la placent à la place du Christ ; d'autres ne voient pas pourquoi elle compterait autant.",
      "La réponse catholique commence par une précision simple : Marie n'est pas un écran devant le Christ, elle est la mère qui renvoie à lui."
    ],
    fact: "Les dogmes mariaux protègent d'abord une vérité sur le Christ et sur la grâce. La maternité divine affirme que celui qu'elle enfante est vraiment le Fils de Dieu fait homme.",
    anchor: "Lumen Gentium présente Marie dans le mystère du Christ et de l'Église. Cette place évite deux excès : l'oubli de Marie et une dévotion détachée du Christ.",
    shepherd: "À l'école du Bon Pasteur, Marie apprend à écouter la voix du Christ et à dire : faites tout ce qu'il vous dira. Elle ne détourne pas du berger ; elle forme une oreille de disciple.",
    response: "Dans un dialogue, on peut commencer par les points communs : Marie est biblique, elle est mère de Jésus, elle dit oui à Dieu. Puis l'on explique progressivement comment l'Église contemple en elle l'oeuvre de la grâce.",
    takeaways: [
      "Marie renvoie au Christ.",
      "Les dogmes mariaux protègent des vérités christologiques et spirituelles.",
      "Lumen Gentium donne un cadre équilibré.",
      "La vraie dévotion mariale forme des disciples."
    ],
    sources: ["lumenGentium", "catechism", "deiVerbum"]
  },
  {
    slug: "saints-temoins-non-ecrans-entre-dieu-et-nous",
    title: "Les saints : témoins, non écrans entre Dieu et nous",
    description: "Répondre aux objections sur les saints, leur intercession et leur place dans la vie catholique.",
    category: "Vie catholique",
    date: "2026-04-13",
    readingMinutes: 7,
    image: "marian",
    tags: ["saints", "intercession", "Église"],
    intro: [
      "La vénération des saints suscite souvent une objection : pourquoi passer par eux au lieu d'aller directement à Dieu ?",
      "La réponse catholique est simple : les saints ne remplacent pas Dieu. Ils manifestent ce que la grâce de Dieu peut faire dans une vie humaine."
    ],
    fact: "L'Église confesse la communion des saints : les croyants ne sont pas séparés par la mort comme si le Christ cessait d'unir son corps. Demander l'intercession d'un saint revient à demander la prière d'un membre vivant du Christ.",
    anchor: "Le Catéchisme situe les saints dans la communion de l'Église. Leur exemple encourage, leur prière accompagne, leur vie montre la fécondité de l'Évangile.",
    shepherd: "À l'école du Bon Pasteur, les saints sont comme des traces sur le chemin. Ils ne sont pas le berger ; ils montrent que le berger conduit réellement vers la sainteté.",
    response: "Pour expliquer cela, on peut partir d'une expérience commune : demander à un ami de prier pour nous. Si la mort ne détruit pas la communion dans le Christ, l'intercession des saints devient compréhensible.",
    takeaways: [
      "Les saints ne remplacent pas Dieu.",
      "La communion des saints exprime l'unité du corps du Christ.",
      "L'intercession prolonge la logique de la prière fraternelle.",
      "Les saints rendent visible la fécondité de l'Évangile."
    ],
    sources: ["catechism", "lumenGentium", "aelfJohn10"]
  },
  {
    slug: "eucharistie-messe-coeur-reponse-catholique",
    title: "Eucharistie : pourquoi la messe est le coeur de la réponse catholique",
    description: "Comprendre pourquoi l'Eucharistie n'est pas un simple symbole, mais le centre de la vie catholique.",
    category: "Vie catholique",
    date: "2026-04-12",
    readingMinutes: 8,
    image: "scripture",
    tags: ["Eucharistie", "messe", "sacrements"],
    intro: [
      "On peut défendre la foi catholique par des arguments, mais le coeur de cette foi bat à la messe. L'Eucharistie révèle ce que l'Église croit du Christ, du salut, du sacrifice et de la communion.",
      "Voilà pourquoi tant d'objections finissent par toucher la messe : présence réelle, sacrifice, sacerdoce, liturgie, adoration."
    ],
    fact: "La foi catholique confesse la présence réelle du Christ dans l'Eucharistie. Elle ne parle pas d'un simple souvenir psychologique, mais d'un sacrement où le Christ se donne.",
    anchor: "Le Catéchisme présente l'Eucharistie comme source et sommet de la vie chrétienne. Cette expression dit son rôle central : tout y conduit et tout en découle.",
    shepherd: "À l'école du Bon Pasteur, la table eucharistique est le lieu où le berger nourrit les siens. Il ne donne pas seulement des idées sur Dieu ; il se donne lui-même.",
    response: "Dans le dialogue, il faut souvent repartir de Jean 6, de la Cène, de la pratique ancienne de l'Église et de la cohérence sacramentelle. L'Eucharistie n'est pas une option dévotionnelle : elle est le coeur vivant du catholicisme.",
    takeaways: [
      "L'Eucharistie est centrale dans la foi catholique.",
      "La présence réelle ne se réduit pas à un symbole subjectif.",
      "La messe révèle le Christ qui se donne.",
      "Comprendre l'Eucharistie aide à comprendre l'Église."
    ],
    sources: ["catechism", "deiVerbum", "lumenGentium"]
  },
  {
    slug: "confession-misericorde-objection-pardon",
    title: "Confession et miséricorde : répondre à l'objection du pardon",
    description: "Pourquoi le sacrement de réconciliation révèle une miséricorde concrète et non une culpabilisation morbide.",
    category: "Vie catholique",
    date: "2026-04-11",
    readingMinutes: 7,
    image: "marian",
    tags: ["confession", "miséricorde", "sacrements"],
    intro: [
      "La confession est parfois perçue comme une pratique culpabilisante. Pourtant, pour l'Église, elle est l'un des lieux les plus concrets de la miséricorde.",
      "Elle oblige à regarder le péché en face, mais seulement pour recevoir un pardon réel et repartir libre."
    ],
    fact: "La foi catholique affirme que le Christ a confié à l'Église un ministère de réconciliation. Le sacrement n'invente pas la miséricorde : il la rend audible, personnelle et sacramentelle.",
    anchor: "Le Catéchisme parle de conversion, d'aveu, d'absolution et de réparation. Ces éléments ne sont pas des humiliations ; ils forment un chemin de vérité qui rend la liberté possible.",
    shepherd: "À l'école du Bon Pasteur, la miséricorde n'est pas une caresse vague. Le berger cherche la brebis perdue, la relève et la ramène. Il nomme la blessure pour la guérir.",
    response: "À quelqu'un qui craint la confession, on peut dire ceci : Dieu ne demande pas l'aveu pour découvrir ce qu'il ignore, mais pour nous faire sortir de la solitude du péché. Le pardon devient alors une parole reçue, pas une idée que l'on se répète.",
    takeaways: [
      "La confession est un sacrement de miséricorde.",
      "Nommer le péché sert la guérison.",
      "L'absolution rend le pardon personnel et audible.",
      "Le Bon Pasteur cherche pour relever."
    ],
    sources: ["catechism", "aelfJohn10", "lumenGentium"]
  }
];

export const blogArticles: BlogArticle[] = [...schoolArticles, ...seeds.map(makeArticle)];

export const blogCategories = Array.from(new Set(blogArticles.map(article => article.category)));

export function getBlogArticle(slug: string) {
  return blogArticles.find(article => article.slug === slug) || null;
}

export function getFeaturedArticles() {
  return blogArticles.filter(article => article.featured).slice(0, 6);
}

export function getRelatedArticles(article: BlogArticle, limit = 3) {
  const matches = blogArticles
    .filter(candidate => candidate.slug !== article.slug)
    .map(candidate => {
      const categoryScore = candidate.category === article.category ? 3 : 0;
      const tagScore = candidate.tags.filter(tag => article.tags.includes(tag)).length;
      return { article: candidate, score: categoryScore + tagScore };
    })
    .sort((a, b) => b.score - a.score || +new Date(b.article.date) - +new Date(a.article.date));

  return matches.slice(0, limit).map(match => match.article);
}

export function formatArticleDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00+02:00`));
}
