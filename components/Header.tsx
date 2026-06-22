"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Phone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserMenu } from "@/components/UserMenu";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/formations", label: "Formations" },
  { href: "/blog", label: "Blog" },
  { href: "/equipe", label: "Équipe" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" }
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="main-header">
      <div className="header-ornament header-ornament-left" aria-hidden="true" />
      <div className="header-ornament header-ornament-right" aria-hidden="true" />
      <div className="header-crown" aria-hidden="true">✝</div>
      <div className="container header-row">
        <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
          <span className="brand-seal">
            <Image src="/images/logo_without_text.png" alt="Institut Saint Irénée" width={78} height={78} priority />
          </span>
          <span className="brand-copy">
            <strong>Institut Saint Irénée</strong>
            <span>Rendre compte de la crédibilité<br />de la foi catholique</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Navigation principale">
          {links.map(link => (
            <Link className={`nav-link ${isActive(link.href) ? "active" : ""}`} key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <a href="tel:+33171681538" className="phone-link">
            <Phone size={18} /> 01.71.68.15.38
          </a>
          <div className="desktop-user-menu">
            <UserMenu />
          </div>
          <button className="mobile-menu-btn" type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="mobile-panel">
          <div className="container">
            {links.map(link => (
              <Link className={`nav-link ${isActive(link.href) ? "active" : ""}`} key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <a href="tel:+33171681538"><Phone size={16} /> 01.71.68.15.38</a>
            <div className="mobile-user-menu">
              <UserMenu onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
