/**
 * Feature: repo-lifecycle-classification, Property 17: Grouping partitions the classified repos
 *
 * For `rows = buildRows(repos, overrides, now)` and `groups =
 * groupByState(rows)`, grouping must be a true partition of the classified
 * rows:
 *  - every input repo appears in exactly one group (the group sizes sum to the
 *    input length),
 *  - each row sits in the group whose key matches its own `state`,
 *  - within each group the relative order matches the input order.
 *
 * All three claims are captured by the single structural equality
 * `groups[state] === rows.filter((r) => r.state === state)` for every state:
 * filtering preserves input order and keeps exactly the rows of that state, so
 * matching it proves membership, exclusivity, and order preservation at once.
 * The summed-length check is asserted separately as an explicit partition
 * guard.
 *
 * Validates: Requirements 8.1
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildRows,
  groupByState,
  STATE_ORDER,
  type GraveyardRow,
} from "@/lib/graveyard-view";
import { type Override } from "@/lib/lifecycle";
import { arbRepoFacts, arbOverride, arbIso } from "./arbitraries";

describe("Property 17: Grouping partitions the classified repos", () => {
  it("every repo lands in exactly one state group, preserving input order", () => {
    fc.assert(
      fc.property(
        // 0..30 repositories, including the empty-input boundary.
        fc.array(arbRepoFacts, { minLength: 0, maxLength: 30 }),
        // A sparse override map: some repo names get an override, keyed by name.
        fc.dictionary(fc.string(), arbOverride),
        arbIso,
        (repos, overrides: Record<string, Override>, now) => {
          const rows: GraveyardRow[] = buildRows(repos, overrides, now);
          const groups = groupByState(rows);

          // One row per input repo, in order.
          expect(rows).toHaveLength(repos.length);

          // Partition guard: group sizes sum to the input length.
          const total = STATE_ORDER.reduce(
            (sum, state) => sum + groups[state].length,
            0,
          );
          expect(total).toBe(repos.length);

          // Membership, exclusivity, and within-group order: each group equals
          // the input-ordered filter of rows for that state.
          for (const state of STATE_ORDER) {
            const expected = rows.filter((row) => row.state === state);
            expect(groups[state]).toEqual(expected);
            // Every row in the group genuinely carries that state.
            for (const row of groups[state]) {
              expect(row.state).toBe(state);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
