/**
 * Feature: repo-lifecycle-classification, Property 18: Rows expose the required fields
 *
 * Every row produced by `buildRows(repos, overrides, now)` must carry the
 * display-relevant fields the graveyard page renders (Requirement 8.5):
 *  - a string `name`,
 *  - a `state` that is one of the five lifecycle states,
 *  - a non-negative integer `daysQuiet`, and
 *  - a `decayLevel` that is non-null IF AND ONLY IF the row's state is `ghost`
 *    or `zombie` (null for tombstone, coffin, and risen).
 *
 * The decay-level presence rule is the core of this property: ghost and zombie
 * are the only decaying states, so a non-null decay level must line up exactly
 * with those two states and nothing else.
 *
 * Validates: Requirements 8.5
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildRows,
  type GraveyardRow,
} from "@/lib/graveyard-view";
import { type LifecycleState, type Override } from "@/lib/lifecycle";
import { arbRepoFacts, arbOverride, arbIso } from "./arbitraries";

/** The five lifecycle states, used to validate each row's `state` field. */
const LIFECYCLE_STATES: readonly LifecycleState[] = [
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
];

describe("Property 18: Rows expose the required fields", () => {
  it("each row has name, state, daysQuiet, and a decay level iff ghost or zombie", () => {
    fc.assert(
      fc.property(
        // 0..30 repositories, including the empty-input boundary.
        fc.array(arbRepoFacts, { minLength: 0, maxLength: 30 }),
        // A sparse override map keyed by repo name; most repos get no override.
        fc.dictionary(fc.string(), arbOverride),
        arbIso,
        (repos, overrides: Record<string, Override>, now) => {
          const rows: GraveyardRow[] = buildRows(repos, overrides, now);

          for (const row of rows) {
            // name is a string.
            expect(typeof row.name).toBe("string");

            // state is one of the five lifecycle states.
            expect(LIFECYCLE_STATES).toContain(row.state);

            // daysQuiet is a non-negative integer.
            expect(Number.isInteger(row.daysQuiet)).toBe(true);
            expect(row.daysQuiet).toBeGreaterThanOrEqual(0);

            // decayLevel is non-null iff the state is ghost or zombie.
            const expectsDecay =
              row.state === "ghost" || row.state === "zombie";
            expect(row.decayLevel !== null).toBe(expectsDecay);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
