/**
 * Feature: repo-lifecycle-classification, Property 10: Revival in the window yields risen
 *
 * A `revived` override that is within the revive window — FEWER than
 * `reviveWindowDays` (14) days elapsed from `setAt` to `now` — AND whose repo
 * was NOT pushed after `setAt` must classify as `risen`, with a `null`
 * `decayLevel` and an EMPTY `clearedOverrides`.
 *
 * This exercises Rule 4 of `classify`: when a revival is still in the window
 * and unsatisfied, the repo rises regardless of its underlying signals, dates,
 * or archive status, and the override is neither cleared nor consumed.
 *
 * To land cleanly in this branch we construct `setAt` and `pushedAt`
 * deterministically relative to `now`:
 *   - setAt = now - elapsed, where elapsed is in [0, 14 days) — strictly less
 *     than the window, including 0 and values just under the boundary.
 *   - pushedAt is either null or a timestamp at/before setAt, so the push is
 *     never strictly after the revive.
 *
 * Validates: Requirements 3.6, 7.7
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, LIFECYCLE_CONFIG, type Override, type RepoFacts } from "@/lib/lifecycle";
import { arbRepoFacts, arbIso } from "./arbitraries";

const DAY = LIFECYCLE_CONFIG.msPerDay;
const WINDOW_MS = LIFECYCLE_CONFIG.reviveWindowDays * DAY;

describe("Property 10: Revival in the window yields risen", () => {
  it("an in-window revived override not pushed after setAt yields risen with null decay and no cleared overrides", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        arbIso,
        // Elapsed ms from setAt to now, strictly inside the window: [0, 14 days).
        // Includes 0 and the near-boundary value (one ms under the window).
        fc.oneof(
          fc.constantFrom(0, 1, DAY, WINDOW_MS - 1),
          fc.integer({ min: 0, max: WINDOW_MS - 1 }),
        ),
        // Whether pushedAt is null or a timestamp at/before setAt (never after).
        fc.boolean(),
        // Non-negative gap placing pushedAt at or before setAt when present.
        fc.integer({ min: 0, max: 4000 * DAY }),
        (repo, now, elapsed, pushNull, beforeGap) => {
          const nowMs = Date.parse(now);
          const setMs = nowMs - elapsed;
          const setAt = new Date(setMs).toISOString();

          // Push is never strictly after setAt: either absent or at/before it.
          const pushedAt: string | null = pushNull
            ? null
            : new Date(setMs - beforeGap).toISOString();

          const subject: RepoFacts = { ...repo, pushedAt };
          const override: Override = { type: "revived", setAt };

          const result = classify(subject, override, now);

          return (
            result.state === "risen" &&
            result.decayLevel === null &&
            result.clearedOverrides.length === 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
