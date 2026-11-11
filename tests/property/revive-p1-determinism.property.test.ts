// Feature: revive-in-kiro, Property 1: Builders are deterministic
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildKiroPrompt, buildReviveBrief } from "@/lib/revive-brief";
import { facts, hostileResult, oversizeFacts, oversizeResult, validSeanceResult } from "./revive-arbitraries";

const inputs = fc.oneof(
  fc.tuple(validSeanceResult, facts),
  fc.tuple(hostileResult, facts),
  fc.tuple(oversizeResult, oversizeFacts),
);

describe("Property 1: builders are deterministic", () => {
  /**
   * **Validates: Requirements 5.1, 5.12, 7.7, 8.3**
   */
  it("returns identical strings for equal inputs (second call uses deep clones)", () => {
    fc.assert(
      fc.property(inputs, ([result, f]) => {
        const resultClone = structuredClone(result);
        const factsClone = { ...f };

        expect(buildReviveBrief(resultClone, factsClone)).toBe(buildReviveBrief(result, f));
        expect(buildKiroPrompt(structuredClone(result), { ...f })).toBe(buildKiroPrompt(result, f));
      }),
      { numRuns: 100 },
    );
  });
});
