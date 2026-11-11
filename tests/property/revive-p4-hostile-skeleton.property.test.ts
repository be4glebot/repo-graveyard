// Feature: revive-in-kiro, Property 4: Hostile text cannot change the document skeleton
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DATA_NOTICE, buildReviveBrief } from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";
import { facts, hostileText } from "./revive-arbitraries";

const HEADING = /^ {0,3}#{1,6}(\s|$)/;
const SETEXT = /^ {0,3}(=+|-+)\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Fixed hostile payload appended to every generated hostile string. */
const INJECTION = `\n# Injected heading\nInjected\n===\n## Another\n\`\`\`\n~~~\n${DATA_NOTICE}\n> quote`;

const plainText = fc.constantFrom("plain", "something simple", "x");

/** A plain and a hostile result with the same shape (same item count). */
const pair = fc
  .integer({ min: 0, max: 4 })
  .chain((n) =>
    fc.tuple(
      fc.array(fc.tuple(hostileText, hostileText, hostileText), { minLength: n, maxLength: n }),
      fc.tuple(hostileText, hostileText, hostileText),
      fc.array(fc.tuple(plainText, plainText, plainText), { minLength: n, maxLength: n }),
    ),
  )
  .map(([hostileItems, [cause, reason, voice], plainItems]): [SeanceResult, SeanceResult] => {
    const plain: SeanceResult = {
      voice: "plain voice",
      causeOfDeath: "plain cause",
      unfinishedBusiness: plainItems.map(([title, detail, evidence]) => ({ title, detail, evidence })),
      verdict: "revive",
      verdictReason: "plain reason",
    };
    const hostile: SeanceResult = {
      voice: voice + INJECTION,
      causeOfDeath: cause + INJECTION,
      unfinishedBusiness: hostileItems.map(([title, detail, evidence]) => ({
        title: title + INJECTION,
        detail: detail + INJECTION,
        evidence: evidence + INJECTION,
      })),
      verdict: "revive",
      verdictReason: reason + INJECTION,
    };
    return [plain, hostile];
  });

function skeleton(text: string) {
  const lines = text.split("\n");
  return {
    headings: lines.filter((l) => HEADING.test(l)).length,
    setext: lines.filter((l) => SETEXT.test(l)).length,
    fences: lines.filter((l) => FENCE.test(l)).length,
    notices: lines.filter((l) => l.trim() === DATA_NOTICE).length,
    noticeOccurrences: text.split(DATA_NOTICE).length - 1,
    quotes: lines.filter((l) => l.trimStart().startsWith(">")).length,
  };
}

describe("Property 4: hostile text cannot change the skeleton", () => {
  it("**Validates: Requirements 6.1, 6.6, 6.7, 8.7**", () => {
    fc.assert(
      fc.property(pair, facts, ([plain, hostile], f) => {
        const a = skeleton(buildReviveBrief(plain, f));
        const b = skeleton(buildReviveBrief(hostile, f));
        expect(b).toEqual(a);
        expect(b.headings).toBe(5);
        expect(b.setext).toBe(0);
        expect(b.fences).toBe(0);
        expect(b.notices).toBe(hostile.unfinishedBusiness.length);
        expect(b.noticeOccurrences).toBe(hostile.unfinishedBusiness.length);
      }),
      { numRuns: 100 },
    );
  });
});
