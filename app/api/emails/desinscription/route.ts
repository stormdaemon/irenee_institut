import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyEmailOptoutToken } from "@/lib/email-optout";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-security";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function htmlPage(title: string, message: string, status: number) {
  const body = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${title} | Institut Saint Irénée</title>
  </head>
  <body style="margin:0;background:#04101e;font-family:Arial,Helvetica,sans-serif;color:#f8f1df;">
    <div style="max-width:560px;margin:64px auto;padding:36px 32px;background:#071523;border:1px solid rgba(220,180,107,.55);border-radius:10px;text-align:center;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;color:#fff7e7;font-size:26px;margin:0 0 16px;">${title}</h1>
      <p style="font-size:16px;line-height:1.7;color:#f0dfc2;margin:0 0 24px;">${message}</p>
      <a href="https://irenee-institut.org" style="display:inline-block;background:#dcb46b;color:#071523;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px;">Retour au site</a>
    </div>
  </body>
</html>`;
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    status
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profil")?.trim().toLowerCase() || "";
  const token = url.searchParams.get("jeton")?.trim() || "";

  if (!uuidPattern.test(profileId) || !token) {
    return htmlPage(
      "Lien invalide",
      "Ce lien de désinscription est invalide ou a expiré. Vous pouvez nous écrire à oeuvrecatholiquefrance@gmail.com pour être retiré de la liste.",
      400
    );
  }

  const ip = getTrustedClientIp(request);
  try {
    const limit = await checkRateLimit(`email-optout:ip:${ip}`, 20, 10 * 60 * 1000);
    if (!limit.allowed) {
      return htmlPage("Trop de tentatives", "Patientez quelques minutes avant de réessayer.", 429);
    }
  } catch {
    return htmlPage("Service indisponible", "Une erreur est survenue. Notre équipe est sur le coup. Réessayez dans quelques minutes.", 503);
  }

  if (!verifyEmailOptoutToken(profileId, token)) {
    return htmlPage(
      "Lien invalide",
      "Ce lien de désinscription est invalide ou a expiré. Vous pouvez nous écrire à oeuvrecatholiquefrance@gmail.com pour être retiré de la liste.",
      400
    );
  }

  try {
    await query(
      `insert into public.marketing_email_optouts (profile_id, source)
       select p.id, 'lien-email' from public.profiles p where p.id = $1
       on conflict (profile_id) do nothing`,
      [profileId]
    );
  } catch {
    return htmlPage("Service indisponible", "Une erreur est survenue. Notre équipe est sur le coup. Réessayez dans quelques minutes.", 503);
  }

  return htmlPage(
    "Désinscription confirmée",
    "Vous ne recevrez plus d'emails d'information sur le pass annuel. Les emails liés à votre compte et à vos documents pédagogiques restent actifs.",
    200
  );
}
