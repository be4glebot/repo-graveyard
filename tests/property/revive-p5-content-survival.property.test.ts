// Feature: revive-in-kiro, Property 5: Content survives when nothing is cut
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BRIEF_SIZE_CAP,
  buildReviveBrief,
  renderReviveBrief,
  sanitiseInline,
  utf8Length,
} from "@/lib/revive-brief";
import { facts, hostileResult, validSeanceResult } from "./revive-arbitraries";

const inputs = fc.oneof(fc.tuple(validSeanceResult, facts), fc.tuple(hostileResult, facts));

describe("Property 5: content survives when nothing is cut", () => {
  /**
   * **Validates: Requirements 5.3, 8.4**
   */
  it("contains every sanitised title and the sanitised verdictReason when the unlimited render fits", () => {
    fc.assert(
      fc.property(inputs, ([result, f]) => {
        const unlimited = renderReviveBrief(result, f, { capBytes: Infinity });
        fc.pre(utf8Length(unlimited) <= BRIEF_SIZE_CAP);

        const brief = buildReviveBrief(result, f);
        expect(brief).toBe(unlimited);
        for (const item of result.unfinishedBusiness) {
          expect(brief).toContain(sanitiseInline(item.title));
        }
        expect(brief).toContain(sanitiseInline(result.verdictReason));
      }),
      { numRuns: 100 },
    );
  });
});
