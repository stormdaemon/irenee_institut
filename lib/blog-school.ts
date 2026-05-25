import type { BlogArticle, BlogSource } from "./blog";

const sourceCatalog: Record<string, BlogSource> = {
  ireneeFormations: {
    id: "ireneeFormations",
    label: "Institut Irénée - Formations",
    url: "/formations"
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
  gaudiumSpes: {
    id: "gaudiumSpes",
    label: "Concile Vatican II, Gaudium et Spes",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_fr.html"
  },
  dignitatisHumanae: {
    id: "dignitatisHumanae",
    label: "Concile Vatican II, Dignitatis Humanae",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651207_dignitatis-humanae_fr.html"
  },
  evangeliiNuntiandi: {
    id: "evangeliiNuntiandi",
    label: "Paul VI, Evangelii Nuntiandi",
    url: "https://www.vatican.va/content/paul-vi/fr/apost_exhortations/documents/hf_p-vi_exh_19751208_evangelii-nuntiandi.html"
  },
  adGentes: {
    id: "adGentes",
    label: "Concile Vatican II, Ad Gentes",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651207_ad-gentes_fr.html"
  },
  interMirifica: {
    id: "interMirifica",
    label: "Concile Vatican II, Inter Mirifica",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19631204_inter-mirifica_fr.html"
  },
  lumenGentium: {
    id: "lumenGentium",
    label: "Concile Vatican II, Lumen Gentium",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_fr.html"
  },
  catechism: {
    id: "catechism",
    label: "Catéchisme de l'Église catholique",
    url: "https://www.vatican.va/archive/FRA0013/_INDEX.HTM"
  },
  aelfFirstPeter: {
    id: "aelfFirstPeter",
    label: "AELF, première lettre de saint Pierre, chapitre 3",
    url: "https://www.aelf.org/bible/1P/3"
  },
  aelfJohn10: {
    id: "aelfJohn10",
    label: "AELF, Évangile selon saint Jean, chapitre 10",
    url: "https://www.aelf.org/bible/Jn/10"
  },
  proverbs15: {
    id: "proverbs15",
    label: "AELF, Livre des Proverbes, chapitre 15",
    url: "https://www.aelf.org/bible/Pr/15"
  },
  britannicaLemaitre: {
    id: "britannicaLemaitre",
    label: "Britannica, Georges Lemaître",
    url: "https://www.britannica.com/biography/Georges-Lemaitre"
  },
  saintIrenee: {
    id: "saintIrenee",
    label: "Vatican, saint Irénée de Lyon docteur de l'unité",
    url: "https://www.vatican.va/content/francesco/fr/apost_letters/documents/20220121-santireneo-dottoredellachiesa.html"
  }
};

function sources(ids: string[]) {
  return ids.map(id => sourceCatalog[id]).filter(Boolean);
}

export const schoolArticles: BlogArticle[] = [
  {
    slug: "ecole-apologetique-repondre-douceur",
    title: "École d'Apologétique : apprendre à répondre avec douceur",
    description: "Une École d'Apologétique aide à parler de la foi sans dureté, avec une parole claire, simple et paisible.",
    category: "École d'Apologétique",
    date: "2026-05-25",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-repondre-douceur.webp",
    imageAlt: "Salle d'étude lumineuse avec Bible ouverte, carnet et lumière douce de vitrail",
    tags: ["École d'Apologétique", "douceur", "témoignage"],
    featured: true,
    intro: [
      "Beaucoup de croyants aimeraient parler de leur foi, mais ils craignent de blesser, de mal dire ou de se faire enfermer dans une dispute. Une École d'Apologétique existe pour donner une parole plus calme.",
      "Elle n'apprend pas à parler plus fort que les autres. Elle apprend à répondre avec justesse, à garder un cœur paisible et à faire sentir que la vérité n'a pas besoin de violence pour être belle."
    ],
    sections: [
      {
        heading: "La phrase qui donne le ton",
        paragraphs: [
          "La première lettre de saint Pierre demande aux chrétiens d'être prêts à rendre raison de leur espérance, mais avec douceur et respect. Cette phrase suffit à corriger beaucoup de mauvaises habitudes.",
          "Rendre raison, ce n'est pas écraser quelqu'un sous des preuves. C'est ouvrir une porte. C'est dire pourquoi l'on croit, pourquoi l'on espère, pourquoi le Christ demeure digne de confiance quand le monde doute ou ironise."
        ]
      },
      {
        heading: "Une parole qui commence par écouter",
        paragraphs: [
          "Dans une vraie conversation, la première réponse n'est pas toujours une phrase. Souvent, c'est une écoute. Une personne ne pose pas seulement une question ; elle vient avec son histoire, ses blessures, ses lectures, ses colères et parfois ses peurs.",
          "Une École d'Apologétique forme donc à ne pas répondre trop vite. Elle aide à comprendre ce qui est vraiment demandé, puis à choisir les mots qui éclairent sans humilier."
        ]
      },
      {
        heading: "La douceur n'efface pas la clarté",
        paragraphs: [
          "La douceur chrétienne n'est pas une façon de tout rendre vague. Elle permet au contraire de dire les choses avec plus de netteté, parce que l'interlocuteur n'est pas traité comme un ennemi.",
          "Le Christ ne sépare jamais la lumière de l'amour. Une parole catholique perd son visage si elle devient agressive ; elle perd aussi son poids si elle n'ose plus nommer ce qui est vrai."
        ]
      },
      {
        heading: "Ce que l'école change",
        paragraphs: [
          "Une École d'Apologétique donne une manière de se tenir dans le dialogue : rester calme, reconnaître ce que l'on ne sait pas, revenir aux sources, et ne jamais oublier que la personne compte plus que la victoire d'un instant.",
          "Pour le lecteur qui veut progresser, le premier pas est simple : relire une question difficile à la lumière de la foi, puis chercher une réponse qui puisse être donnée avec paix."
        ]
      }
    ],
    takeaways: [
      "La foi se défend mieux quand la parole reste paisible.",
      "La douceur et la clarté peuvent marcher ensemble.",
      "écouter d'abord rend la réponse plus humaine.",
      "Une École d'Apologétique forme des témoins, pas des querelleurs."
    ],
    sources: sources(["aelfFirstPeter", "catechism", "ireneeFormations"])
  },
  {
    slug: "ecole-apologetique-foi-raison",
    title: "École d'Apologétique : croire sans éteindre l'intelligence",
    description: "Pourquoi la foi catholique invite a penser, chercher et poser des questions sans peur.",
    category: "École d'Apologétique",
    date: "2026-05-24",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-foi-raison.webp",
    imageAlt: "Bibliothèque ancienne avec globe, livres ouverts et lumière du matin",
    tags: ["École d'Apologétique", "foi", "raison"],
    featured: true,
    intro: [
      "Beaucoup imaginent qu'il faut choisir entre croire et penser. La foi serait pour les cœurs simples, la raison pour les esprits libres. La tradition catholique refuse cette opposition.",
      "Une École d'Apologétique aide à comprendre que la foi n'a rien à perdre lorsque l'intelligence cherche sincèrement la vérité."
    ],
    sections: [
      {
        heading: "Dieu n'a pas peur des questions",
        paragraphs: [
          "Fides et Ratio rappelle que la foi et la raison sont faites pour chercher ensemble la vérité. Cette conviction donne une grande paix : une question honnête n'est pas une menace pour Dieu.",
          "On peut interroger l'existence de Dieu, la souffrance, les Évangiles, l'histoire de l'Église ou la morale sans quitter le chemin de la foi. Le vrai danger n'est pas de poser une question ; c'est de ne plus chercher la vérité."
        ]
      },
      {
        heading: "Une intelligence qui devient humble",
        paragraphs: [
          "Penser ne veut pas dire tout comprendre d'un coup. L'intelligence avance par étapes. Elle apprend à distinguer ce qui est certain, ce qui est probable, ce qui reste obscur et ce qui demande plus de temps.",
          "Cette humilité rend la foi plus solide. Elle empêche de confondre une impression avec une réponse et elle évite de transformer chaque discussion en jugement rapide."
        ]
      },
      {
        heading: "Le monde pose de vraies questions",
        paragraphs: [
          "Gaudium et Spes regarde les joies, les peines et les angoisses des hommes. Le texte ne parle pas d'un monde abstrait : il parle de personnes qui cherchent le sens de leur vie, de leur souffrance et de leur avenir.",
          "Une École d'Apologétique part de ces questions réelles. Elle n'enseigne pas une foi hors du monde, mais une foi capable d'éclairer ce que les hommes vivent chaque jour."
        ]
      },
      {
        heading: "Un chemin pour aujourd'hui",
        paragraphs: [
          "Croire sans éteindre l'intelligence, c'est accepter de lire, de comparer, de vérifier, de prier et de demander conseil. C'est aussi accepter que certaines réponses deviennent claires peu à peu.",
          "L'Institut Irénée veut servir ce chemin : former des catholiques qui n'aient pas peur de penser, parce qu'ils savent que toute vérité vient de Dieu."
        ]
      }
    ],
    takeaways: [
      "La foi catholique invite à chercher la vérité.",
      "Une question honnête peut devenir un chemin vers Dieu.",
      "L'intelligence grandit quand elle devient humble.",
      "Une École d'Apologétique relie la pensée, la prière et la vie."
    ],
    sources: sources(["fidesRatio", "gaudiumSpes", "ireneeFormations"])
  },
  {
    slug: "ecole-apologetique-bible-parole",
    title: "École d'Apologétique et Bible : lire avant de répondre",
    description: "Une réponse catholique devient plus juste quand elle revient d'abord à la Parole de Dieu.",
    category: "École d'Apologétique",
    date: "2026-05-23",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-bible-parole.webp",
    imageAlt: "Bible ouverte sur une table de bois avec plume, bougie et fenêtre claire",
    tags: ["École d'Apologétique", "Bible", "Parole de Dieu"],
    featured: true,
    intro: [
      "Beaucoup d'objections commencent par une phrase entendue sur la Bible : un passage choque, un récit semble étrange, une contradiction est supposée, une parole de Jésus est arrachée à son contexte.",
      "Une École d'Apologétique apprend à ne pas répondre avec des slogans. Elle invite d'abord à lire, à regarder le texte, à se laisser instruire par la Parole de Dieu."
    ],
    sections: [
      {
        heading: "La Bible n'est pas un pretexte",
        paragraphs: [
          "Dei Verbum rappelle que Dieu parle aux hommes et que cette parole conduit au Christ. La Bible n'est donc pas une réserve de phrases à lancer dans un débat ; elle est un lieu de rencontre avec Dieu.",
          "Lire avant de répondre change tout. On cesse de prendre un verset comme une arme. On cherche ce que le texte dit vraiment, à qui il parle, et comment il conduit vers le Christ."
        ]
      },
      {
        heading: "Répondre avec une parole habitée",
        paragraphs: [
          "Une personne peut poser une question sur la violence, les miracles, la création, Marie, l'Église ou la résurrection. Dans chaque cas, la Bible demande une lecture attentive et patiente.",
          "La réponse catholique ne se limite pas à une phrase isolée. Elle regarde l'ensemble : l'Ancien Testament, les Évangiles, la vie de l'Église, la prière et la foi reçue depuis les apôtres."
        ]
      },
      {
        heading: "Une lecture qui rend plus simple",
        paragraphs: [
          "Plus on lit la Bible avec l'Église, plus on peut parler simplement. La simplicité ne vient pas de l'ignorance, mais d'une familiarité grandissante avec les grandes lignes de l'histoire sainte.",
          "Une École d'Apologétique aide ainsi à donner des réponses moins brusques et plus profondes. Elle apprend à dire : regardons le texte, puis avançons ensemble."
        ]
      },
      {
        heading: "Le fruit attendu",
        paragraphs: [
          "Le but n'est pas seulement de gagner une discussion sur un passage difficile. Le but est que la personne ait envie de lire davantage et de découvrir le visage du Christ dans l'Écriture.",
          "Quand la Bible redevient une source, la parole du croyant devient plus sobre, plus vraie et plus proche du cœur de l'Église."
        ]
      }
    ],
    takeaways: [
      "La Bible se lit avant de se citer.",
      "La Parole de Dieu conduit au Christ.",
      "Une réponse catholique regarde l'ensemble de la foi.",
      "Une École d'Apologétique forme à lire avec patience."
    ],
    sources: sources(["deiVerbum", "aelfFirstPeter", "catechism"])
  },
  {
    slug: "ecole-apologetique-liberte-proposer-sans-forcer",
    title: "École d'Apologétique et liberté : proposer sans forcer",
    description: "Pourquoi la foi catholique se propose avec clarté, sans pression et sans peur de la liberté.",
    category: "École d'Apologétique",
    date: "2026-05-22",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-liberte-proposer-sans-forcer.webp",
    imageAlt: "Porte de chapelle ouverte sur un jardin paisible baigné de lumière",
    tags: ["École d'Apologétique", "liberté", "foi"],
    featured: true,
    intro: [
      "La foi ne se force pas. Cette phrase est simple, mais elle protège la dignité de la personne et la beauté de l'annonce chrétienne.",
      "Une École d'Apologétique apprend à proposer la foi avec clarté, sans pression, sans manipulation et sans renoncer à la vérité."
    ],
    sections: [
      {
        heading: "La vérité appelle la liberté",
        paragraphs: [
          "Dignitatis Humanae affirme que personne ne doit être forcé d'agir contre sa conscience en matière religieuse. La foi demande une réponse libre, parce qu'elle engage toute la personne.",
          "Cela ne veut pas dire que toutes les idées se valent. Cela veut dire que la vérité ne grandit pas dans une âme par contrainte. Elle demande un accueil, une confiance et un consentement."
        ]
      },
      {
        heading: "Le Bon Pasteur appelle",
        paragraphs: [
          "Dans l'Évangile selon saint Jean, le Bon Pasteur appelle ses brebis par leur nom. Il ne les traite pas comme une foule anonyme. Il les connaît, les conduit et donne sa vie pour elles.",
          "Cette image donne un style à toute parole chrétienne. On ne pousse pas quelqu'un vers Dieu comme on gagne une bataille. On l'appelle, on l'éclaire, on l'accompagne."
        ]
      },
      {
        heading: "Clarté sans pression",
        paragraphs: [
          "Proposer sans forcer ne signifie pas parler à demi-mot. Le croyant peut dire clairement qui est le Christ, ce que croit l'Église et pourquoi cette foi change la vie.",
          "Mais il laisse à l'autre un espace réel pour recevoir, réfléchir, questionner et répondre. Cette patience n'affaiblit pas l'annonce ; elle la rend plus digne du Christ."
        ]
      },
      {
        heading: "Une parole qui respecte",
        paragraphs: [
          "Une École d'Apologétique forme à ce respect concret : ne pas piéger, ne pas culpabiliser, ne pas parler comme si l'autre était seulement un problème à corriger.",
          "La foi se propose comme une lumière. Elle n'a pas besoin d'être imposée pour être forte."
        ]
      }
    ],
    takeaways: [
      "La foi demande une réponse libre.",
      "Proposer n'est pas imposer.",
      "Le Bon Pasteur donne le style de l'annonce.",
      "La clarté grandit quand elle respecte la personne."
    ],
    sources: sources(["dignitatisHumanae", "aelfJohn10", "catechism"])
  },
  {
    slug: "ecole-apologetique-mission-annoncer-christ",
    title: "École d'Apologétique et mission : annoncer le Christ simplement",
    description: "L'apologétique catholique trouve son sens quand elle conduit vers le Christ, et pas seulement vers des réponses.",
    category: "École d'Apologétique",
    date: "2026-05-21",
    readingMinutes: 8,
    image: "/images/blog/articles/ecole-apologetique-mission-annoncer-christ.webp",
    imageAlt: "Chemin de pierre vers une eglise lumineuse au lever du soleil",
    tags: ["École d'Apologétique", "mission", "Christ"],
    featured: true,
    intro: [
      "L'apologétique n'est pas une passion pour les disputes religieuses. Elle à un centre : annoncer le Christ, le faire connaître et aider les personnes a s'approcher de lui.",
      "Une École d'Apologétique garde ce centre visible. Elle ne forme pas seulement à répondre aux objections ; elle forme à servir la rencontre avec le Christ."
    ],
    sections: [
      {
        heading: "L'Église existe pour annoncer",
        paragraphs: [
          "Evangelii Nuntiandi rappelle que l'annonce de l'Évangile appartient au cœur de la vie de l'Église. La foi reçue n'est pas faite pour rester cachée par peur du regard des autres.",
          "Ad Gentes présente aussi l'Église comme envoyée vers les hommes. Cette mission n'est pas une option réservee à quelques spécialistes : elle concerne tout baptisé, selon sa place et ses dons."
        ]
      },
      {
        heading: "Répondre ne suffit pas",
        paragraphs: [
          "Il est possible de donner une réponse juste et de perdre le fil principal. Si l'on parle de Dieu sans conduire vers le Christ, la parole reste incomplète.",
          "Une bonne réponse doit laisser voir plus qu'une idée. Elle doit faire pressentir une présence, une espérance, une joie possible, une vie qui vaut la peine d'être cherchée."
        ]
      },
      {
        heading: "La simplicité rend proche",
        paragraphs: [
          "Annoncer simplement ne veut pas dire appauvrir la foi. Cela veut dire choisir des mots que l'autre peut recevoir, sans faire de la religion un langage ferme.",
          "Le Christ parlait avec des images de la vie : le pain, la porte, le berger, la lumière, la maison. Une École d'Apologétique apprend à retrouver cette clarté."
        ]
      },
      {
        heading: "Une mission patiente",
        paragraphs: [
          "Tout ne se joue pas dans une seule conversation. Parfois, une parole juste prepare seulement le terrain. Elle fait tomber une caricature, adoucit une peur, ou donne envie de revenir.",
          "C'est déjà beaucoup. L'annonce du Christ avance souvent par petites lumières fidèles."
        ]
      }
    ],
    takeaways: [
      "L'apologétique conduit vers le Christ.",
      "La mission concerne tout baptisé.",
      "La simplicité aide la foi a devenir audible.",
      "Une parole juste peut preparer une rencontre future."
    ],
    sources: sources(["evangeliiNuntiandi", "adGentes", "ireneeFormations"])
  },
  {
    slug: "ecole-apologetique-science-emerveillement",
    title: "École d'Apologétique et science : garder l'émerveillement",
    description: "Comment parler de science et de foi sans les opposer, avec admiration pour la création et amour de la vérité.",
    category: "École d'Apologétique",
    date: "2026-05-20",
    readingMinutes: 8,
    image: "/images/blog/articles/ecole-apologetique-science-emerveillement.webp",
    imageAlt: "Télescope ancien près d'une fenêtre ouverte sur un ciel étoile",
    tags: ["École d'Apologétique", "science", "création"],
    featured: true,
    intro: [
      "La science est souvent présentée comme une raison de quitter la foi. Pourtant, l'histoire de l'Église montre une relation plus riche, faite de recherches, d'admiration et parfois de tensions à regarder avec honnêteté.",
      "Une École d'Apologétique aide a sortir du faux choix entre aimer la science et croire en Dieu."
    ],
    sections: [
      {
        heading: "La création se regarde aussi avec intelligence",
        paragraphs: [
          "La foi catholique affirme que le monde vient de Dieu. Cette conviction ne dispense pas d'étudier le monde ; elle donne au contraire une raison de l'admirer.",
          "Quand un croyant regarde les étoiles, la vie, les lois de la nature ou la beauté du vivant, il ne fuit pas la science. Il apprend à recevoir le réel comme un don qui mérite d'être compris."
        ]
      },
      {
        heading: "L'exemple de Georges Lemaître",
        paragraphs: [
          "La figure de Georges Lemaître, prêtre catholique et grand scientifique lié à l'histoire de la théorie du Big Bang, suffit à fissurer l'image d'une guerre simple entre foi et science.",
          "Lemaître n'est pas une réponse à toutes les questions, mais il montre qu'un esprit croyant peut chercher avec sérieux, sans transformer Dieu en bouche-trou pour ce qu'il ne comprend pas encore."
        ]
      },
      {
        heading: "Ne pas opposer ce qui cherche la vérité",
        paragraphs: [
          "La science et la foi ne posent pas toujours les mêmes questions. La science observe, mesure et explique des enchaînements. La foi parle du sens dernier, du don de l'être, de la vocation de l'homme et de Dieu.",
          "Une École d'Apologétique apprend à ne pas mélanger ces plans et à ne pas les séparer comme s'ils étaient ennemis."
        ]
      },
      {
        heading: "Une parole paisible",
        paragraphs: [
          "Face à quelqu'un qui oppose science et foi, il vaut mieux commencer par reconnaître la valeur de la recherche. Un catholique n'a pas à avoir peur d'une découverte vraie.",
          "La vérité ne peut pas contredire la vérité. Cette confiance rend la conversation plus libre et plus belle."
        ]
      }
    ],
    takeaways: [
      "La science peut nourrir l'émerveillement.",
      "Georges Lemaître montre qu'un croyant peut chercher avec rigueur.",
      "La foi et la science ne posent pas toujours les mêmes questions.",
      "Une École d'Apologétique aide à parler sans peur."
    ],
    sources: sources(["britannicaLemaitre", "fidesRatio", "catechism"])
  },
  {
    slug: "ecole-apologetique-conversations-difficiles",
    title: "École d'Apologétique : garder la paix dans les conversations difficiles",
    description: "Des repères simples pour parler de la foi quand le ton monte, sans se fermer ni renoncer à la vérité.",
    category: "École d'Apologétique",
    date: "2026-05-19",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-conversations-difficiles.webp",
    imageAlt: "Table ronde avec deux tasses, livres ouverts et lumière chaude de fin de jour",
    tags: ["École d'Apologétique", "dialogue", "paix"],
    intro: [
      "Certaines conversations sur la foi deviennent vite difficiles. Un mot suffit parfois à réveiller une blessure, une caricature ou une ancienne colère.",
      "Une École d'Apologétique apprend à rester présent dans ces moments, sans se durcir et sans abandonner ce qui est vrai."
    ],
    sections: [
      {
        heading: "La paix commence dans le ton",
        paragraphs: [
          "Le livre des Proverbes rappelle qu'une réponse paisible peut calmer la fureur, tandis qu'un mot blessant peut la faire monter. Cette sagesse très simple vaut pour beaucoup de discussions sur la foi.",
          "Le ton ne remplace pas la vérité, mais il décide souvent si la vérité pourra être entendue. Une parole dure peut fermer une porte avant meme que la réponse soit comprise."
        ]
      },
      {
        heading: "Ne pas répondre a la blessure comme à une attaque",
        paragraphs: [
          "Derrière une objection, il peut y avoir une vraie question. Il peut aussi y avoir une douleur. Une personne qui parle durement de l'Église ne parle pas toujours seulement d'une idée ; parfois, elle parle d'une déception.",
          "Une École d'Apologétique aide a discerner cela. Elle apprend à ne pas traiter toutes les phrases comme des ennemies et à chercher ce qui demande d'abord de la compassion."
        ]
      },
      {
        heading: "Dire vrai avec patience",
        paragraphs: [
          "Garder la paix ne veut pas dire tout accepter. Si une accusation est fausse, il faut pouvoir la corriger. Si une question est juste, il faut pouvoir l'accueillir.",
          "La patience consiste à répondre au bon endroit. Elle refuse les phrases qui blessent pour impressionner. Elle préfère une clarté qui peut porter du fruit."
        ]
      },
      {
        heading: "Une petite regle utile",
        paragraphs: [
          "Avant de répondre, on peut se demander : est-ce que ma phrase va éclairer, ou seulement soulager mon agacement ? Cette question simple peut sauver une conversation.",
          "La foi mérite mieux qu'une réaction nerveuse. Elle mérite une parole qui garde la paix du Christ."
        ]
      }
    ],
    takeaways: [
      "Le ton peut ouvrir ou fermer une conversation.",
      "Une objection peut cacher une blessure.",
      "La patience aide à répondre au bon endroit.",
      "Une École d'Apologétique forme à parler sans se durcir."
    ],
    sources: sources(["proverbs15", "aelfFirstPeter", "gaudiumSpes"])
  },
  {
    slug: "ecole-apologetique-jeunes-adultes",
    title: "École d'Apologétique pour jeunes adultes : ne pas rester seul avec ses questions",
    description: "Pourquoi les jeunes adultes ont besoin d'un lieu solide pour poser leurs questions et approfondir la foi.",
    category: "École d'Apologétique",
    date: "2026-05-18",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-jeunes-adultes.webp",
    imageAlt: "Groupe de jeunes adultes autour d'une table avec livres, carnets et lumière de chapelle",
    tags: ["École d'Apologétique", "jeunes adultes", "formation"],
    intro: [
      "Les jeunes adultes rencontrent souvent des questions fortes : Dieu existe-t-il vraiment, peut-on faire confiance à l'Église, comment croire dans un monde qui doute, que faire des scandales, de la science, de la morale ou de la souffrance ?",
      "Une École d'Apologétique offre un lieu où ces questions peuvent être posées sans honte et travaillées avec sérieux."
    ],
    sections: [
      {
        heading: "Une generation qui cherche",
        paragraphs: [
          "Gaudium et Spes parle d'un monde marque par de grands changements et par des questions profondes sur le sens de la vie. Cette description rejoint beaucoup de jeunes adultes d'aujourd'hui.",
          "Ils ne manquent pas toujours d'intérêt pour la foi. Souvent, ils manquent d'un lieu où leurs questions soient prises au sérieux, sans réponse trop rapide et sans ton condescendant."
        ]
      },
      {
        heading: "Ne pas confondre doute et abandon",
        paragraphs: [
          "Avoir des questions ne signifie pas que l'on a perdu la foi. Cela peut être le début d'une foi plus personnelle, moins héritée par habitude et plus choisie.",
          "Une formation solide aide à traverser ce passage. Elle donne des sources, des repères, des compagnons de route et le courage de ne pas rester seul."
        ]
      },
      {
        heading: "Apprendre à parler dans son monde",
        paragraphs: [
          "Les jeunes adultes parlent de la foi en famille, avec des amis, en couple, à l'université, au travail ou en ligne. Ils ont besoin de mots simples et vrais pour ces lieux réels.",
          "Une École d'Apologétique ne les éloigne pas de leur monde. Elle les aide a y être présents avec une foi plus claire et plus paisible."
        ]
      },
      {
        heading: "Une foi qui grandit",
        paragraphs: [
          "Quand une question trouve une réponse solide, quelque chose se détend. La foi devient moins fragile devant les objections et plus libre pour aimer.",
          "C'est l'un des fruits les plus beaux d'une École d'Apologétique : faire passer de la peur de répondre à la joie de témoigner."
        ]
      }
    ],
    takeaways: [
      "Les jeunes adultes ont besoin d'un lieu pour poser leurs questions.",
      "Le doute peut devenir un passage vers une foi plus personnelle.",
      "La formation aide à parler dans la vie réelle.",
      "Une foi mieux comprise devient plus libre."
    ],
    sources: sources(["gaudiumSpes", "catechism", "ireneeFormations"])
  },
  {
    slug: "ecole-apologetique-en-ligne",
    title: "École d'Apologétique en ligne : parler vrai dans un monde pressé",
    description: "Comment garder une parole catholique humaine, claire et patiente sur internet.",
    category: "École d'Apologétique",
    date: "2026-05-17",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-en-ligne.webp",
    imageAlt: "Téléphone pose près d'une Bible ouverte et d'un carnet dans une lumière douce",
    tags: ["École d'Apologétique", "internet", "mission"],
    intro: [
      "Internet donne à chacun la possibilité de parler vite et loin. C'est une chance pour annoncer la foi, mais aussi un lieu où la parole peut devenir brusque, incomplète ou blessante.",
      "Une École d'Apologétique aide à garder une parole catholique humaine dans un monde pressé."
    ],
    sections: [
      {
        heading: "Les outils changent, la responsabilite demeure",
        paragraphs: [
          "Inter Mirifica reconnaît l'importance des moyens de communication et invite à les employer pour le bien. Aujourd'hui, cette invitation touche aussi les réseaux sociaux, les vidéos, les messages courts et les commentaires.",
          "Le moyen peut être moderne, mais la question reste ancienne : est-ce que ma parole sert la vérité et le bien de celui qui la reçoit ?"
        ]
      },
      {
        heading: "La tentation de la phrase qui gagne",
        paragraphs: [
          "En ligne, on peut facilement chercher la phrase qui humilie, celle qui fait reagir ou qui donne l'impression d'avoir gagne. Mais une phrase victorieuse peut laisser une personne plus loin du Christ.",
          "Une École d'Apologétique apprend a préférer la parole qui ouvre. Elle donne envie d'aller plus loin, de lire, de prier, de poser une vraie question."
        ]
      },
      {
        heading: "Parler vrai sans perdre le visage",
        paragraphs: [
          "Evangelii Nuntiandi invite a annoncer l'Évangile avec les moyens de son temps. Cela demande de ne pas séparer le contenu de la manière de parler.",
          "La foi catholique n'est pas un simple avis parmi d'autres. Mais elle ne doit pas perdre son visage humain au moment meme ou elle se rend visible."
        ]
      },
      {
        heading: "Une présence plus chrétienne",
        paragraphs: [
          "Avant de publier, on peut se demander : est-ce que cela aide quelqu'un à aimer davantage la vérité ? Est-ce que cela respecte la personne qui doute ? Est-ce que cela conduit vers le Christ ?",
          "Ces questions simples changent déjà la manière d'être présent en ligne."
        ]
      }
    ],
    takeaways: [
      "Internet peut servir l'annonce de la foi.",
      "Une parole courte doit rester juste.",
      "Humilier n'est jamais une victoire chrétienne.",
      "Une École d'Apologétique aide à parler vrai avec visage humain."
    ],
    sources: sources(["interMirifica", "evangeliiNuntiandi", "aelfFirstPeter"])
  },
  {
    slug: "ecole-apologetique-saints-temoins",
    title: "École d'Apologétique et saints : apprendre par des vies",
    description: "Les saints montrent que la foi n'est pas seulement une idée à expliquer, mais une vie transformée par le Christ.",
    category: "École d'Apologétique",
    date: "2026-05-16",
    readingMinutes: 7,
    image: "/images/blog/articles/ecole-apologetique-saints-temoins.webp",
    imageAlt: "Galerie de portraits de saints dans une lumière de cathédrale avec livres ouverts",
    tags: ["École d'Apologétique", "saints", "témoignage"],
    intro: [
      "Une réponse sur la foi peut être juste, mais rester froide. Les saints rappellent que le christianisme n'est pas seulement une idée à expliquer : c'est une vie transformée.",
      "Une École d'Apologétique gagne à regarder les saints, parce qu'ils montrent ce que la grâce peut faire dans des personnes réelles."
    ],
    sections: [
      {
        heading: "La sainteté rend la foi visible",
        paragraphs: [
          "Lumen Gentium présente l'appel à la sainteté comme un appel pour tous. La foi ne se mesure pas seulement à ce que l'on sait dire, mais à la manière dont le Christ prend forme dans une vie.",
          "Les saints ne remplacent pas les réponses. Ils les rendent crédibles. Ils montrent qu'une foi vraie peut devenir patience, courage, pardon, intelligence, service et joie."
        ]
      },
      {
        heading: "Saint Irénée, un nom pour unir",
        paragraphs: [
          "Le pape François a donne à saint Irénée de Lyon le titre de docteur de l'unité. Ce signe parle fortement à une École d'Apologétique qui porte son nom.",
          "Irénée rappelle que défendre la foi ne veut pas dire fragmenter, mais garder l'unité de ce que l'Église à reçu et transmettre cette foi avec fidélité."
        ]
      },
      {
        heading: "Des vies qui repondent",
        paragraphs: [
          "A quelqu'un qui demande si la foi change vraiment quelque chose, on peut parler des saints. Ils ne sont pas des statues lointaines, mais des témoins de la puissance du Christ dans l'histoire.",
          "Leur vie répond parfois là où les mots ne suffisent pas. Elle montre une foi devenue chair, temps donné, courage dans l'épreuve et amour jusqu'au bout."
        ]
      },
      {
        heading: "Apprendre à témoigner",
        paragraphs: [
          "Une École d'Apologétique ne forme pas seulement à parler des saints. Elle aide chacun à comprendre que sa propre vie peut devenir une petite lumière pour quelqu'un d'autre.",
          "La meilleure réponse sera toujours celle où la parole et la vie marchent ensemble."
        ]
      }
    ],
    takeaways: [
      "Les saints rendent la foi visible.",
      "Saint Irénée rappelle l'importance de l'unité.",
      "Une vie transformée peut répondre plus loin que des mots.",
      "L'apologétique grandit quand la parole et la vie s'accordent."
    ],
    sources: sources(["lumenGentium", "saintIrenee", "catechism"])
  }
];
