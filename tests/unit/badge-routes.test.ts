// Route tests for the badge endpoints (graveyard-badges task 6.3).
// Loader and limiter are mocked; the real service, builder and classifier run.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkXml } from "../helpers/xml";
import type { GraveyardData } from "@/lib/github";
import type { RepoFacts } from "@/lib/lifecycle";

vi.mock("@/lib/graveyard-loader", () => ({ loadGraveyard: vi.fn() }));
vi.mock("@/lib/ratelimit-store", () => ({
  createUpstashRedis: vi.fn(async () => ({})),
  createUpstashStore: vi.fn(() => ({})),
}));
vi.mock("@/lib/ratelimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ratelimit")>();
  return { ...actual, createBucketLimiter: vi.fn(actual.createBucketLimiter) };
});

import { loadGraveyard } from "@/lib/graveyard-loader";
import * as ratelimit from "@/lib/ratelimit";
import { GET as getSummary } from "@/app/api/badge/[owner]/route";
import { GET as getRepo } from "@/app/api/badge/[owner]/[repo]/route";

const SEP = " \u00B7 ";
const GREY = "#8d897b";
const SUCCESS_CC = "public, s-maxage=3600, stale-while-revalidate=86400";
const CT = "image/svg+xml; charset=utf-8";

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

function repo(name: string, over: Partial<RepoFacts>): RepoFacts {
  return {
    name,
    description: null,
    url: `https://github.com/octo/${name}`,
    pushedAt: iso(2),
    createdAt: iso(900),
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: 5000,
    lastCommitMessage: "tidy",
    languageColor: null,
    forkCount: 0,
    topics: [],
    ...over,
  };
}

const FIXTURE: GraveyardData = {
  totalCount: 4,
  truncated: false,
  repos: [
    repo("alive", { pushedAt: iso(2) }),
    repo("rotter", { pushedAt: iso(200), readmeBytes: null }),
    repo("done", {
      pushedAt: iso(400),
      releaseCount: 2,
      homepageUrl: "https://done.example",
    }),
    repo("gone", { pushedAt: iso(400), isArchived: true, readmeBytes: null }),
  ],
};

const loadMock = vi.mocked(loadGraveyard);
const createBucketLimiterMock = vi.mocked(ratelimit.createBucketLimiter);
const actualCreate = createBucketLimiterMock.getMockImplementation()!;

function req(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${path}`, { headers });
}
const callSummary = (owner: string, q = "") =>
  getSummary(req(`/api/badge/${owner}${q}`), { params: Promise.resolve({ owner }) });
const callRepo = (owner: string, name: string, q = "") =>
  getRepo(req(`/api/badge/${owner}/${name}${q}`), {
    params: Promise.resolve({ owner, repo: name }),
  });

function title(svg: string): string {
  return /<title>([\s\S]*?)<\/title>/.exec(svg)?.[1] ?? "";
}

async function expectBadge(
  res: Response,
  opts: { message: string; cache: string; fill?: string },
) {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe(CT);
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(res.headers.get("Cache-Control")).toBe(opts.cache);
  const svg = await res.text();
  expect(checkXml(svg)).toEqual({ ok: true });
  const t = title(svg);
  expect(t).toContain("repo graveyard");
  expect(t).toContain(opts.message);
  if (opts.fill) expect(svg).toContain(opts.fill);
  return svg;
}

beforeEach(() => {
  loadMock.mockReset();
  loadMock.mockResolvedValue({ ok: true, value: FIXTURE });
  createBucketLimiterMock.mockReset();
  createBucketLimiterMock.mockImplementation(actualCreate);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("success badges", () => {
  const SUMMARY = ["1 ghost", "1 zombie", "1 at rest", "1 sealed"].join(SEP);

  it("summary badge, haunted and flat", async () => {
    const haunted = await expectBadge(await callSummary("octo"), {
      message: SUMMARY,
      cache: SUCCESS_CC,
    });
    const flat = await expectBadge(await callSummary("octo", "?style=flat"), {
      message: SUMMARY,
      cache: SUCCESS_CC,
    });
    expect(flat).not.toBe(haunted);
  });

  it("repo badge, haunted and flat", async () => {
    const haunted = await expectBadge(await callRepo("octo", "alive"), {
      message: `ghost${SEP}healthy`,
      cache: SUCCESS_CC,
    });
    const flat = await expectBadge(await callRepo("octo", "alive", "?style=flat"), {
      message: `ghost${SEP}healthy`,
      cache: SUCCESS_CC,
    });
    expect(flat).not.toBe(haunted);
    await expectBadge(await callRepo("octo", "rotter"), {
      message: `zombie${SEP}rotting`,
      cache: SUCCESS_CC,
    });
    await expectBadge(await callRepo("octo", "done"), {
      message: "at rest",
      cache: SUCCESS_CC,
    });
    await expectBadge(await callRepo("octo", "gone"), {
      message: "sealed",
      cache: SUCCESS_CC,
    });
  });

  it("matches the repo name case-insensitively", async () => {
    await expectBadge(await callRepo("octo", "ALIVE"), {
      message: `ghost${SEP}healthy`,
      cache: SUCCESS_CC,
    });
  });

  it("invalid style values give a valid haunted badge", async () => {
    const base = await (await callSummary("octo")).text();
    for (const style of ["", "FLAT", "x".repeat(33)]) {
      const res = await callSummary("octo", `?style=${style}`);
      const svg = await expectBadge(res, { message: "1 ghost", cache: SUCCESS_CC });
      expect(svg).toBe(base);
    }
  });
});

describe("error and fallback cases", () => {
  const FALLBACK_CC = "public, s-maxage=300";

  type Case = {
    name: string;
    message: string;
    setup: () => void;
    summary?: () => Promise<Response>;
    repo?: () => Promise<Response>;
  };

  const cases: Case[] = [
    {
      name: "unknown user",
      message: "not found",
      setup: () => loadMock.mockResolvedValue({ ok: false, error: { kind: "not-found" } }),
      summary: () => callSummary("ghosty"),
      repo: () => callRepo("ghosty", "alive"),
    },
    {
      name: "unknown repo",
      message: "not found",
      setup: () => {},
      repo: () => callRepo("octo", "missing"),
    },
    {
      name: "invalid name",
      message: "not found",
      setup: () => {},
      summary: () => callSummary("-bad-"),
      repo: () => callRepo("octo", "bad name!"),
    },
    {
      name: "loader rate-limited",
      message: "unavailable",
      setup: () =>
        loadMock.mockResolvedValue({
          ok: false,
          error: { kind: "rate-limited", resetAt: null },
        }),
      summary: () => callSummary("octo"),
      repo: () => callRepo("octo", "alive"),
    },
    {
      name: "loader failure",
      message: "unavailable",
      setup: () => loadMock.mockRejectedValue(new Error("boom")),
      summary: () => callSummary("octo"),
      repo: () => callRepo("octo", "alive"),
    },
  ];

  for (const c of cases) {
    for (const kind of ["summary", "repo"] as const) {
      const call = c[kind];
      if (!call) continue;
      it(`${c.name} (${kind})`, async () => {
        c.setup();
        const res = await call();
        const svg = await expectBadge(res, { message: c.message, cache: FALLBACK_CC, fill: GREY });
        expect(svg).not.toContain("ghosty");
        expect(svg).not.toContain("bad name");
      });
    }
  }

  it("invalid names never call the loader", async () => {
    await callSummary("-bad-");
    await callRepo("octo", "bad name!");
    await callRepo("octo", "x".repeat(101));
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("every fallback carries content type and nosniff (also with flat style)", async () => {
    loadMock.mockResolvedValue({ ok: false, error: { kind: "server-error" } });
    await expectBadge(await callRepo("octo", "alive", "?style=flat"), {
      message: "unavailable",
      cache: FALLBACK_CC,
      fill: GREY,
    });
  });
});

describe("limiter", () => {
  it("rejection gives an uncached unavailable badge; a later request is cacheable", async () => {
    createBucketLimiterMock.mockImplementationOnce(() => ({
      consume: async () => ({ ok: false as const, retryAfter: 30 }),
    }));
    const res = await callSummary("octo");
    const svg = await expectBadge(res, { message: "unavailable", cache: "no-store", fill: GREY });
    expect(res.headers.get("Cache-Control")).not.toContain("s-maxage");
    expect(svg).not.toContain("octo");
    expect(loadMock).not.toHaveBeenCalled();

    await expectBadge(await callSummary("octo"), {
      message: "1 ghost",
      cache: SUCCESS_CC,
    });
  });

  it("rejection also applies to the repo route", async () => {
    createBucketLimiterMock.mockImplementationOnce(() => ({
      consume: async () => ({ ok: false as const, retryAfter: 30 }),
    }));
    await expectBadge(await callRepo("octo", "alive"), {
      message: "unavailable",
      cache: "no-store",
    });
  });

  it("is configured as bucket badge, 600 per hour, keyed by client IP", async () => {
    const ips: string[] = [];
    createBucketLimiterMock.mockImplementationOnce((store, clock, cfg) => {
      const inner = actualCreate(store, clock, cfg);
      return {
        consume: async (ip: string) => {
          ips.push(ip);
          return inner.consume(ip);
        },
      };
    });
    await getSummary(req("/api/badge/octo", { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), {
      params: Promise.resolve({ owner: "octo" }),
    });
    expect(createBucketLimiterMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      { bucket: "badge", limit: 600, windowMs: 3_600_000 },
    );
    expect(ips).toEqual(["203.0.113.7"]);
  });

  describe("fails open", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    it("when the store throws", async () => {
      createBucketLimiterMock.mockImplementationOnce((store) => ({
        consume: async () => {
          try {
            await store!.zcard("k");
          } catch {
            // the service's wrapper has flagged the failure
          }
          return { ok: false as const, retryAfter: 5 };
        },
      }));
      // Make the underlying store throw by replacing the mocked adapter output.
      const storeMod = await import("@/lib/ratelimit-store");
      vi.mocked(storeMod.createUpstashStore).mockReturnValueOnce({
        zcard: () => Promise.reject(new Error("redis down")),
      } as never);
      await expectBadge(await callSummary("octo"), {
        message: "1 ghost",
        cache: SUCCESS_CC,
      });
    });

    it("when consume never resolves (500 ms timeout)", async () => {
      createBucketLimiterMock.mockImplementationOnce(() => ({
        consume: () => new Promise(() => {}),
      }));
      const pending = callSummary("octo");
      await vi.advanceTimersByTimeAsync(500);
      await expectBadge(await pending, { message: "1 ghost", cache: SUCCESS_CC });
    });

    it("honours a verdict that arrives at 499 ms", async () => {
      createBucketLimiterMock.mockImplementationOnce(() => ({
        consume: () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: false, retryAfter: 1 }), 499),
          ),
      }));
      const pending = callSummary("octo");
      await vi.advanceTimersByTimeAsync(499);
      await expectBadge(await pending, { message: "unavailable", cache: "no-store" });
    });
  });
});

describe("route files", () => {
  const root = process.cwd();
  const files = [
    "app/api/badge/[owner]/route.ts",
    "app/api/badge/[owner]/[repo]/route.ts",
  ];

  for (const f of files) {
    it(`${f} exports only GET, no segment config, awaits ctx.params`, () => {
      const src = readFileSync(join(root, f), "utf8");
      const exports = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/gm)].map(
        (m) => m[1],
      );
      expect(exports).toEqual(["GET"]);
      expect(src).not.toMatch(/^export\s*\{/m);
      expect(src).not.toMatch(/export\s+(const|let)\s+(dynamic|revalidate|runtime|maxDuration|fetchCache|preferredRegion|dynamicParams)/);
      expect(src).toMatch(/await\s+ctx\.params/);
    });
  }

  it("a rejected params promise still yields the unavailable fallback", async () => {
    const params = Promise.reject(new Error("bad"));
    params.catch(() => {});
    await expectBadge(await getSummary(req("/api/badge/x"), { params }), {
      message: "unavailable",
      cache: "public, s-maxage=300",
      fill: GREY,
    });
  });
});
