/**
 * Example/unit tests for the loader orchestration (`lib/graveyard-loader.ts`).
 *
 * These drive `loadGraveyard` with an injected fake `GraphqlTransport` and fake
 * `CacheClient`, covering the cache/fetch interplay:
 *
 * - 2.1: a successful miss+fetch stores the RAW facts under the lowercased key
 *   with `{ ex: 600 }`.
 * - 2.2: a cache HIT makes zero transport calls and returns the cached data.
 * - 2.3: a cache MISS fetches from GitHub then stores the result.
 * - 2.4: a cache `get` that rejects or hangs past `REDIS_TIMEOUT_MS` falls back
 *   to GitHub without surfacing a cache error. The hang path uses fake timers.
 * - 2.5: a Redis failure plus a GitHub failure returns the GitHub error.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGraveyard } from "@/lib/graveyard-loader";
import {
  GRAVEYARD_TTL_SECONDS,
  REDIS_TIMEOUT_MS,
  type CacheClient,
  type GraveyardData,
} from "@/lib/cache";
import {
  type GraphqlTransport,
  type GraveyardQueryResponse,
  type RawRepoNode,
  TransportError,
} from "@/lib/github";
import type { RepoFacts } from "@/lib/lifecycle";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A raw GraphQL repository node as `GRAVEYARD_QUERY` would return. */
function makeRawNode(overrides: Partial<RawRepoNode> = {}): RawRepoNode {
  return {
    name: "example",
    description: null,
    url: "https://github.com/octocat/example",
    pushedAt: "2023-01-01T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    issues: { totalCount: 0 },
    releases: { totalCount: 0 },
    readmeUpper: null,
    readmeLower: null,
    defaultBranchRef: null,
    ...overrides,
  };
}

/** The `RepoFacts` shape that `makeRawNode()` maps to. */
function makeRepoFacts(overrides: Partial<RepoFacts> = {}): RepoFacts {
  return {
    name: "example",
    description: null,
    url: "https://github.com/octocat/example",
    pushedAt: "2023-01-01T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: null,
    ...overrides,
  };
}

/** A schema-valid cached `GraveyardData`. */
function makeGraveyardData(
  overrides: Partial<GraveyardData> = {},
): GraveyardData {
  return {
    repos: [makeRepoFacts()],
    totalCount: 1,
    truncated: false,
    ...overrides,
  };
}

/**
 * A single-page fake transport returning the given nodes. Honors the shape of a
 * real `GRAVEYARD_QUERY` response (owner → repositories connection).
 */
function makeOkTransport(
  nodes: RawRepoNode[] = [makeRawNode()],
  totalCount = nodes.length,
): ReturnType<typeof vi.fn> & GraphqlTransport {
  const fn = vi.fn(async () => {
    const response: GraveyardQueryResponse = {
      repositoryOwner: {
        repositories: {
          totalCount,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes,
        },
      },
    };
    return { data: response as unknown };
  });
  return fn as unknown as ReturnType<typeof vi.fn> & GraphqlTransport;
}

/** A fake transport that always rejects with a 5xx `TransportError`. */
function makeServerErrorTransport(): ReturnType<typeof vi.fn> &
  GraphqlTransport {
  const fn = vi.fn(async () => {
    throw new TransportError("boom", { status: 503 });
  });
  return fn as unknown as ReturnType<typeof vi.fn> & GraphqlTransport;
}

/** Builds a fake `CacheClient` whose `get`/`set` are spies. */
function makeFakeCache(
  impl: Partial<CacheClient> = {},
): {
  cache: CacheClient;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn(impl.get ?? (async () => null));
  const set = vi.fn(impl.set ?? (async () => "OK"));
  return { cache: { get, set }, get, set };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 2.1 — store raw facts under the lowercased key with a 10-minute TTL
// ---------------------------------------------------------------------------

describe("loadGraveyard stores raw facts on a successful fetch (Req 2.1)", () => {
  it("writes the raw GraveyardData under graveyard:{lowercase} with { ex: 600 }", async () => {
    const transport = makeOkTransport();
    const { cache, set } = makeFakeCache();

    const result = await loadGraveyard("OctoCat", { transport, cache });

    expect(result.ok).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);

    const [key, value, opts] = set.mock.calls[0];
    expect(key).toBe("graveyard:octocat");
    // Value is the RAW facts payload, never classifications.
    expect(value).toEqual({
      repos: [makeRepoFacts()],
      totalCount: 1,
      truncated: false,
    });
    expect(opts).toEqual({ ex: GRAVEYARD_TTL_SECONDS });
  });
});

// ---------------------------------------------------------------------------
// 2.2 — a cache hit returns cached data and issues zero transport calls
// ---------------------------------------------------------------------------

describe("loadGraveyard returns cached data on a hit (Req 2.2)", () => {
  it("returns the cached data and makes zero transport calls", async () => {
    const cached = makeGraveyardData({ totalCount: 7, truncated: true });
    const transport = makeOkTransport();
    const { cache, get, set } = makeFakeCache({ get: async () => cached });

    const result = await loadGraveyard("OctoCat", { transport, cache });

    expect(result).toEqual({ ok: true, value: cached });
    expect(get).toHaveBeenCalledWith("graveyard:octocat");
    expect(transport).not.toHaveBeenCalled();
    // A hit must not re-write the cache either.
    expect(set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2.3 — a cache miss fetches from GitHub then stores the result
// ---------------------------------------------------------------------------

describe("loadGraveyard fetches then stores on a miss (Req 2.3)", () => {
  it("calls the transport on a miss and stores the fetched result", async () => {
    const transport = makeOkTransport([
      makeRawNode({ name: "alpha" }),
      makeRawNode({ name: "beta" }),
    ]);
    const { cache, get, set } = makeFakeCache({ get: async () => null });

    const result = await loadGraveyard("octocat", { transport, cache });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.repos.map((r) => r.name)).toEqual(["alpha", "beta"]);
    }
    expect(get).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(1);
    // Stores exactly what was fetched.
    expect(set).toHaveBeenCalledTimes(1);
    const [key, value] = set.mock.calls[0];
    expect(key).toBe("graveyard:octocat");
    expect(value).toEqual(result.ok ? result.value : undefined);
  });
});

// ---------------------------------------------------------------------------
// 2.4 — a failing/hanging cache get falls back to GitHub without an error
// ---------------------------------------------------------------------------

describe("loadGraveyard falls back to GitHub when the cache is unavailable (Req 2.4)", () => {
  it("fetches and succeeds when the cache get REJECTS (treated as a miss)", async () => {
    const transport = makeOkTransport();
    const { cache, set } = makeFakeCache({
      get: async () => {
        throw new Error("redis connection refused");
      },
    });

    const result = await loadGraveyard("octocat", { transport, cache });

    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    // Fetch succeeded, so the result is still written best-effort.
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("fetches and succeeds when the cache get HANGS past REDIS_TIMEOUT_MS (fake timers)", async () => {
    vi.useFakeTimers();
    const transport = makeOkTransport();
    // A get that never resolves: only the internal timeout race can settle it.
    const { cache } = makeFakeCache({
      get: () => new Promise<unknown>(() => {}),
    });

    const pending = loadGraveyard("octocat", { transport, cache });
    // Trip the REDIS_TIMEOUT_MS ceiling so cacheGet resolves to a miss.
    await vi.advanceTimersByTimeAsync(REDIS_TIMEOUT_MS);

    const result = await pending;

    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2.5 — Redis failure + GitHub failure returns the GitHub error
// ---------------------------------------------------------------------------

describe("loadGraveyard surfaces the GitHub error when cache and fetch both fail (Req 2.5)", () => {
  it("returns the GitHub server-error, not a cache error", async () => {
    const transport = makeServerErrorTransport();
    const { cache, set } = makeFakeCache({
      get: async () => {
        throw new Error("redis down");
      },
    });

    const result = await loadGraveyard("octocat", { transport, cache });

    // The GitHub error surfaces as a server-error (not a cache error), now
    // carrying a redacted diagnostic `detail` for logging. The token is never
    // part of that detail.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("server-error");
      if (result.error.kind === "server-error") {
        expect(result.error.detail).toContain("503");
        expect(result.error.detail).not.toContain("token");
      }
    }
    // The error is never cached.
    expect(set).not.toHaveBeenCalled();
  });
});
