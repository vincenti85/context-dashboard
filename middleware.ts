// middleware.ts — ADMIN_PASSWORD-based auth for personal admin tool.
// Protects all routes except /login and static assets.

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, login API, static assets, and worker/cron endpoints.
  // Worker/cron endpoints (/api/jobs/run, /api/cron/daily) authenticate via a
  // Bearer CRON_SECRET checked inside the route handler (see lib/auth.ts) —
  // they are called by external services (cron-job.org, Vercel Cron, self-invoke)
  // that have no browser session cookie, so the cookie check below does not apply.
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/jobs/run") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check auth cookie
  const authCookie = request.cookies.get("admin-session");
  if (!authCookie || authCookie.value !== process.env.ADMIN_PASSWORD) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
