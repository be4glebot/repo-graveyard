import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  VERDICT_COPY,
  buildTranscriptText,
} from "@/lib/seance-transcript";
import { validSeanceResult } from "./seance-arbitraries";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value as object).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("seance transcript property tests", () => {
  // Feature: the-seance, Property 12: Transcript text contains everything, in order
  // **Validates: Requirements 16.7, 16.11, 20.18**
  it("contains every field in display order and is deterministic", () => {
    fc.assert(
      fc.property(validSeanceResult, (result) => {
        const frozen = deepFreeze(structuredClone(result));
        const text = buildTranscriptText(frozen);

        let cursor = 0;
        const expectNext = (needle: string) => {
          const at = text.indexOf(needle, cursor);
          expect(at, `missing or out of order: ${needle}`).toBeGreaterThanOrEqual(0);
          cursor = at + needle.length;
        };

        expectNext(result.voice);
        expectNext(result.causeOfDeath);
        result.unfinishedBusiness.forEach((it, i) => {
          expectNext(`${i + 1}. ${it.title}`);
          expectNext(it.detail);
          expectNext(it.evidence);
        });
        expectNext(VERDICT_COPY[result.verdict].word);
        expectNext(result.verdictReason);

        expect(buildTranscriptText(frozen)).toBe(text);
      }),
      { numRuns: 200 },
    );
  });
});
