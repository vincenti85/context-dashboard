// lib/auth.ts — Shared auth guards.
// requireAdmin(): defense-in-depth guard for mutating Server Actions
// (middleware.ts already blocks unauthenticated page/API access; this guard
// protects Server Actions even if invoked from a context middleware doesn't cover).
// requireCronSecret(): constant-time Bearer check for worker/cron endpoints
// (these use a separate secret, NOT the admin session cookie, because they
// are called by external services with no browser session).

import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Guard for Server Actions. Throws UnauthorizedError if the admin session cookie is missing/invalid. */
export async function requireAdmin(): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new UnauthorizedError("ADMIN_PASSWORD is not configured");
  }
  const cookieStore = await cookies();
  const session = cookieStore.get("admin-session")?.value;
  if (!session || !constantTimeEqual(session, adminPassword)) {
    throw new UnauthorizedError();
  }
}

/**
 * Guard for /api/jobs/run and /api/cron/daily.
 * Compares the request's Authorization header against CRON_SECRET.
 * Returns false (never throws) so callers can return a plain 401 Response.
 */
export function isValidCronSecret(authorizationHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authorizationHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  return constantTimeEqual(authorizationHeader, expected);
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length dummy buffers to avoid a
    // length-based timing side-channel (deliberately not a hot path).
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
