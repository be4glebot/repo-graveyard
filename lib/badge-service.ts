/**
 * Badge service (server only): rate limit, validation, graveyard load,
 * classification (no overrides) and the "never break a README" error mapping.
 *
 * Every response is HTTP 200 with an SVG body. The function never throws.
 * Read-only against GitHub; nothing is written anywhere except the limiter's
 * own counters.
 *
 * Requirements: 1.1, 1.5, 1.8, 2.1, 2.5, 2.7, 4.1-4.4, 5.1-5.8, 6.5, 11.3-11.6
 */

import "server-only";

import {
  FALLBACK_NOT_FOUND,
  FALLBACK_UNAVAILABLE,
  buildBadge,
  MINIMAL_FALLBACK_SVG,
  isValidRepoName,
  parseBadgeStyle,
  type BadgeStyle,
} from "./badge";
import { repoMessage, repoTone, summaryMessage, summaryTone } from "./badge-messages";
import { loadGraveyard, type GraveyardData, type LoadError, type Result } from "./graveyard-loader";
import { buildGraveyardPayload } from "./graveyard-payload";
import {
  clientIp,
  createBucketLimiter,
  type BucketLimiter,
  type RateLimitStore,
} from "./ratelimit";
import { createUpstashRedis, createUpstashStore } from "./ratelimit-store";
import { isValidUsername } from "./username";

export interface BadgeServiceDeps {
  load?: (owner: string) => Promise<Result<GraveyardData, LoadError>>;
  makeLimiter?: () => Promise<BucketLimiter>;
  now?: () => number;
  limiterTimeoutMs?: number;
}

export const BADGE_BUCKET = "badge";
export const BADGE_LIMIT = 600;
export const BADGE_WINDOW_MS = 3_600_000;
export const SUCCESS_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400";
export const FALLBACK_CACHE_CONTROL = "public, s-maxage=300";
export const THROTTLED_CACHE_CONTROL = "no-store";

const BADGE_LABEL = "repo graveyard";
const DEFAULT_LIMITER_TIMEOUT_MS = 500;

/** Last resort if even building a fallback badge throws. */
const HARD_FALLBACK_SVG = MINIMAL_FALLBACK_SVG;

function svgResponse(body: string, cacheControl: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cacheControl,
    },
  });
}

function fallbackResponse(
  message: string,
  style: BadgeStyle,
  cacheControl: string = FALLBACK_CACHE_CONTROL,
): Response {
  let body: string;
  try {
    body = buildBadge({ label: BADGE_LABEL, message, tone: "fallback", style });
  } catch {
    body = HARD_FALLBACK_SVG;
  }
  return svgResponse(body, cacheControl);
}

/**
 * "unavailable" fallback for route files whose own setup (e.g. awaiting
 * `params`) failed. Never throws and never contains user text.
 */
export function unavailableBadgeResponse(request?: Request): Response {
  let style: BadgeStyle = "haunted";
  try {
    if (request) {
      style = parseBadgeStyle(new URL(request.url).searchParams.get("style"));
    }
  } catch {
    // keep default style
  }
  return fallbackResponse(FALLBACK_UNAVAILABLE, style);
}

/**
 * Default limiter: Upstash-backed (or in-memory when Redis is absent). If the
 * store throws, the verdict is discarded and the request is allowed (fail open).
 */
async function defaultMakeLimiter(now: () => number): Promise<BucketLimiter> {
  const redis = await createUpstashRedis();
  const base: RateLimitStore | null = redis ? createUpstashStore(redis) : null;
  let failed = false;
  const store: RateLimitStore | null = base
    ? {
        zadd: (k, e) => guard(() => base.zadd(k, e)),
        zremrangebyscore: (k, a, b) => guard(() => base.zremrangebyscore(k, a, b)),
        zcard: (k) => guard(() => base.zcard(k)),
        incr: (k) => guard(() => base.incr(k)),
        expire: (k, s) => guard(() => base.expire(k, s)),
        get: (k) => guard(() => base.get(k)),
      }
    : null;
  async function guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      failed = true;
      throw err;
    }
  }
  const inner = createBucketLimiter(store, now, {
    bucket: BADGE_BUCKET,
    limit: BADGE_LIMIT,
    windowMs: BADGE_WINDOW_MS,
  });
  return {
    async consume(ip) {
      const verdict = await inner.consume(ip);
      return failed ? { ok: true } : verdict;
    },
  };
}

/** True when the request is allowed. Timeout, throw or store failure all allow. */
async function allowed(
  request: Request,
  makeLimiter: () => Promise<BucketLimiter>,
  timeoutMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  const check = (async () => {
    try {
      const limiter = await makeLimiter();
      const verdict = await limiter.consume(
        clientIp(request.headers.get("x-forwarded-for")),
      );
      return verdict.ok;
    } catch {
      return true;
    }
  })();
  try {
    return await Promise.race([check, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function handleBadgeRequest(
  request: Request,
  owner: string,
  repo: string | null,
  deps?: BadgeServiceDeps,
): Promise<Response> {
  let style: BadgeStyle = "haunted";
  try {
    style = parseBadgeStyle(new URL(request.url).searchParams.get("style"));
    const now = deps?.now ?? Date.now;
    const load = deps?.load ?? ((o: string) => loadGraveyard(o));
    const makeLimiter = deps?.makeLimiter ?? (() => defaultMakeLimiter(now));

    // 1. Limiter first: every badge request counts.
    const ok = await allowed(
      request,
      makeLimiter,
      deps?.limiterTimeoutMs ?? DEFAULT_LIMITER_TIMEOUT_MS,
    );
    if (!ok) {
      return fallbackResponse(FALLBACK_UNAVAILABLE, style, THROTTLED_CACHE_CONTROL);
    }

    // 2. Validate names before touching the loader.
    if (!isValidUsername(owner) || (repo !== null && !isValidRepoName(repo))) {
      return fallbackResponse(FALLBACK_NOT_FOUND, style);
    }

    // 3. Load (cached by the loader) and map errors.
    const result = await load(owner);
    if (!result.ok) {
      const kind = result.error.kind;
      console.warn("[badge] load failed", { kind });
      return fallbackResponse(
        kind === "not-found" || kind === "invalid-username"
          ? FALLBACK_NOT_FOUND
          : FALLBACK_UNAVAILABLE,
        style,
      );
    }

    // 4. Classify with no overrides.
    const payload = buildGraveyardPayload(
      owner,
      result.value,
      new Date(now()).toISOString(),
    );

    let message: string;
    let tone: string;
    if (repo === null) {
      message = summaryMessage(payload.counts);
      tone = summaryTone(payload.counts);
    } else {
      const wanted = repo.toLowerCase();
      const entry = payload.repos.find((r) => r.name.toLowerCase() === wanted);
      if (!entry) return fallbackResponse(FALLBACK_NOT_FOUND, style);
      message = repoMessage(entry.state, entry.decay);
      tone = repoTone(entry.state);
    }

    return svgResponse(
      buildBadge({ label: BADGE_LABEL, message, tone, style }),
      SUCCESS_CACHE_CONTROL,
    );
  } catch {
    console.warn("[badge] unexpected error");
    return fallbackResponse(FALLBACK_UNAVAILABLE, style);
  }
}
