// Feature: revive-in-kiro, Property 9: Size caps hold for any input
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BRIEF_SIZE_CAP,
  PROMPT_SIZE_CAP,
  buildKiroPrompt,
  buildReviveBrief,
  utf8Length,
} from "@/lib/revive-brief";
import { facts, hostileResult, oversizeFacts, oversizeResult, validSeanceResult } from "./revive-arbitraries";

const bytes = (s: string): number => new TextEncoder().encode(s).length;

const inputs = fc.oneof(
  fc.tuple(validSeanceResult, facts),
  fc.tuple(hostileResult, facts),
  fc.tuple(oversizeResult, oversizeFacts),
  fc.tuple(oversizeResult, facts),
  fc.tuple(validSeanceResult, oversizeFacts),
);

describe("Property 9: size caps hold for any input", () => {
  /**
   * **Validates: Requirements 7.1, 7.2, 7.6, 8.5**
   */
  it("keeps the brief within 8192 bytes and the prompt within 2048 bytes", () => {
    fc.assert(
      fc.property(inputs, ([result, f]) => {
        const brief = buildReviveBrief(result, f);
        const prompt = buildKiroPrompt(result, f);

        expect(bytes(brief)).toBeLessThanOrEqual(BRIEF_SIZE_CAP);
        expect(bytes(prompt)).toBeLessThanOrEqual(PROMPT_SIZE_CAP);
        expect(utf8Length(brief)).toBe(bytes(brief));
        expect(utf8Length(prompt)).toBe(bytes(prompt));
      }),
      { numRuns: 100 },
    );
  });
});
