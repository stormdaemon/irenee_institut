"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, Lock, Save, User } from "lucide-react";
import type { Profile } from "@/lib/types";
import { cloudinaryAvatarUrl } from "@/lib/cloudinary";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { AvatarUploader } from "@/components/AvatarUploader";
import { createBrowserClient } from "@/lib/supabase";

function avatarSrc(profile: Profile | null) {
  const src = profile?.avatar_public_id || profile?.avatar_url || "";
  if (!src) return "";
  if (!src.startsWith("http") && !src.startsWith("/") && !src.includes("balzaac") && !src.includes("nezchristos") && !src.includes("mathieu")) {
    return cloudinaryAvatarUrl(src);
  }
  if (src.startsWith("http") || src.startsWith("/")) return src;
  if (src.includes("balzaac")) return "/images/balzaac.jpeg";
  if (src.includes("nezchristos")) return "/images/nezchristos.jpeg";
  if (src.includes("mathieu")) return "/images/mathieu.webp";
  return "";
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const supabase = createBrowserClient();
      if (!supabase) {
        if (mounted) {
          setProfile(null);
          setLoaded(true);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        if (mounted) {
          setProfile(null);
          setLoaded(true);
        }
        return;
      }

      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const result = await response.json().catch(() => null);

      if (mounted) {
        setProfile(response.ok ? result.profile as Profile : null);
        setLoaded(true);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setStatus("saving");
    setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserClient();
    const { data: sessionData } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!sessionData.session?.access_token) {
      setError("Connectez-vous pour modifier votre profil.");
      setStatus("error");
      return;
    }
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({
        id: profile.id,
        civilite: form.get("civilite"),
        date_naissance: form.get("date_naissance"),
        prenom: form.get("prenom"),
        nom: form.get("nom"),
        telephone: form.get("telephone"),
        adresse: form.get("adresse"),
        code_postal: form.get("code_postal"),
        ville: form.get("ville"),
        pays: form.get("pays"),
        marketing_opt_in: form.get("marketing_opt_in") === "on"
      })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setProfile(data.profile as Profile);
      setStatus("success");
    } else {
      setError(data.error || "Les informations n'ont pas pu être enregistrées.");
      setStatus("error");
    }
  }

  const src = avatarSrc(profile);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <Link href="/espace-etudiant">← Retour</Link>
        <h1 className="title" style={{ marginTop: 24 }}>Paramètres</h1>
        <p className="subtitle">Gérez vos informations personnelles, votre photo de profil et la sécurité de votre compte.</p>
        {!loaded && <div className="card" style={{ padding: 34, marginTop: 34 }}>Chargement du profil...</div>}
        {loaded && !profile && (
          <div className="card" style={{ padding: 34, marginTop: 34 }}>
            <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}>Connexion requise</h2>
            <p className="muted">Connectez-vous pour modifier vos paramètres.</p>
            <Link className="btn btn-primary" href="/auth/login">Se connecter</Link>
          </div>
        )}
        <ActionNotice status={status} success="Modifications enregistrées." error={error} />
        {loaded && profile && (
          <>
            <div className="card" style={{ padding: 34, marginTop: 34 }}>
              <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}><Camera /> Photo utilisateur</h2>
              <div style={{ display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap" }}>
                <div className="avatar avatar-large">{src ? <Image src={src} alt="Avatar" fill sizes="96px" style={{ objectFit: "cover" }} /> : `${profile.prenom?.[0] || ""}${profile.nom?.[0] || ""}`}</div>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <AvatarUploader profile={profile} onUploaded={(next) => setProfile(next)} />
                </div>
              </div>
            </div>

            <form className="card" style={{ padding: 34, marginTop: 34 }} onSubmit={saveProfile}>
              <h2 className="font-display" style={{ color: "var(--navy)" }}><User /> Informations personnelles</h2>
              <div className="grid-2">
                <p><label>Civilité</label><select className="input" name="civilite" defaultValue={profile.civilite || "M."}><option>M.</option><option>Mme</option></select></p>
                <p><label>Date de naissance</label><input className="input" name="date_naissance" type="date" defaultValue={profile.date_naissance || ""} /></p>
                <p><label>Prénom *</label><input className="input" name="prenom" defaultValue={profile.prenom || ""} /></p>
                <p><label>Nom *</label><input className="input" name="nom" defaultValue={profile.nom || ""} /></p>
                <p><label>Email</label><input className="input" defaultValue={profile.email || ""} disabled /></p>
                <p><label>Téléphone</label><input className="input" name="telephone" defaultValue={profile.telephone || ""} /></p>
              </div>
              <p><label>Adresse</label><input className="input" name="adresse" defaultValue={profile.adresse || ""} /></p>
              <div className="grid-3">
                <p><label>Code postal</label><input className="input" name="code_postal" defaultValue={profile.code_postal || ""} /></p>
                <p><label>Ville</label><input className="input" name="ville" defaultValue={profile.ville || ""} /></p>
                <p><label>Pays</label><input className="input" name="pays" defaultValue={profile.pays || "France"} /></p>
              </div>
              <p>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <input name="marketing_opt_in" type="checkbox" defaultChecked={profile.marketing_opt_in === true} style={{ marginTop: 4 }} />
                  <span>
                    Recevoir les actualités importantes, ressources et offres de formations de l'Institut Irénée.
                    <small className="auth-help" style={{ display: "block" }}>Vous pouvez vous désabonner à tout moment.</small>
                  </span>
                </label>
              </p>
              <p style={{ textAlign: "right" }}><button className="btn btn-primary"><Save size={18} /> Enregistrer les modifications</button></p>
            </form>

            <form className="card" style={{ padding: 34, marginTop: 34 }} onSubmit={(event) => event.preventDefault()}>
              <h2 className="font-display" style={{ color: "var(--navy)" }}><Lock /> Sécurité</h2>
              <p><label>Nouveau mot de passe</label><input className="input" type="password" minLength={8} /></p>
              <p><label>Confirmer le mot de passe</label><input className="input" type="password" minLength={8} /></p>
              <p style={{ textAlign: "right" }}><button className="btn btn-primary">Changer le mot de passe</button></p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
