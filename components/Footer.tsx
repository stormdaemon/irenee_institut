"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Brand} from "./Brand";
export function Footer(){const path=usePathname();if(path.startsWith("/admin")||path.startsWith("/cours/"))return null;
 return <footer className="apostolos-footer"><div className="apostolos-wrap"><div className="apostolos-footer-grid"><div><Brand/><p>Comprendre la foi.<br/>Cultiver l’intelligence.<br/>Transmettre avec justesse.</p></div><nav aria-label="Formation"><span className="apostolos-label">APPRENDRE</span><Link href="/formations">Tous les cours</Link><Link href="/espace-etudiant">Mon espace de formation</Link><Link href="/bibliotheque-apologetique">La bibliothèque</Link></nav><nav aria-label="Institut"><span className="apostolos-label">DÉCOUVRIR</span><Link href="/a-propos">Notre démarche</Link><Link href="/blog">Le journal</Link><Link href="/contact">Nous contacter</Link></nav></div><div className="apostolos-footer-bottom"><span>© {new Date().getFullYear()} Institut Apostolos Saint Irénée</span><nav aria-label="Informations légales"><Link href="/mentions-legales">Mentions légales</Link><Link href="/politique-confidentialite">Confidentialité</Link><Link href="/cgv">CGV</Link></nav></div></div></footer>;
}
