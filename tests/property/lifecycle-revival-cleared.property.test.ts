/**
 * Feature: repo-lifecycle-classification, Property 9: Satisfied or lapsed revivals clear and match the no-override result
 *
 * A `revived` override that is EITHER
 *   (a) satisfied  — the repo's `pushedAt` is strictly after the revive
 *       timestamp (`setAt`), OR
 *   (b) lapsed     — at least `reviveWindowDays` (14) have elapsed from `setAt`
 *       to `now` AND the repo was not pushed after `setAt`
 * must put `"revived"` in `clearedOverrides` and yield the SAME `state` and
 * `decayLevel` as classifying the identical repo with NO override.
 *
 * This exercises Rules 3 (satisfied) and 5 (lapsed) of `classify`, both of
 * which clear the override and continue evaluation from the archived rule as if
 * no override were set.
 *
 * To land cleanly in each branch we construct `setAt` and `pushedAt`
 * deterministically relative to `now`:
 *   - satisfied: setAt = now - gap; pushedAt = setAt + push (push > 0), so the
 *     push is strictly after the revive.
 *   - lapsed: setAt = now - (14 days + extra); pushedAt is either null or
 *     setAt - before (before >= 0), so the push is never after the revive and
 *     at least 14 days have elapsed.
 *
 * Validates: Requirements 3.5, 3.7, 7.6, 7.8
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, LIFECYCLE_CONFIG, type Override, type RepoFacts } from "@/lib/lifecycle";
import { arbRepoFacts, arbIso } from "./arbitraries";

const DAY = LIFECYCLE_CONFIG.msPerDay;
const WINDOW_MS = LIFECYCLE_CONFIG.reviveWindowDays * DAY;

describe("Property 9: Satisfied or lapsed revivals clear and match the no-override result", () => {
  it("a satisfied or lapsed revived override clears and matches the no-override classification", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        arbIso,
        fc.constantFrom<"satisfied" | "lapsed">("satisfied", "lapsed"),
        // Positive millisecond magnitude used to build offsets in each branch.
        fc.integer({ min: 1, max: 4000 * DAY }),
        // Whether the lapsed branch uses a null pushedAt or a pre-setAt push.
        fc.boolean(),
        (repo, now, branch, magnitude, lapsedPushNull) => {
          const nowMs = Date.parse(now);

          let setAt: string;
          let pushedAt: string | null;

          if (branch === "satisfied") {
            // Revive happened `magnitude` ms before now; the push is strictly
            // after the revive (setAt + 1 day) so Rule 3 fires.
            const setMs = nowMs - magnitude;
            setAt = new Date(setMs).toISOString();
            pushedAt = new Date(setMs + DAY).toISOString();
          } else {
            // Revive happened at least the full window (+ extra) before now, so
            // elapsed >= 14 days and Rule 5 fires. The push is never after the
            // revive: either absent or strictly before setAt.
            const setMs = nowMs - (WINDOW_MS + magnitude);
            setAt = new Date(setMs).toISOString();
            pushedAt = lapsedPushNull ? null : new Date(setMs - DAY).toISOString();
          }

          const subject: RepoFacts = { ...repo, pushedAt };
          const override: Override = { type: "revived", setAt };

          const withOverride = classify(subject, override, now);
          const withoutOverride = classify(subject, undefined, now);

          return (
            withOverride.clearedOverrides.includes("revived") &&
            withOverride.state === withoutOverride.state &&
            withOverride.decayLevel === withoutOverride.decayLevel
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
