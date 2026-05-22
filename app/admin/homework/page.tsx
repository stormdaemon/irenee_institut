import Link from "next/link";
import { CheckCircle2, ClipboardList, Clock, Plus, Users } from "lucide-react";
import { getHomework } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function HomeworkAdminPage() {
  const homework = await getHomework();
  const assigned = homework.reduce((sum, item) => sum + (item.homework_assignments?.length || 0), 0);

  return (
    <section className="section" style={{ minHeight: 780 }}>
      <div className="container">
        <Link href="/admin">← Retour au tableau de bord</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "40px 0", gap: 20, flexWrap: "wrap" }}>
          <div><h1 className="title">Gestion des devoirs</h1><p className="subtitle">Création, assignation, suivi des rendus et corrections</p></div>
          <Link className="btn btn-primary" href="/admin/homework/new"><Plus size={18} /> Nouveau devoir</Link>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 34 }}>
          <div className="kpi"><ClipboardList color="#3478ff" /><strong>{homework.length}</strong><span>Devoirs</span></div>
          <div className="kpi"><Users color="#22c55e" /><strong>{assigned}</strong><span>Assignations</span></div>
          <div className="kpi"><Clock color="#eab308" /><strong>0</strong><span>En attente correction</span></div>
          <div className="kpi"><CheckCircle2 color="#a855f7" /><strong>0</strong><span>Corrigés</span></div>
        </div>

        {homework.length === 0 ? (
          <div className="card center" style={{ padding: "80px 20px" }}>
            <ClipboardList size={70} color="#c3cad5" />
            <h2>Aucun devoir</h2>
            <p>Aucun devoir n'a encore été créé sur la plateforme</p>
            <Link className="btn btn-primary" href="/admin/homework/new"><Plus size={18} /> Créer un devoir</Link>
          </div>
        ) : (
          <div className="card table-wrap">
            <table className="data-table">
              <thead><tr><th>Devoir</th><th>Date limite</th><th>Assignés</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {homework.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.titre}</strong><br /><small>{item.description}</small></td>
                    <td>{item.date_limite ? new Date(item.date_limite).toLocaleString("fr-FR") : "Non définie"}</td>
                    <td>{item.homework_assignments?.length || 0} étudiant{(item.homework_assignments?.length || 0) > 1 ? "s" : ""}</td>
                    <td><span className="badge">Ouvert</span></td>
                    <td><Link className="btn btn-outline" href="/admin/homework/new">Modifier</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
