// tests/ai-provider.test.ts — Gemini -> Groq fallback chain, fully mocked (no real API calls).
// Verifies WP4-V2/V3 from docs/superpowers/specs/2026-07-05-integrated-system-design.md §10:
// 429/5xx/timeout on the first provider falls back to the second; total failure throws
// AiUnavailableError; a non-transient error does not waste a call on the fallback provider.

import { describe, it, expect, vi, beforeEach } from "vitest";

const generateTextMock = vi.fn();
const generateObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn((id: string) => ({ id, provider: "google" })),
}));
vi.mock("@ai-sdk/groq", () => ({
  groq: vi.fn((id: string) => ({ id, provider: "groq" })),
}));

function rateLimitError() {
  return Object.assign(new Error("rate limited"), { statusCode: 429 });
}
function serverError() {
  return Object.assign(new Error("server error"), { statusCode: 503 });
}
function badRequestError() {
  return Object.assign(new Error("invalid request: malformed prompt"), { statusCode: 400 });
}

describe("generateWithFallback", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it("returns the Gemini result directly when the first provider succeeds", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "hello from gemini" });
    const { generateWithFallback } = await import("@/lib/ai/provider");

    const result = await generateWithFallback({ system: "s", prompt: "p" });

    expect(result).toEqual({ text: "hello from gemini", modelUsed: "gemini-2.0-flash" });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Groq on a 429 from Gemini", async () => {
    generateTextMock.mockRejectedValueOnce(rateLimitError());
    generateTextMock.mockResolvedValueOnce({ text: "hello from groq" });
    const { generateWithFallback } = await import("@/lib/ai/provider");

    const result = await generateWithFallback({ system: "s", prompt: "p" });

    expect(result).toEqual({ text: "hello from groq", modelUsed: "llama-3.3-70b-versatile" });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to Groq on a 5xx from Gemini", async () => {
    generateTextMock.mockRejectedValueOnce(serverError());
    generateTextMock.mockResolvedValueOnce({ text: "hello from groq" });
    const { generateWithFallback } = await import("@/lib/ai/provider");

    const result = await generateWithFallback({ system: "s", prompt: "p" });
    expect(result.modelUsed).toBe("llama-3.3-70b-versatile");
  });

  it("throws AiUnavailableError when every provider in the chain fails", async () => {
    generateTextMock.mockRejectedValueOnce(rateLimitError());
    generateTextMock.mockRejectedValueOnce(rateLimitError());
    const { generateWithFallback, AiUnavailableError } = await import("@/lib/ai/provider");

    await expect(generateWithFallback({ system: "s", prompt: "p" })).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("does not fall back on a non-transient error (e.g. 400 bad request)", async () => {
    generateTextMock.mockRejectedValueOnce(badRequestError());
    const { generateWithFallback } = await import("@/lib/ai/provider");

    await expect(generateWithFallback({ system: "s", prompt: "p" })).rejects.toThrow(
      "invalid request",
    );
    // Only the first provider should have been tried — no wasted fallback call.
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });
});

describe("generateObjectWithFallback", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("falls back to Groq for structured output on rate limit", async () => {
    generateObjectMock.mockRejectedValueOnce(rateLimitError());
    generateObjectMock.mockResolvedValueOnce({ object: { items: ["a", "b"] } });
    const { generateObjectWithFallback } = await import("@/lib/ai/provider");

    const result = await generateObjectWithFallback({
      system: "s",
      prompt: "p",
      schema: {} as never,
    });

    expect(result.object).toEqual({ items: ["a", "b"] });
    expect(result.modelUsed).toBe("llama-3.3-70b-versatile");
  });
});
