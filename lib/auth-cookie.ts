import { type NextResponse } from "next/server";
import {
  SECURE_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  type LocalSession
} from "@/lib/local-auth";

function useSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE === "true") return true;
  if (process.env.NODE_ENV !== "production" && process.env.AUTH_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function activeSessionCookieName() {
  return useSecureCookie() ? SECURE_SESSION_COOKIE_NAME : SESSION_COOKIE_NAME;
}

export function setSessionCookie(response: NextResponse, session: LocalSession) {
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(activeSessionCookieName(), session.access_token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    priority: "high",
    sameSite: "lax",
    secure: useSecureCookie()
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  for (const name of [SESSION_COOKIE_NAME, SECURE_SESSION_COOKIE_NAME]) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      priority: "high",
      sameSite: "lax",
      secure: name === SECURE_SESSION_COOKIE_NAME || useSecureCookie()
    });
  }
}
