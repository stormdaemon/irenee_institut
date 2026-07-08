import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { signUpWithPassword } from "@/lib/local-auth";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientKey(request: Request, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `signup:${forwarded || "unknown"}:${email.toLowerCase()}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const metadata = typeof body.metadata === "object" && body.metadata ? body.metadata as Record<string, unknown> : {};

  if (!emailPattern.test(email)) return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Mot de passe trop court." }, { status: 400 });
  if (!checkRateLimit(clientKey(request, email), 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de créations de compte. Reessayez plus tard." }, { status: 429 });
  }

  const result = await signUpWithPassword({ email, metadata, password });
  const signupError = (result as { error?: Error | null }).error;
  if (signupError) return NextResponse.json({ error: signupError.message }, { status: 400 });
  if (!result.session && result.user && (result.identities || []).length === 0) {
    return NextResponse.json({ error: "Cette adresse email est déjà utilisée." }, { status: 409 });
  }

  const user = result.user ? { ...result.user, identities: result.identities || [] } : null;
  const response = NextResponse.json({ session: result.session, user });
  if (result.session) setSessionCookie(response, result.session);
  return response;
}
