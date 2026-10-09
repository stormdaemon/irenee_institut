import Link from "next/link";
import { EditorialBanner } from "@/components/EditorialBanner";
import { JsonLd } from "@/components/JsonLd";
import { publicPageMetadata, siteUrl } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "Apologétique pour étudiants : par où commencer ? | Apostolos",
  "Un parcours pour étudier la foi catholique pendant ses études : méthode, foi et raison, lecture des sources et dialogue. Ressources et cours Apostolos Saint Irénée.",
  "/apologetique-pour-etudiants"
);

export default function StudentApologeticsPage() {
  return <div className="apostolos-wrap">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", "@id": `${siteUrl}/apologetique-pour-etudiants#webpage`, url: `${siteUrl}/apologetique-pour-etudiants`, name: "Apologétique pour étudiants", inLanguage: "fr-FR", about: { "@id": `${siteUrl}/#organization` }, isPartOf: { "@id": `${siteUrl}/#website` } }} />
    <EditorialBanner image="/images/apostolos/vitrail/ecriture.webp" label="ÉTUDIER · COMPRENDRE · DIALOGUER">
      <h1>L’apologétique<br /><em>pour étudiants.</em></h1>
      <p>L’apologétique catholique étudie les raisons de croire et les réponses aux objections. Pour un étudiant, elle donne une méthode : comprendre une question, examiner les sources et dialoguer sans chercher à humilier.</p>
    </EditorialBanner>
    <article className="apostolos-section apostolos-article-body">
      <p>Une conversation après un cours, une vidéo sur la religion ou une interrogation personnelle peuvent soulever des questions difficiles. Il n’est pas nécessaire d’avoir réponse à tout pour commencer. L’Institut d’Apologétique Apostolos Saint Irénée propose des cours en ligne et un journal de ressources pour avancer progressivement.</p>
      <section><h2>Commencer par une question précise</h2>
        <p>« La foi est-elle raisonnable ? » recouvre plusieurs problèmes. S’agit-il de l’existence de Dieu, de la fiabilité d’un texte ou du rapport entre une conviction et une preuve ? Écrivez d’abord la question en une phrase. Distinguez ensuite une affirmation historique, une proposition philosophique et un enseignement de la foi : on ne les examine pas avec les mêmes outils.</p>
        <p>Pour préparer cet exercice, lisez <Link href="/blog/qu-est-ce-que-l-apologetique-catholique">notre introduction à l’apologétique catholique</Link> et <Link href="/blog/apprendre-a-poser-une-question">la méthode pour poser une question</Link>. Essayez de reformuler une objection de manière que votre interlocuteur reconnaisse sa propre pensée.</p>
      </section>
      <section><h2>Un rythme compatible avec la vie universitaire</h2>
        <p>Voici une proposition de travail, à adapter à vos études : deux séances de vingt minutes par semaine et un court bilan. La première sert à lire une source ; la seconde, à résumer son argument. Le bilan distingue ce que vous comprenez, ce que vous contestez et ce qu’il reste à vérifier. Ce rythme suggéré n’est pas la durée annoncée des cours.</p>
        <ol><li><strong>Première semaine :</strong> définir l’apologétique et apprendre à séparer une question de la réponse que l’on espère.</li><li><strong>Deuxième semaine :</strong> travailler les rapports entre foi et raison, en explicitant les prémisses d’un argument.</li><li><strong>Troisième semaine :</strong> lire un passage biblique dans son contexte et comparer une citation à sa source.</li><li><strong>Quatrième semaine :</strong> préparer une réponse courte, puis noter honnêtement ses limites.</li></ol>
        <p>Le <Link href="/programme-apologetique">programme de formation</Link> présente la progression. Le <Link href="/formations">catalogue</Link> détaille les cours et leurs modules pour choisir un point de départ adapté.</p>
      </section>
      <section><h2>Trois questions à explorer</h2>
        <h3>La raison et la foi s’opposent-elles ?</h3><p>Commencez par définir ce que vous appelez « raison » et « foi ». Examiner un argument n’est pas le confondre avec une preuve expérimentale. Notre dossier <Link href="/blog/foi-et-raison-deux-lumieres">Foi et raison</Link> propose des repères et renvoie aux textes étudiés.</p>
        <h3>Comment étudier les Évangiles ?</h3><p>Il faut distinguer la transmission des manuscrits, le genre du récit et la portée théologique du texte. Une réponse sur l’un de ces points ne résout pas automatiquement les autres. Le dossier sur <Link href="/blog/fiabilite-des-evangiles-dossier">la fiabilité des Évangiles</Link> aide à situer ces questions.</p>
        <h3>Comment discuter sans transformer l’échange en concours ?</h3><p>Demandez ce qui compte réellement pour votre interlocuteur, donnez vos sources et acceptez de dire « je vais vérifier ». La première lettre de Pierre associe la réponse sur l’espérance à la douceur et au respect ; <a href="https://www.aelf.org/bible/1P/3">lisez 1 Pierre 3, 15–16 dans son contexte</a>. Une personne ne se réduit jamais à son objection.</p>
      </section>
      <section><h2>Questions pratiques</h2><h3>Faut-il déjà avoir étudié la théologie ?</h3><p>Le catalogue comporte une introduction générale à l’apologétique chrétienne. Consultez les objectifs et le niveau de chaque cours avant de choisir ; les approfondissements demandent davantage de repères.</p><h3>Peut-on lire des ressources avant de s’inscrire ?</h3><p>Oui, les articles du <Link href="/blog">journal Apostolos</Link> sont consultables publiquement. L’accès aux cours se gère ensuite dans votre espace personnel selon vos droits.</p><h3>Apostolos est-il l’ancien Institut Saint Irénée ?</h3><p>Oui. L’Institut Saint Irénée revient sous le nom d’Institut Apostolos Saint Irénée. <Link href="/institut-apologetique">Découvrez l’Institut</Link> et <Link href="/equipe">son équipe</Link>. Si vous possédiez un pass annuel, vous pouvez <Link href="/recuperer-mon-pass">demander sa récupération gratuite</Link> ; l’équipe vérifiera votre ancien accès.</p></section>
      <p><Link className="vitrail-button" href="/formations">Choisir un premier cours →</Link></p>
      <p className="apostolos-label">Rédaction : Institut Apostolos Saint Irénée · 9 octobre 2026</p>
    </article>
  </div>;
}
