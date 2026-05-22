import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-mark" aria-hidden="true">✝</div>
        <div className="footer-grid">
          <div>
            <h3>Institut Irénée</h3>
            <p>Rendre compte de la crédibilité de la foi catholique auprès des jeunes générations.</p>
            <p>Une initiative de l'association <strong>Parole et Partage</strong><br />SIREN : 841 890 692</p>
          </div>
          <div>
            <h3>Formation</h3>
            <p><Link href="/formations">Nos formations</Link></p>
            <p><Link href="/formateurs">Nos formateurs</Link></p>
            <p><Link href="/formations">Tarifs</Link></p>
            <p><Link href="/espace-etudiant">Espace étudiant</Link></p>
          </div>
          <div>
            <h3>Institut</h3>
            <p><Link href="/a-propos">À propos</Link></p>
            <p><Link href="/contact">Contact</Link></p>
            <p><Link href="/contact#faq">FAQ</Link></p>
          </div>
          <div>
            <h3>Contact</h3>
            <p><Mail size={16} /> catholicloungemousic@gmail.com</p>
            <p><Phone size={16} /> 01.71.68.15.38</p>
            <p><MapPin size={16} /> 1 rue de Stockholm, 75008 Paris</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Parole et Partage - Institut Irénée. Tous droits réservés.</span>
          <span className="footer-links">
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-confidentialite">Politique de confidentialité</Link>
            <Link href="/cgv">CGV</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
