import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { signInWithPassword } from "@/lib/local-auth";

export const runtime = "nodejs";

function clientKey(request: Request, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `login:${forwarded || "unknown"}:${email.toLowerCase()}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }
  if (!checkRateLimit(clientKey(request, email), 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessayez plus tard." }, { status: 429 });
  }

  const result = await signInWithPassword(email, password);
  if (result.error || !result.session || !result.user) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  const response = NextResponse.json({ session: result.session, user: result.user });
  setSessionCookie(response, result.session);
  return response;
}
