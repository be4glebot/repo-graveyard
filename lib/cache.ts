/**
 * Server-only Redis cache helpers for the graveyard loader.
 *
 * The cache stores only the *raw* data shape for a user's graveyard
 * (`RepoFacts[]` + `totalCount` + `truncated`) and never classifications:
 * classification depends on `now` and on client-side overrides, so caching
 * classified output would go stale and could not honor overrides
 * (Requirement 2.1).
 *
 * Every operation is best-effort and non-fatal (Requirement 2.4): both `get`
 * and `set` race a `REDIS_TIMEOUT_MS` ceiling, catch every error, and never
 * throw. A `get` failure, timeout, or a payload that fails schema validation is
 * treated as a cache miss (`null`); a `set` failure is swallowed silently.
 *
 * This module depends only on the injectable `CacheClient` interface, never on
 * a concrete Redis client, so the loader can be tested with fakes.
 *
 * Requirements: 2.1, 2.4
 */

import "server-only";
import { z } from "zod";
import { normalizeUsername } from "./username";
import type { RepoFacts } from "./lifecycle";
import { seanceResultSchema, type SeanceResult } from "./seance-schema";

/** Cache time-to-live, in seconds (10 minutes). */
export const GRAVEYARD_TTL_SECONDS = 600;

/** Maximum time, in milliseconds, either cache operation may take. */
export const REDIS_TIMEOUT_MS = 2000;

/**
 * The raw, cache-safe data shape for a user's graveyard: the fetched facts plus
 * the connection-level total and whether the result was truncated. This is the
 * only thing ever written to the cache — never `Classification`s.
 *
 * (Also used as the success payload of the loader's `Result`.)
 */
export interface GraveyardData {
  repos: RepoFacts[];
  totalCount: number;
  truncated: boolean;
}

/**
 * The minimal get/set surface the cache helpers need. Modeled on the
 * `@upstash/redis` client: `get` returns the decoded value (or `null` on a
 * miss) and `set` accepts a `{ ex }` TTL option in seconds. Kept intentionally
 * small and injectable so the loader can run against a fake in tests.
 */
export interface CacheClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
}

/** Builds the case-insensitive cache key for a username: `graveyard:{lowercased}`. */
export function graveyardCacheKey(username: string): string {
  return `graveyard:${normalizeUsername(username)}`;
}

/**
 * zod schema mirroring `RepoFacts`. A cached payload that does not match this
 * shape (an older format, a partial write, or corrupted JSON) is treated as a
 * miss so stale shapes can never flow into classification.
 */
const repoFactsSchema: z.ZodType<RepoFacts> = z.object({
  name: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  pushedAt: z.string().nullable(),
  createdAt: z.string(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
  homepageUrl: z.string().nullable(),
  stargazerCount: z.number(),
  primaryLanguage: z.string().nullable(),
  languageColor: z.string().nullable(),
  forkCount: z.number().int().nonnegative(),
  topics: z.array(z.string()).max(5),
  openIssueCount: z.number(),
  releaseCount: z.number(),
  readmeBytes: z.number().nullable(),
  lastCommitMessage: z.string().nullable(),
});

/** zod schema for the cached `GraveyardData` payload. */
const graveyardDataSchema: z.ZodType<GraveyardData> = z.object({
  repos: z.array(repoFactsSchema),
  totalCount: z.number(),
  truncated: z.boolean(),
});

/**
 * Rejects after `REDIS_TIMEOUT_MS`, used to race against a cache operation that
 * hangs. The caller catches the rejection and treats it as a miss / swallows
 * it, so the exact error value never surfaces.
 */
function timeout(): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error("redis timeout")), REDIS_TIMEOUT_MS);
  });
}

/**
 * Reads a cached `GraveyardData` for `key`, returning `null` on a miss, a
 * client error, a timeout past `REDIS_TIMEOUT_MS`, or a payload that fails
 * schema validation. Never throws. A `null` client (Redis not configured) is a
 * guaranteed miss.
 */
export async function cacheGet(
  client: CacheClient | null,
  key: string,
): Promise<GraveyardData | null> {
  if (client === null) {
    return null;
  }
  try {
    const raw = await Promise.race([client.get(key), timeout()]);
    if (raw === null || raw === undefined) {
      return null;
    }
    const parsed = graveyardDataSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Writes `data` to the cache under `key` with a `GRAVEYARD_TTL_SECONDS` TTL,
 * racing a `REDIS_TIMEOUT_MS` ceiling. Best-effort: any error, timeout, or a
 * `null` client is swallowed and the function resolves normally. Never throws.
 */
export async function cacheSet(
  client: CacheClient | null,
  key: string,
  data: GraveyardData,
): Promise<void> {
  if (client === null) {
    return;
  }
  try {
    await Promise.race([
      client.set(key, data, { ex: GRAVEYARD_TTL_SECONDS }),
      timeout(),
    ]);
  } catch {
    // Best effort: a cache write failure must never break the request.
  }
}

/* ------------------------------------------------------------------ */
/* Séance result cache (Requirements 7.1, 7.3-7.8, 7.10-7.12)          */
/* ------------------------------------------------------------------ */

/** Séance cache time-to-live, in seconds (24 hours). */
export const SEANCE_TTL_SECONDS = 86_400;

/**
 * Builds the séance cache key. Keyed on the repo's last activity
 * (`pushedAt`, falling back to `createdAt`) so a new push invalidates it.
 */
export function seanceCacheKey(
  owner: string,
  repo: string,
  pushedAt: string | null,
  createdAt: string,
  state?: string,
  decayLevel?: number | null,
): string {
  const decay = typeof decayLevel === "number" ? `:d${decayLevel}` : "";
  return `seance:v6:${owner.toLowerCase()}/${repo.toLowerCase()}:${pushedAt ?? createdAt}${state ? `:${state}` : ""}${decay}`;
}

/**
 * Reads a cached séance result. Errors, timeouts, and payloads failing
 * `seanceResultSchema` are misses (`null`). A `null` client is always a miss.
 * Never throws.
 */
export async function seanceCacheGet(
  client: CacheClient | null,
  key: string,
): Promise<SeanceResult | null> {
  if (client === null) {
    return null;
  }
  try {
    const raw = await Promise.race([client.get(key), timeout()]);
    if (raw === null || raw === undefined) {
      return null;
    }
    const parsed = seanceResultSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Writes a séance result with `SEANCE_TTL_SECONDS`. Best effort: failures,
 * timeouts, and a `null` client are swallowed. Never throws.
 */
export async function seanceCacheSet(
  client: CacheClient | null,
  key: string,
  result: SeanceResult,
): Promise<void> {
  if (client === null) {
    return;
  }
  try {
    await Promise.race([
      client.set(key, result, { ex: SEANCE_TTL_SECONDS }),
      timeout(),
    ]);
  } catch {
    // Best effort: a cache write failure must never break the request.
  }
}
