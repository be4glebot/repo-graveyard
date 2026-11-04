/**
 * Feature: repo-lifecycle-classification, Property 12: Decay level bands, ranges, and presence
 *
 * For any classified repo:
 *  - a `ghost` has `decayLevel` equal to the count of `ghostDecayBounds`
 *    entries `<= daysQuiet`, and that level stays within 0..3;
 *  - a `zombie` has `decayLevel` equal to the count of `zombieDecayBounds`
 *    entries `<= daysQuiet`, and that level stays within 0..4;
 *  - a `tombstone`, `coffin`, or `risen` has `decayLevel === null`.
 *
 * The expected band count is computed by an independent helper
 * (`referenceDecayLevel`) that counts bounds directly, so a defect in the
 * production `decayLevelFor` cannot hide behind a shared implementation.
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 7.5
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import { arbRepoFacts, arbOverride, arbIso } from "./arbitraries";

/**
 * Independent reference: the decay band index is the number of ascending
 * bounds that are `<= value`. Written with a plain filter so it shares no code
 * with the production engine.
 */
function referenceDecayLevel(value: number, bounds: readonly number[]): number {
  return bounds.filter((bound) => bound <= value).length;
}

describe("Property 12: Decay level bands, ranges, and presence", () => {
  it("decay levels match the thresholds, stay in range, and are null for terminal/risen states", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        fc.option(arbOverride, { nil: undefined }),
        arbIso,
        (repo, override, now) => {
          const result = classify(repo, override, now);

          switch (result.state) {
            case "ghost": {
              const expected = referenceDecayLevel(
                result.daysQuiet,
                LIFECYCLE_CONFIG.ghostDecayBounds,
              );
              return (
                result.decayLevel === expected &&
                result.decayLevel !== null &&
                result.decayLevel >= 0 &&
                result.decayLevel <= 3
              );
            }
            case "zombie": {
              const expected = referenceDecayLevel(
                result.daysQuiet,
                LIFECYCLE_CONFIG.zombieDecayBounds,
              );
              return (
                result.decayLevel === expected &&
                result.decayLevel !== null &&
                result.decayLevel >= 0 &&
                result.decayLevel <= 4
              );
            }
            case "tombstone":
            case "coffin":
            case "risen":
              return result.decayLevel === null;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
