"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";

export function LearningDocumentButton({ documentId, label = "Télécharger" }: { documentId: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    const supabase = createBrowserClient();
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!data.session) {
      setError("Reconnectez-vous pour télécharger ce document.");
      setBusy(false);
      return;
    }

    const response = await fetch(`/api/documents/${documentId}`, { credentials: "same-origin" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error || "Le document n'a pas pu être téléchargé.");
      setBusy(false);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "document-saint-irenee.pdf";
    link.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  }

  return (
    <span>
      <button className="btn btn-outline" type="button" onClick={download} disabled={busy}>
        {busy ? <Loader2 className="action-spin" size={16} /> : <Download size={16} />} {label}
      </button>
      {error && <small className="field-error">{error}</small>}
    </span>
  );
}
