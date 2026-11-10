/**
 * Feature: repo-details-hover-panel, Property 4: Explanation line is total and deterministic
 * Feature: repo-details-hover-panel, Property 5: Tombstone explanation names a real finished signal
 *
 * **Validates: Requirements 6.3, 11.5, 11.8** (Property 4)
 * **Validates: Requirements 6.3, 11.5** (Property 5)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { explanationLine } from "@/lib/repoDetails/explanationLine";
import { countSignals } from "@/lib/finished";
import { LIFECYCLE_CONFIG, type LifecycleState, type RepoFacts } from "@/lib/lifecycle";

const RUNS = { numRuns: 100 };

const MIN_MS = Date.parse("2000-01-01T00:00:00.000Z");
const MAX_MS = Date.parse("2040-01-01T00:00:00.000Z");

const arbValidIso = fc
  .integer({ min: MIN_MS, max: MAX_MS })
  .map((ms) => new Date(ms).toISOString());
const arbUnparseable = fc
  .oneof(fc.constantFrom("", "not a date", "NaN", "   "), fc.string({ maxLength: 12 }))
  .filter((s) => Number.isNaN(Date.parse(s)));
const arbTimestamp = fc.oneof(arbValidIso, arbUnparseable);
const arbNullableTimestamp = fc.oneof(arbValidIso, fc.constant(null), arbUnparseable);

const arbState = fc.constantFrom<LifecycleState>(
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
);

const arbFacts: fc.Arbitrary<RepoFacts> = fc.record({
  name: fc.string({ maxLength: 10 }),
  description: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  url: fc.constant("https://github.com/o/r"),
  pushedAt: arbNullableTimestamp,
  createdAt: arbTimestamp,
  isArchived: fc.boolean(),
  isFork: fc.boolean(),
  homepageUrl: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  stargazerCount: fc.oneof(
    fc.nat({ max: 200 }),
    fc.constantFrom(0, LIFECYCLE_CONFIG.popularStars - 1, LIFECYCLE_CONFIG.popularStars),
  ),
  primaryLanguage: fc.option(fc.string({ maxLength: 8 }), { nil: null }),
  openIssueCount: fc.nat({ max: 50 }),
  releaseCount: fc.nat({ max: 20 }),
  readmeBytes: fc.option(fc.integer({ min: 0, max: 5000 }), { nil: null }),
  lastCommitMessage: fc.option(
    fc.oneof(
      fc.string({ maxLength: 30 }),
      fc.constantFrom("v1.0 release", "wip", "final touches\nbody", "ship it", "todo"),
    ),
    { nil: null },
  ),
  languageColor: fc.constant(null),
  forkCount: fc.nat({ max: 100 }),
  topics: fc.constant([] as string[]),
});

/** Facts with an independently toggled set of finished signals. */
const arbSignalFacts: fc.Arbitrary<RepoFacts> = fc
  .record({
    base: arbFacts,
    release: fc.boolean(),
    homepage: fc.boolean(),
    readme: fc.boolean(),
    keyword: fc.boolean(),
    popular: fc.boolean(),
  })
  .map(({ base, release, homepage, readme, keyword, popular }) => ({
    ...base,
    releaseCount: release ? Math.max(1, base.releaseCount) : 0,
    homepageUrl: homepage ? "https://example.com" : null,
    readmeBytes: readme ? LIFECYCLE_CONFIG.readmeMinBytes + 1 : 0,
    lastCommitMessage: keyword ? "v1.0 release" : "misc",
    stargazerCount: popular ? LIFECYCLE_CONFIG.popularStars : 0,
  }));

const arbRevivedAt = fc.option(fc.oneof(arbValidIso, arbUnparseable), { nil: undefined });

const BAD = /NaN|undefined|\[object/;

describe("Feature: repo-details-hover-panel, Property 4: Explanation line is total and deterministic", () => {
  it("returns one stable non-empty sentence for any state/facts/renderedAt and never throws", () => {
    fc.assert(
      fc.property(
        arbState,
        fc.option(fc.nat({ max: 4 }), { nil: null }),
        arbFacts,
        arbRevivedAt,
        arbTimestamp,
        (state, decayLevel, facts, revivedAt, renderedAt) => {
          const input = { state, decayLevel, facts, revivedAt };
          const first = explanationLine(input, renderedAt);
          const second = explanationLine({ ...input, facts: { ...facts } }, renderedAt);
          expect(typeof first).toBe("string");
          expect(first.trim().length).toBeGreaterThan(0);
          expect(first).not.toMatch(BAD);
          expect(second).toBe(first);
        },
      ),
      RUNS,
    );
  });
});

describe("Feature: repo-details-hover-panel, Property 5: Tombstone explanation names a real finished signal", () => {
  it("mentions at least one finished signal that countSignals actually found", () => {
    const SIGNAL_WORDS: Record<string, RegExp> = {
      release: /\breleases?\b/,
      homepage: /\bhomepage\b/,
      readme: /\bREADME\b/,
      keyword: /\blast commit\b/,
      popular: /\bstars\b/,
    };
    fc.assert(
      fc.property(
        arbSignalFacts,
        arbValidIso,
        (facts, renderedAt) => {
          fc.pre(countSignals(facts).finished > 0);
          const found: string[] = [];
          if (facts.releaseCount >= 1) found.push("release");
          if (facts.homepageUrl !== null && facts.homepageUrl.trim().length > 0) found.push("homepage");
          if (facts.readmeBytes !== null && facts.readmeBytes > LIFECYCLE_CONFIG.readmeMinBytes) {
            found.push("readme");
          }
          if (/v1\.0|release|final|done|ship/i.test(facts.lastCommitMessage ?? "")) found.push("keyword");
          if (facts.stargazerCount >= LIFECYCLE_CONFIG.popularStars) found.push("popular");

          const line = explanationLine({ state: "tombstone", decayLevel: null, facts }, renderedAt);
          expect(found.length).toBeGreaterThan(0);
          expect(found.some((k) => SIGNAL_WORDS[k].test(line))).toBe(true);
        },
      ),
      RUNS,
    );
  });
});
