import Image from "next/image";
import Link from "next/link";
import { getCourses } from "@/lib/server-data";
import { UpcomingSessions } from "@/components/UpcomingSessions";
import { getPublicAgenda } from "@/lib/public-agenda";
export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Institut Apostolos Saint Irénée — L’Institut est de retour" }, description: "L’Institut est de retour. Théologie, philosophie et apologétique : reprenez le chemin de la formation. Les anciens détenteurs d’un pass annuel peuvent demander sa récupération gratuite." };
const domains = [
  { title: "Apologétique", art: "apologetique", subtitle: "Répondre. Dialoguer. Témoigner.", match: /introduction-apologetique/ },
  { title: "Écriture sainte", art: "ecriture", subtitle: "Accueillir. Méditer. Vivre.", match: /bibl|ecriture/ },
  { title: "Philosophie", art: "philosophie", subtitle: "Chercher. Discerner. Bâtir.", match: /philosophie|foi-et-raison/ }
];
export default async function Home() {
  const [courses, agenda] = await Promise.all([getCourses(), getPublicAgenda()]);
  return <div className="vitrail-home">
    <section className="vitrail-hero" aria-labelledby="home-title">
      <Image className="vitrail-hero-image" src="/images/apostolos/vitrail/hero.webp" alt="" fill priority sizes="100vw" />
      <div className="vitrail-hero-shade" />
      <div className="vitrail-hero-content">
        <p className="vitrail-eyebrow">L’Institut est de retour</p>
        <h1 id="home-title">Une foi vivante.<br />Une pensée libre.</h1>
        <p className="vitrail-intro">Théologie, philosophie et apologétique :<br className="desktop-break" /> reprenez le chemin de la formation.</p>
        <div className="vitrail-actions">
          <Link className="vitrail-button" href="/formations">Explorer les formations <span aria-hidden="true">→</span></Link>
          <Link className="vitrail-button vitrail-button-secondary" href="/a-propos">Découvrir l’Institut</Link>
        </div>
        <p className="vitrail-motto" aria-hidden="true"><span>→</span>S’enraciner<br />Comprendre<br />Dialoguer<br />Transmettre</p>
      </div>
      <p className="vitrail-column-quote" aria-hidden="true">Ad<br />Deum<br />per<br />intellectum<span>✧</span></p>
    </section>
    <section className="vitrail-return" aria-labelledby="return-title">
      <div><h2 id="return-title">Vous aviez un pass annuel ?</h2><p>Demandez sa récupération gratuite.</p></div>
      <Link className="vitrail-button" href="/recuperer-mon-pass">Récupérer mon pass <span aria-hidden="true">→</span></Link>
    </section>
    <section className="vitrail-domains" aria-labelledby="domains-title">
      <div className="vitrail-section-heading"><h2 id="domains-title">Explorer les savoirs</h2><p>Des racines<br />pour demain</p></div>
      <div className="vitrail-domain-grid">{domains.map(domain => {
        const course = courses.find(item => domain.match.test(item.slug));
        return <Link className="vitrail-domain" href={course ? `/formations#cours-${course.id}` : "/formations"} key={domain.art}>
          <Image src={`/images/apostolos/vitrail/${domain.art}.webp`} alt="" fill sizes="(max-width:650px) 100vw, 33vw" />
          <div className="vitrail-domain-copy"><h3>{domain.title}</h3><p>{domain.subtitle}</p></div><span className="vitrail-round-arrow" aria-hidden="true">→</span>
        </Link>;
      })}</div>
    </section>
    <Link className="vitrail-journal" href="/blog" aria-label="Le Journal — découvrir tous les articles">
      <div><h2>Le Journal <span aria-hidden="true">→</span></h2><p>Penser aujourd’hui<br />à la lumière du Christ</p></div>
      <p className="vitrail-journal-topics" aria-hidden="true">Articles<br />Réflexions<br />Débats<br />Culture</p>
      <p className="vitrail-journal-values" aria-hidden="true">Vérité<br />Beauté<br />Bien<br />Ensemble</p>
    </Link>
    <UpcomingSessions sessions={agenda.sessions} unavailable={agenda.unavailable} />
  </div>;
}
