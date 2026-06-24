"use client";

import type { LucideIcon } from "lucide-react";
import { HandHeart } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type FloatingLink = {
  label: string;
  href: string;
  icon?: string;
  Icon?: LucideIcon;
  external?: boolean;
  featured?: boolean;
};

const donationUrl = "https://www.paypal.com/ncp/payment/4TJJK3C697B9A";

const networkLinks: FloatingLink[] = [
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

const contactLinks: FloatingLink[] = [
  {
    label: "Faire un don",
    href: donationUrl,
    Icon: HandHeart,
    external: true,
    featured: true
  },
  {
    label: "Appeler",
    href: "tel:+33171681538",
    icon: "/images/network-icons/contact-phone.png"
  },
  {
    label: "Écrire",
    href: "mailto:oeuvrecatholiquefrance@gmail.com",
    icon: "/images/network-icons/contact-mail.png"
  }
];

function isConversionPath(pathname: string | null) {
  return Boolean(pathname === "/" || pathname?.startsWith("/formations") || pathname?.startsWith("/auth") || pathname?.startsWith("/paiement"));
}

function FloatingIcon({ link, size }: { link: FloatingLink; size: number }) {
  if (link.icon) return <Image src={link.icon} alt="" width={size} height={size} />;
  if (link.Icon) {
    const Icon = link.Icon;
    return <Icon aria-hidden="true" size={Math.round(size * .54)} strokeWidth={1.8} />;
  }
  return null;
}

export function FloatingNetworkMenu() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const isConversion = isConversionPath(pathname);
  const visibleContactLinks = isConversion ? contactLinks.filter(link => !link.featured) : contactLinks;
  const mobileLinks = [...networkLinks, ...visibleContactLinks];

  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    };
  }, []);

  const openMobileHub = () => {
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    closingTimerRef.current = null;
    setMobileClosing(false);
    setMobileOpen(true);
  };

  const closeMobileHub = () => {
    if (!mobileOpen) return;
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    setMobileOpen(false);
    setMobileClosing(true);
    closingTimerRef.current = setTimeout(() => {
      setMobileClosing(false);
      closingTimerRef.current = null;
    }, 520);
  };

  const toggleMobileHub = () => {
    if (mobileOpen) closeMobileHub();
    else openMobileHub();
  };

  return (
    <>
      <aside className="floating-network" aria-label="Sites amis">
        <div className="floating-network-inner">
          {networkLinks.map(link => (
            <a className="network-link" href={link.href} target="_blank" rel="noreferrer" key={link.href}>
              <span className="network-icon">
                <FloatingIcon link={link} size={64} />
              </span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </aside>

      <aside className="floating-contact" aria-label="Contact rapide">
        <div className="floating-contact-inner">
          {visibleContactLinks.map(link => (
            <a
              className={`contact-float-link ${link.featured ? "is-featured" : ""}`}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              key={link.href}
            >
              <span className="contact-float-icon">
                <FloatingIcon link={link} size={64} />
              </span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </aside>

      <div className={`mobile-float-hub ${isConversion ? "is-conversion" : ""} ${mobileOpen ? "is-open" : ""} ${mobileClosing ? "is-closing" : ""}`}>
        <button
          className="mobile-float-scrim"
          type="button"
          aria-label="Fermer le panneau"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={closeMobileHub}
        />
        <div className="mobile-hub-panel" role="dialog" aria-label="Raccourcis rapides" aria-hidden={!mobileOpen && !mobileClosing}>
          <div className="mobile-hub-grid">
            {mobileLinks.map(link => (
              <a
                className={`mobile-hub-link ${link.featured ? "is-featured" : ""}`}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
                key={link.href}
                tabIndex={mobileOpen ? 0 : -1}
                onClick={closeMobileHub}
              >
                <span className="mobile-hub-icon">
                  <FloatingIcon link={link} size={56} />
                </span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </div>
        <button
          className="mobile-hub-trigger"
          type="button"
          aria-label={mobileOpen ? "Fermer les raccourcis" : "Ouvrir les raccourcis"}
          aria-expanded={mobileOpen}
          onClick={toggleMobileHub}
        >
          <Image src="/images/logo_without_text.png" alt="" width={36} height={36} priority={false} />
        </button>
      </div>
    </>
  );
}
