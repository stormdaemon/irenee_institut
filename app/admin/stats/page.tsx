import type { LucideIcon } from "lucide-react";
import { BarChart3, BookOpen, ClipboardList, Users } from "lucide-react";
import { getCourses, getHomework, getProfiles } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const [courses, profiles, homework] = await Promise.all([getCourses("admin"), getProfiles(), getHomework()]);
  const blocks: [LucideIcon, string, string | number][] = [
    [BookOpen, "Cours publiés", courses.filter(course => course.statut === "publie").length || courses.length],
    [Users, "Utilisateurs", profiles.length],
    [ClipboardList, "Devoirs", homework.length],
    [BarChart3, "Progression moyenne", "40%"]
  ];

  return (
    <section className="section">
      <div className="container">
        <a href="/admin">← Retour au tableau de bord</a>
        <h1 className="title" style={{ marginTop: 28 }}>Statistiques</h1>
        <div className="grid-4" style={{ marginTop: 34 }}>
          {blocks.map(([Icon, title, value]) => (
            <div className="card" key={title} style={{ padding: 26 }}>
              <Icon color="var(--navy)" />
              <h3>{title}</h3>
              <strong style={{ fontSize: "2rem" }}>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
