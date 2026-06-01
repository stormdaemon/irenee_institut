"use client";

import Link from "next/link";
import { FileText, Save } from "lucide-react";
import { legalPages, type LegalPageKey } from "@/lib/legal";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const keys: LegalPageKey[] = ["mentions-legales", "politique-confidentialite", "cgv"];

export default function AdminLegalPage() {
  const [active, setActive] = useState<LegalPageKey>("mentions-legales");
  const [values, setValues] = useState(() => ({
    "mentions-legales": legalPages["mentions-legales"].content,
    "politique-confidentialite": legalPages["politique-confidentialite"].content,
    cgv: legalPages.cgv.content
  }));
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    authenticatedFetch("/api/settings")
      .then(response => response.json())
      .then(data => {
        if (data.legalPages) setValues(current => ({ ...current, ...data.legalPages }));
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setStatus("saving");
    setError("");
    const response = await authenticatedFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalPages: values })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) setStatus("success");
    else {
      setError(data.error || "Les pages légales n'ont pas pu être enregistrées.");
      setStatus("error");
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 1100 }}>
        <Link href="/admin">← Retour au tableau de bord</Link>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap", marginTop: 28 }}>
          <div>
            <h1 className="title">Pages légales</h1>
            <p className="subtitle">Mentions légales, politique de confidentialité et conditions générales.</p>
          </div>
          <button className="btn btn-primary" onClick={save}><Save size={18} /> Enregistrer</button>
        </div>
        <ActionNotice status={status} success="Pages légales enregistrées." error={error} />
        <div className="grid-3" style={{ margin: "30px 0" }}>
          {keys.map(key => (
            <button key={key} className={`card ${active === key ? "legal-active" : ""}`} type="button" onClick={() => setActive(key)} style={{ padding: 22, textAlign: "left", cursor: "pointer" }}>
              <FileText color="var(--navy)" />
              <h3>{legalPages[key].title}</h3>
              <p className="muted">{legalPages[key].intro}</p>
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: 30 }}>
          <label>{legalPages[active].title}</label>
          <textarea
            className="input"
            rows={24}
            value={values[active]}
            onChange={event => setValues(current => ({ ...current, [active]: event.target.value }))}
          />
          <p className="muted">Page publique : <Link href={`/${active}`}>{`/${active}`}</Link></p>
        </div>
      </div>
    </section>
  );
}
