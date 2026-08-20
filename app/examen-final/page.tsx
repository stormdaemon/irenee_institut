"use client";

import Link from "next/link";
import { AlertTriangle, Award, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LearningDocumentButton } from "@/components/LearningDocumentButton";
import { createBrowserClient } from "@/lib/supabase";

type Question = {
  id: string;
  question: string;
  options: string[];
};

type ExamPayload = {
  annualPassActive: boolean;
  certificate?: { id: string } | null;
  eligible: boolean;
  passScore: number;
  questions: Question[];
};

export default function FinalExamPage() {
  const [payload, setPayload] = useState<ExamPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ passed: boolean; score: number; certificate?: { id: string } | null } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function request(path: string, init?: RequestInit) {
    const supabase = createBrowserClient();
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!data.session) throw new Error("Connectez-vous pour accéder à l'examen final.");
    return fetch(path, {
      ...init,
      credentials: "same-origin"
    });
  }

  async function load() {
    try {
      const response = await request("/api/final-exam");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Examen indisponible.");
      setPayload(data);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Examen indisponible.");
      setStatus("error");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const response = await request("/api/final-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "L'examen n'a pas pu être corrigé.");
      setResult(data);
      setStatus("ready");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "L'examen n'a pas pu être corrigé.");
      setStatus("error");
    }
  }

  if (status === "loading") return <section className="section center"><Loader2 className="action-spin" size={36} /></section>;
  if (!payload || status === "error") return (
    <section className="section">
      <div className="container center"><div className="card" style={{ padding: 34 }}><AlertTriangle /><p>{error}</p><Link className="btn btn-outline" href="/espace-etudiant">Retour à mon espace</Link></div></div>
    </section>
  );

  if (payload.certificate || result?.certificate) {
    const certificate = result?.certificate || payload.certificate;
    return (
      <section className="section"><div className="container center"><div className="card" style={{ padding: 38, maxWidth: 760, margin: "0 auto" }}>
        <Award size={52} color="var(--gold-2)" />
        <h1 className="title">Certificat obtenu</h1>
        <p className="subtitle">Votre certificat nominatif d'apologétique est disponible dans votre espace et a été placé dans la file d'envoi email.</p>
        {certificate && <LearningDocumentButton documentId={certificate.id} label="Télécharger mon certificat" />}
      </div></div></section>
    );
  }

  if (!payload.eligible) return (
    <section className="section"><div className="container center"><div className="card" style={{ padding: 38, maxWidth: 760, margin: "0 auto" }}>
      <AlertTriangle size={42} color="var(--gold-2)" />
      <h1 className="title">Examen final verrouillé</h1>
      <p className="subtitle">Terminez l'ensemble des modules du cursus avant de présenter l'examen final.</p>
      <Link className="btn btn-primary" href="/espace-etudiant">Reprendre mon cursus</Link>
    </div></div></section>
  );

  if (result) return (
    <section className="section"><div className="container center"><div className="card" style={{ padding: 38, maxWidth: 760, margin: "0 auto" }}>
      {result.passed ? <CheckCircle2 size={46} color="#22c55e" /> : <AlertTriangle size={46} color="var(--gold-2)" />}
      <h1 className="title">{result.passed ? "Examen réussi" : "Examen à reprendre"}</h1>
      <p className="subtitle">Votre score : <strong>{result.score}%</strong>. Le seuil de réussite est fixé à {payload.passScore}%.</p>
      {!result.passed && <button className="btn btn-primary" type="button" onClick={() => setResult(null)}>Réessayer</button>}
    </div></div></section>
  );

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 900 }}>
        <Link href="/espace-etudiant">← Retour à mon espace</Link>
        <h1 className="title" style={{ marginTop: 24 }}>Examen final d'apologétique</h1>
        <p className="subtitle">Répondez aux {payload.questions.length} questions. Le certificat nominatif est délivré à partir de {payload.passScore}%.</p>
        <form method="post" onSubmit={submit}>
          {payload.questions.map((question, index) => (
            <article className="card" style={{ padding: 24, marginTop: 18 }} key={question.id}>
              <h2 style={{ fontSize: "1.1rem" }}>{index + 1}. {question.question}</h2>
              {question.options.map((option, optionIndex) => (
                <label style={{ display: "flex", gap: 10, padding: "8px 0" }} key={option}>
                  <input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} required />
                  <span>{option}</span>
                </label>
              ))}
            </article>
          ))}
          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={status === "saving"}>
            {status === "saving" && <Loader2 className="action-spin" size={18} />} Corriger mon examen
          </button>
        </form>
      </div>
    </section>
  );
}
