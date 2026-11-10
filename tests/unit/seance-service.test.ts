/**
 * Unit tests for `runSeance` in `lib/seance-service.ts`.
 * Every dependency is an injected fake; no real network, cache or LLM.
 *
 * Requirements: 4.11, 4.12, 4.18, 7.8, 7.9, 8.3, 8.4, 8.10, 19.5, 19.8,
 * 20.3, 20.4, 20.8, 20.9, 20.24, 20.27, 20.28, 20.32
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { CacheClient } from "@/lib/cache";
import type { RepoFacts } from "@/lib/lifecycle";
import { parseDailyLimit, type ConsumeResult } from "@/lib/ratelimit";
import { runSeance, type SeanceDeps } from "@/lib/seance-service";

const SECRET = "SENTINEL-README-TEXT-xyz";

const baseFacts: RepoFacts = {
  name: "Crypt-Keeper",
  description: null,
  url: "https://github.com/ada/crypt-keeper",
  pushedAt: "2025-01-10T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 3,
  primaryLanguage: "TypeScript",
  openIssueCount: 1,
  releaseCount: 0,
  readmeBytes: 200,
  lastCommitMessage: "wip oauth callback",
  languageColor: null,
  forkCount: 0,
  topics: [],
};

const VALID = JSON.stringify({
  voice: "I was left in the middle of a login. The callback still needs care.",
  causeOfDeath: "Killed by an unfinished oauth callback.",
  unfinishedBusiness: [
    { title: "Callback", detail: "The oauth callback is broken.", evidence: "last commit: wip oauth callback" },
    { title: "Issues", detail: "One issue is still open.", evidence: "open issues: 1" },
  ],
  verdict: "revive",
  verdictReason: "The idea is still worth finishing.",
});
const INVALID = "this is not json";

interface Harness {
  deps: SeanceDeps;
  facts: RepoFacts;
  calls: { llm: number; fetch: number; check: number; consume: number; load: number; cacheGet: number; cacheSet: number };
  logs: Array<{ repo: string; reason: string }>;
  store: Map<string, unknown>;
}

function harness(opts: {
  outputs?: Array<string | "hang">;
  llm?: "none";
  checkResult?: ConsumeResult;
  fetch?: "hang";
  load?: "hang" | "missing" | "error";
  preload?: boolean;
} = {}): Harness {
  const facts = { ...baseFacts };
  const calls = { llm: 0, fetch: 0, check: 0, consume: 0, load: 0, cacheGet: 0, cacheSet: 0 };
  const logs: Array<{ repo: string; reason: string }> = [];
  const store = new Map<string, unknown>();
  const outputs = opts.outputs ?? [VALID];
  const cache: CacheClient = {
    async get(key) {
      calls.cacheGet++;
      return store.get(key) ?? null;
    },
    async set(key, value) {
      calls.cacheSet++;
      store.set(key, value);
    },
  };
  const deps: SeanceDeps = {
    loadGraveyard: async () => {
      calls.load++;
      if (opts.load === "hang") return new Promise(() => {});
      if (opts.load === "error") return { ok: false, error: { kind: "not-found" } } as never;
      const repos = opts.load === "missing" ? [{ ...facts, name: "other" }] : [facts];
      return { ok: true, value: { repos, totalCount: repos.length, truncated: false } };
    },
    fetchEvidence: async () => {
      calls.fetch++;
      if (opts.fetch === "hang") return new Promise(() => {});
      return { readme: `# Readme\n${SECRET}`, commits: ["wip oauth callback"] };
    },
    llm:
      opts.llm === "none"
        ? null
        : {
            complete: async () => {
              const out = outputs[Math.min(calls.llm, outputs.length - 1)];
              calls.llm++;
              if (out === "hang") return new Promise<string>(() => {});
              return out;
            },
          },
    cache,
    limiter: {
      check: async () => {
        calls.check++;
        return opts.checkResult ?? "ok";
      },
      consume: async () => {
        calls.consume++;
        return "ok";
      },
    },
    log: (e) => logs.push(e),
  };
  return { deps, facts, calls, logs, store };
}

const req = { owner: "ada", repo: "crypt-keeper", ip: "1.2.3.4" };

afterEach(() => {
  vi.useRealTimers();
});

describe("retry (20.3, 20.4, 8.10)", () => {
  it("invalid then valid makes exactly 2 calls and returns ok", async () => {
    const h = harness({ outputs: [INVALID, VALID] });
    const out = await runSeance(req, h.deps);
    expect(out.kind).toBe("ok");
    expect(h.calls.llm).toBe(2);
    expect(h.calls.consume).toBe(2);
  });

  it("both invalid is silent after exactly 2 calls, nothing cached", async () => {
    const h = harness({ outputs: [INVALID] });
    expect(await runSeance(req, h.deps)).toEqual({ kind: "silent" });
    expect(h.calls.llm).toBe(2);
    expect(h.calls.consume).toBe(2);
    expect(h.calls.cacheSet).toBe(0);
  });

  it("an ungrounded evidence reference counts as invalid", async () => {
    const bad = JSON.stringify({
      ...JSON.parse(VALID),
      unfinishedBusiness: [
        { title: "A", detail: "Made up.", evidence: "commit abc1234 never happened" },
        { title: "B", detail: "Made up too.", evidence: "open issues: 1" },
      ],
    });
    const h = harness({ outputs: [bad] });
    expect(await runSeance(req, h.deps)).toEqual({ kind: "silent" });
    expect(h.calls.llm).toBe(2);
  });
});

describe("cache and limits (20.8, 20.9, 20.24, 20.32, 7.8, 7.9)", () => {
  it("cache hit makes 0 LLM, GitHub-evidence and limiter calls, even for a blocked IP", async () => {
    const h = harness();
    await runSeance(req, h.deps);
    const before = { ...h.calls };
    const blocked = { ...h.deps, limiter: { check: vi.fn(async () => "veil" as const), consume: vi.fn(async () => "veil" as const) } };
    const out = await runSeance(req, blocked);
    expect(out.kind).toBe("ok");
    expect(h.calls.llm).toBe(before.llm);
    expect(h.calls.fetch).toBe(before.fetch);
    expect(blocked.limiter.check).not.toHaveBeenCalled();
    expect(blocked.limiter.consume).not.toHaveBeenCalled();
  });

  it.each(["veil", "weak"] as const)("blocked IP on a miss gets %s with 0 fetch and 0 LLM calls", async (kind) => {
    const h = harness({ checkResult: kind });
    expect(await runSeance(req, h.deps)).toEqual({ kind });
    expect(h.calls.fetch).toBe(0);
    expect(h.calls.llm).toBe(0);
    expect(h.calls.consume).toBe(0);
  });

  it("second request with the same key costs nothing; a changed server pushedAt costs exactly 1 call", async () => {
    const h = harness();
    await runSeance(req, h.deps);
    expect(h.calls.llm).toBe(1);
    await runSeance(req, h.deps);
    expect(h.calls.llm).toBe(1);
    h.facts.pushedAt = "2025-02-01T00:00:00Z";
    await runSeance(req, h.deps);
    expect(h.calls.llm).toBe(2);
    expect(h.calls.fetch).toBe(2);
  });

  it("a client-sent pushedAt changes nothing", async () => {
    const h = harness();
    await runSeance(req, h.deps);
    const keys = [...h.store.keys()];
    const out = await runSeance({ ...req, pushedAt: "1999-01-01T00:00:00Z" } as typeof req, h.deps);
    expect(out.kind).toBe("ok");
    expect(h.calls.llm).toBe(1);
    expect([...h.store.keys()]).toEqual(keys);
  });

  it("looks the repo up case-insensitively", async () => {
    const h = harness();
    const out = await runSeance({ ...req, repo: "CRYPT-KEEPER" }, h.deps);
    expect(out.kind).toBe("ok");
  });
});

describe("fallbacks (19.5, 19.8)", () => {
  it("missing key is silent with no LLM call", async () => {
    const h = harness({ llm: "none" });
    expect(await runSeance(req, h.deps)).toEqual({ kind: "silent" });
    expect(h.calls.llm).toBe(0);
    expect(h.logs).toEqual([{ repo: "crypt-keeper", reason: "no-llm" }]);
  });

  it("missing repo and failed graveyard load equal the other silent fallbacks", async () => {
    const silentFromKey = await runSeance(req, harness({ llm: "none" }).deps);
    for (const load of ["missing", "error"] as const) {
      const h = harness({ load });
      const out = await runSeance(req, h.deps);
      expect(out).toEqual(silentFromKey);
      expect(JSON.stringify(out)).toBe(JSON.stringify(silentFromKey));
      expect(h.calls.fetch).toBe(0);
      expect(h.calls.llm).toBe(0);
      expect(h.calls.check).toBe(0);
    }
  });

  it("log entries hold only repo and a reason code", async () => {
    const h = harness({ outputs: [INVALID] });
    await runSeance(req, h.deps);
    expect(h.logs.length).toBeGreaterThan(0);
    for (const e of h.logs) {
      expect(Object.keys(e).sort()).toEqual(["reason", "repo"]);
      expect(e.reason).toMatch(/^[a-z-]+$/);
    }
    expect(JSON.stringify(h.logs)).not.toContain(SECRET);
    expect(JSON.stringify(h.logs)).not.toContain("1.2.3.4");
  });
});

describe("LLM_DAILY_LIMIT parsing (20.28)", () => {
  it.each([undefined, "", "-5", "abc", "1.5", " 7"])("%j yields 200", (raw) => {
    expect(parseDailyLimit(raw)).toBe(200);
  });
  it("accepts a plain integer", () => {
    expect(parseDailyLimit("42")).toBe(42);
  });
});

describe("timeouts (20.27)", () => {
  it("abandons GitHub at 5 s and still produces a result", async () => {
    vi.useFakeTimers();
    const h = harness({ fetch: "hang" });
    const p = runSeance(req, h.deps);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(h.calls.llm).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect((await p).kind).toBe("ok");
    expect(h.calls.llm).toBe(1);
  });

  it("abandons each LLM call at 8 s", async () => {
    vi.useFakeTimers();
    const h = harness({ outputs: ["hang"] });
    const p = runSeance(req, h.deps);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(h.calls.llm).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.calls.llm).toBe(2);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await p).toEqual({ kind: "silent" });
    expect(h.calls.llm).toBe(2);
    expect(h.calls.cacheSet).toBe(0);
  });

  it("a timed-out first call can be followed by a valid second", async () => {
    vi.useFakeTimers();
    const h = harness({ outputs: ["hang", VALID] });
    const p = runSeance(req, h.deps);
    await vi.advanceTimersByTimeAsync(8_000);
    expect((await p).kind).toBe("ok");
    expect(h.calls.llm).toBe(2);
  });

  it("the whole request is silent at 25 s with no cache write", async () => {
    vi.useFakeTimers();
    const h = harness({ load: "hang" });
    const p = runSeance(req, h.deps);
    await vi.advanceTimersByTimeAsync(24_999);
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ kind: "silent" });
    expect(h.calls.cacheSet).toBe(0);
    expect(h.logs).toEqual([{ repo: "crypt-keeper", reason: "timeout" }]);
  });
});
