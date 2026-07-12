import { NextRequest, NextResponse } from "next/server";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

const SENSITIVE_LOGIN_QUERY_PARAMETERS = new Set(["code", "email", "pass", "password", "pwd", "token"]);
const SESSION_COOKIE_NAMES = ["__Host-irenee_session", "irenee_session"];

function nonceForRequest() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function emptyRedirect(url: URL, status: 302 | 307) {
  const response = NextResponse.redirect(url, status);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Content-Security-Policy", "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/formations" && request.nextUrl.searchParams.has("checkout")) {
    const checkoutValues = request.nextUrl.searchParams.getAll("checkout");
    if (checkoutValues.length !== 1 || checkoutValues[0] !== "annual-pass") {
      const url = request.nextUrl.clone();
      url.searchParams.delete("checkout");
      return emptyRedirect(url, 307);
    }
  }

  if (request.nextUrl.pathname === "/auth/login") {
    const url = request.nextUrl.clone();
    let removed = false;
    for (const name of SENSITIVE_LOGIN_QUERY_PARAMETERS) {
      if (!url.searchParams.has(name)) continue;
      url.searchParams.delete(name);
      removed = true;
    }
    if (removed) return emptyRedirect(url, 302);
  }

  if (
    request.nextUrl.pathname.startsWith("/admin")
    && !SESSION_COOKIE_NAMES.some(name => request.cookies.has(name))
  ) {
    const url = request.nextUrl.clone();
    const nextPath = `${url.pathname}${url.search}`;
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", nextPath);
    return emptyRedirect(url, 307);
  }

  if (
    request.nextUrl.pathname === "/auth/signup" &&
    request.nextUrl.searchParams.get("next") === annualPassCheckoutPath
  ) {
    const url = request.nextUrl.clone();
    url.pathname = cleanAnnualPassSignupPath;
    url.search = "";
    return emptyRedirect(url, 307);
  }

  const nonce = nonceForRequest();
  const csp = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
    process.env.AUTH_COOKIE_SECURE !== "false",
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|opengraph-image.png|twitter-image.png|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};
