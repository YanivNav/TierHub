import "server-only";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { TRPCError } from "@trpc/server";

// Shared Upstash Redis client. When the env vars are absent (local dev, or
// before Upstash is provisioned) we fail open - no limiting - mirroring how
// resolve-media treats a missing YOUTUBE_API_KEY.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
/** Shared Upstash client (also backs Better Auth's login rate limiter). */
export const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  console.warn(
    "[ratelimit] Upstash not configured - AI rate limiting disabled (fail-open)."
  );
}

function makeLimiter(tokens: number, window: Duration, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: `ratelimit:${prefix}`,
  });
}

// Expensive LLM generation - keep tight.
const generateLimiter = makeLimiter(10, "1 m", "ai-generate");
// Per-item media resolution (Wikipedia/YouTube) - looser, but still capped so a
// single user can't burn the YouTube Data API daily quota.
const mediaLimiter = makeLimiter(60, "1 m", "ai-media");

async function enforce(limiter: Ratelimit | null, key: string) {
  if (!limiter) return; // fail-open when Upstash isn't configured
  const { success, reset } = await limiter.limit(key);
  if (!success) {
    const seconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many AI requests. Try again in ${seconds}s.`,
    });
  }
}

// Dedupe recorded views: at most one counted view per (list, viewer-ip) per
// window, so a public list's view count can't be inflated by repeat/scripted
// requests. Fails open (counts the view) when Upstash isn't configured.
const VIEW_DEDUPE_WINDOW_SECONDS = 60 * 60; // 1 hour

export async function shouldCountView(listId: string, ip: string): Promise<boolean> {
  if (!redis) return true;
  const res = await redis.set(`view:${listId}:${ip}`, "1", {
    nx: true,
    ex: VIEW_DEDUPE_WINDOW_SECONDS,
  });
  return res === "OK";
}

/** Throttle LLM item generation / classification, keyed by user. */
export const rateLimitAiGenerate = (userId: string) =>
  enforce(generateLimiter, userId);

/** Throttle per-item media (Wikipedia/YouTube) resolution, keyed by user. */
export const rateLimitAiMedia = (userId: string) =>
  enforce(mediaLimiter, userId);
