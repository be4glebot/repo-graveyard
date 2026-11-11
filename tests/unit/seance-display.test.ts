import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { displayEvidence, removeUnbalancedBrackets } from "@/lib/seance-display";

describe("displayEvidence (display only)", () => {
  it("wraps the quote in quotation marks", () => {
    expect(displayEvidence("open issues: 0")).toBe("“open issues: 0”");
    expect(displayEvidence("oauth callback still broken")).toBe("“oauth callback still broken”");
  });

  it("trims leading and trailing punctuation and whitespace", () => {
    expect(displayEvidence("  , the redirect loops.  ")).toBe("“the redirect loops”");
    expect(displayEvidence('"wired up yet..."')).toBe("“wired up yet”");
    expect(displayEvidence("— a half-written parser; ")).toBe("“a half-written parser”");
    expect(displayEvidence("it\n  stalls\there")).toBe("“it stalls here”");
  });

  it("removes unbalanced brackets, keeps balanced ones", () => {
    expect(displayEvidence("(wired up yet.")).toBe("“wired up yet”");
    expect(displayEvidence("the redirect loops (see")).toBe("“the redirect loops see”");
    expect(displayEvidence("loops) in [the callback")).toBe("“loops in the callback”");
    expect(displayEvidence("fix (the redirect) now")).toBe("“fix (the redirect) now”");
    expect(displayEvidence("a [b (c] d)")).toBe("“a b (c d)”");
    expect(removeUnbalancedBrackets("((a)")).toBe("(a)");
  });

  it("keeps literal tags intact", () => {
    expect(displayEvidence("<b>bold</b>")).toBe("“<b>bold</b>”");
  });

  it("falls back to the original when nothing but punctuation is left", () => {
    expect(displayEvidence("...")).toBe("“...”");
    expect(displayEvidence("((")).toBe("“((”");
  });

  it("property: always quoted, no edge punctuation inside, brackets balanced", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (raw) => {
        const out = displayEvidence(raw);
        expect(out.startsWith("“")).toBe(true);
        expect(out.endsWith("”")).toBe(true);
        const inner = out.slice(1, -1);
        const cleaned = raw.replace(/\s+/g, " ").trim();
        if (/[\p{L}\p{N}]/u.test(cleaned)) {
          expect(inner).toBe(inner.trim());
          expect(inner).not.toMatch(/^[.,;:!?'"“”‘’`*_#\-–—…/\\|~]|[.,;:!?'"“”‘’`*_#\-–—…/\\|~]$/u);
          expect(removeUnbalancedBrackets(inner)).toBe(inner);
        }
      }),
      { numRuns: 300 },
    );
  });
});