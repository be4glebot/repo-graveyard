/**
 * Example/unit tests for the Redis cache helpers (`lib/cache.ts`).
 *
 * These drive `cacheGet`, `cacheSet`, and `graveyardCacheKey` directly against
 * an injected fake `CacheClient`, covering the storage key/value/TTL contract
 * (Req 2.1) and the best-effort, never-throw behavior on a rejecting or hanging
 * client (Req 2.4). The hang case uses Vitest fake timers to trip the
 * `REDIS_TIMEOUT_MS` race without waiting in real time.
 *
 * Requirements: 2.1, 2.4
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GRAVEYARD_TTL_SECONDS,
  REDIS_TIMEOUT_MS,
  type CacheClient,
  type GraveyardData,
  cacheGet,
  cacheSet,
  graveyardCacheKey,
} from "@/lib/cache";
import type { RepoFacts } from "@/lib/lifecycle";

/** A minimal, schema-valid `RepoFacts` for assembling cache payloads. */
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
    languageColor: null,
    forkCount: 0,
    topics: [],
    ...overrides,
  };
}

/** A schema-valid `GraveyardData` payload. */
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

/** Builds a fake `CacheClient` whose `get`/`set` are `vi.fn()` spies. */
function makeFakeClient(
  impl: Partial<CacheClient> = {},
): {
  client: CacheClient;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn(impl.get ?? (async () => null));
  const set = vi.fn(impl.set ?? (async () => "OK"));
  return { client: { get, set }, get, set };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("graveyardCacheKey", () => {
  it("lowercases the username and prefixes it with graveyard:", () => {
    expect(graveyardCacheKey("OctoCat")).toBe("graveyard:octocat");
  });
});

describe("cacheSet stores raw facts with a 10-minute TTL (Req 2.1)", () => {
  it("calls set with the lowercased key, the GraveyardData value, and { ex: 600 }", async () => {
    const { client, set } = makeFakeClient();
    const key = graveyardCacheKey("OctoCat");
    const data = makeGraveyardData();

    await cacheSet(client, key, data);

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("graveyard:octocat", data, {
      ex: GRAVEYARD_TTL_SECONDS,
    });
    // The constant is the 10-minute TTL the requirement calls for.
    expect(GRAVEYARD_TTL_SECONDS).toBe(600);
  });

  it("swallows a rejecting set without throwing (best-effort)", async () => {
    const { client, set } = makeFakeClient({
      set: async () => {
        throw new Error("redis down");
      },
    });

    await expect(
      cacheSet(client, graveyardCacheKey("octocat"), makeGraveyardData()),
    ).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the client is null", async () => {
    await expect(
      cacheSet(null, graveyardCacheKey("octocat"), makeGraveyardData()),
    ).resolves.toBeUndefined();
  });
});

describe("cacheGet returns the stored data on a hit", () => {
  it("parses and returns a schema-valid payload", async () => {
    const data = makeGraveyardData();
    const { client, get } = makeFakeClient({ get: async () => data });

    const result = await cacheGet(client, graveyardCacheKey("octocat"));

    expect(result).toEqual(data);
    expect(get).toHaveBeenCalledWith("graveyard:octocat");
  });

  it("treats a null/undefined client return as a miss", async () => {
    const { client } = makeFakeClient({ get: async () => null });
    expect(await cacheGet(client, "graveyard:octocat")).toBeNull();
  });

  it("treats a schema-invalid payload as a miss", async () => {
    const { client } = makeFakeClient({
      get: async () => ({ repos: "not-an-array", totalCount: 1 }),
    });
    expect(await cacheGet(client, "graveyard:octocat")).toBeNull();
  });

  it("returns a miss when the client is null", async () => {
    expect(await cacheGet(null, "graveyard:octocat")).toBeNull();
  });
});

describe("cacheGet is best-effort on failure (Req 2.4)", () => {
  it("returns null (miss) when get rejects, without surfacing the error", async () => {
    const { client, get } = makeFakeClient({
      get: async () => {
        throw new Error("redis connection error");
      },
    });

    await expect(
      cacheGet(client, graveyardCacheKey("octocat")),
    ).resolves.toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("returns null (miss) when get hangs past REDIS_TIMEOUT_MS, via fake timers", async () => {
    vi.useFakeTimers();
    // A get that never resolves: only the timeout race can settle cacheGet.
    const { client } = makeFakeClient({
      get: () => new Promise<unknown>(() => {}),
    });

    const pending = cacheGet(client, graveyardCacheKey("octocat"));
    // Trip the REDIS_TIMEOUT_MS ceiling.
    await vi.advanceTimersByTimeAsync(REDIS_TIMEOUT_MS);

    await expect(pending).resolves.toBeNull();
    expect(REDIS_TIMEOUT_MS).toBe(2000);
  });
});
