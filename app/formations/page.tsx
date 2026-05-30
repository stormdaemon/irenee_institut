import Link from "next/link";
import { ArrowRight, Award, BookOpen, Clock, User } from "lucide-react";
import { formatDuration, formatPrice } from "@/lib/data";
import { getCourses } from "@/lib/server-data";
import { BuyCourseButton } from "@/components/BuyCourseButton";

export const dynamic = "force-dynamic";

export default async function FormationsPage() {
  const courses = await getCourses();

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="font-display" style={{ fontSize: "4rem", margin: 0 }}>Nos Formations</h1>
          <p style={{ fontSize: "1.3rem", color: "#dce6f6", maxWidth: 760 }}>
            Une formation complète en apologétique catholique, structurée par modules et accessible en ligne.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container grid-2">
          {courses.map(course => (
            <div className="card" key={course.id} style={{ padding: 30 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}>{course.titre}</h2>
                <strong style={{ color: "var(--navy)", fontSize: "1.35rem", textAlign: "right" }}>
                  {formatPrice(course.prix || 9900)}
                  <small style={{ display: "block", fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>montant libre</small>
                </strong>
              </div>
              <p className="muted">{course.description}</p>
              <p style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "var(--muted)" }}>
                <span><Clock size={16} /> {formatDuration(course.duree_totale)}</span>
                <span><BookOpen size={16} /> {course.nb_modules} modules</span>
                <span><User size={16} /> {course.auteur_nom || "Institut Irénée"}</span>
                <span><Award size={16} /> Certificat</span>
              </p>
              <div className="course-card-actions">
                <Link className="btn btn-outline" href={`/cours/${course.slug}`}>Voir le cours <ArrowRight size={16} /></Link>
                <BuyCourseButton courseId={course.id} courseTitle={course.titre} defaultAmountCents={course.prix || 9900} label="Payer librement" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
