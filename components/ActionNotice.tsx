"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type ActionNoticeProps = {
  status: "idle" | "saving" | "success" | "error";
  success?: string;
  error?: string;
};

const copy = {
  saving: {
    className: "action-saving",
    icon: Loader2,
    label: "Enregistrement en cours...",
  },
  success: {
    className: "action-success",
    icon: CheckCircle2,
    label: "C'est enregistré.",
  },
  error: {
    className: "action-error",
    icon: XCircle,
    label: "Impossible d'enregistrer pour le moment.",
  },
};

export function ActionNotice({ status, success, error }: ActionNoticeProps) {
  if (status === "idle") return null;

  const item = copy[status];
  const Icon = item.icon;
  const label = status === "success" ? success || item.label : status === "error" ? error || item.label : item.label;

  return (
    <div className={`action-notice ${item.className}`} role={status === "error" ? "alert" : "status"} aria-live="polite">
      <Icon className={status === "saving" ? "action-spin" : "action-check"} size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
