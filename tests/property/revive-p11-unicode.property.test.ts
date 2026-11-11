// Feature: revive-in-kiro, Property 11: Output is well-formed Unicode and escapes are never split
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildKiroPrompt, buildReviveBrief } from "@/lib/revive-brief";
import { facts, hostileResult, oversizeFacts, oversizeResult, validSeanceResult } from "./revive-arbitraries";

const inputs = fc.oneof(
  fc.tuple(validSeanceResult, facts),
  fc.tuple(hostileResult, facts),
  fc.tuple(oversizeResult, oversizeFacts),
  fc.tuple(oversizeResult, facts),
  fc.tuple(validSeanceResult, oversizeFacts),
);

const hasLoneSurrogate = (s: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

/** A backslash run of odd length directly before an ellipsis means an escape was cut. */
const hasDanglingBackslash = (s: string): boolean => /(?<!\\)(?:\\\\)*\\…/.test(s);

describe("Property 11: well-formed Unicode and unsplit escapes", () => {
  /**
   * **Validates: Requirements 7.9**
   */
  it("has no lone surrogates and no dangling backslash before the ellipsis", () => {
    fc.assert(
      fc.property(inputs, ([result, f]) => {
        for (const out of [buildReviveBrief(result, f), buildKiroPrompt(result, f)]) {
          expect(hasLoneSurrogate(out)).toBe(false);
          expect(hasDanglingBackslash(out)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
