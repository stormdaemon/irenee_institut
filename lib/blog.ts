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

export const blogArticles: BlogArticle[] = [
  {
    "slug": "apprendre-a-poser-une-question",
    "title": "Avant de répondre, apprendre à questionner",
    "description": "Une bonne question ne cherche pas seulement une réponse rapide : elle précise ce qui mérite d’être compris.",
    "category": "Méthode",
    "date": "2026-10-08",
    "readingMinutes": 3,
    "image": "/images/apostolos/etude.png",
    "imageAlt": "Livres et architecture d’étude — Apostolos",
    "tags": [
      "Méthode"
    ],
    "featured": true,
    "intro": [
      "Une bonne question ne cherche pas seulement une réponse rapide : elle précise ce qui mérite d’être compris."
    ],
    "sections": [
      {
        "heading": "Définir ce qui nous interroge",
        "paragraphs": [
          "Une discussion sur la foi commence souvent par une formule très large. Avant de réunir des arguments, on peut demander ce que cette formule signifie pour la personne qui la prononce. Parle-t-elle d’une idée, d’une expérience, d’une institution ou d’une blessure ?",
          "Écrire la question en une phrase aide à repérer les mots qui restent flous. Cet exercice ne rend pas le sujet moins profond ; il rend le travail possible."
        ]
      },
      {
        "heading": "Distinguer comprendre et convaincre",
        "paragraphs": [
          "On peut comprendre un argument sans encore y adhérer. Donner à cette étape sa place libère la conversation de l’obligation de gagner immédiatement.",
          "Avant de répondre, essayez de reformuler le propos de votre interlocuteur de manière qu’il puisse dire : oui, c’est bien ma question. Cette vérification est souvent plus utile qu’une nouvelle référence."
        ]
      },
      {
        "heading": "Construire un carnet de questions",
        "paragraphs": [
          "Réservez une page aux questions que votre lecture fait naître. À côté de chacune, notez ce qui est acquis, ce qui reste incertain et la source que vous souhaitez consulter.",
          "Revenir sur ce carnet après un module permet de voir une progression qui ne se mesure pas seulement au nombre de pages lues."
        ]
      }
    ],
    "takeaways": [
      "Définir ce qui nous interroge",
      "Distinguer comprendre et convaincre",
      "Construire un carnet de questions"
    ],
    "sources": []
  },
  {
    "slug": "lire-un-texte-sans-le-precipiter",
    "title": "Lire lentement, comprendre davantage",
    "description": "Quelques habitudes simples pour faire d’un texte étudié une pensée réellement comprise.",
    "category": "Pratique",
    "date": "2026-10-08",
    "readingMinutes": 3,
    "image": "/images/apostolos/cloitre.png",
    "imageAlt": "Livres et architecture d’étude — Apostolos",
    "tags": [
      "Pratique"
    ],
    "featured": true,
    "intro": [
      "Quelques habitudes simples pour faire d’un texte étudié une pensée réellement comprise."
    ],
    "sections": [
      {
        "heading": "Lire une première fois sans tout résoudre",
        "paragraphs": [
          "La première lecture permet de rencontrer le mouvement d’un texte. Il n’est pas nécessaire d’interrompre chaque phrase pour éclaircir tous les détails. Relevez les passages qui résistent et continuez jusqu’au bout.",
          "À la fin, formulez ce que l’auteur semble vouloir établir. Une proposition provisoire vaut mieux qu’un résumé composé uniquement de citations."
        ]
      },
      {
        "heading": "Revenir à la structure",
        "paragraphs": [
          "Lors de la deuxième lecture, séparez la question, la thèse et les raisons avancées. Repérez les exemples : illustrent-ils un propos ou constituent-ils une preuve ?",
          "Les mots de liaison sont de précieux repères. Un « donc » indique une conclusion ; un « pourtant » marque une difficulté. Les souligner rend le raisonnement visible."
        ]
      },
      {
        "heading": "Fermer le livre pour reformuler",
        "paragraphs": [
          "Éloignez le texte quelques minutes. Expliquez son idée principale avec vos propres mots, puis rouvrez-le pour vérifier ce que vous avez oublié ou déplacé.",
          "Le but n’est pas de remplacer la parole de l’auteur, mais de reconnaître précisément ce que vous en avez compris."
        ]
      }
    ],
    "takeaways": [
      "Lire une première fois sans tout résoudre",
      "Revenir à la structure",
      "Fermer le livre pour reformuler"
    ],
    "sources": []
  },
  {
    "slug": "foi-raison-temps-etude",
    "title": "Faire une place à l’étude dans une vie chargée",
    "description": "Un rythme réaliste, un lieu simple et une attention protégée : préparer les conditions de l’apprentissage.",
    "category": "Vie étudiante",
    "date": "2026-10-08",
    "readingMinutes": 3,
    "image": "/images/apostolos/etude.png",
    "imageAlt": "Livres et architecture d’étude — Apostolos",
    "tags": [
      "Vie étudiante"
    ],
    "featured": true,
    "intro": [
      "Un rythme réaliste, un lieu simple et une attention protégée : préparer les conditions de l’apprentissage."
    ],
    "sections": [
      {
        "heading": "Choisir un rendez-vous tenable",
        "paragraphs": [
          "Un projet de formation dure mieux lorsqu’il s’inscrit dans une semaine réelle. Commencez par un créneau que vous pouvez protéger, même court, plutôt que par un programme idéal impossible à tenir.",
          "Prévoyez une marge pour reprendre un passage difficile. La régularité n’exige pas que chaque séance produise le même résultat."
        ]
      },
      {
        "heading": "Préparer un espace d’attention",
        "paragraphs": [
          "Gardez à portée de main le cours, un carnet et les références utiles. Écartez les notifications pendant la lecture. Ces gestes simples réduisent les interruptions sans demander un équipement particulier.",
          "Au début de la séance, relisez votre dernière note : elle vous permettra de retrouver le fil sans recommencer tout le travail."
        ]
      },
      {
        "heading": "Terminer par une trace",
        "paragraphs": [
          "Notez une idée comprise, une question encore ouverte et votre prochaine étape. Trois phrases suffisent.",
          "Une semaine interrompue n’annule pas les précédentes. Reprenez au dernier repère utile, sans transformer le retard en motif d’abandon."
        ]
      }
    ],
    "takeaways": [
      "Choisir un rendez-vous tenable",
      "Préparer un espace d’attention",
      "Terminer par une trace"
    ],
    "sources": []
  },
  {
    "slug": "dialoguer-sans-caricaturer",
    "title": "Le désaccord peut-il nous faire progresser ?",
    "description": "Écouter une objection avec précision pour répondre à la question qui est réellement posée.",
    "category": "Dialogue",
    "date": "2026-10-08",
    "readingMinutes": 3,
    "image": "/images/apostolos/cloitre.png",
    "imageAlt": "Livres et architecture d’étude — Apostolos",
    "tags": [
      "Dialogue"
    ],
    "featured": false,
    "intro": [
      "Écouter une objection avec précision pour répondre à la question qui est réellement posée."
    ],
    "sections": [
      {
        "heading": "Accueillir la difficulté",
        "paragraphs": [
          "Une objection peut être une demande de précision, une contestation ou l’expression d’une expérience douloureuse. La manière de l’accueillir doit tenir compte de cette différence.",
          "Demander un exemple concret évite souvent de débattre de deux problèmes différents sous les mêmes mots."
        ]
      },
      {
        "heading": "Présenter loyalement les positions",
        "paragraphs": [
          "La version la plus faible d’une idée est rarement celle qui mérite d’être discutée. Cherchez les raisons qu’une personne réfléchie pourrait avoir de la soutenir.",
          "Vous pouvez ensuite exposer votre désaccord en distinguant les faits, leur interprétation et les conséquences que vous en tirez."
        ]
      },
      {
        "heading": "Accepter une conversation inachevée",
        "paragraphs": [
          "Certaines questions demandent une lecture supplémentaire ou un temps de réflexion. Dire « je ne sais pas encore » protège la confiance dans l’échange.",
          "Convenir d’une source à consulter ensemble peut être une meilleure conclusion qu’un dernier argument."
        ]
      }
    ],
    "takeaways": [
      "Accueillir la difficulté",
      "Présenter loyalement les positions",
      "Accepter une conversation inachevée"
    ],
    "sources": []
  },
  {
    "slug": "travailler-avec-les-sources",
    "title": "Une référence n’est pas encore un argument",
    "description": "Retrouver le contexte, vérifier une citation et distinguer la source de son commentaire.",
    "category": "Sources",
    "date": "2026-10-08",
    "readingMinutes": 3,
    "image": "/images/apostolos/etude.png",
    "imageAlt": "Livres et architecture d’étude — Apostolos",
    "tags": [
      "Sources"
    ],
    "featured": false,
    "intro": [
      "Retrouver le contexte, vérifier une citation et distinguer la source de son commentaire."
    ],
    "sections": [
      {
        "heading": "Retrouver le passage",
        "paragraphs": [
          "Une citation isolée peut perdre le problème auquel elle répond. Quand c’est possible, lisez ce qui la précède et ce qui la suit. Notez le titre de l’œuvre, la section et l’édition consultée.",
          "Une traduction est aussi un travail d’interprétation. Si un mot porte tout l’argument, comparez les traductions disponibles avant de conclure."
        ]
      },
      {
        "heading": "Identifier le type de document",
        "paragraphs": [
          "Un récit, une lettre, une définition et un commentaire ne se lisent pas de la même manière. Demandez-vous à qui le texte s’adresse et ce qu’il cherche à faire.",
          "Distinguez la parole de la source du commentaire qui l’accompagne. Cette attention permet de citer avec davantage de justesse."
        ]
      },
      {
        "heading": "Rendre son raisonnement vérifiable",
        "paragraphs": [
          "Expliquez le lien entre la référence et la conclusion que vous proposez. Le lecteur doit pouvoir suivre votre passage de l’une à l’autre.",
          "Gardez les références dans vos notes de cours : elles forment une bibliothèque de travail, pas un décor destiné à impressionner."
        ]
      }
    ],
    "takeaways": [
      "Retrouver le passage",
      "Identifier le type de document",
      "Rendre son raisonnement vérifiable"
    ],
    "sources": []
  },
  {
    "slug": "le-chemin-apostolos",
    "title": "Apostolos : comprendre pour transmettre",
    "description": "Une nouvelle identité pour une même exigence d’étude : donner des fondements à une parole éclairée.",
    "category": "L’Institut",
    "date": "2026-10-08",
    "readingMinutes": 3,
    "image": "/images/apostolos/cloitre.png",
    "imageAlt": "Livres et architecture d’étude — Apostolos",
    "tags": [
      "L’Institut"
    ],
    "featured": false,
    "intro": [
      "Une nouvelle identité pour une même exigence d’étude : donner des fondements à une parole éclairée."
    ],
    "sections": [
      {
        "heading": "Commencer par apprendre",
        "paragraphs": [
          "L’Institut Apostolos Saint Irénée place les cours et les modules au cœur de son parcours. L’objectif est de rendre l’étude accessible sans réduire les questions à quelques formules.",
          "L’histoire, les Écritures, la philosophie et la théologie offrent des points d’entrée complémentaires. Le travail consiste à les articuler avec soin."
        ]
      },
      {
        "heading": "Avancer avec des repères",
        "paragraphs": [
          "Un cours donne une direction ; les modules permettent de la parcourir par étapes. Votre espace personnel vous aide à retrouver les contenus et à suivre votre progression.",
          "Une bonne séance d’étude peut aussi aboutir à une question mieux formulée. L’apprentissage ne se résume pas à accumuler des réponses."
        ]
      },
      {
        "heading": "Transmettre avec justesse",
        "paragraphs": [
          "Rendre compte de la foi demande à la fois de la précision et de la charité. La première évite de déformer les idées ; la seconde donne à l’interlocuteur toute sa place.",
          "C’est cet esprit que nous souhaitons faire vivre dans le programme, les lectures et les échanges de l’Institut."
        ]
      }
    ],
    "takeaways": [
      "Commencer par apprendre",
      "Avancer avec des repères",
      "Transmettre avec justesse"
    ],
    "sources": []
  }
];

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
