import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { edgeCopy, type EdgeKind } from "@/lib/edge-states";

const KINDS: EdgeKind[] = [
  "not-found",
  "rate-limited",
  "server-error",
  "empty",
  "app-not-found",
];

function sentenceCount(text: string): number {
  return text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim() !== "").length;
}

describe("edge copy properties", () => {
  // Feature: landing-mobile-states, Property 6: Edge copy is short, kind of voice and date free
  // **Validates: Requirements 7.2, 7.5, 7.7**
  it("is non-empty, short, 1-2 sentences and digit free for every kind", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), (kind) => {
        const { heading, body } = edgeCopy(kind);
        expect(heading.trim().length).toBeGreaterThan(0);
        expect(body.trim().length).toBeGreaterThan(0);
        expect(body.length).toBeLessThanOrEqual(200);
        const n = sentenceCount(body);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(2);
        expect(/\d/.test(heading)).toBe(false);
        expect(/\d/.test(body)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("server-error differs from rate-limited and required headings exist", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const server = edgeCopy("server-error");
        const limited = edgeCopy("rate-limited");
        expect(server.heading).not.toBe(limited.heading);
        expect(server.body).not.toBe(limited.body);
        expect(edgeCopy("not-found").heading).toBe(
          "No one by that name rests here",
        );
        expect(limited.heading).toBe("The gates are locked for now");
      }),
      { numRuns: 100 },
    );
  });
});
