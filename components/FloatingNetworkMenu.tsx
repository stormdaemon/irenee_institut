"use client";

import Image from "next/image";
import { useState } from "react";

const networkLinks = [
  {
    label: "WikiBible",
    href: "https://wikibible.fr/",
    icon: "/images/network-icons/wikibible.png",
    external: true
  },
  {
    label: "Heaven Radio",
    href: "https://heavenradio.fr/",
    icon: "/images/network-icons/heaven-radio.png",
    external: true
  },
  {
    label: "La Mission",
    href: "https://www.lamissioncatholique.fr/",
    icon: "/images/network-icons/la-mission.png",
    external: true
  },
  {
    label: "Ultreia",
    href: "https://ultreiaevent.com/",
    icon: "/images/network-icons/ultreia.png",
    external: true
  },
  {
    label: "SOS Chrétiens",
    href: "https://soschretiensdorient.netlify.app/",
    icon: "/images/network-icons/sos-chretiens.png",
    external: true
  },
  {
    label: "Baptême",
    href: "https://lebaptemecatholique.fr/",
    icon: "/images/network-icons/bapteme.png",
    external: true
  }
];

const contactLinks = [
  {
    label: "Appeler",
    href: "tel:+33171681538",
    icon: "/images/network-icons/contact-phone.png"
  },
  {
    label: "Écrire",
    href: "mailto:catholicloungemousic@gmail.com",
    icon: "/images/network-icons/contact-mail.png"
  }
];

const mobileLinks = [...networkLinks, ...contactLinks];

export function FloatingNetworkMenu() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="floating-network" aria-label="Sites amis">
        <div className="floating-network-inner">
          {networkLinks.map(link => (
            <a className="network-link" href={link.href} target="_blank" rel="noreferrer" key={link.href}>
              <span className="network-icon">
                <Image src={link.icon} alt="" width={64} height={64} />
              </span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </aside>

      <aside className="floating-contact" aria-label="Contact rapide">
        <div className="floating-contact-inner">
          {contactLinks.map(link => (
            <a className="contact-float-link" href={link.href} key={link.href}>
              <span className="contact-float-icon">
                <Image src={link.icon} alt="" width={64} height={64} />
              </span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </aside>

      <div className={`mobile-float-hub ${mobileOpen ? "is-open" : ""}`}>
        {mobileOpen && (
          <button
            className="mobile-float-scrim"
            type="button"
            aria-label="Fermer les raccourcis"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {mobileOpen && (
          <div className="mobile-hub-panel" role="dialog" aria-label="Raccourcis rapides">
            <div className="mobile-hub-grid">
              {mobileLinks.map(link => (
                <a
                  className="mobile-hub-link"
                  href={link.href}
                  target={"external" in link && link.external ? "_blank" : undefined}
                  rel={"external" in link && link.external ? "noreferrer" : undefined}
                  key={link.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="mobile-hub-icon">
                    <Image src={link.icon} alt="" width={56} height={56} />
                  </span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        <button
          className="mobile-hub-trigger"
          type="button"
          aria-label={mobileOpen ? "Fermer les raccourcis" : "Ouvrir les raccourcis"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(open => !open)}
        >
          <Image src="/images/logo_without_text.png" alt="" width={36} height={36} priority={false} />
        </button>
      </div>
    </>
  );
}
