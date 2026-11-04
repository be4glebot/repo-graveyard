/**
 * Feature: repo-lifecycle-classification, Property 8: Recent pushes are ghosts
 *
 * Any NON-ARCHIVED repo with NO override whose `pushedAt` is strictly less than
 * `ghostMaxDaysQuiet` (90) days before `now` classifies as `ghost`.
 *
 * Rule 8 of `classify` fires when `daysQuiet < ghostMaxDaysQuiet`, and
 * `daysQuiet = max(0, floor((now - pushedAt) / msPerDay))`. Because of the
 * floor semantics, any offset strictly less than 90 days (so `floor(...) <=
 * 89`) keeps `daysQuiet` strictly below 90. We generate offsets in the closed
 * day range [0, 89] plus a fractional component in [0, 1) days, which keeps the
 * total offset in [0, 90) days and therefore `daysQuiet` in [0, 89].
 *
 * Validates: Requirements 3.10, 7.3
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import { arbRepoFacts, arbIso } from "./arbitraries";

describe("Property 8: Recent pushes are ghosts", () => {
  it("non-archived, no-override repos pushed < 90 days ago classify as ghost", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        arbIso,
        // Whole-day offset in [0, 89].
        fc.integer({ min: 0, max: LIFECYCLE_CONFIG.ghostMaxDaysQuiet - 1 }),
        // Fractional sub-day offset in [0, 1) days, in milliseconds, to probe
        // the floor boundary without pushing daysQuiet to 90.
        fc.integer({ min: 0, max: LIFECYCLE_CONFIG.msPerDay - 1 }),
        (repo, now, dayOffset, subDayMs) => {
          const nowMs = Date.parse(now);
          // arbIso always yields a parseable ISO timestamp.
          const offsetMs = dayOffset * LIFECYCLE_CONFIG.msPerDay + subDayMs;
          const pushedAt = new Date(nowMs - offsetMs).toISOString();

          const result = classify(
            { ...repo, isArchived: false, pushedAt },
            undefined,
            now,
          );

          return result.state === "ghost";
        },
      ),
      { numRuns: 100 },
    );
  });
});
