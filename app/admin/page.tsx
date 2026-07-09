import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BookOpen, ClipboardList, CreditCard, FileText, KeyRound, Radio, Settings, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCourses, getHomework, getPaymentRequests, getProfiles, getStats } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await requireAdminPage();
  const isDirector = profile.role === "directeur";
  const [courses, homework] = await Promise.all([
    getCourses(),
    getHomework()
  ]);
  const [stats, profiles, paymentRequests] = isDirector
    ? await Promise.all([getStats(), getProfiles(), getPaymentRequests()])
    : [{ cours: courses.length, etudiants: 0, inscriptions: 0 }, [], []];
  const staffCards: [LucideIcon, string, string, string][] = [
    [BookOpen, "Gérer les cours", "Créer, modifier les modules et publier", "/admin/courses"],
    [ClipboardList, "Devoirs", "Créer, assigner et suivre les devoirs", "/admin/homework"],
    [Radio, "Séances en direct", "Programmer les visios Daily hebdomadaires", "/admin/live"]
  ];
  const directorCards: [LucideIcon, string, string, string][] = [
    [CreditCard, "Paiements", "Valider les demandes d'inscription", "/admin/payments"],
    [KeyRound, "Accès étudiants", "Vérifier les cours et pass annuels", "/admin/access"],
    [Users, "Utilisateurs", "Étudiants, formateurs et rôles", "/admin/users"],
    [Settings, "Paramètres", "RIB et configuration système", "/admin/settings"],
    [BarChart3, "Statistiques", "Tableaux de bord et analyses", "/admin/stats"],
    [FileText, "Pages légales", "Éditer les mentions, confidentialité et CGV", "/admin/legal"]
  ];
  const cards = isDirector ? [...staffCards, ...directorCards] : staffCards;

  return (
    <section className="section">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <h1 className="title">Dashboard Administration</h1>
            <p className="subtitle">{isDirector ? "Accès complet à la plateforme Institut Saint Irénée" : "Espace pédagogique formateur"}</p>
          </div>
          <Link href="/" className="btn btn-outline">Déconnexion</Link>
        </div>

        <div className="card" style={{ padding: 28, margin: "24px 0 34px", display: "flex", gap: 18, alignItems: "center" }}>
          <Users size={52} color="var(--navy)" />
          <div>
            <h2 style={{ margin: 0, color: "var(--navy)" }}>{profile.prenom} {profile.nom}</h2>
            <p style={{ marginBottom: 0 }}>{profile.email}<br />{profile.role}</p>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi"><BookOpen color="#3478ff" /><strong>{stats.cours}</strong><span>Cours totaux</span></div>
          <div className="kpi"><ClipboardList color="#a855f7" /><strong>{homework.length}</strong><span>Devoirs</span></div>
          {isDirector && <div className="kpi"><Users color="#22c55e" /><strong>{stats.etudiants}</strong><span>Étudiants</span></div>}
          {isDirector && <div className="kpi"><CreditCard color="#eab308" /><strong>{paymentRequests.length}</strong><span>Inscriptions</span></div>}
        </div>

        <div className="admin-grid" style={{ marginTop: 34 }}>
          {cards.map(([Icon, title, desc, href]) => (
            <Link className="card" key={title} href={href} style={{ padding: 26 }}>
              <Icon color="var(--navy)" />
              <h3>{title}</h3>
              <p>{desc}</p>
            </Link>
          ))}
        </div>

        <div className="admin-dashboard-split">
          <section>
            <div className="admin-inline-head">
              <h2 className="font-display" style={{ color: "var(--navy)" }}>Cours récents</h2>
              <Link className="btn btn-primary" href="/admin/courses">+ Nouveau cours</Link>
            </div>
            {courses.slice(0, 6).map(course => (
              <div className="card" key={course.id} style={{ padding: 22, marginBottom: 16 }}>
                <h3 style={{ color: "var(--navy)", marginTop: 0 }}>{course.titre}</h3>
                <p className="muted">{course.description}</p>
                <p><BookOpen size={16} /> {course.nb_modules || course.modules.length} modules · {course.nb_etudiants || 0} étudiants <span className="badge">{course.statut || "publie"}</span></p>
                <Link className="btn btn-outline" href={`/admin/courses?course=${course.id}`} style={{ width: "100%" }}>Éditer ce cours</Link>
              </div>
            ))}
          </section>

          {isDirector ? (
          <section>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Activité plateforme</h2>
            <div className="card table-wrap">
              <table className="data-table">
                <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Inscription</th></tr></thead>
                <tbody>
                  {profiles.slice(0, 7).map(user => (
                    <tr key={user.id}>
                      <td><strong>{user.prenom} {user.nom}</strong><br /><small>{user.email}</small></td>
                      <td><span className="badge">{user.role}</span></td>
                      <td>{new Date(user.created_at || Date.now()).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          ) : (
          <section>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Devoirs récents</h2>
            {homework.slice(0, 6).map(item => (
              <div className="card" key={item.id} style={{ padding: 22, marginBottom: 16 }}>
                <h3 style={{ color: "var(--navy)", marginTop: 0 }}>{item.titre}</h3>
                <p className="muted">{item.description}</p>
                <Link className="btn btn-outline" href="/admin/homework" style={{ width: "100%" }}>Voir les devoirs</Link>
              </div>
            ))}
          </section>
          )}
        </div>
      </div>
    </section>
  );
}
