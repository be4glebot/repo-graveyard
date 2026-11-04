/**
 * Feature: repo-lifecycle-classification, Property 11: Days quiet is floored,
 * clamped, and falls back to createdAt
 *
 * `daysQuiet(repo, now)` must equal `max(0, floor((now − base) / msPerDay))`
 * where `base` is `pushedAt` when present and parseable, otherwise `createdAt`.
 * An unparseable `now`, or an unusable `base` (null/unparseable pushedAt AND
 * unparseable createdAt), yields 0. The result is always a non-negative integer
 * and never `NaN`.
 *
 * The expected value is computed with an INDEPENDENT reference below (its own
 * parse + floor + max(0, …)) so a defect in the production arithmetic cannot
 * hide behind a shared implementation.
 *
 * Validates: Requirements 4.1
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { daysQuiet, LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import { arbIso } from "./arbitraries";

/**
 * Independent parse: ISO 8601 string to epoch milliseconds, or `null` when the
 * input is absent or unparseable. Mirrors the spec's "parseable else fall
 * back" contract without reusing the production helper.
 */
function referenceParseMs(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Independent reference for `daysQuiet`, derived straight from Requirement 4.1:
 *   base = parseable(pushedAt) ?? parseable(createdAt)
 *   result = max(0, floor((now − base) / msPerDay))
 * with an unparseable `now` or unusable `base` collapsing to 0.
 */
function referenceDaysQuiet(
  pushedAt: string | null,
  createdAt: string,
  now: string,
): number {
  const nowMs = referenceParseMs(now);
  if (nowMs === null) {
    return 0;
  }
  const base = referenceParseMs(pushedAt) ?? referenceParseMs(createdAt);
  if (base === null) {
    return 0;
  }
  return Math.max(0, Math.floor((nowMs - base) / LIFECYCLE_CONFIG.msPerDay));
}

/**
 * A date-field generator that covers the full input space the property cares
 * about: valid ISO strings, unparseable strings (including the empty string),
 * and — when used for `pushedAt` — `null` to force the `createdAt` fallback.
 * Valid ISO values from `arbIso` also naturally produce future-relative-to-now
 * cases, exercising the `max(0, …)` clamp.
 */
const arbUnparseable = fc.constantFrom("not-a-date", "", "   ", "2023-13-45", "garbage");

/** `pushedAt`: nullable, valid, or unparseable. */
const arbPushedAt: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  arbIso,
  arbUnparseable,
);

/** `createdAt`: non-null, valid, or unparseable. */
const arbCreatedAt: fc.Arbitrary<string> = fc.oneof(arbIso, arbUnparseable);

describe("Property 11: Days quiet is floored, clamped, and falls back to createdAt", () => {
  it("daysQuiet equals the independent reference and is always a non-negative, non-NaN integer", () => {
    fc.assert(
      fc.property(
        arbPushedAt,
        arbCreatedAt,
        arbIso,
        (pushedAt, createdAt, now) => {
          const actual = daysQuiet({ pushedAt, createdAt }, now);
          const expected = referenceDaysQuiet(pushedAt, createdAt, now);

          // Matches the exact spec formula via an independent computation.
          if (actual !== expected) {
            return false;
          }
          // Never NaN.
          if (Number.isNaN(actual)) {
            return false;
          }
          // Always a non-negative integer.
          if (!Number.isInteger(actual) || actual < 0) {
            return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
