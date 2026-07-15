import type { BlogArticle, BlogSource } from "./blog";

const sourceCatalog: Record<string, BlogSource> = {
  deiVerbum: {
    id: "deiVerbum",
    label: "Concile Vatican II, Dei Verbum",
    url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_fr.html"
  },
  aelfLuke1: {
    id: "aelfLuke1",
    label: "AELF, Évangile selon saint Luc, chapitre 1",
    url: "https://www.aelf.org/bible/Lc/1"
  },
  aelfJohn5: {
    id: "aelfJohn5",
    label: "AELF, Évangile selon saint Jean, chapitre 5",
    url: "https://www.aelf.org/bible/Jn/5"
  },
  britannicaSinaiticus: {
    id: "britannicaSinaiticus",
    label: "Britannica, Codex Sinaiticus",
    url: "https://www.britannica.com/topic/Codex-Sinaiticus"
  },
  britannicaTacitus: {
    id: "britannicaTacitus",
    label: "Britannica, Tacite",
    url: "https://www.britannica.com/biography/Tacitus-Roman-historian"
  },
  britannicaJosephus: {
    id: "britannicaJosephus",
    label: "Britannica, Flavius Josèphe",
    url: "https://www.britannica.com/biography/Flavius-Josephus"
  },
  ireneeFormations: {
    id: "ireneeFormations",
    label: "Institut Saint Irénée - Formations",
    url: "/formations"
  }
};

function sources(ids: string[]) {
  return ids.map(id => sourceCatalog[id]).filter(Boolean);
}

export const dossierArticles: BlogArticle[] = [
  {
    slug: "fiabilite-des-evangiles-dossier",
    title: "La fiabilité des Évangiles : manuscrits, histoire et regard de l'Église",
    description:
      "Un dossier complet sur la fiabilité historique des Évangiles : richesse des manuscrits, témoignages non chrétiens, archéologie, critères des historiens et enseignement de Dei Verbum.",
    category: "Fondamentaux",
    date: "2026-07-15",
    readingMinutes: 12,
    image: "/images/blog/ecriture-tradition-magistere.png",
    imageAlt: "Bible ancienne, parchemin scelle et cordon tresse dans une chapelle bibliotheque",
    tags: ["fiabilité des Évangiles", "manuscrits bibliques", "histoire", "apologétique"],
    featured: true,
    intro: [
      "Peut-on faire confiance aux Évangiles ? La question revient dans presque toutes les conversations sur la foi, et elle mérite mieux qu'un slogan, dans un sens comme dans l'autre. Ce dossier rassemble les données que tout lecteur peut vérifier : l'état des manuscrits, les témoignages extérieurs, l'archéologie, la méthode des historiens et la position de l'Église.",
      "L'objectif n'est pas de remplacer la foi par une démonstration, mais de montrer que le chrétien ne croit pas contre les faits. La confiance accordée aux Évangiles s'appuie sur des raisons publiques, discutables et documentées."
    ],
    sections: [
      {
        heading: "Poser la question correctement",
        paragraphs: [
          "Demander si les Évangiles sont « fiables » suppose de préciser ce qu'on attend d'eux. Ce ne sont ni des procès-verbaux modernes ni des biographies au sens contemporain : ce sont des témoignages rédigés au premier siècle pour transmettre ce que les premiers disciples ont vu, entendu et compris de Jésus de Nazareth.",
          "Le prologue de l'Évangile selon saint Luc l'affirme explicitement : l'auteur dit s'être « soigneusement informé de tout depuis les origines » auprès de « ceux qui, dès le commencement, furent témoins oculaires et serviteurs de la Parole ». L'intention de rapporter des faits réels appartient donc au texte lui-même, et c'est sur cette intention que l'historien peut travailler."
        ]
      },
      {
        heading: "Des manuscrits nombreux et remarquablement anciens",
        paragraphs: [
          "Aucun texte de l'Antiquité n'est aussi bien attesté matériellement que le Nouveau Testament : plusieurs milliers de manuscrits grecs ont été conservés, auxquels s'ajoutent les traductions anciennes (latin, syriaque, copte) et les citations abondantes des Pères de l'Église. À titre de comparaison, les œuvres classiques les mieux transmises, comme celles d'Homère, sont connues par un nombre de copies bien inférieur, et la plupart des auteurs antiques ne subsistent que par une poignée de manuscrits médiévaux.",
          "L'ancienneté des témoins est tout aussi frappante. Le fragment de papyrus P52, conservé à Manchester, contient quelques versets de l'Évangile selon saint Jean et est généralement daté de la première moitié du IIe siècle : quelques décennies seulement séparent ce témoin matériel de la rédaction du texte. Des papyrus plus étendus suivent au IIIe siècle, puis les grands codex complets du IVe siècle, comme le Codex Sinaiticus et le Codex Vaticanus.",
          "Cette densité documentaire a une conséquence méthodologique décisive : elle permet de comparer les copies entre elles et de reconstituer le texte avec une précision exceptionnelle. Les variantes existent, comme dans toute transmission manuscrite, mais l'immense majorité relève de l'orthographe ou de l'ordre des mots, et aucun point de doctrine chrétienne ne repose sur un passage textuellement incertain."
        ]
      },
      {
        heading: "Des témoignages extérieurs au christianisme",
        paragraphs: [
          "Les Évangiles ne sont pas les seuls documents antiques à mentionner Jésus. L'historien romain Tacite, racontant l'incendie de Rome sous Néron, rapporte que le « Christ » fut supplicié sous Ponce Pilate, pendant le règne de Tibère. Ce témoignage, hostile au christianisme, confirme le cadre chronologique et politique des récits évangéliques.",
          "L'historien juif Flavius Josèphe mentionne Jean le Baptiste, puis Jacques, « frère de Jésus appelé Christ », dans ses Antiquités juives ; ce dernier passage est très largement tenu pour authentique par les spécialistes, alors que le célèbre Testimonium Flavianum est considéré comme partiellement retouché par des copistes chrétiens, ce que la recherche dit ouvertement. Pline le Jeune, gouverneur de Bithynie vers 112, décrit quant à lui des chrétiens qui chantent des hymnes « au Christ comme à un dieu ».",
          "Aucun de ces textes ne démontre la foi chrétienne, et il ne faut pas leur faire dire plus qu'ils ne disent. Mais ils établissent un point que l'histoire sérieuse ne conteste plus : Jésus de Nazareth a existé, il a été exécuté sous Ponce Pilate, et le mouvement né de ses disciples s'est répandu très vite dans l'Empire."
        ]
      },
      {
        heading: "L'archéologie et la précision du contexte",
        paragraphs: [
          "Plusieurs détails des Évangiles, longtemps jugés suspects, ont été confirmés par l'archéologie. L'Évangile selon saint Jean décrit à Jérusalem une piscine de Bethesda entourée de cinq portiques : les fouilles menées près de l'église Sainte-Anne ont mis au jour ce bassin double à cinq colonnades, conforme à la description johannique.",
          "En 1961, une inscription découverte à Césarée maritime a livré le nom de Ponce Pilate avec son titre exact de préfet de Judée, confirmant l'existence et la fonction du personnage central du récit de la Passion. La toponymie, les noms propres, les monnaies et les usages décrits dans les Évangiles correspondent à la Palestine du premier siècle, et non au monde méditerranéen tardif où écrivaient les copistes.",
          "Ces convergences ne prouvent pas les miracles, ce n'est pas leur rôle. Elles montrent autre chose : les évangélistes connaissaient de près le pays, l'époque et les institutions dont ils parlaient, ce qui est la marque de traditions enracinées dans le témoignage, non d'une légende tardive."
        ]
      },
      {
        heading: "Comment travaillent les historiens",
        paragraphs: [
          "Les historiens du christianisme ancien utilisent des critères publics pour évaluer les traditions évangéliques. Le critère d'attestation multiple retient les faits rapportés par plusieurs sources indépendantes : la crucifixion de Jésus, par exemple, est attestée par les quatre Évangiles, par saint Paul et par Tacite.",
          "Le critère d'embarras est encore plus parlant : une communauté n'invente pas ce qui la gêne. Or les Évangiles rapportent le baptême de Jésus par Jean, le reniement de Pierre, la fuite des disciples et le témoignage des femmes au tombeau, alors que le témoignage féminin avait peu de valeur juridique à l'époque. La présence de ces éléments embarrassants plaide pour la fidélité des rédacteurs à ce qu'ils avaient reçu.",
          "Appliqués avec rigueur, ces critères conduisent la recherche contemporaine, croyante ou non, à reconnaître dans les Évangiles des sources historiques de premier ordre sur Jésus, son enseignement, sa mort et la naissance de la foi pascale, même lorsque l'historien suspend son jugement sur ce qui relève de la foi."
        ]
      },
      {
        heading: "Ce que l'Église affirme, et ce qu'elle n'affirme pas",
        paragraphs: [
          "La constitution dogmatique Dei Verbum du concile Vatican II « affirme sans hésiter l'historicité » des quatre Évangiles : ils « transmettent fidèlement ce que Jésus, le Fils de Dieu, durant sa vie parmi les hommes, a réellement fait et enseigné ». Le même texte décrit honnêtement le travail des évangélistes : sélection des traditions, synthèse, explicitation à la lumière de Pâques, adaptation à la situation des Églises.",
          "L'Église ne demande donc pas de lire les Évangiles comme un enregistrement mot à mot, et elle ne craint pas l'étude critique : elle l'encourage, tout en affirmant que cette étude, bien menée, rejoint le témoignage des Apôtres au lieu de le dissoudre. Croire les Évangiles n'exige pas de renoncer à l'intelligence historique ; cela demande de l'exercer jusqu'au bout, y compris sur la question que le texte pose lui-même : qui est cet homme ?"
        ]
      },
      {
        heading: "Les objections honnêtes méritent des réponses honnêtes",
        paragraphs: [
          "Il existe de vraies difficultés : des divergences de détail entre les récits, des chronologies organisées différemment, des paroles transmises avec des formulations distinctes. L'apologétique sérieuse ne les cache pas. Elle observe que ces variations sont celles de témoignages indépendants et de genres littéraires antiques, non celles d'une fabrication concertée, qui aurait précisément gommé les différences.",
          "De même, reconnaître que le texte a été copié avec des variantes, que certains passages ont une histoire textuelle discutée, ou que le Testimonium Flavianum a été retouché, ce n'est pas fragiliser le dossier : c'est montrer qu'il repose sur une critique des sources assumée. Une confiance qui a examiné les objections vaut plus qu'une confiance qui les ignore.",
          "C'est exactement le travail que propose la formation de l'Institut : lire les textes de près, connaître les données manuscrites et archéologiques, comprendre les méthodes des historiens et apprendre à en rendre compte avec clarté et charité."
        ]
      }
    ],
    takeaways: [
      "Le Nouveau Testament est le texte antique le mieux attesté par les manuscrits, en nombre comme en ancienneté.",
      "Tacite, Flavius Josèphe et Pline le Jeune confirment le cadre historique des Évangiles de l'extérieur.",
      "L'archéologie (Bethesda, inscription de Pilate) valide la précision du contexte évangélique.",
      "Les critères des historiens, comme l'embarras et l'attestation multiple, plaident pour la fidélité des traditions.",
      "Dei Verbum affirme l'historicité des Évangiles tout en assumant le travail rédactionnel des évangélistes."
    ],
    sources: sources([
      "deiVerbum",
      "aelfLuke1",
      "aelfJohn5",
      "britannicaSinaiticus",
      "britannicaTacitus",
      "britannicaJosephus",
      "ireneeFormations"
    ])
  }
];
