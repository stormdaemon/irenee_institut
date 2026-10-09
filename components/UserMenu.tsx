"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Camera, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Settings, UserCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/browser-auth";
import { cloudinaryAvatarUrl } from "@/lib/cloudinary";
import { cleanAnnualPassSignupPath } from "@/lib/routes";
import type { Profile } from "@/lib/types";
import { AvatarUploader } from "@/components/AvatarUploader";

type BrowserAuthClient = NonNullable<ReturnType<typeof createBrowserClient>>;

function initials(profile: Profile) {
  return `${profile.prenom?.[0] || ""}${profile.nom?.[0] || ""}` || "II";
}

function avatarSrc(profile: Profile | null) {
  if (!profile) return "";
  const src = profile.avatar_public_id || profile.avatar_url || "";
  if (!src) return "";
  if (!src.startsWith("http") && !src.startsWith("/") && !src.includes("balzaac") && !src.includes("nezchristos")) {
    return cloudinaryAvatarUrl(src);
  }
  if (src.startsWith("http") || src.startsWith("/")) return src;
  if (src.includes("balzaac")) return "/images/guillaume-maspero.jpg";
  if (src.includes("nezchristos")) return "/images/nezchristos.jpeg";
  return "";
}

type UserMenuProps = {
  onNavigate?: () => void;
  loggedOutLabel?: string;
};

const annualPassSignupHref = cleanAnnualPassSignupPath;

export function UserMenu({ onNavigate, loggedOutLabel = "Se connecter" }: UserMenuProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [loginHref, setLoginHref] = useState("/auth/login");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const src = useMemo(() => avatarSrc(profile), [profile]);

  useEffect(() => {
    const client = createBrowserClient();
    const params = new URLSearchParams(window.location.search);
    const currentPathWithQuery = `${window.location.pathname}${window.location.search}`;
    const nextParam = params.get("next");

    setLoginHref(
      nextParam
        ? `/auth/login?next=${encodeURIComponent(nextParam)}`
        : currentPathWithQuery.includes("checkout=annual-pass")
          ? `/auth/login?next=${encodeURIComponent(currentPathWithQuery)}`
          : "/auth/login"
    );

    if (!client) return;

    async function loadProfile(context: BrowserAuthClient) {
      const resetProfile = async () => {
        await context.auth.signOut({ scope: "local" }).catch(() => undefined);
        setProfile(null);
      };

      const { data, error } = await context.auth.getUser().catch(() => ({ data: { user: null }, error: new Error("Session invalide") }));
      if (!data.user) {
        setProfile(null);
        return;
      }
      if (error) {
        await resetProfile();
        return;
      }

      const { data: profileData } = await context.getProfile();
      setProfile((profileData as Profile | null) || {
        id: data.user.id,
        email: data.user.email || "",
        prenom: String(data.user.user_metadata?.prenom || data.user.email?.split("@")[0] || ""),
        nom: String(data.user.user_metadata?.nom || ""),
        role: "etudiant"
      });
    }

    loadProfile(client);
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function signOut() {
    onNavigate?.();
    const context = createBrowserClient();
    await context?.auth.signOut();
    window.location.href = "/";
  }

  function closeAfterNavigate() {
    setOpen(false);
    onNavigate?.();
  }

  if (!profile) {
    return (
      <>
        <Link href={loginHref} className="btn btn-outline" prefetch={false} onClick={onNavigate}>{loggedOutLabel}</Link>

      </>
    );
  }

  const isStaff = profile.role === "directeur" || profile.role === "formateur";

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-trigger" type="button" aria-expanded={open} aria-label="Menu du compte" onClick={() => setOpen(!open)}>
        <span className="avatar-wrap">
          <span className="avatar">
            {src ? <Image src={src} alt={`${profile.prenom} ${profile.nom}`} fill sizes="36px" style={{ objectFit: "cover" }} /> : initials(profile)}
          </span>
        </span>
        <span className="user-copy">
          <strong>{profile.prenom} {profile.nom}</strong>
          <small>{profile.role}</small>
        </span>
        <ChevronDown size={16} className={open ? "rotate" : ""} />
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-head">
            <strong>{profile.prenom} {profile.nom}</strong>
            <span>{profile.email}</span>
            <small>{profile.role}</small>
          </div>
          <Link href="/espace-etudiant" prefetch={false} onClick={closeAfterNavigate}><BookOpen size={16} /> Mes cours</Link>
          <Link href={isStaff ? "/admin/homework" : "/devoirs"} prefetch={false} onClick={closeAfterNavigate}><ClipboardList size={16} /> Devoirs</Link>
          {isStaff && <Link href="/admin" prefetch={false} onClick={closeAfterNavigate}><LayoutDashboard size={16} /> Administration</Link>}
          <Link href="/parametres" prefetch={false} onClick={closeAfterNavigate}><Settings size={16} /> Paramètres</Link>
          <button type="button" onClick={() => { setOpen(false); setAvatarOpen(true); }}><Camera size={16} /> Changer ma photo</button>
          <button type="button" onClick={signOut}><LogOut size={16} /> Déconnexion</button>
        </div>
      )}

      {avatarOpen && (
        <div className="modal-backdrop" onClick={() => setAvatarOpen(false)}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
              <h2 className="font-display" style={{ color: "var(--navy)", margin: 0 }}>Changer ma photo</h2>
              <button className="btn btn-outline" type="button" onClick={() => setAvatarOpen(false)}>Fermer</button>
            </div>
            <div className="center" style={{ margin: "22px 0" }}>
              <div className="avatar avatar-large">{src ? <Image src={src} alt="Avatar actuel" fill sizes="96px" style={{ objectFit: "cover" }} /> : <UserCircle size={48} />}</div>
            </div>
            <AvatarUploader profile={profile} onUploaded={(next) => setProfile(next)} />
          </div>
        </div>
      )}
    </div>
  );
}
