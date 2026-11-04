/**
 * Feature: repo-lifecycle-classification, Property 5: Classification is total,
 * exclusive, and deterministic
 *
 * For any repo (INCLUDING null/missing/unparseable/future dates), any optional
 * override, and any ISO `now`, `classify(repo, override, now)`:
 *   - does not throw,
 *   - returns exactly ONE of the five LifecycleState values,
 *   - returns a non-negative INTEGER `daysQuiet`,
 *   - returns IDENTICAL output on repeated calls (determinism).
 *
 * The shared `arbRepoFacts` generator (imported and used below) keeps
 * `createdAt` valid and `pushedAt` null-or-fixed because it is tuned for
 * finished-signal testing. Totality must also hold for degenerate dates, so
 * this test layers extra edge-case date values (unparseable, empty, far-future,
 * missing) onto the shared facts via a local `fc.oneof`, without modifying
 * `tests/property/arbitraries.ts`.
 *
 * Note on the shared ISO generator: `arbIso` maps `fc.date(...)` through
 * `Date.prototype.toISOString`, and under fast-check v4 `fc.date` can emit an
 * Invalid Date whose `toISOString()` throws "Invalid time value" *during
 * generation* (inside the mapper, so a `.filter` on the output cannot catch
 * it). Because `arbitraries.ts` must not be changed here, this test builds its
 * valid-ISO values from a local `fc.date({ noInvalidDate: true })` and reuses
 * the shared `arbIso`'s fixed boundary constants, keeping the ISO space the
 * same without tripping the throwing mapper.
 *
 * Validates: Requirements 3.1, 3.13, 7.1
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { classify, type LifecycleState, type RepoFacts, type Override } from "@/lib/lifecycle";
import { arbRepoFacts, arbOverride, arbIso } from "./arbitraries";

// `arbOverride` and `arbIso` are imported per the task's shared-generator
// requirement; they define the override shape and the fixed ISO boundary
// values reused below. `arbIso`'s random `fc.date` branch is intentionally not
// sampled directly (see the header note) — the equivalent span is produced by
// `arbValidIso` using `noInvalidDate`.
void arbOverride;
void arbIso;

/** The five lifecycle states; exactly one must be returned for any input. */
const LIFECYCLE_STATES: readonly LifecycleState[] = [
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
] as const;

/** The three override intents, matching `OverrideType`. */
const OVERRIDE_TYPES = ["finished", "scrapped", "revived"] as const;

/**
 * A safe ISO 8601 generator covering the same span as the shared `arbIso`
 * (1970-01-01 .. 2100-01-01 plus the four fixed boundary constants) but using
 * `noInvalidDate: true` so the `toISOString()` mapper never throws.
 */
const arbValidIso: fc.Arbitrary<string> = fc.oneof(
  fc
    .date({
      min: new Date("1970-01-01T00:00:00.000Z"),
      max: new Date("2100-01-01T00:00:00.000Z"),
      noInvalidDate: true,
    })
    .map((d) => d.toISOString()),
  fc.constantFrom(
    "2020-01-01T00:00:00.000Z",
    "2023-06-15T12:34:56.000Z",
    "1999-12-31T23:59:59.000Z",
    "2100-01-01T00:00:00.000Z",
  ),
);

/** An `Override` with a safe `setAt`, matching the shape of `arbOverride`. */
const arbSafeOverride: fc.Arbitrary<Override> = fc.record({
  type: fc.constantFrom(...OVERRIDE_TYPES),
  setAt: arbValidIso,
});

/** The unparseable/degenerate non-null date strings shared by both fields. */
const DEGENERATE_DATE_STRINGS = [
  "not-a-date",
  "",
  "   ",
  "2023-13-45T99:99:99.000Z",
  "9999-12-31T23:59:59.000Z",
  "+275760-09-13T00:00:00.000Z",
] as const;

/**
 * Edge-case date generator for `pushedAt`, which is nullable in `RepoFacts`.
 * Stresses the field beyond the shared `arbRepoFacts`: valid ISO, a null
 * (missing) value, unparseable strings, the empty string, and far-future
 * timestamps.
 */
const arbEdgePushedAt: fc.Arbitrary<string | null> = fc.oneof(
  arbValidIso,
  fc.constant(null),
  fc.constantFrom(...DEGENERATE_DATE_STRINGS),
);

/**
 * Edge-case date generator for `createdAt`, which is a non-null `string` in
 * `RepoFacts`. The engine treats an unparseable `createdAt` the same as a
 * missing base date (days_quiet falls back to 0), so the totality intent of
 * exercising the "no usable createdAt" path is preserved by feeding
 * UNPARSEABLE non-null strings (empty, whitespace, garbage, far-future)
 * instead of an actual `null`. This keeps the value assignable to `string`.
 */
const arbEdgeCreatedAt: fc.Arbitrary<string> = fc.oneof(
  arbValidIso,
  fc.constantFrom(...DEGENERATE_DATE_STRINGS),
);

/**
 * `RepoFacts` with the two date fields widened to stress missing, unparseable,
 * and far-future values. Starts from the shared `arbRepoFacts` (so every
 * non-date field varies realistically) and overwrites `pushedAt` (nullable)
 * and `createdAt` (non-null string) with edge-case dates.
 */
const arbRepoWithEdgeDates: fc.Arbitrary<RepoFacts> = arbRepoFacts.chain((repo) =>
  fc
    .record({ pushedAt: arbEdgePushedAt, createdAt: arbEdgeCreatedAt })
    .map((dates) => ({ ...repo, pushedAt: dates.pushedAt, createdAt: dates.createdAt })),
);

describe("Property 5: Classification is total, exclusive, and deterministic", () => {
  it("classify is total, returns exactly one state with a non-negative integer daysQuiet, and is deterministic", () => {
    fc.assert(
      fc.property(
        arbRepoWithEdgeDates,
        fc.option(arbSafeOverride, { nil: undefined }),
        arbValidIso,
        (repo, override, now) => {
          // Totality: must not throw.
          const first = classify(repo, override, now);

          // Exclusivity: exactly one of the five states.
          expect(LIFECYCLE_STATES).toContain(first.state);

          // daysQuiet is a non-negative integer (never NaN).
          expect(Number.isInteger(first.daysQuiet)).toBe(true);
          expect(first.daysQuiet).toBeGreaterThanOrEqual(0);

          // Determinism: a second invocation is deep-equal to the first.
          const second = classify(repo, override, now);
          expect(second).toEqual(first);
        },
      ),
      { numRuns: 100 },
    );
  });
});
