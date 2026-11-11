/**
 * Unit tests for app/api/graveyard/[owner]/route.ts.
 *
 * The loader, GitHub transport, limiter and Redis are mocked; any `fetch`
 * attempt fails the test. Requirements 13.1-13.14.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadGraveyard: vi.fn(),
  createGithubTransport: vi.fn(),
  createBucketLimiter: vi.fn(),
  consume: vi.fn(),
  createUpstashRedis: vi.fn(),
  createUpstashStore: vi.fn(),
}));

vi.mock("@/lib/graveyard-loader", () => ({
  loadGraveyard: mocks.loadGraveyard,
}));
vi.mock("@/lib/github", () => ({
  createGithubTransport: mocks.createGithubTransport,
}));
vi.mock("@/lib/ratelimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ratelimit")>();
  return { ...actual, createBucketLimiter: mocks.createBucketLimiter };
});
vi.mock("@/lib/ratelimit-store", () => ({
  createUpstashRedis: mocks.createUpstashRedis,
  createUpstashStore: mocks.createUpstashStore,
}));

import { GET } from "@/app/api/graveyard/[owner]/route";
import type { GraveyardData } from "@/lib/github";
import type { RepoFacts } from "@/lib/lifecycle";

const MARKER = "MARKER-upstream-detail-do-not-leak-91c2";
const TRANSPORT = { name: "transport-sentinel" };
const CACHE = { name: "cache-sentinel" };
const STORE = { name: "store-sentinel" };

function repo(name: string, pushedAt: string | null): RepoFacts {
  return {
    name,
    description: null,
    url: `https://github.com/octo/${name}`,
    pushedAt,
    createdAt: "2020-01-01T00:00:00Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 3,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: null,
    languageColor: null,
    forkCount: 0,
    topics: [],
  };
}

function call(owner = "octo", headers: Record<string, string> = {}) {
  return GET(
    new Request(`http://localhost/api/graveyard/${owner}`, { headers }),
    { params: Promise.resolve({ owner }) },
  );
}

const SIX = ["decay", "html_url", "name", "pushedAt", "stars", "state"];

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network call attempted");
    }),
  );
  mocks.createUpstashRedis.mockResolvedValue(CACHE);
  mocks.createUpstashStore.mockReturnValue(STORE);
  mocks.createGithubTransport.mockReturnValue(TRANSPORT);
  mocks.consume.mockResolvedValue({ ok: true });
  mocks.createBucketLimiter.mockReturnValue({ consume: mocks.consume });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/graveyard/[owner] success", () => {
  it("returns the exact payload shape, ordering, counts and ISO dates", async () => {
    const data: GraveyardData = {
      repos: [
        repo("zeta", "2024-03-01T00:00:00Z"),
        repo("old", "2022-01-01T00:00:00Z"),
        repo("nodate", null),
        repo("beta", "2024-03-01T00:00:00Z"),
        repo("newest", "2024-06-01T12:00:00Z"),
      ],
      totalCount: 5,
      truncated: false,
    };
    mocks.loadGraveyard.mockResolvedValue({ ok: true, value: data });

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual([
      "counts",
      "owner",
      "repos",
      "truncated",
    ]);
    expect(body.owner).toBe("octo");
    expect(body.truncated).toBe(false);

    for (const entry of body.repos) {
      expect(Object.keys(entry).sort()).toEqual(SIX);
    }
    expect(body.repos.map((r: { name: string }) => r.name)).toEqual([
      "newest",
      "beta",
      "zeta",
      "old",
      "nodate",
    ]);

    const c = body.counts;
    expect(c.ghost + c.risen + c.zombie + c.tombstone + c.coffin).toBe(c.total);
    expect(c.total).toBe(body.repos.length);

    for (const entry of body.repos) {
      if (entry.name === "nodate") expect(entry.pushedAt).toBeNull();
      else {
        expect(entry.pushedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
        expect(Number.isNaN(Date.parse(entry.pushedAt))).toBe(false);
      }
    }
  });
});

describe("GET /api/graveyard/[owner] errors", () => {
  const cases: [string, unknown, number, unknown][] = [
    ["invalid-username", { kind: "invalid-username" }, 400, { error: "invalid-username" }],
    ["not-found", { kind: "not-found" }, 404, { error: "not-found" }],
    [
      "rate-limited without reset",
      { kind: "rate-limited", resetAt: null },
      429,
      { error: "rate-limited" },
    ],
    [
      "server-error",
      { kind: "server-error", detail: MARKER },
      502,
      { error: "server-error" },
    ],
  ];

  it.each(cases)("%s", async (name, error, status, body) => {
    mocks.loadGraveyard.mockResolvedValue({ ok: false, error });
    const res = await call();
    const text = await res.text();
    expect(res.status, name).toBe(status);
    expect(JSON.parse(text), name).toEqual(body);
    expect(res.headers.get("Cache-Control"), name).toBe("no-store");
    expect(text).not.toContain(MARKER);
    expect(JSON.stringify([...res.headers])).not.toContain(MARKER);
  });

  it("rate-limited without a reset time sends no Retry-After", async () => {
    mocks.loadGraveyard.mockResolvedValue({
      ok: false,
      error: { kind: "rate-limited", resetAt: null },
    });
    const res = await call();
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("rate-limited with a reset time sends an integer Retry-After >= 1", async () => {
    mocks.loadGraveyard.mockResolvedValue({
      ok: false,
      error: {
        kind: "rate-limited",
        resetAt: new Date(Date.now() + 90_000).toISOString(),
      },
    });
    const res = await call();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate-limited" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const ra = res.headers.get("Retry-After") as string;
    expect(ra).toMatch(/^\d+$/);
    expect(Number(ra)).toBeGreaterThanOrEqual(1);
  });

  it("a thrown error gives 502 without leaking its message", async () => {
    mocks.loadGraveyard.mockRejectedValue(new Error(MARKER));
    const res = await call();
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ error: "server-error" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(text).not.toContain(MARKER);
    expect(JSON.stringify([...res.headers])).not.toContain(MARKER);
  });
});

describe("GET /api/graveyard/[owner] limiter", () => {
  it("denied: 429, integer Retry-After >= 1, no-store, loader never called", async () => {
    mocks.consume.mockResolvedValue({ ok: false, retryAfter: 0.4 });
    const res = await call();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate-limited" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const ra = res.headers.get("Retry-After") as string;
    expect(ra).toMatch(/^\d+$/);
    expect(Number(ra)).toBeGreaterThanOrEqual(1);
    expect(mocks.loadGraveyard).toHaveBeenCalledTimes(0);
  });

  it("uses the dedicated bucket, 60 per hour and the client IP", async () => {
    mocks.loadGraveyard.mockResolvedValue({
      ok: true,
      value: { repos: [], totalCount: 0, truncated: false },
    });
    await call("octo", { "x-forwarded-for": "198.51.100.7, 10.0.0.1" });

    expect(mocks.createBucketLimiter).toHaveBeenCalledTimes(1);
    const [store, , config] = mocks.createBucketLimiter.mock.calls[0];
    expect(store).toBe(STORE);
    expect(config).toEqual({
      bucket: "graveyard-route",
      limit: 60,
      windowMs: 3_600_000,
    });
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    expect(mocks.consume).toHaveBeenCalledWith("198.51.100.7");
  });

  it("calls loadGraveyard once with the owner, transport and cache", async () => {
    mocks.loadGraveyard.mockResolvedValue({
      ok: true,
      value: { repos: [], totalCount: 0, truncated: false },
    });
    const res = await call("octo");
    expect(res.status).toBe(200);
    expect(mocks.loadGraveyard).toHaveBeenCalledTimes(1);
    expect(mocks.loadGraveyard).toHaveBeenCalledWith("octo", {
      transport: TRANSPORT,
      cache: CACHE,
    });
  });
});
