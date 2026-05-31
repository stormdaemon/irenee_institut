import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, authorizeBearerUser } from "@/lib/server-auth";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60
};

export async function POST(request: Request) {
  const auth = await authorizeBearerUser(request);
  if (!auth.ok) return auth.response;
  if (auth.profile.role !== "directeur" && auth.profile.role !== "formateur") {
    return NextResponse.json({ ok: false, error: "Acces reserve au personnel pedagogique." }, { status: 403 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
