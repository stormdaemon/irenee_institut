import Image from "next/image";

const samuelPhotoUrl = "https://bilan-previsionnel.fr/wp-content/uploads/2020/11/Bilan-Previsionnel-presentation-portrait-img-1.jpg";

const values = [
  ["Excellence académique", "Nous maintenons les plus hauts standards d'enseignement théologique.", "/images/irenee-value-medallion-1.png", "50% 50%"],
  ["Bienveillance", "Le dialogue apologétique doit se faire dans la charité.", "/images/irenee-value-medallion-2.png", "50% 50%"],
  ["Fidélité au Magistère", "Notre enseignement est fidèle à la doctrine de l'Église catholique.", "/images/irenee-value-medallion-3.png", "50% 50%"],
  ["Communauté", "Nous cultivons une communauté d'entraide fraternelle.", "/images/irenee-value-medallion-4.png", "50% 50%"],
  ["Accessibilité", "Une formation 100% en ligne accessible partout.", "/images/irenee-value-medallion-5.png", "50% 50%"],
  ["Rigueur intellectuelle", "Nous encourageons la réflexion critique au service de la foi.", "/images/irenee-value-medallion-6.png", "50% 50%"]
];

const reasons = [
  ["Une formation complète", "/images/irenee-reason-medallion-1.png"],
  ["Des formateurs d'excellence", "/images/irenee-reason-medallion-2.png"],
  ["Certificats reconnus", "/images/irenee-reason-medallion-3.png"],
  ["100% en ligne et flexible", "/images/irenee-reason-medallion-4.png"],
  ["Tarifs accessibles", "/images/irenee-reason-medallion-5.png"],
  ["Accompagnement personnalisé", "/images/irenee-reason-medallion-6.png"],
  ["Communauté vivante", "/images/irenee-reason-medallion-7.png"],
  ["Outils pratiques", "/images/irenee-reason-medallion-8.png"]
];

export default function AboutPage() {
  return (
    <>
      <section className="section about-direction-section">
        <div className="container center">
          <h2 className="section-title">Direction</h2>
          <div className="grid-2 about-directors">
            <article className="card about-director-card">
              <div className="about-director-photo">
                <Image src={samuelPhotoUrl} alt="Samuel Armanios" fill sizes="150px" style={{ objectFit: "cover", objectPosition: "52% 14%", transform: "scale(1.62)" }} />
              </div>
              <span className="badge">Directeur</span>
              <h3>Samuel Armanios</h3>
              <p className="muted">Diplômé en théologie à l'Université de la Sainte Croix.</p>
            </article>
            <article className="card about-director-card">
              <div className="about-director-photo">
                <Image src="/images/mathieu.webp" alt="Matthieu Raffray" fill sizes="150px" style={{ objectFit: "cover" }} />
              </div>
              <span className="badge">Directeur administratif</span>
              <h3>Matthieu Raffray</h3>
              <p className="muted">Directeur administratif, engagé dans l'organisation et l'accompagnement des étudiants.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container center">
          <h2 className="section-title">Nos Valeurs</h2>
          <div className="grid-3 about-icon-grid">
            {values.map(([title, text, icon, position]) => (
              <article className="soft-card about-icon-card" key={title}>
                <span className="about-medallion value-medallion">
                  <Image src={icon} alt="" fill sizes="104px" style={{ objectFit: "cover", objectPosition: position }} />
                </span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section hero-band">
        <div className="container">
          <h2 className="section-title" style={{ color: "white" }}>Pourquoi nous choisir ?</h2>
          <div className="grid-4 about-reasons-grid">
            {reasons.map(([item, icon]) => (
              <article className="soft-card about-reason-card" key={item}>
                <span className="about-medallion small">
                  <Image src={icon} alt="" fill sizes="68px" style={{ objectFit: "cover" }} />
                </span>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
