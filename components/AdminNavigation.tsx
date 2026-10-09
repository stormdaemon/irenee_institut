"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {LayoutDashboard,BookOpen,Users,ClipboardList,Radio,Settings,CreditCard,KeyRound,FileText,BarChart3} from "lucide-react";
const staff=[["/admin","Vue d’ensemble",LayoutDashboard],["/admin/courses","Cours & modules",BookOpen],["/admin/homework","Devoirs",ClipboardList],["/admin/live","Séances en direct",Radio]] as const;
const director=[["/admin/users","Communauté",Users],["/admin/access","Accès aux cours",KeyRound],["/admin/payments","Inscriptions",CreditCard],["/admin/stats","Statistiques",BarChart3],["/admin/settings","Paramètres",Settings],["/admin/legal","Pages légales",FileText]] as const;
export function AdminNavigation({isDirector}:{isDirector:boolean}){const path=usePathname();return <nav className="apostolos-admin-nav" aria-label="Administration"><span className="apostolos-label">ATELIER APOSTOLOS</span>{[...staff,...(isDirector?director:[])].map(([href,label,Icon])=><Link key={href} href={href} aria-current={path===href||href!=="/admin"&&path.startsWith(href+"/")?"page":undefined}><Icon size={17} strokeWidth={1.5}/>{label}</Link>)}</nav>}
