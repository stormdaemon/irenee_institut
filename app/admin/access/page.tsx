import Link from "next/link";
import { BookOpen, CheckCircle2, CreditCard, Users } from "lucide-react";
import { getAdminAccessAudit } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Non renseignee";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function formatPrice(amount?: number | null, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format((amount || 0) / 100);
}

export default async function AdminAccessPage() {
  const audit = await getAdminAccessAudit();

  return (
    <section className="section">
      <div className="container">
        <Link href="/admin">← Retour au tableau de bord</Link>
        <div className="admin-page-head">
          <div>
            <h1 className="title">Accès étudiants</h1>
            <p className="subtitle">Cours attribués et détenteurs du pass annuel</p>
          </div>
          <Link className="btn btn-outline" href="/admin/users">Gérer les utilisateurs</Link>
        </div>

        <div className="kpi-grid">
          <div className="kpi"><Users /><strong>{audit.stats.students}</strong><span>Étudiants</span></div>
          <div className="kpi"><BookOpen /><strong>{audit.stats.studentsWithCourses}</strong><span>Avec cours attribués</span></div>
          <div className="kpi"><CreditCard /><strong>{audit.annualPasses.length}</strong><span>Pass annuels</span></div>
          <div className="kpi"><CheckCircle2 /><strong>{audit.stats.activeAnnualPasses}</strong><span>Pass actifs</span></div>
        </div>

        <section className="admin-access-section">
          <div className="admin-section-title">
            <h2 className="font-display">Cours attribués</h2>
            <span className="badge">Ancienne version</span>
          </div>
          <div className="card table-wrap">
            <table className="data-table admin-access-table">
              <thead>
                <tr><th>Étudiant</th><th>Cours inscrits</th><th>Pass annuel</th><th>Dernière attribution</th></tr>
              </thead>
              <tbody>
                {audit.students.map(student => {
                  const lastEnrollment = student.courses
                    .map(enrollment => enrollment.created_at)
                    .filter(Boolean)
                    .sort()
                    .at(-1);

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.prenom} {student.nom}</strong>
                        <small>{student.email}</small>
                      </td>
                      <td>
                        {student.courses.length ? (
                          <div className="course-chip-list">
                            {student.courses.map(enrollment => (
                              <span className="course-chip" key={enrollment.id}>
                                {enrollment.course?.titre || enrollment.course_id}
                                <small>{enrollment.statut || "en_cours"}</small>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Aucun cours attribué</span>
                        )}
                      </td>
                      <td><span className={`badge ${student.hasActiveAnnualPass ? "badge-success" : ""}`}>{student.hasActiveAnnualPass ? "Actif" : "Non"}</span></td>
                      <td>{formatDate(lastEnrollment)}</td>
                    </tr>
                  );
                })}
                {!audit.students.length && (
                  <tr><td colSpan={4} style={{ padding: 30, textAlign: "center" }}>Aucun étudiant trouvé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-access-section">
          <div className="admin-section-title">
            <h2 className="font-display">Pass annuel</h2>
            <span className="badge">{audit.stats.activeAnnualPasses} actif{audit.stats.activeAnnualPasses > 1 ? "s" : ""}</span>
          </div>
          <div className="card table-wrap">
            <table className="data-table admin-access-table">
              <thead>
                <tr><th>Étudiant</th><th>Commande</th><th>Montant</th><th>Statut</th><th>Début</th><th>Expiration</th></tr>
              </thead>
              <tbody>
                {audit.annualPasses.map(pass => (
                  <tr key={pass.id}>
                    <td>
                      <strong>{pass.profile ? `${pass.profile.prenom} ${pass.profile.nom}` : "Profil introuvable"}</strong>
                      <small>{pass.profile?.email || pass.user_id}</small>
                    </td>
                    <td>{pass.provider_order_id || "Non renseignee"}</td>
                    <td>{formatPrice(pass.amount_total, pass.currency || "EUR")}</td>
                    <td><span className={`badge ${pass.isActive ? "badge-success" : ""}`}>{pass.status || "inconnu"}</span></td>
                    <td>{formatDate(pass.starts_at)}</td>
                    <td>{formatDate(pass.expires_at)}</td>
                  </tr>
                ))}
                {!audit.annualPasses.length && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: "center" }}>Aucun pass annuel enregistré.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
