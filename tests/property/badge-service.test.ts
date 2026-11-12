import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import {
  FALLBACK_CACHE_CONTROL,
  SUCCESS_CACHE_CONTROL,
  THROTTLED_CACHE_CONTROL,
  handleBadgeRequest,
  type BadgeServiceDeps,
} from "@/lib/badge-service";
import { buildBadge, isValidRepoName } from "@/lib/badge";
import { repoMessage, summaryMessage } from "@/lib/badge-messages";
import type { GraveyardData, LoadError, Result } from "@/lib/github";
import { classify, type RepoFacts } from "@/lib/lifecycle";
import { isValidUsername } from "@/lib/username";
import { checkXml } from "../helpers/xml";

const NUM_RUNS = 100;
const NOW_MS = Date.parse("2026-06-15T12:00:00.000Z");
const NOW_ISO = new Date(NOW_MS).toISOString();
const DAY_MS = 86_400_000;
const LABEL = "repo graveyard";
const SVG_TYPE = "image/svg+xml; charset=utf-8";

const fetchSpy = vi.fn(() => {
  throw new Error("network is not allowed in badge-service property tests");
});

beforeAll(() => {
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const repoNameArb = fc.stringMatching(/^[A-Za-z0-9._-]{1,30}$/);
const ownerArb = fc.stringMatching(/^[A-Za-z0-9]{1,20}$/);

const nullableDays = fc.option(fc.integer({ min: -5, max: 2000 }), { nil: null });

function makeFacts(
  name: string,
  e: {
    pushedDays: number | null;
    archived: boolean;
    homepage: boolean;
    releases: number;
    readme: number | null;
    commit: string | null;
    issues: number;
  },
): RepoFacts {
  return {
    name,
    description: null,
    url: `https://github.com/octo/${name}`,
    pushedAt: e.pushedDays === null ? null : new Date(NOW_MS - e.pushedDays * DAY_MS).toISOString(),
    createdAt: new Date(NOW_MS - 3000 * DAY_MS).toISOString(),
    isArchived: e.archived,
    isFork: false,
    homepageUrl: e.homepage ? "https://example.com" : null,
    stargazerCount: 0,
    primaryLanguage: null,
    openIssueCount: e.issues,
    releaseCount: e.releases,
    readmeBytes: e.readme,
    lastCommitMessage: e.commit,
    languageColor: null,
    forkCount: 0,
    topics: [],
  };
}

const factsArb = (name: string): fc.Arbitrary<RepoFacts> =>
  fc
    .record({
      pushedDays: nullableDays,
      archived: fc.boolean(),
      homepage: fc.boolean(),
      releases: fc.integer({ min: 0, max: 3 }),
      readme: fc.option(fc.integer({ min: 0, max: 5000 }), { nil: null }),
      commit: fc.option(fc.constantFrom("wip", "v1.0", "final", "todo", "fix bug"), {
        nil: null,
      }),
      issues: fc.integer({ min: 0, max: 40 }),
    })
    .map((e) => makeFacts(name, e));

const factsListArb: fc.Arbitrary<RepoFacts[]> = fc
  .uniqueArray(repoNameArb, {
    minLength: 0,
    maxLength: 12,
    selector: (n) => n.toLowerCase(),
  })
  .chain((names) =>
    names.length === 0
      ? fc.constant<RepoFacts[]>([])
      : fc.tuple(...names.map((n) => factsArb(n))),
  );

function okLoad(repos: RepoFacts[]): NonNullable<BadgeServiceDeps["load"]> {
  return async () => ({
    ok: true,
    value: { repos, totalCount: repos.length, truncated: false },
  });
}

const allowLimiter: NonNullable<BadgeServiceDeps["makeLimiter"]> = async () => ({
  consume: async () => ({ ok: true }),
});

function request(path: string, style?: string): Request {
  const q = style === undefined ? "" : `?style=${safeEncode(style)}`;
  return new Request(`https://example.test/api/badge/${path}${q}`);
}

/** encodeURIComponent throws on lone surrogates; encode those as U+FFFD. */
function safeEncode(s: string): string {
  return encodeURIComponent(s.toWellFormed());
}

function fallbackBody(message: string, style: "haunted" | "flat" = "haunted"): string {
  return buildBadge({ label: LABEL, message, tone: "fallback", style });
}

/** Message shown in a successful badge: the <title> is "<label>: <message>". */
function titleOf(svg: string): string {
  const m = /<title>([\s\S]*?)<\/title>/.exec(svg);
  return m ? m[1] : "";
}

function expectedTitle(message: string, style: "haunted" | "flat" = "haunted"): string {
  const svg = buildBadge({ label: LABEL, message, tone: "neutral", style });
  return titleOf(svg);
}

function expectContract(res: Response, body: string): void {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe(SVG_TYPE);
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(checkXml(body)).toEqual({ ok: true });
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("badge-service properties", () => {
  // Feature: graveyard-badges, Property 13: Repo-name validation matches the pattern
  // (loader half)
  // **Validates: Requirements 5.5, 5.6**
  it("Property 13: the loader is never called for an invalid owner or repo name", async () => {
    const invalidOwnerArb = fc
      .oneof(fc.string({ maxLength: 60 }), fc.constantFrom("-a", "a-", "a b", "", "a".repeat(40)))
      .filter((s) => !isValidUsername(s));
    const invalidRepoArb = fc
      .oneof(
        fc.string({ maxLength: 120 }),
        fc.constantFrom("", "a/b", "a b", "a".repeat(101), "../x", "é"),
      )
      .filter((s) => !isValidRepoName(s));

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.record({ owner: invalidOwnerArb, repo: fc.oneof(fc.constant(null), repoNameArb) }),
          fc.record({ owner: ownerArb, repo: invalidRepoArb }),
        ),
        async ({ owner, repo }) => {
          const load = vi.fn(okLoad([]));
          const res = await handleBadgeRequest(request("x"), owner, repo, {
            load,
            makeLimiter: allowLimiter,
            now: () => NOW_MS,
          });
          expect(load).not.toHaveBeenCalled();
          expect(await res.text()).toBe(fallbackBody("not found"));
        },
      ),
      { numRuns: NUM_RUNS },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Feature: graveyard-badges, Property 14: Repo lookup is case-insensitive
  // **Validates: Requirements 2.5**
  it("Property 14: repo lookup is case-insensitive; unknown names give not found", async () => {
    await fc.assert(
      fc.asyncProperty(
        factsListArb.filter((l) => l.length > 0),
        fc.nat(),
        fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }),
        async (repos, pick, flips) => {
          const target = repos[pick % repos.length];
          const recased = [...target.name]
            .map((ch, i) => (flips[i % flips.length] ? ch.toUpperCase() : ch.toLowerCase()))
            .join("");
          const c = classify(target, undefined, NOW_ISO);
          const deps: BadgeServiceDeps = {
            load: okLoad(repos),
            makeLimiter: allowLimiter,
            now: () => NOW_MS,
          };
          const res = await handleBadgeRequest(request("octo/x"), "octo", recased, deps);
          const body = await res.text();
          expect(res.headers.get("Cache-Control")).toBe(SUCCESS_CACHE_CONTROL);
          expect(titleOf(body)).toBe(expectedTitle(repoMessage(c.state, c.decayLevel)));

          // A name that matches nothing case-insensitively.
          const taken = new Set(repos.map((r) => r.name.toLowerCase()));
          let missing = `${target.name}x`;
          while (taken.has(missing.toLowerCase())) missing += "x";
          if (isValidRepoName(missing)) {
            const miss = await handleBadgeRequest(request("octo/x"), "octo", missing, deps);
            expect(await miss.text()).toBe(fallbackBody("not found"));
            expect(miss.headers.get("Cache-Control")).toBe(FALLBACK_CACHE_CONTROL);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 15: Summary counts equal an override-free classification tally
  // **Validates: Requirements 1.5, 2.1, 11.4**
  it("Property 15: summary and repo messages equal an override-free classification", async () => {
    await fc.assert(
      fc.asyncProperty(factsListArb, async (repos) => {
        const counts = { ghost: 0, risen: 0, zombie: 0, tombstone: 0, coffin: 0 };
        for (const r of repos) counts[classify(r, undefined, NOW_ISO).state] += 1;
        const deps: BadgeServiceDeps = {
          load: okLoad(repos),
          makeLimiter: allowLimiter,
          now: () => NOW_MS,
        };

        const summary = await handleBadgeRequest(request("octo"), "octo", null, deps);
        const sBody = await summary.text();
        expect(titleOf(sBody)).toBe(expectedTitle(summaryMessage(counts)));

        for (const r of repos) {
          const c = classify(r, undefined, NOW_ISO);
          const res = await handleBadgeRequest(request("octo/x"), "octo", r.name, deps);
          expect(titleOf(await res.text())).toBe(
            expectedTitle(repoMessage(c.state, c.decayLevel)),
          );
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 16: Every service response honours the contract
  // **Validates: Requirements 4.1, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.5, 11.6**
  it("Property 16: every service response honours the contract", async () => {
    type LoaderKind = "ok" | "not-found" | "invalid-username" | "rate-limited" | "server-error" | "throws";
    type LimiterKind = "allow" | "deny" | "throws" | "hangs";

    const hostile = fc.oneof(
      fc.string({ maxLength: 80 }),
      fc.constantFrom("<script>", "a&b", "\"'", "\u0000", "\ud800", "x".repeat(5000)),
    );

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          owner: fc.oneof(ownerArb, hostile),
          repo: fc.oneof(fc.constant(null), repoNameArb, hostile),
          style: fc.option(
            fc.oneof(fc.constantFrom("flat", "FLAT", "haunted", "", "x".repeat(40)), hostile),
            { nil: undefined },
          ),
          loader: fc.constantFrom<LoaderKind>(
            "ok", "not-found", "invalid-username", "rate-limited", "server-error", "throws",
          ),
          limiter: fc.constantFrom<LimiterKind>("allow", "allow", "deny", "throws", "hangs"),
          repos: factsListArb,
        }),
        async (s) => {
          const load = vi.fn(async (): Promise<Result<GraveyardData, LoadError>> => {
            switch (s.loader) {
              case "ok":
                return { ok: true, value: { repos: s.repos, totalCount: s.repos.length, truncated: false } };
              case "not-found":
                return { ok: false, error: { kind: "not-found" } };
              case "invalid-username":
                return { ok: false, error: { kind: "invalid-username" } };
              case "rate-limited":
                return { ok: false, error: { kind: "rate-limited", resetAt: null } };
              case "server-error":
                return { ok: false, error: { kind: "server-error", detail: "secret" } };
              default:
                throw new Error("boom");
            }
          });
          const makeLimiter = async () => {
            if (s.limiter === "throws") throw new Error("redis down");
            if (s.limiter === "hangs") return { consume: () => new Promise<never>(() => {}) };
            return {
              consume: async () =>
                s.limiter === "deny" ? { ok: false as const, retryAfter: 5 } : { ok: true as const },
            };
          };

          const res = await handleBadgeRequest(
            new Request("https://example.test/api/badge/x?style=" + safeEncode(s.style ?? ""), {
              headers: { "x-forwarded-for": "203.0.113.9" },
            }),
            s.owner,
            s.repo,
            { load, makeLimiter, now: () => NOW_MS, limiterTimeoutMs: 2 },
          );
          const body = await res.text();
          expectContract(res, body);
          const cc = res.headers.get("Cache-Control");

          if (s.limiter === "deny") {
            expect(cc).toBe(THROTTLED_CACHE_CONTROL);
            expect(cc).not.toContain("s-maxage");
            expect(titleOf(body)).toBe(expectedTitle("unavailable"));
            expect(load).not.toHaveBeenCalled();
            return;
          }

          const namesValid =
            isValidUsername(s.owner) && (s.repo === null || isValidRepoName(s.repo));
          if (!namesValid) {
            expect(cc).toBe(FALLBACK_CACHE_CONTROL);
            expect(titleOf(body)).toBe(expectedTitle("not found"));
            expect(load).not.toHaveBeenCalled();
            return;
          }

          if (s.loader === "ok") {
            const known =
              s.repo === null ||
              s.repos.some((r) => r.name.toLowerCase() === s.repo!.toLowerCase());
            expect(cc).toBe(known ? SUCCESS_CACHE_CONTROL : FALLBACK_CACHE_CONTROL);
            if (!known) expect(titleOf(body)).toBe(expectedTitle("not found"));
          } else {
            expect(cc).toBe(FALLBACK_CACHE_CONTROL);
            const notFound = s.loader === "not-found" || s.loader === "invalid-username";
            expect(titleOf(body)).toBe(expectedTitle(notFound ? "not found" : "unavailable"));
          }
          expect(cc).not.toBe(THROTTLED_CACHE_CONTROL);
          expect(body).not.toContain("secret");
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 17: Fallback body does not depend on user text
  // **Validates: Requirements 5.8, 11.6**
  it("Property 17: fallback body does not depend on user text", async () => {
    const marker = "ZQX<&>\"'";
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 60 }),
        fc.string({ maxLength: 60 }),
        fc.constantFrom<"haunted" | "flat">("haunted", "flat"),
        async (a, b, style) => {
          // Invalid owner (contains the marker, which no username may hold).
          const owner = `${marker}${a}`;
          const repo = `${marker}${b}`;
          const styleParam = style === "flat" ? "flat" : undefined;
          const load = okLoad([]);
          const deps: BadgeServiceDeps = { load, makeLimiter: allowLimiter, now: () => NOW_MS };

          const r1 = await handleBadgeRequest(request("x", styleParam), owner, null, deps);
          const r2 = await handleBadgeRequest(request("x", styleParam), "octo", repo, deps);
          const unknown = await handleBadgeRequest(request("x", styleParam), "octo", "missing", deps);

          const expected = fallbackBody("not found", style);
          for (const res of [r1, r2, unknown]) {
            const body = await res.text();
            expect(body).toBe(expected);
            expect(body).not.toContain("ZQX");
            expect(body).not.toContain("missing");
          }

          // Loader failure fallbacks are fixed as well.
          const failing = await handleBadgeRequest(request("x", styleParam), "octo", null, {
            load: async () => ({ ok: false, error: { kind: "server-error", detail: a } }),
            makeLimiter: allowLimiter,
            now: () => NOW_MS,
          });
          expect(await failing.text()).toBe(fallbackBody("unavailable", style));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
