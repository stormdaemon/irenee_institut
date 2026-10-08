import { UpcomingSessions } from "@/components/UpcomingSessions";
import { getPublicAgenda } from "@/lib/public-agenda";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { getCourses } from "@/lib/server-data";
import { courseArtwork } from "@/lib/course-art";
import { blogArticles } from "@/lib/blog";
export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Institut Apostolos Saint Irénée — Comprendre pour transmettre" } };
export default async function Home() {
  const [courses, agenda] = await Promise.all([getCourses(), getPublicAgenda()]);
  const moduleCount = courses.reduce((n, c) => n + Number(c.nb_modules || 0), 0);
  return <div className="apostolos-home apostolos-illustrated">
    <section className="apostolos-sanctuary">
      <Image src="/images/apostolos/sanctuaire.png" alt="Une bibliothèque dans une basilique, éclairée par les vitraux, avec un manuscrit enluminé au premier plan" fill priority sizes="100vw" />
      <div className="apostolos-sanctuary-shade" />
      <div className="apostolos-wrap apostolos-sanctuary-content">
        <span className="apostolos-label">INSTITUT APOSTOLOS SAINT IRÉNÉE</span>
        <div className="apostolos-ornament" aria-hidden="true"><img src="/images/apostolos/ui/emblem.png" width="140" height="140" alt="" /></div>
        <h1><span>La foi.</span><span>Le désir de</span><em>comprendre.</em></h1>
        <p>Entrez dans une tradition vivante. Explorez les Écritures, l’histoire et la raison pour comprendre la foi catholique et apprendre à la transmettre.</p>
        <div className="apostolos-actions"><Link href="/formations" className="apostolos-cta apostolos-cta-gold">Explorer les formations <ArrowUpRight size={19} /></Link><Link href="/a-propos" className="apostolos-text-link">Découvrir l’Institut <ArrowRight size={17} /></Link></div>
      </div>
      <div className="apostolos-sanctuary-caption"><span>ÉCRITURE · TRADITION · RAISON</span><span>Un héritage à comprendre. Une parole à porter.</span></div>
    </section>
    <div className="apostolos-foundations apostolos-wrap"><div><strong>{courses.length}</strong><span>cours pour approfondir</span></div><div><strong>{moduleCount}</strong><span>modules à explorer</span></div><div><strong>Un chemin</strong><span>à votre rythme, où que vous soyez</span></div></div>
    <section className="apostolos-conviction apostolos-wrap" data-reveal>
      <div className="apostolos-conviction-image"><Image src="/images/apostolos/tradition.png" alt="Lumière des vitraux sur la pierre sculptée d’une église" fill sizes="(max-width:800px) 100vw, 40vw" /><span>UNE TRADITION VIVANTE</span></div>
      <div><span className="apostolos-label">L’ESPRIT APOSTOLOS</span><h2>Des racines profondes.<br /><em>Un regard ouvert.</em></h2><p className="apostolos-lead">La foi ne demande pas de renoncer à comprendre.</p><p>L’Écriture, la tradition chrétienne, la philosophie et l’histoire se rencontrent dans un parcours structuré. Nous prenons le temps de lire, de questionner et de relier les idées, pour former une parole précise et charitable.</p><Link href="/a-propos" className="apostolos-text-link">Notre démarche <ArrowUpRight size={18} /></Link></div>
    </section>
    <div className="apostolos-motion-ribbon" aria-hidden="true"><span className="apostolos-motion-word">CROIRE. COMPRENDRE. TRANSMETTRE.</span></div>
    <section className="apostolos-section apostolos-wrap">
      <div className="apostolos-section-head"><div><span className="apostolos-label">LES PORTES DU SAVOIR</span><h2>Chaque question ouvre<br /><em>un nouvel horizon.</em></h2></div><Link href="/formations" className="apostolos-text-link">Tous les cours <ArrowUpRight size={18} /></Link></div>
      <div className="apostolos-course-grid">{courses.filter((_, index) => [0, 1, 5].includes(index)).map((course, i) => {
        const art = courseArtwork(course.slug);
        return <Link href={`/formations#cours-${course.id}`} key={course.id} className="apostolos-course-tile apostolos-painted-course"><div className="apostolos-painted-art"><Image src={art.src} alt={art.alt} fill sizes="(max-width:520px) 100vw, (max-width:800px) 50vw, 33vw" /><span className="apostolos-art-number">{String(i + 1).padStart(2, "0")}</span><span className="apostolos-art-label">APOSTOLOS / ÉTUDES</span></div><div className="apostolos-course-body"><span className="apostolos-label">{course.nb_modules} MODULES · À VOTRE RYTHME</span><h3>{course.titre}</h3><p>{course.description}</p><span className="apostolos-text-link">Explorer ce cours <ArrowUpRight size={18} /></span></div></Link>;
      })}</div>
    </section>
    <section className="apostolos-interlude"><Image src="/images/apostolos/raison.png" alt="Le ciel étoilé et les instruments d’un cabinet d’étude" fill sizes="100vw" /><div className="apostolos-interlude-copy"><span className="apostolos-label">LA FOI ET LA RAISON EN DIALOGUE</span><h2>S’émerveiller.<br />Questionner.<br /><em>Approfondir.</em></h2><p>Les grandes questions méritent plus qu’une réponse rapide. Donnons-leur un lieu, des sources et du temps.</p><Link href="/formations" className="apostolos-cta apostolos-cta-gold">Entrer dans le programme <ArrowUpRight size={18} /></Link></div></section>
    <section className="apostolos-method apostolos-wrap apostolos-illustrated-method"><div className="apostolos-method-image"><Image src="/images/apostolos/manuscrits.png" alt="Un livre enluminé, une plume et des feuilles d’olivier dans la lumière d’un scriptorium" fill sizes="(max-width:800px) 100vw, 50vw" /></div><div className="apostolos-method-copy"><span className="apostolos-label">UNE MÉTHODE, UN CHEMIN</span><h2>Apprendre vraiment.<br /><em>Un pas après l’autre.</em></h2>{[["01", "Entrer dans une question", "Des cours organisés pour poser les fondements avant les approfondissements."], ["02", "Prendre le temps d’étudier", "Des modules de lecture et des ressources à retrouver dans votre espace."], ["03", "Faire vivre ce que l’on apprend", "Une progression personnelle pour relier le savoir à la réflexion et au dialogue."]].map(([n, title, text]) => <div className="apostolos-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}<Link href="/formations" className="apostolos-text-link">Trouver mon point de départ <ArrowUpRight size={18} /></Link></div></section>
    <section className="apostolos-section apostolos-wrap"><div className="apostolos-section-head"><div><span className="apostolos-label">LE JOURNAL APOSTOLOS</span><h2>La réflexion<br /><em>se prolonge ici.</em></h2></div><Link href="/blog" className="apostolos-text-link">Ouvrir le journal <ArrowUpRight size={18} /></Link></div><div className="apostolos-journal-grid">{blogArticles.slice(0, 3).map((article, i) => <article className="apostolos-journal-card" key={article.slug}><Link href={`/blog/${article.slug}`}><div className="apostolos-journal-image"><Image src={["/images/apostolos/manuscrits.png", "/images/apostolos/raison.png", "/images/apostolos/tradition.png"][i]} alt="" fill sizes="(max-width:520px) 100vw, 33vw" /></div><span className="apostolos-label">{article.category} · {article.readingMinutes} MIN</span><h2>{article.title}</h2><p>{article.description}</p><span className="apostolos-text-link">Lire l’article <ArrowUpRight size={17} /></span></Link></article>)}</div></section>
    <UpcomingSessions sessions={agenda.sessions} unavailable={agenda.unavailable} />
  </div>;
}
