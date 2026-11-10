import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RepoFacts } from "@/lib/lifecycle";
import type { CacheClient } from "@/lib/cache";
import type { LlmClient } from "@/lib/llm";
import type { ConsumeResult, RateLimiter } from "@/lib/ratelimit";
import { deriveEvidence } from "@/lib/seance";
import type { SeanceDeps } from "@/lib/seance-service";
import { runSeance } from "@/lib/seance-service";
import type { SeanceResult } from "@/lib/seance-schema";
import { validSeanceResult } from "./seance-arbitraries";

// ---------------------------------------------------------------------------
// Reusable fakes and arbitraries (tasks 7.4 to 7.6 append to this file)
// ---------------------------------------------------------------------------

export const FAKE_OWNER = "ghostly";
export const FAKE_REPO = "haunted-app";
export const FAKE_IP = "203.0.113.7";

export const FAKE_FACTS: RepoFacts = {
  name: FAKE_REPO,
  description: "a small invented tool",
  url: "https://github.com/ghostly/haunted-app",
  pushedAt: "2024-01-10T00:00:00Z",
  createdAt: "2023-06-01T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 12,
  primaryLanguage: "TypeScript",
  openIssueCount: 3,
  releaseCount: 0,
  readmeBytes: 2048,
  lastCommitMessage: "wip: login redirect still broken",
  languageColor: null,
  forkCount: 1,
  topics: ["cli"],
};

export const FAKE_COMMITS = ["wip: login redirect still broken", "add oauth callback"];

export const FAKE_DERIVED = deriveEvidence({
  facts: FAKE_FACTS,
  readme: "# haunted-app\nA small invented tool.",
  commits: FAKE_COMMITS,
});

/** Evidence strings that pass grounding for the fake facts. */
export const GROUNDED_EVIDENCE = FAKE_DERIVED.factLines
  .map((f) => f.text)
  .filter((t) => t.length >= 8 && t.length <= 200);

export type Behaviour =
  | "valid"
  | "invalid-json"
  | "schema-invalid"
  | "ungrounded"
  | "dated-voice"
  | "throws"
  | "hang";

export const BEHAVIOURS: Behaviour[] = [
  "valid",
  "invalid-json",
  "schema-invalid",
  "ungrounded",
  "dated-voice",
  "throws",
  "hang",
];

/** A schema-valid, grounded result built from the generic arbitrary. */
export const groundedResult: fc.Arbitrary<SeanceResult> = validSeanceResult.chain(
  (r) =>
    fc
      .array(fc.constantFrom(...GROUNDED_EVIDENCE), {
        minLength: r.unfinishedBusiness.length,
        maxLength: r.unfinishedBusiness.length,
      })
      .map((ev) => ({
        ...r,
        unfinishedBusiness: r.unfinishedBusiness.map((b, i) => ({
          ...b,
          evidence: ev[i],
        })),
      })),
);

/** One scripted LLM step: the behaviour plus the grounded result it may serve. */
export const llmStep = fc.record({
  behaviour: fc.constantFrom(...BEHAVIOURS),
  result: groundedResult,
});
export type LlmStep = { behaviour: Behaviour; result: SeanceResult };

/** Makes the text (or failure) a step produces. Hang never settles. */
export function runStep(step: LlmStep): Promise<string> {
  const r = step.result;
  switch (step.behaviour) {
    case "valid":
      return Promise.resolve(JSON.stringify(r));
    case "invalid-json":
      return Promise.resolve("{ not json " + r.voice);
    case "schema-invalid":
      return Promise.resolve(JSON.stringify({ ...r, verdict: "maybe" }));
    case "ungrounded":
      return Promise.resolve(
        JSON.stringify({
          ...r,
          unfinishedBusiness: r.unfinishedBusiness.map((b) => ({
            ...b,
            evidence: "zzqx nonexistent evidence line",
          })),
        }),
      );
    case "dated-voice":
      return Promise.resolve(
        JSON.stringify({ ...r, voice: "I remember you. It was 5 days ago." }),
      );
    case "throws":
      return Promise.reject(new Error("provider exploded"));
    case "hang":
      return new Promise<string>(() => {});
  }
}

export interface FakeLlm extends LlmClient {
  calls: number;
}

export function makeFakeLlm(steps: LlmStep[]): FakeLlm {
  const fake: FakeLlm = {
    calls: 0,
    complete() {
      const step = steps[fake.calls] ?? steps[steps.length - 1];
      fake.calls += 1;
      return runStep(step);
    },
  };
  return fake;
}

export interface FakeLimiter extends RateLimiter {
  checks: number;
  consumes: number;
}

export function makeFakeLimiter(
  check: ConsumeResult = "ok",
  consume: ConsumeResult = "ok",
): FakeLimiter {
  const l: FakeLimiter = {
    checks: 0,
    consumes: 0,
    async check() {
      l.checks += 1;
      return check;
    },
    async consume() {
      l.consumes += 1;
      return consume;
    },
  };
  return l;
}

export function makeFakeDeps(
  llm: LlmClient | null,
  limiter: RateLimiter,
  overrides: Partial<SeanceDeps> = {},
): SeanceDeps {
  return {
    loadGraveyard: async () => ({
      ok: true,
      value: { repos: [FAKE_FACTS], totalCount: 1, truncated: false },
    }),
    fetchEvidence: async () => ({
      readme: "# haunted-app\nA small invented tool.",
      commits: FAKE_COMMITS,
    }),
    llm,
    cache: null,
    limiter,
    log: () => {},
    ...overrides,
  };
}

export interface FakeCache extends CacheClient {
  sets: { key: string; value: unknown }[];
}

/** A cache that always misses on read and records every write. */
export function makeFakeCache(): FakeCache {
  const c: FakeCache = {
    sets: [],
    async get() {
      return null;
    },
    async set(key, value) {
      c.sets.push({ key, value });
      return "OK";
    },
  };
  return c;
}

// ---------------------------------------------------------------------------
// Property 19
// ---------------------------------------------------------------------------

describe("seance-service retry loop", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  // Feature: the-seance, Property 19: The retry loop makes at most two calls and never returns partial output
  // **Validates: Requirements 4.8, 4.9, 4.10, 4.11, 4.12, 5.7, 6.7, 8.10, 20.3, 20.4**
  it("makes at most two calls and never returns partial output", async () => {
    await fc.assert(
      fc.asyncProperty(llmStep, llmStep, async (first, second) => {
        const llm = makeFakeLlm([first, second]);
        const limiter = makeFakeLimiter();
        const deps = makeFakeDeps(llm, limiter);

        const pending = runSeance(
          { owner: FAKE_OWNER, repo: FAKE_REPO, ip: FAKE_IP },
          deps,
        );
        // Two 8 s hangs total 16 s, inside the 25 s request deadline.
        await vi.advanceTimersByTimeAsync(20_000);
        const outcome = await pending;

        const firstValid = first.behaviour === "valid";
        const secondValid = second.behaviour === "valid";
        const expectOk = firstValid || secondValid;

        expect(llm.calls).toBeLessThanOrEqual(2);
        expect(llm.calls).toBe(firstValid ? 1 : 2);
        expect(limiter.consumes).toBe(llm.calls);
        expect(limiter.checks).toBe(1);

        if (expectOk) {
          expect(outcome.kind).toBe("ok");
          const expected = firstValid ? first.result : second.result;
          expect(outcome).toEqual({ kind: "ok", result: expected });
        } else {
          expect(outcome).toEqual({ kind: "silent" });
          expect("result" in outcome).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 20
// ---------------------------------------------------------------------------

const LOG_REASONS = new Set([
  "repo-not-found",
  "no-llm",
  "invalid-output",
  "llm-error",
  "timeout",
  "veil",
  "weak",
]);

describe("seance-service leakage and caching", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  // Feature: the-seance, Property 20: No raw model text leaks and only validated results are cached
  // **Validates: Requirements 4.13, 4.14, 7.12, 19.6, 19.7**
  it("never leaks raw model text and caches only validated results", async () => {
    await fc.assert(
      fc.asyncProperty(
        llmStep,
        llmStep,
        fc.uuid(),
        fc.uuid(),
        async (first, second, sentinelId, keyId) => {
          const SENTINEL = `SENTINEL-${sentinelId}`;
          const API_KEY = `KEY-${keyId}`;

          // Salt every non-valid step with the sentinel (and the key, in errors).
          let calls = 0;
          const steps = [first, second];
          const llm: LlmClient = {
            complete() {
              const step = steps[calls] ?? steps[steps.length - 1];
              calls += 1;
              if (step.behaviour === "valid") return runStep(step);
              if (step.behaviour === "throws") {
                return Promise.reject(new Error(`${SENTINEL} ${API_KEY}`));
              }
              if (step.behaviour === "dated-voice") {
                return runStep(step).then((t) =>
                  t.replace("5 days ago.", `5 days ago. ${SENTINEL}`),
                );
              }
              return runStep({
                ...step,
                result: { ...step.result, voice: `${SENTINEL} ${step.result.voice}` },
              });
            },
          };

          const cache = makeFakeCache();
          const logs: { repo: string; reason: string }[] = [];
          const deps = makeFakeDeps(llm, makeFakeLimiter(), {
            cache,
            log: (e) => logs.push(e),
          });

          const pending = runSeance(
            { owner: FAKE_OWNER, repo: FAKE_REPO, ip: FAKE_IP },
            deps,
          );
          await vi.advanceTimersByTimeAsync(20_000);
          const outcome = await pending;
          const serialized = JSON.stringify(outcome);

          // Secrets never appear in a response or a log entry.
          expect(serialized).not.toContain(API_KEY);
          expect(JSON.stringify(logs)).not.toContain(API_KEY);
          // Raw model text never appears in logs.
          expect(JSON.stringify(logs)).not.toContain(SENTINEL);

          // Logs hold only repo + reason code.
          for (const entry of logs) {
            expect(Object.keys(entry).sort()).toEqual(["reason", "repo"]);
            expect(entry.repo).toBe(FAKE_REPO);
            expect(LOG_REASONS.has(entry.reason)).toBe(true);
          }

          if (outcome.kind === "ok") {
            // Only a valid step can succeed, and it carries no sentinel.
            expect(serialized).not.toContain(SENTINEL);
            expect(cache.sets).toHaveLength(1);
            expect(cache.sets[0].value).toEqual(outcome.result);
          } else {
            expect(serialized).not.toContain(SENTINEL);
            expect(outcome.kind).toBe("silent");
            expect(cache.sets).toHaveLength(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 21
// ---------------------------------------------------------------------------

import { seanceCacheKey } from "@/lib/cache";

const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789-";
const nameArb = fc
  .array(fc.constantFrom(...NAME_CHARS.split("")), { minLength: 1, maxLength: 12 })
  .map((cs) => cs.join(""));
const caseModeArb = fc.constantFrom("lower", "upper", "alt");
const isoArb = fc
  .integer({ min: Date.UTC(2015, 0, 1), max: Date.UTC(2030, 0, 1) })
  .map((ms) => new Date(ms).toISOString());

function applyCase(s: string, mode: string): string {
  if (mode === "upper") return s.toUpperCase();
  if (mode === "lower") return s.toLowerCase();
  return s
    .split("")
    .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
    .join("");
}

/** A cache that stores writes, so a second identical request is a real hit. */
function makeStoreCache(): CacheClient & { keys: string[] } {
  const store = new Map<string, unknown>();
  const c = {
    keys: [] as string[],
    async get(key: string) {
      c.keys.push(key);
      return store.get(key) ?? null;
    },
    async set(key: string, value: unknown) {
      store.set(key, value);
      return "OK";
    },
  };
  return c;
}

describe("seance cache key dependence", () => {
  // Feature: the-seance, Property 21: Cache key depends only on server-held values
  // **Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.9, 7.10, 19.4, 20.8, 20.24**
  it("depends only on lower-cased owner/repo and the server-held pushedAt", async () => {
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        nameArb,
        caseModeArb,
        caseModeArb,
        isoArb,
        fc.option(isoArb, { nil: null }),
        isoArb,
        fc.string({ maxLength: 30 }),
        fc.oneof(isoArb, fc.constant(null), fc.string({ maxLength: 20 })),
        async (owner, repo, modeA, modeB, createdAt, pushedAt, otherPushed, extra, clientPushed) => {
          fc.pre(otherPushed !== (pushedAt ?? createdAt));

          // Pure key properties.
          const ownerA = applyCase(owner, modeA);
          const repoA = applyCase(repo, modeA);
          const ownerB = applyCase(owner, modeB);
          const repoB = applyCase(repo, modeB);
          const keyA = seanceCacheKey(ownerA, repoA, pushedAt, createdAt);
          expect(seanceCacheKey(ownerB, repoB, pushedAt, createdAt)).toBe(keyA);
          expect(keyA).toBe(seanceCacheKey(owner, repo, pushedAt ?? createdAt, "ignored"));
          expect(seanceCacheKey(owner, repo, otherPushed, createdAt)).not.toBe(keyA);

          // Service behaviour with a mutable server-held fact set.
          let facts: RepoFacts = {
            ...FAKE_FACTS,
            name: repo,
            createdAt,
            pushedAt: pushedAt as string,
          };
          const derivedFor = (f: RepoFacts) =>
            deriveEvidence({ facts: f, readme: null, commits: [] }).factLines
              .map((l) => l.text)
              .filter((t) => t.length >= 8 && t.length <= 200);
          const seed = fc.sample(validSeanceResult, { numRuns: 1, seed: 21 })[0];
          const llm: LlmClient = {
            complete() {
              llm_calls += 1;
              const ev = derivedFor(facts);
              return Promise.resolve(
                JSON.stringify({
                  ...seed,
                  unfinishedBusiness: seed.unfinishedBusiness.map((b) => ({
                    ...b,
                    evidence: ev[0],
                  })),
                }),
              );
            },
          };
          let llm_calls = 0;
          const limiter = makeFakeLimiter();
          const cache = makeStoreCache();
          const deps = makeFakeDeps(llm, limiter, {
            cache,
            loadGraveyard: async () => ({
              ok: true,
              value: { repos: [facts], totalCount: 1, truncated: false },
            }),
            fetchEvidence: async () => ({ readme: null, commits: [] }),
          });

          const first = await runSeance(
            { owner: ownerA, repo: repoA, ip: FAKE_IP, extra } as never,
            deps,
          );
          expect(first.kind).toBe("ok");
          expect(llm_calls).toBe(1);
          expect(limiter.checks).toBe(1);
          const consumesAfterFirst = limiter.consumes;
          expect(consumesAfterFirst).toBe(1);

          // Same server facts, different casing and client-sent pushedAt: a hit.
          const second = await runSeance(
            { owner: ownerB, repo: repoB, ip: FAKE_IP, pushedAt: clientPushed, extra } as never,
            deps,
          );
          expect(second).toEqual(first);
          expect(llm_calls).toBe(1);
          expect(limiter.checks).toBe(1);
          expect(limiter.consumes).toBe(consumesAfterFirst);
          expect(new Set(cache.keys).size).toBe(1);

          // A changed server pushedAt is a miss and costs exactly one more call.
          facts = { ...facts, pushedAt: otherPushed };
          const third = await runSeance(
            { owner: ownerA, repo: repoA, ip: FAKE_IP, pushedAt: clientPushed } as never,
            deps,
          );
          expect(third.kind).toBe("ok");
          expect(llm_calls).toBe(2);
          expect(limiter.consumes).toBe(2);
          expect(new Set(cache.keys).size).toBe(2);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 27
// ---------------------------------------------------------------------------

const limiterStateArb = fc.constantFrom<"ok" | "veil" | "weak">("ok", "veil", "weak");
const blockedStateArb = fc.constantFrom<"veil" | "weak">("veil", "weak");
const ipArb = fc
  .tuple(
    fc.integer({ min: 1, max: 254 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 254 }),
  )
  .map((p) => p.join("."));

describe("seance-service cache hits and blocked misses", () => {
  // Feature: the-seance, Property 27: Cache hits bypass the limiter; blocked misses cost nothing
  // **Validates: Requirements 7.9, 8.3, 8.4, 20.9, 20.32**
  it("a cache hit never touches the limiter, GitHub or the LLM", async () => {
    await fc.assert(
      fc.asyncProperty(
        validSeanceResult,
        ipArb,
        limiterStateArb,
        limiterStateArb,
        async (cachedResult, ip, checkState, consumeState) => {
          let llmCalls = 0;
          let githubCalls = 0;
          const llm: LlmClient = {
            complete() {
              llmCalls += 1;
              return Promise.reject(new Error("must not be called"));
            },
          };
          const limiter = makeFakeLimiter(checkState, consumeState);
          const sets: unknown[] = [];
          const cache: CacheClient = {
            async get() {
              return cachedResult;
            },
            async set(_k, v) {
              sets.push(v);
              return "OK";
            },
          };
          const deps = makeFakeDeps(llm, limiter, {
            cache,
            fetchEvidence: async () => {
              githubCalls += 1;
              return null;
            },
          });

          const outcome = await runSeance(
            { owner: FAKE_OWNER, repo: FAKE_REPO, ip },
            deps,
          );

          expect(outcome).toEqual({ kind: "ok", result: cachedResult });
          expect(limiter.checks).toBe(0);
          expect(limiter.consumes).toBe(0);
          expect(githubCalls).toBe(0);
          expect(llmCalls).toBe(0);
          expect(sets).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("a blocked miss returns the limiter state with no GitHub, LLM, consume or cache write", async () => {
    await fc.assert(
      fc.asyncProperty(
        ipArb,
        blockedStateArb,
        limiterStateArb,
        async (ip, blocked, consumeState) => {
          let llmCalls = 0;
          let githubCalls = 0;
          const llm: LlmClient = {
            complete() {
              llmCalls += 1;
              return Promise.reject(new Error("must not be called"));
            },
          };
          const limiter = makeFakeLimiter(blocked, consumeState);
          const cache = makeFakeCache();
          const deps = makeFakeDeps(llm, limiter, {
            cache,
            fetchEvidence: async () => {
              githubCalls += 1;
              return null;
            },
          });

          const outcome = await runSeance(
            { owner: FAKE_OWNER, repo: FAKE_REPO, ip },
            deps,
          );

          expect(outcome).toEqual({ kind: blocked });
          expect(limiter.checks).toBe(1);
          expect(limiter.consumes).toBe(0);
          expect(githubCalls).toBe(0);
          expect(llmCalls).toBe(0);
          expect(cache.sets).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
