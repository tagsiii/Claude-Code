import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "./app/lib/auth";

// Gate the dashboard: no valid session cookie → bounce to /login.
export function middleware(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie !== sessionToken()) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/dashboard"],
};
