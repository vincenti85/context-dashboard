// lib/ai/provider.ts — Free-tier AI provider chain: Gemini first, Groq fallback.
// Confirmed model IDs/versions: docs/superpowers/specs/2026-07-05-wp0-baseline-audit.md §V3
//   ai@^7.0.15 + @ai-sdk/google@^4.0.8 + @ai-sdk/groq@^4.0.5 + zod@^3.25.76
//   (provider/provider-utils versions match exactly across all three packages).

import { generateText, generateObject, type Schema } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { z } from "zod";

export class AiUnavailableError extends Error {
  constructor(causes: string[]) {
    super(
      causes.length === 0
        ? "No AI provider configured (set GOOGLE_GENERATIVE_AI_API_KEY and/or GROQ_API_KEY)"
        : `All AI providers failed: ${causes.join(" | ")}`,
    );
    this.name = "AiUnavailableError";
  }
}

interface ChainEntry {
  id: string;
  provider: "google" | "groq";
  model: () => Parameters<typeof generateText>[0]["model"];
}

// Stable (non-experimental) free-tier models. "gemini-flash-latest"-style
// aliases point at experimental models with tighter rate limits — avoided
// deliberately (see WP0 audit §V3).
//
// The chain is built from whichever provider keys are actually configured, so
// an unused provider never produces a spurious "missing API key" failure when
// the primary rate-limits. Adding GROQ_API_KEY re-enables the fallback with no
// code change; with only Gemini configured the chain is simply one entry long.
const ALL_CHAIN_ENTRIES: Array<ChainEntry & { envKey: string }> = [
  {
    id: "gemini-2.0-flash",
    provider: "google",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    model: () => google("gemini-2.0-flash"), // free: 1,500 req/day
  },
  {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    envKey: "GROQ_API_KEY",
    model: () => groq("llama-3.3-70b-versatile"), // free: 1,000 req/day fallback
  },
];

/** Providers whose API key is present, in priority order. Read per call so
 * tests and runtime env changes are picked up without a module reload. */
export function getModelChain(): ChainEntry[] {
  return ALL_CHAIN_ENTRIES.filter((entry) => Boolean(process.env[entry.envKey]));
}

const PER_PROVIDER_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/** True for errors that should trigger a fallback to the next provider (rate limit, server error, timeout). */
function isFallbackWorthy(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (/timeout after/.test(message)) return true;
  // Vercel AI SDK errors expose statusCode on APICallError; duck-type it
  // since we don't want a hard dependency on the exact error class shape.
  const statusCode = (err as { statusCode?: number })?.statusCode;
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) return true;
  // Fallback: match common rate-limit/server-error phrasing when statusCode is absent.
  return /rate.?limit|429|5\d\d|server error/i.test(message);
}

export interface GenerateWithFallbackOptions {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}

export interface GenerateWithFallbackResult {
  text: string;
  modelUsed: string;
}

/** generateText across the provider chain, falling back on rate-limit/5xx/timeout. */
export async function generateWithFallback(
  opts: GenerateWithFallbackOptions,
): Promise<GenerateWithFallbackResult> {
  const failures: string[] = [];
  for (const entry of getModelChain()) {
    try {
      const { text } = await withTimeout(
        generateText({
          model: entry.model(),
          system: opts.system,
          prompt: opts.prompt,
          maxOutputTokens: opts.maxOutputTokens ?? 2000,
        }),
        PER_PROVIDER_TIMEOUT_MS,
      );
      return { text, modelUsed: entry.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${entry.id}: ${message}`);
      if (!isFallbackWorthy(err)) {
        // Non-transient error (e.g. bad request) — no point trying the next provider.
        throw err;
      }
    }
  }
  throw new AiUnavailableError(failures);
}

export interface GenerateObjectWithFallbackOptions<T> {
  system: string;
  prompt: string;
  schema: Schema<T> | z.ZodType<T>;
}

export interface GenerateObjectWithFallbackResult<T> {
  object: T;
  modelUsed: string;
}

/** generateObject across the provider chain (used for titles/thumbnails/title-scoring structured output). */
export async function generateObjectWithFallback<T>(
  opts: GenerateObjectWithFallbackOptions<T>,
): Promise<GenerateObjectWithFallbackResult<T>> {
  const failures: string[] = [];
  for (const entry of getModelChain()) {
    try {
      const { object } = await withTimeout(
        generateObject({
          model: entry.model(),
          system: opts.system,
          prompt: opts.prompt,
          schema: opts.schema,
        }),
        PER_PROVIDER_TIMEOUT_MS,
      );
      return { object, modelUsed: entry.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${entry.id}: ${message}`);
      if (!isFallbackWorthy(err)) {
        throw err;
      }
    }
  }
  throw new AiUnavailableError(failures);
}
