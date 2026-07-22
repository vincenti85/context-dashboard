// tests/ai-provider.test.ts — Gemini -> Groq fallback chain, fully mocked (no real API calls).
// Verifies WP4-V2/V3 from docs/superpowers/specs/2026-07-05-integrated-system-design.md §10:
// 429/5xx/timeout on the first provider falls back to the second; total failure throws
// AiUnavailableError; a non-transient error does not waste a call on the fallback provider.
//
// The chain is built from configured provider keys, so each test sets the env
// vars it wants in scope (see "chain composition" block at the bottom).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;

/** Restore the ambient provider-key env after each test file section. */
function restoreProviderKeys() {
  if (originalGoogleKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
}

describe("generateWithFallback", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    // Both providers configured — exercises the full two-entry chain.
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
    process.env.GROQ_API_KEY = "test-groq-key";
  });

  afterEach(restoreProviderKeys);

  it("returns the Gemini result directly when the first provider succeeds", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "hello from gemini" });
    const { generateWithFallback } = await import("@/lib/ai/provider");

    const result = await generateWithFallback({ system: "s", prompt: "p" });

    expect(result).toEqual({ text: "hello from gemini", modelUsed: "gemini-3.5-flash" });
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
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
    process.env.GROQ_API_KEY = "test-groq-key";
  });

  afterEach(restoreProviderKeys);

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

// Chain composition: the deployed configuration has Gemini only (Groq is
// deliberately unused), so an absent GROQ_API_KEY must never surface as a
// provider failure.
describe("getModelChain — built from configured provider keys", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  afterEach(restoreProviderKeys);

  it("includes both providers when both keys are set", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
    process.env.GROQ_API_KEY = "test-groq-key";
    const { getModelChain } = await import("@/lib/ai/provider");

    expect(getModelChain().map((e) => e.id)).toEqual([
      "gemini-3.5-flash",
      "llama-3.3-70b-versatile",
    ]);
  });

  it("includes only Gemini when GROQ_API_KEY is absent (current deployment)", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
    delete process.env.GROQ_API_KEY;
    const { getModelChain } = await import("@/lib/ai/provider");

    expect(getModelChain().map((e) => e.id)).toEqual(["gemini-3.5-flash"]);
  });

  it("does not attempt a Groq call when Gemini rate-limits and Groq is unconfigured", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
    delete process.env.GROQ_API_KEY;
    generateTextMock.mockRejectedValueOnce(rateLimitError());
    const { generateWithFallback, AiUnavailableError } = await import("@/lib/ai/provider");

    await expect(generateWithFallback({ system: "s", prompt: "p" })).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    // Exactly one attempt — no phantom call against an unconfigured provider.
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("throws a configuration-specific error when no provider key is set", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    const { generateWithFallback } = await import("@/lib/ai/provider");

    await expect(generateWithFallback({ system: "s", prompt: "p" })).rejects.toThrow(
      /No AI provider configured/,
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
