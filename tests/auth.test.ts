// tests/auth.test.ts — lib/auth.ts guard behavior.
// requireAdmin() needs next/headers cookies(); mocked below since these tests
// run outside a Next.js request context (Vitest, no server).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
  }),
}));

describe("lib/auth", () => {
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    cookieStore.clear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalAdminPassword;
    process.env.CRON_SECRET = originalCronSecret;
  });

  describe("requireAdmin", () => {
    it("throws when ADMIN_PASSWORD is not configured", async () => {
      delete process.env.ADMIN_PASSWORD;
      const { requireAdmin, UnauthorizedError } = await import("@/lib/auth");
      await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
    });

    it("throws when session cookie is missing", async () => {
      process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
      const { requireAdmin, UnauthorizedError } = await import("@/lib/auth");
      await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
    });

    it("throws when session cookie does not match ADMIN_PASSWORD", async () => {
      process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
      cookieStore.set("admin-session", "wrong-password");
      const { requireAdmin, UnauthorizedError } = await import("@/lib/auth");
      await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
    });

    it("resolves when session cookie matches ADMIN_PASSWORD", async () => {
      process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
      cookieStore.set("admin-session", "correct-horse-battery-staple");
      const { requireAdmin } = await import("@/lib/auth");
      await expect(requireAdmin()).resolves.toBeUndefined();
    });
  });

  describe("isValidCronSecret", () => {
    it("returns false when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;
      const { isValidCronSecret } = await import("@/lib/auth");
      expect(isValidCronSecret("Bearer anything")).toBe(false);
    });

    it("returns false when header is null", async () => {
      process.env.CRON_SECRET = "s3cr3t";
      const { isValidCronSecret } = await import("@/lib/auth");
      expect(isValidCronSecret(null)).toBe(false);
    });

    it("returns false when header does not match", async () => {
      process.env.CRON_SECRET = "s3cr3t";
      const { isValidCronSecret } = await import("@/lib/auth");
      expect(isValidCronSecret("Bearer wrong")).toBe(false);
    });

    it("returns true when header matches Bearer + CRON_SECRET", async () => {
      process.env.CRON_SECRET = "s3cr3t";
      const { isValidCronSecret } = await import("@/lib/auth");
      expect(isValidCronSecret("Bearer s3cr3t")).toBe(true);
    });

    it("returns false for a different-length secret (no throw)", async () => {
      process.env.CRON_SECRET = "a-much-longer-secret-value";
      const { isValidCronSecret } = await import("@/lib/auth");
      expect(isValidCronSecret("Bearer short")).toBe(false);
    });
  });
});
