/**
 * Feature: repo-lifecycle-classification, Property 6: Classification equals the precedence reference model
 *
 * For any repository, any optional override, and any ISO `now`, the lifecycle
 * `state` returned by the production `classify` (lib/lifecycle) must equal the
 * `state` returned by the independent, table-driven reference model
 * `referenceClassify` (./reference-lifecycle). The two derivations use
 * genuinely different control flow (nested early-returns vs. a linear rule
 * table), so agreement across the input space is strong evidence that the
 * precedence ordering is implemented correctly.
 *
 * The shared generators (`arbRepoFacts`, `arbOverride`, `arbIso`) already mix
 * boundary dates. To push harder on the revival/date rules (rules 3-5 and the
 * days-quiet fallback), this test also mixes in locally-built edge dates:
 * future `setAt`/`pushedAt`, unparseable timestamps, and an unparseable `now`.
 *
 * Validates: Requirements 3.2, 3.8, 3.9, 3.10, 3.11, 3.12
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, type Override, type RepoFacts } from "@/lib/lifecycle";
import { referenceClassify } from "./reference-lifecycle";
import { arbRepoFacts, arbOverride, arbIso } from "./arbitraries";

/**
 * Inline edge-case ISO-ish timestamps built locally in this test file to
 * exercise the revival and days-quiet rules harder than the shared generators
 * alone: a far-future date (negative elapsed -> within window -> risen), a
 * near-future date, and two strings that `Date.parse` cannot parse (treated as
 * "missing"/"not after"/lapsed by the engine).
 */
const EDGE_DATES: readonly string[] = [
  "2999-01-01T00:00:00.000Z", // far future
  "2100-06-01T00:00:00.000Z", // future
  "not-a-date", // unparseable
  "", // unparseable (empty)
];

/** An ISO string drawn either from the shared generator or the edge pool. */
const arbIsoWithEdges: fc.Arbitrary<string> = fc.oneof(
  arbIso,
  fc.constantFrom(...EDGE_DATES),
);

/**
 * A repo whose date-bearing fields may carry the inline edge values, layered
 * on top of the shared `arbRepoFacts` generator. Overriding `pushedAt` and
 * `createdAt` here lets the revival "pushed after setAt" and the days-quiet
 * "fallback to createdAt" / "unparseable" paths be hit far more often than the
 * two fixed values the shared generator supplies.
 */
const arbRepoWithEdgeDates: fc.Arbitrary<RepoFacts> = fc
  .tuple(
    arbRepoFacts,
    fc.oneof(fc.constant(null), arbIsoWithEdges),
    arbIsoWithEdges,
  )
  .map(([repo, pushedAt, createdAt]) => ({ ...repo, pushedAt, createdAt }));

/**
 * An override whose `setAt` may carry the inline edge values, layered on top of
 * the shared `arbOverride` generator so future/unparseable `setAt` values drive
 * rules 3-5 across all three branches (satisfied, within-window, lapsed).
 */
const arbOverrideWithEdgeDates: fc.Arbitrary<Override> = fc
  .tuple(arbOverride, arbIsoWithEdges)
  .map(([override, setAt]) => ({ ...override, setAt }));

describe("Property 6: Classification equals the precedence reference model", () => {
  it("classify(...).state equals referenceClassify(...).state for any repo, override, and now", () => {
    fc.assert(
      fc.property(
        arbRepoWithEdgeDates,
        fc.option(arbOverrideWithEdgeDates, { nil: undefined }),
        arbIsoWithEdges,
        (repo, override, now) => {
          const actual = classify(repo, override, now).state;
          const expected = referenceClassify(repo, override, now).state;
          return actual === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
});
