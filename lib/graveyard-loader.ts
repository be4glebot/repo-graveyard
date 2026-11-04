/**
 * Graveyard loader orchestration (server only).
 *
 * This is the single entry point the graveyard page calls to turn a raw
 * username into either a `GraveyardData` payload or a `LoadError`. It wires the
 * three lower layers together in a fixed order:
 *
 *   1. Validate the username (pure, `lib/username.ts`).
 *   2. Read the Redis cache (`lib/cache.ts`).
 *   3. On a miss, fetch from GitHub (`lib/github.ts`).
 *   4. On a successful fetch, write the cache best-effort.
 *
 * The result/error contract and the `GraveyardData` payload shape are owned by
 * `lib/github.ts` (the first producer of them), so this module imports and
 * re-exports them rather than redefining them. Keeping a single canonical
 * definition avoids duplicate, drifting types across the server layer.
 *
 * `loadGraveyard` takes an optional `deps` so tests can inject a fake transport
 * and cache client; the default wires the production GitHub transport and an
 * Upstash Redis client (or `null` when Redis is not configured).
 *
 * Requirements: 1.4, 2.2, 2.3, 2.5
 */

import "server-only";

import { isValidUsername, normalizeUsername } from "./username";
import {
  type CacheClient,
  cacheGet,
  cacheSet,
  graveyardCacheKey,
} from "./cache";
import {
  type GraphqlTransport,
  type GraveyardData,
  type LoadError,
  type Result,
  createGithubTransport,
  fetchRepos,
} from "./github";

// Re-export the shared contract so callers can import the loader's types from
// one place. These are the canonical definitions from `lib/github.ts`; the
// loader never redefines them.
export type { GraveyardData, LoadError, Result };

/**
 * The injectable dependencies for {@link loadGraveyard}. Both are optional so a
 * caller can override just the transport, just the cache, or neither. When a
 * field is omitted the production default is used (the real GitHub transport
 * and the Upstash cache client, which is `null` when Redis is not configured).
 */
export interface LoadGraveyardDeps {
  transport?: GraphqlTransport;
  cache?: CacheClient | null;
}

/**
 * Lazily builds the production Upstash cache client from env, or returns `null`
 * when the REST URL/token are not configured. `@upstash/redis` is imported
 * lazily so this server-only dependency is not pulled into the module graph of
 * callers that inject their own cache. A `null` client makes every cache
 * operation a guaranteed miss / no-op (see `lib/cache.ts`).
 */
async function defaultCacheClient(): Promise<CacheClient | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

/**
 * Loads the graveyard for `rawUsername`.
 *
 * Flow (Req 1.4, 2.2, 2.3, 2.5):
 * 1. Validate first. If the username is invalid, return `invalid-username`
 *    immediately — before constructing or touching any dependency, so an
 *    invalid username makes zero cache and zero transport calls.
 * 2. Normalize the username and compute the cache key.
 * 3. Read the cache. On a hit, return the cached `GraveyardData` as success
 *    (zero transport calls).
 * 4. On a miss, fetch from GitHub.
 * 5. On fetch success, write the cache best-effort (never throws, never blocks
 *    the result) and return success.
 * 6. On fetch error, return that error as-is. A Redis outage (cache miss) plus
 *    a failed GitHub fetch surfaces the GitHub error. Errors are never cached.
 */
export async function loadGraveyard(
  rawUsername: string,
  deps?: LoadGraveyardDeps,
): Promise<Result<GraveyardData, LoadError>> {
  // 1. Validate before touching any dependency.
  if (!isValidUsername(rawUsername)) {
    return { ok: false, error: { kind: "invalid-username" } };
  }

  // Resolve dependencies only after validation has passed.
  const transport = deps?.transport ?? createGithubTransport();
  const cache =
    deps?.cache !== undefined ? deps.cache : await defaultCacheClient();

  // 2. Normalize + compute the cache key.
  const login = normalizeUsername(rawUsername);
  const key = graveyardCacheKey(login);

  // 3. Cache read. A hit short-circuits the fetch.
  const cached = await cacheGet(cache, key);
  if (cached !== null) {
    return { ok: true, value: cached };
  }

  // 4. Cache miss → fetch from GitHub.
  const fetched = await fetchRepos(login, transport);

  // 6. On error, surface it as-is. Never cache an error. Server-errors are
  // logged here (kind + redacted status/GraphQL message, never the token) so a
  // gateway timeout or upstream failure is not silent in production logs.
  if (!fetched.ok) {
    if (fetched.error.kind === "server-error") {
      console.error(
        `[graveyard-loader] server-error loading "${login}": ${fetched.error.detail ?? "no detail"}`,
      );
    }
    return fetched;
  }

  // 5. On success, write the cache best-effort then return.
  await cacheSet(cache, key, fetched.value);
  return fetched;
}
