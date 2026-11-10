/**
 * Feature: repo-details-hover-panel, Property 3: Quiet phrase is total, deterministic
 *
 * `quietPhrase` returns the same non-empty string for the same inputs, never
 * throws or yields NaN/undefined, clamps future reference timestamps to the
 * zero-duration phrase, falls back to `createdAt` when `pushedAt` is unusable,
 * and returns the fixed fallback phrase when neither is usable.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.8**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  quietPhrase,
  QUIET_FALLBACK_PHRASE,
  QUIET_ZERO_PHRASE,
} from "@/lib/repoDetails/quietPhrase";

const RUNS = { numRuns: 100 };

const MIN_MS = Date.parse("2000-01-01T00:00:00.000Z");
const MAX_MS = Date.parse("2040-01-01T00:00:00.000Z");

const arbValidIso = fc
  .integer({ min: MIN_MS, max: MAX_MS })
  .map((ms) => new Date(ms).toISOString());

/** Strings that Date.parse rejects. */
const arbUnparseable = fc
  .oneof(
    fc.constantFrom("", "not a date", "yesterday", "2024-13-45", "NaN", "   "),
    fc.string({ maxLength: 12 }),
  )
  .filter((s) => Number.isNaN(Date.parse(s)));

const arbTimestamp = fc.oneof(arbValidIso, fc.constant(null), arbUnparseable);
const arbUnusable = fc.oneof(fc.constant(null), arbUnparseable);

const NUMERIC_BAD = /NaN|undefined|null|Infinity/;

describe("Feature: repo-details-hover-panel, Property 3: Quiet phrase is total, deterministic", () => {
  it("is total, deterministic, and non-empty for any timestamp mix", () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbTimestamp,
        fc.oneof(arbValidIso, arbUnparseable),
        (pushedAt, createdAt, renderedAt) => {
          const a = quietPhrase({ pushedAt, createdAt }, renderedAt);
          const b = quietPhrase({ pushedAt, createdAt }, renderedAt);
          expect(typeof a).toBe("string");
          expect(a.length).toBeGreaterThan(0);
          expect(a).toBe(b);
          expect(a).not.toMatch(NUMERIC_BAD);
        },
      ),
      RUNS,
    );
  });

  it("clamps a future reference timestamp to the zero-duration phrase", () => {
    fc.assert(
      fc.property(
        arbValidIso,
        fc.integer({ min: 0, max: 5 * 365 * 24 * 3600 * 1000 }),
        fc.boolean(),
        (renderedAt, offsetMs, viaCreated) => {
          const future = new Date(Date.parse(renderedAt) + offsetMs).toISOString();
          const ts = viaCreated
            ? { pushedAt: null, createdAt: future }
            : { pushedAt: future, createdAt: null };
          expect(quietPhrase(ts, renderedAt)).toBe(QUIET_ZERO_PHRASE);
        },
      ),
      RUNS,
    );
  });

  it("computes from createdAt when pushedAt is absent or unparseable", () => {
    fc.assert(
      fc.property(
        arbValidIso,
        arbValidIso,
        arbUnusable,
        (renderedAt, createdAt, pushedAt) => {
          expect(quietPhrase({ pushedAt, createdAt }, renderedAt)).toBe(
            quietPhrase({ pushedAt: createdAt, createdAt: null }, renderedAt),
          );
        },
      ),
      RUNS,
    );
  });

  it("returns the fixed fallback when neither timestamp is usable", () => {
    fc.assert(
      fc.property(arbUnusable, arbUnusable, arbValidIso, (pushedAt, createdAt, renderedAt) => {
        expect(quietPhrase({ pushedAt, createdAt }, renderedAt)).toBe(
          QUIET_FALLBACK_PHRASE,
        );
      }),
      RUNS,
    );
  });
});
