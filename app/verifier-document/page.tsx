import type { Metadata } from "next";
import { DocumentVerificationForm } from "@/components/DocumentVerificationForm";

export const metadata: Metadata = {
  description: "Vérifiez une référence de document pédagogique émise par l'Institut Saint Irénée.",
  title: "Vérifier un document"
};

export default function VerifyDocumentPage() {
  return (
    <section className="auth-shell">
      <div className="auth-intro center">
        <h1 className="title">Vérifier un document</h1>
        <p className="subtitle">La vérification confirme l'émission technique et le nom déclaré. Elle ne constitue pas une vérification d'identité civile.</p>
      </div>
      <DocumentVerificationForm />
    </section>
  );
}
