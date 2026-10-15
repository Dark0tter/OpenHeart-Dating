import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIndexable } from "@/lib/public-pages";

/** Keeps everything but the public pages out of search engines, and sends signed-out visitors to log in. */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!isIndexable(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // Soft gate: app routes expect a session cookie from Auth.js
  const isApp =
    request.nextUrl.pathname.startsWith("/feed") ||
    request.nextUrl.pathname.startsWith("/rooms") ||
    request.nextUrl.pathname.startsWith("/search") ||
    request.nextUrl.pathname.startsWith("/matches") ||
    request.nextUrl.pathname.startsWith("/likes") ||
    request.nextUrl.pathname.startsWith("/supporter") ||
    request.nextUrl.pathname.startsWith("/messages") ||
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname.startsWith("/members") ||
    request.nextUrl.pathname.startsWith("/mod") ||
    request.nextUrl.pathname.startsWith("/owner") ||
    request.nextUrl.pathname.startsWith("/notifications") ||
    request.nextUrl.pathname.startsWith("/events") ||
    request.nextUrl.pathname.startsWith("/safety/check-in") ||
    request.nextUrl.pathname.startsWith("/suspended");

  if (isApp) {
    const token =
      request.cookies.get("authjs.session-token") ??
      request.cookies.get("__Secure-authjs.session-token");
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
