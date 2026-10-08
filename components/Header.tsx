"use client";
import Link from "next/link";
import {Menu,X,ArrowUpRight,ArrowLeft} from "lucide-react";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {Brand} from "./Brand";
import {UserMenu} from "./UserMenu";
const links=[["/formations","Les cours"],["/a-propos","L’Institut"],["/equipe","L’équipe"],["/blog","Le journal"],["/contact","Contact"]];
export function Header(){
 const path=usePathname(),[open,setOpen]=useState(false);
 useEffect(()=>{setOpen(false)},[path]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[]);
 const workspace=path.startsWith("/admin")||path.startsWith("/cours/");
 return <header className="apostolos-header"><div className="apostolos-header-inner"><Link href="/" aria-label="Institut Apostolos Saint Irénée — accueil"><Brand/></Link>{workspace?<Link href={path.startsWith("/admin")?"/":"/espace-etudiant"} className="apostolos-back"><ArrowLeft size={16}/>{path.startsWith("/admin")?"Voir le site":"Mon espace"}</Link>:<nav className="apostolos-nav" aria-label="Navigation principale">{links.map(([href,label])=><Link key={href} href={href} aria-current={path.startsWith(href)?"page":undefined}>{label}</Link>)}</nav>}<div className="apostolos-header-actions"><UserMenu/>{!workspace&&<Link className="apostolos-cta" href="/formations">Le programme <ArrowUpRight size={16}/></Link>}<button type="button" className="apostolos-menu-toggle" aria-label={open?"Fermer le menu":"Ouvrir le menu"} aria-expanded={open} aria-controls="apostolos-mobile-nav" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div></div>{open&&<nav id="apostolos-mobile-nav" className="apostolos-mobile-nav" aria-label="Navigation mobile">{links.map(([href,label])=><Link key={href} href={href}>{label}<ArrowUpRight size={18}/></Link>)}</nav>}</header>;
}
