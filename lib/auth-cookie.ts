import { type NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, type LocalSession } from "@/lib/local-auth";

function useSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE === "true") return true;
  if (process.env.AUTH_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(response: NextResponse, session: LocalSession) {
  response.cookies.set(SESSION_COOKIE_NAME, session.access_token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: useSecureCookie()
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: useSecureCookie()
  });
}
