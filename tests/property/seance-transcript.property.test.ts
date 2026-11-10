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

  // Feature: the-seance, Property 13: Transcript builder adds no markup and never prints undefined
  // **Validates: Requirements 16.8, 16.12**
  it("adds no markup, never prints undefined or null, and numbers consecutively", () => {
    const mode = fc.constantFrom("keep", "absent", "empty", "blank");
    const apply = <T>(m: string, v: T, empty: T): T | undefined =>
      m === "keep" ? v : m === "absent" ? undefined : m === "empty" ? empty : (" \n " as unknown as T);

    const partial = fc
      .tuple(
        validSeanceResult,
        fc.array(mode, { minLength: 5, maxLength: 5 }),
        fc.array(fc.array(mode, { minLength: 3, maxLength: 3 }), {
          minLength: 5,
          maxLength: 5,
        }),
        fc.boolean(),
      )
      .map(([r, m, im, dropItems]) => {
        const out: Record<string, unknown> = {};
        const set = (k: string, v: unknown, e: unknown, mm: string) => {
          const val = apply(mm, v, e);
          if (val !== undefined) out[k] = val;
        };
        set("voice", r.voice, "", m[0]);
        set("causeOfDeath", r.causeOfDeath, "", m[1]);
        set("verdict", r.verdict, "", m[2]);
        set("verdictReason", r.verdictReason, "", m[3]);
        if (!dropItems || m[4] === "keep") {
          out.unfinishedBusiness = r.unfinishedBusiness.map((it, i) => {
            const o: Record<string, unknown> = {};
            (["title", "detail", "evidence"] as const).forEach((f, j) => {
              const val = apply(im[i][j], it[f], "");
              if (val !== undefined) o[f] = val;
            });
            return o;
          });
        }
        return out;
      });

    fc.assert(
      fc.property(partial, (input) => {
        const text = buildTranscriptText(input as never);

        expect(text).not.toMatch(/undefined|null/);
        expect(text).toMatch(/^[A-Za-z0-9 .,!?:\n]*$/);
        expect(text).not.toMatch(/\n\n\n/);
        expect(text).toBe(text.trim());
        expect(text.split("\n")).not.toContain("Verdict:");

        const nums = text
          .split("\n")
          .map((l) => /^(\d+)\./.exec(l))
          .filter((m): m is RegExpExecArray => m !== null)
          .map((m) => Number(m[1]));
        nums.forEach((n, i) => expect(n).toBe(i + 1));

        const items = (input.unfinishedBusiness ?? []) as Record<string, string>[];
        const expected = items.filter((it) =>
          ["title", "detail", "evidence"].some((f) => (it[f] ?? "").trim() !== ""),
        ).length;
        expect(nums.length).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});