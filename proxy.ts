import { NextRequest, NextResponse } from "next/server";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

function nonceForRequest() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/auth/signup" &&
    request.nextUrl.searchParams.get("next") === annualPassCheckoutPath
  ) {
    const url = request.nextUrl.clone();
    url.pathname = cleanAnnualPassSignupPath;
    url.search = "";
    return NextResponse.redirect(url, 307);
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
