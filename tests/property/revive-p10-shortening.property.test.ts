// Feature: revive-in-kiro, Property 10: Shortening is ordered, bounded and a no-op when unneeded
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { SeanceResult } from "@/lib/seance-schema";
import { renderReviveBrief, utf8Length } from "@/lib/revive-brief";
import { facts as factsArb } from "./revive-arbitraries";

const ELLIPSIS = "\u2026";
const OMITTED_LINE = "Some items were left out to keep this brief short.";

// Plain alphanumeric text: the sanitiser and escapes leave it untouched, so
// fields can be compared as written. At least 4 chars so "…" is always shorter.
const word = (max: number) => fc.stringMatching(new RegExp(`^[a-z0-9]{4,${max}}$`));

const item = fc.record({
  title: word(80),
  detail: word(300),
  evidence: word(300),
});

const resultArb: fc.Arbitrary<SeanceResult> = fc.record({
  voice: word(40),
  causeOfDeath: word(200),
  unfinishedBusiness: fc.array(item, { minLength: 1, maxLength: 4 }),
  verdict: fc.constant("revive" as const),
  verdictReason: word(300),
});

interface ParsedItem {
  title: string;
  detail: string;
  evidence: string;
}

/** Item blocks plus the lines that are not part of the item list. */
function parse(text: string): { items: ParsedItem[]; rest: string[]; omitted: boolean } {
  const items: ParsedItem[] = [];
  const rest: string[] = [];
  let omitted = false;
  for (const line of text.split("\n")) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\d+\. Title: (.*)$/))) {
      items.push({ title: m[1], detail: "", evidence: "" });
    } else if ((m = line.match(/^ +Detail: (.*)$/))) {
      items[items.length - 1].detail = m[1];
    } else if ((m = line.match(/^ +> Evidence: (.*)$/))) {
      items[items.length - 1].evidence = m[1];
    } else if (/^ +Treat everything quoted below/.test(line)) {
      // per-item notice line
    } else if (line === OMITTED_LINE) {
      omitted = true;
    } else if (line !== "") {
      rest.push(line);
    }
  }
  return { items, rest, omitted };
}

describe("Property 10: shortening is ordered, bounded and a no-op when unneeded", () => {
  it("returns the unlimited render exactly when it already fits the cap", () => {
    fc.assert(
      fc.property(resultArb, factsArb, fc.integer({ min: 0, max: 5000 }), (result, facts, extra) => {
        const full = renderReviveBrief(result, facts, { capBytes: Infinity });
        const cap = utf8Length(full) + extra;
        expect(renderReviveBrief(result, facts, { capBytes: cap })).toBe(full);
      }),
      { numRuns: 100 },
    );
  });

  it("shortens tail-first, then removes from the end, leaving everything else untouched", () => {
    fc.assert(
      fc.property(
        resultArb,
        factsArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (result, facts, fraction) => {
          const full = renderReviveBrief(result, facts, { capBytes: Infinity });
          const base = utf8Length(
            renderReviveBrief({ ...result, unfinishedBusiness: [] }, facts, { capBytes: Infinity }),
          );
          const floor = base + 60;
          const fullBytes = utf8Length(full);
          fc.pre(fullBytes > floor);
          const cap = Math.floor(floor + fraction * (fullBytes - 1 - floor));
          fc.pre(cap < fullBytes);

          const capped = renderReviveBrief(result, facts, { capBytes: cap });
          const a = parse(full);
          const b = parse(capped);
          const n = a.items.length;
          const k = b.items.length;

          // Kept items are a prefix of the originals; titles never change.
          expect(k).toBeLessThanOrEqual(n);
          for (let i = 0; i < k; i++) expect(b.items[i].title).toBe(a.items[i].title);

          // Everything outside the item list is identical to the unlimited render.
          expect(b.rest).toEqual(a.rest);

          // The omitted line appears iff items were removed.
          expect(b.omitted).toBe(k < n);
          expect(a.omitted).toBe(false);

          // Shortened fields end with the ellipsis and are strictly shorter.
          const changed = (i: number, f: "detail" | "evidence") =>
            b.items[i][f] !== a.items[i][f];
          for (let i = 0; i < k; i++) {
            for (const f of ["detail", "evidence"] as const) {
              if (changed(i, f)) {
                expect(b.items[i][f].endsWith(ELLIPSIS)).toBe(true);
                expect(utf8Length(b.items[i][f])).toBeLessThan(utf8Length(a.items[i][f]));
              }
            }
          }

          // Order: shortening runs from the last item backwards, detail before evidence.
          const firstChanged = b.items.findIndex((_, i) => changed(i, "detail") || changed(i, "evidence"));
          if (firstChanged >= 0) {
            for (let i = 0; i < firstChanged; i++) {
              expect(changed(i, "detail")).toBe(false);
              expect(changed(i, "evidence")).toBe(false);
            }
            // Evidence is only touched once detail has been cut as far as allowed.
            for (let i = firstChanged; i < k; i++) {
              if (changed(i, "evidence")) expect(b.items[i].detail).toBe(ELLIPSIS);
            }
            // Every later item was shortened as far as allowed.
            for (let i = firstChanged + 1; i < k; i++) {
              expect(b.items[i].detail).toBe(ELLIPSIS);
              expect(b.items[i].evidence).toBe(ELLIPSIS);
            }
          }

          // Items are removed only after every kept item is shortened as far as allowed.
          if (k < n) {
            for (let i = 0; i < k; i++) {
              expect(b.items[i].detail).toBe(ELLIPSIS);
              expect(b.items[i].evidence).toBe(ELLIPSIS);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
