import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { mapLoadError, retryAfterFromReset } from "@/lib/graveyard-payload";
import type { LoadError } from "@/lib/github";

const RUNS = { numRuns: 100 };

// Dates within a safe range for Date#toISOString.
const nowMsArb = fc.integer({ min: 0, max: 4_000_000_000_000 });
const offsetMsArb = fc.integer({ min: -10_000_000_000, max: 10_000_000_000 });

describe("graveyard errors", () => {
  // Feature: graveyard-mcp, Property 4: Retry-After from a reset time
  // **Validates: Requirements 1.15, 1.16**
  it("Property 4: Retry-After is whole seconds >= 1 for valid resets, undefined otherwise", () => {
    fc.assert(
      fc.property(nowMsArb, offsetMsArb, (nowMs, offset) => {
        const resetMs = nowMs + offset;
        const result = retryAfterFromReset(new Date(resetMs).toISOString(), nowMs);
        expect(result).toBeDefined();
        expect(Number.isInteger(result)).toBe(true);
        expect(result!).toBeGreaterThanOrEqual(1);
        expect(result).toBe(Math.max(1, Math.ceil((resetMs - nowMs) / 1000)));
      }),
      RUNS,
    );

    fc.assert(
      fc.property(
        nowMsArb,
        fc.oneof(
          fc.constant(null),
          fc.string().filter((s) => !Number.isFinite(Date.parse(s))),
        ),
        (nowMs, reset) => {
          expect(retryAfterFromReset(reset, nowMs)).toBeUndefined();
        },
      ),
      RUNS,
    );
  });

  // Feature: graveyard-mcp, Property 5: Load errors map to fixed responses without detail
  // **Validates: Requirements 1.13, 1.14, 1.15, 1.16, 1.17**
  it("Property 5: load errors map to fixed responses without detail", () => {
    const errorArb: fc.Arbitrary<LoadError> = fc.oneof(
      fc.constant<LoadError>({ kind: "invalid-username" }),
      fc.constant<LoadError>({ kind: "not-found" }),
      fc.oneof(
        fc.constant(null),
        offsetMsArb.map((o) => new Date(1_700_000_000_000 + o).toISOString()),
        fc.string(),
      ).map((resetAt): LoadError => ({ kind: "rate-limited", resetAt })),
      fc
        .option(fc.string(), { nil: undefined })
        .map((detail): LoadError => ({ kind: "server-error", detail })),
    );
    const fixed = {
      "invalid-username": { status: 400, error: "invalid-username" },
      "not-found": { status: 404, error: "not-found" },
      "rate-limited": { status: 429, error: "rate-limited" },
      "server-error": { status: 502, error: "server-error" },
    } as const;

    fc.assert(
      fc.property(errorArb, nowMsArb, fc.uuid(), (error, nowMs, marker) => {
        const withMarker: LoadError =
          error.kind === "server-error" ? { ...error, detail: marker } : error;
        const res = mapLoadError(withMarker, nowMs);
        const want = fixed[withMarker.kind];
        expect(res.status).toBe(want.status);
        expect(res.body).toEqual({ error: want.error });
        expect(JSON.stringify(res)).not.toContain(marker);
        if (withMarker.kind === "rate-limited") {
          expect(res.retryAfter).toBe(retryAfterFromReset(withMarker.resetAt, nowMs));
        } else {
          expect(res.retryAfter).toBeUndefined();
        }
      }),
      RUNS,
    );
  });
});
