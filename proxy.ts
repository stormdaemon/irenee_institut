import { NextRequest, NextResponse } from "next/server";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/signup"]
};
