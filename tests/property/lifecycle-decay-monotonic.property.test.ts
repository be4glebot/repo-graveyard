/**
 * Feature: repo-lifecycle-classification, Property 13: Decay is monotonic in days quiet
 *
 * For a non-archived repo with no override, growing `daysQuiet` from `a` to
 * `b >= a` by shifting ONLY `pushedAt` (all else equal):
 *  - if the repo is not a ghost at `a`, it is not a ghost at `b` (growing quiet
 *    never creates a ghost); and
 *  - if the two classifications share the same state and that state is `ghost`
 *    or `zombie`, then `decayLevel(b) >= decayLevel(a)`.
 *
 * The two day-offsets are generated in a range wide enough to span the
 * ghost -> zombie transition and all decay bands (0..4000 days). `pushedAt` is
 * computed as `now - offset days`, so a larger offset means an older push and a
 * larger `daysQuiet`. `a = min(offsets)`, `b = max(offsets)`, guaranteeing
 * `a <= b`.
 *
 * Validates: Requirements 7.4
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import { arbRepoFacts, arbIso } from "./arbitraries";

/** Builds an ISO timestamp `days` before `now` (`now` is epoch ms). */
function isoDaysBefore(nowMs: number, days: number): string {
  return new Date(nowMs - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

describe("Property 13: Decay is monotonic in days quiet", () => {
  it("growing days quiet never creates a ghost and never lowers decay within the same ghost/zombie state", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        arbIso,
        // Two day-offsets wide enough to span ghost -> zombie and every band.
        fc.integer({ min: 0, max: 4000 }),
        fc.integer({ min: 0, max: 4000 }),
        (baseRepo, now, offset1, offset2) => {
          const nowMs = Date.parse(now);
          // `arbIso` never yields an unparseable timestamp, but guard anyway so
          // the property stays total.
          if (Number.isNaN(nowMs)) {
            return true;
          }

          const a = Math.min(offset1, offset2);
          const b = Math.max(offset1, offset2);

          // Same repo otherwise: non-archived, override undefined; only
          // `pushedAt` differs between the two classifications.
          const common: RepoFacts = { ...baseRepo, isArchived: false };
          const repoA: RepoFacts = { ...common, pushedAt: isoDaysBefore(nowMs, a) };
          const repoB: RepoFacts = { ...common, pushedAt: isoDaysBefore(nowMs, b) };

          const resultA = classify(repoA, undefined, now);
          const resultB = classify(repoB, undefined, now);

          // Growing quiet never turns a non-ghost into a ghost.
          if (resultA.state !== "ghost" && resultB.state === "ghost") {
            return false;
          }

          // Within the same ghost/zombie state, decay never decreases.
          if (
            resultA.state === resultB.state &&
            (resultA.state === "ghost" || resultA.state === "zombie")
          ) {
            if (resultA.decayLevel === null || resultB.decayLevel === null) {
              return false;
            }
            return resultB.decayLevel >= resultA.decayLevel;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
