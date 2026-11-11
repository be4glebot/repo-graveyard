/**
 * Server-only rate limiter for the séance AI calls.
 *
 * Two limits apply, IP first:
 *  - per IP: 30 AI calls per rolling 60 minutes (a Redis sorted set per IP);
 *  - global: a daily budget (`INCR` on `llm:daily:<UTC date>`, 48 h expiry).
 *
 * A blocked IP never touches the daily counter. If the store throws, or Redis
 * is absent (`null` store), an in-memory fallback applies: 10 calls per rolling
 * hour per IP plus a per-process daily counter (best effort).
 *
 * `@upstash/ratelimit` is deliberately not used. The store is a small
 * injectable interface modeled on `@upstash/redis`, so tests use a fake.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.9, 8.10, 8.11, 8.12
 */

import "server-only";

export type ConsumeResult = "ok" | "veil" | "weak";

export interface RateLimiter {
  /** Read-only: reports the state without counting anything. */
  check(ip: string): Promise<ConsumeResult>;
  /** Counts one AI call, or reports why it is not allowed. */
  consume(ip: string): Promise<ConsumeResult>;
}

/** The Redis operations the limiter needs (shape of `@upstash/redis`). */
export interface RateLimitStore {
  zadd(key: string, entry: { score: number; member: string }): Promise<unknown>;
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown>;
  zcard(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get(key: string): Promise<unknown>;
}

export const IP_LIMIT = 30;
export const FALLBACK_IP_LIMIT = 10;
export const WINDOW_MS = 60 * 60 * 1000;
export const DAILY_TTL_SECONDS = 48 * 60 * 60;
export const DEFAULT_DAILY_LIMIT = 200;
export const ANON_IP = "anon";

/** Parses `LLM_DAILY_LIMIT`: digits only and a safe integer, else 200. `0` is valid. */
export function parseDailyLimit(raw: string | undefined): number {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return DEFAULT_DAILY_LIMIT;
  }
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : DEFAULT_DAILY_LIMIT;
}

/** First `x-forwarded-for` entry, trimmed; the shared bucket "anon" when empty. */
export function clientIp(forwardedFor: string | null): string {
  if (forwardedFor === null) {
    return ANON_IP;
  }
  const first = forwardedFor.split(",")[0]?.trim() ?? "";
  return first === "" ? ANON_IP : first;
}

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Builds a limiter. `store` is `null` when Redis is absent (fallback only).
 * `dailyLimit` defaults to `parseDailyLimit(process.env.LLM_DAILY_LIMIT)`,
 * read on each call.
 */
export function createRateLimiter(
  store: RateLimitStore | null,
  clock: () => number,
  dailyLimit: () => number = () => parseDailyLimit(process.env.LLM_DAILY_LIMIT),
): RateLimiter {
  // In-memory fallback state.
  const memCalls = new Map<string, number[]>();
  const memDaily = new Map<string, number>();
  let seq = 0;

  const dayKey = (now: number) =>
    `llm:daily:${new Date(now).toISOString().slice(0, 10)}`;
  const ipKey = (ip: string) => `llm:ip:${ip}`;

  function memWindow(ip: string, now: number): number[] {
    const live = (memCalls.get(ip) ?? []).filter((t) => t > now - WINDOW_MS);
    memCalls.set(ip, live);
    return live;
  }

  function memCheck(ip: string): ConsumeResult {
    const now = clock();
    if (memWindow(ip, now).length >= FALLBACK_IP_LIMIT) {
      return "veil";
    }
    if ((memDaily.get(dayKey(now)) ?? 0) >= dailyLimit()) {
      return "weak";
    }
    return "ok";
  }

  function memConsume(ip: string): ConsumeResult {
    const now = clock();
    const live = memWindow(ip, now);
    if (live.length >= FALLBACK_IP_LIMIT) {
      return "veil";
    }
    const key = dayKey(now);
    const used = (memDaily.get(key) ?? 0) + 1;
    memDaily.set(key, used);
    if (used > dailyLimit()) {
      return "weak";
    }
    live.push(now);
    return "ok";
  }

  async function storeCheck(s: RateLimitStore, ip: string): Promise<ConsumeResult> {
    const now = clock();
    const key = ipKey(ip);
    await s.zremrangebyscore(key, 0, now - WINDOW_MS);
    if (toCount(await s.zcard(key)) >= IP_LIMIT) {
      return "veil";
    }
    if (toCount(await s.get(dayKey(now))) >= dailyLimit()) {
      return "weak";
    }
    return "ok";
  }

  async function storeConsume(s: RateLimitStore, ip: string): Promise<ConsumeResult> {
    const now = clock();
    const key = ipKey(ip);
    await s.zremrangebyscore(key, 0, now - WINDOW_MS);
    if (toCount(await s.zcard(key)) >= IP_LIMIT) {
      return "veil"; // daily counter untouched
    }
    const dKey = dayKey(now);
    const used = toCount(await s.incr(dKey));
    if (used === 1) {
      await s.expire(dKey, DAILY_TTL_SECONDS);
    }
    if (used > dailyLimit()) {
      return "weak";
    }
    seq += 1;
    await s.zadd(key, { score: now, member: `${now}:${seq}:${Math.random()}` });
    await s.expire(key, Math.ceil(WINDOW_MS / 1000));
    return "ok";
  }

  return {
    async check(ip) {
      if (store !== null) {
        try {
          return await storeCheck(store, ip);
        } catch {
          // fall through to the in-memory limiter
        }
      }
      return memCheck(ip);
    },
    async consume(ip) {
      if (store !== null) {
        try {
          return await storeConsume(store, ip);
        } catch {
          // fall through to the in-memory limiter
        }
      }
      return memConsume(ip);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Generic bucket limiter (graveyard-mcp route). Requirements 1.19-1.22 */
/* ------------------------------------------------------------------ */

export const GRAVEYARD_ROUTE_BUCKET = "graveyard-route";

export interface BucketConfig {
  bucket: string;
  limit: number;
  windowMs: number;
}

export type BucketVerdict = { ok: true } | { ok: false; retryAfter: number };

export interface BucketLimiter {
  consume(ip: string): Promise<BucketVerdict>;
}

/**
 * Independent sliding-window limiter on the sorted set
 * `ratelimit:<bucket>:<ip>`. Falls back to a per-process in-memory window when
 * the store is `null` or any store call throws.
 */
export function createBucketLimiter(
  store: RateLimitStore | null,
  clock: () => number,
  config: BucketConfig,
): BucketLimiter {
  const { bucket, limit, windowMs } = config;
  const mem = new Map<string, number[]>();
  let seq = 0;

  const denied: BucketVerdict = {
    ok: false,
    retryAfter: Math.max(1, Math.ceil(windowMs / limit / 1000)),
  };

  function memConsume(ip: string): BucketVerdict {
    const now = clock();
    const live = (mem.get(ip) ?? []).filter((t) => t > now - windowMs);
    if (live.length >= limit) {
      mem.set(ip, live);
      return denied;
    }
    live.push(now);
    mem.set(ip, live);
    return { ok: true };
  }

  async function storeConsume(s: RateLimitStore, ip: string): Promise<BucketVerdict> {
    const now = clock();
    const key = `ratelimit:${bucket}:${ip}`;
    await s.zremrangebyscore(key, 0, now - windowMs);
    if (toCount(await s.zcard(key)) >= limit) {
      return denied;
    }
    seq += 1;
    await s.zadd(key, { score: now, member: `${now}:${seq}:${Math.random()}` });
    await s.expire(key, Math.ceil(windowMs / 1000));
    return { ok: true };
  }

  return {
    async consume(ip) {
      if (store !== null) {
        try {
          return await storeConsume(store, ip);
        } catch {
          // fall through to the in-memory limiter
        }
      }
      return memConsume(ip);
    },
  };
}
