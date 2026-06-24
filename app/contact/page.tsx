"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, Clock, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    category: "Inscription",
    items: [
      ["Qui peut s'inscrire à l'Institut Saint Irénée ?", "Toute personne souhaitant approfondir la foi catholique et apprendre à la défendre avec intelligence et charité peut s'inscrire."],
      ["Y a-t-il des prérequis pour s'inscrire au Semestre 2 ?", "Oui, le Semestre 2 suppose d'avoir validé ou maîtrisé les bases du premier semestre."],
    ],
  },
  {
    category: "Formation",
    items: [
      ["Quel est le niveau requis pour suivre la formation ?", "Aucun prérequis académique strict. Les modules introduisent progressivement les notions et les méthodes."],
      ["Quelle est la durée de la formation complète ?", "Le parcours complet est structuré en deux semestres avec un accès en ligne aux contenus."],
      ["Est-ce que la formation est diplômante ?", "Elle donne lieu à un certificat de formation délivré par l'Institut Saint Irénée."],
      ["Puis-je suivre la formation à mon rythme ?", "Oui, les contenus sont consultables en ligne et conçus pour s'adapter à votre rythme."],
      ["Puis-je reprendre un module si je ne réussis pas l'évaluation ?", "Oui, vous pouvez reprendre un module et consolider les notions avant de repasser l'évaluation."],
      ["Comment se déroulent les examens ?", "Les examens et devoirs sont transmis depuis l'espace étudiant, avec correction et suivi pédagogique."],
    ],
  },
  {
    category: "Paiement",
    items: [
      ["Quels sont les moyens de paiement acceptés ?", "Le pass annuel se règle en ligne par PayPal. Le paiement confirmé active automatiquement l'accès au cursus dans votre espace étudiant."],
      ["Pourquoi le pass annuel est-il en participation libre ?", "Le prix conseillé est de 99 euros. La participation libre permet aux étudiants de contribuer selon leurs moyens tout en soutenant l'accessibilité de la formation."],
      ["Que faire si je ne peux pas régler le prix conseillé ?", "Vous pouvez choisir un montant plus bas dans la fenêtre PayPal. Pour une situation particulière, contactez l'équipe avant ou après l'inscription."],
    ],
  },
  {
    category: "Technique",
    items: [
      ["Les cours sont-ils en direct ou enregistrés ?", "Le parcours combine contenus accessibles en ligne et accompagnement pédagogique."],
      ["Puis-je échanger avec d'autres étudiants ?", "Oui, des espaces d'échange sont prévus pour favoriser l'entraide et les questions."],
    ],
  },
  {
    category: "Général",
    items: [
      ["Que faire si j'ai des questions pendant la formation ?", "Vous pouvez contacter l'équipe pédagogique et utiliser les espaces d'échange prévus."],
    ],
  },
];

export default function ContactPage() {
  const [open, setOpen] = useState("Puis-je suivre la formation à mon rythme ?");

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="font-display" style={{ fontSize: "4rem", margin: 0 }}>Contactez-nous</h1>
          <p style={{ fontSize: "1.25rem", color: "#dce6f6" }}>Une question sur nos formations ? Notre équipe est à votre écoute.</p>
        </div>
      </section>
      <section className="section" style={{ background: "white" }}>
        <div className="container grid-2">
          <form className="soft-card" style={{ padding: 30 }} action="https://formspree.io/f/mjgzlojl" method="POST">
            <input type="hidden" name="_subject" value="Nouveau message depuis le site Institut Saint Irenee" />
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Envoyez-nous un message</h2>
            <div className="grid-2">
              <div><label>Prénom *</label><input className="input" name="prenom" required /></div>
              <div><label>Nom *</label><input className="input" name="nom" required /></div>
            </div>
            <p><label>Email *</label><input className="input" type="email" name="email" required /></p>
            <p><label>Téléphone</label><input className="input" name="telephone" /></p>
            <p>
              <label>Sujet *</label>
              <select className="input" name="sujet" required defaultValue="">
                <option value="" disabled>Sélectionnez un sujet</option>
                <option>Formation</option>
                <option>Paiement</option>
                <option>Technique</option>
              </select>
            </p>
            <p><label>Message *</label><textarea className="input" name="message" rows={7} required placeholder="Décrivez votre demande..." /></p>
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>Envoyer le message</button>
          </form>
          <div>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Nos coordonnées</h2>
            {([
              [Mail, "Email", "oeuvrecatholiquefrance@gmail.com"],
              [Phone, "Téléphone", "01.71.68.15.38"],
              [MapPin, "Adresse", "1 rue de Stockholm, 75008 Paris"],
              [Clock, "Horaires", "Lun-Ven : 9h-18h"],
            ] satisfies [LucideIcon, string, string][]).map(([Icon, title, value]) => (
              <div className="soft-card" key={title} style={{ padding: 22, marginBottom: 18, display: "flex", gap: 18 }}>
                <Icon color="var(--navy)" />
                <div><strong>{title}</strong><p className="muted">{value}</p></div>
              </div>
            ))}
            <div className="soft-card" style={{ padding: 24, background: "#f6f8fc" }}>
              <h3>Temps de réponse</h3>
              <p>Nous nous engageons à répondre à votre message sous <strong>48 heures maximum</strong>.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="section" id="faq">
        <div className="container" style={{ maxWidth: 760 }}>
          <h2 className="section-title">Questions Fréquentes (FAQ)</h2>
          <p className="center muted" style={{ marginBottom: 42 }}>Trouvez rapidement les réponses à vos questions</p>
          <div className="faq-list">
            {faqs.map((group) => (
              <div className="faq-group" key={group.category}>
                <h3>{group.category}</h3>
                {group.items.map(([question, answer]) => {
                  const isOpen = open === question;
                  return (
                    <article className={`faq-item ${isOpen ? "open" : ""}`} key={question}>
                      <button
                        className="faq-trigger"
                        type="button"
                        onClick={() => setOpen(isOpen ? "" : question)}
                        aria-expanded={isOpen}
                      >
                        <span>{question}</span>
                        <ChevronDown size={18} aria-hidden="true" />
                      </button>
                      <div className="faq-panel">
                        <div className="faq-panel-inner">
                          <p>{answer}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="soft-card center" style={{ padding: 26, marginTop: 40, background: "#eaf3ff" }}>
            <h3>Vous ne trouvez pas la réponse ?</h3>
            <p>N'hésitez pas à nous contacter directement.</p>
            <p><Mail size={16} aria-hidden="true" /> oeuvrecatholiquefrance@gmail.com</p>
          </div>
        </div>
      </section>
      <section className="section" style={{ background: "white" }}>
        <div className="container center">
          <h2 className="section-title">Nous trouver</h2>
          <div className="map-frame">
            <iframe
              title="Carte Google Maps - 1 rue de Stockholm, 75008 Paris"
              src="https://www.google.com/maps?q=1%20rue%20de%20Stockholm%2C%2075008%20Paris&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </>
  );
}
