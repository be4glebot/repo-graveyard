// Feature: revive-in-kiro, Property 3: The brief keeps a fixed structure for any model text
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DATA_NOTICE, buildReviveBrief } from "@/lib/revive-brief";
import { causeHeading } from "@/lib/seance-schema";
import { facts, hostileResult, markersFor, withMarkers } from "./revive-arbitraries";

const PREFIX = "p3";
const HEADING = /^ {0,3}#{1,6}(\s|$)/;
const SETEXT = /^ {0,3}(=+|-+)\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ITEM = /^(\d+)\. Title: /;

describe("Property 3: fixed brief structure", () => {
  it("**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.10, 6.4, 6.5, 6.6, 6.7, 8.6**", () => {
    fc.assert(
      fc.property(hostileResult, facts, (raw, f) => {
        const result = withMarkers(raw, PREFIX);
        const marks = markersFor(result, PREFIX);
        const text = buildReviveBrief(result, f);
        const lines = text.split("\n");

        // Exactly five ATX headings, in the fixed order, and no setext underline.
        const headingLines = lines.filter((l) => HEADING.test(l));
        expect(headingLines).toHaveLength(5);
        expect(headingLines[0].startsWith("# Revival brief: ")).toBe(true);
        expect(headingLines.slice(1)).toEqual([
          `## ${causeHeading(f.state)}`,
          "## Unfinished business",
          "## First step",
          "## How to use this in Kiro",
        ]);
        expect(lines.filter((l) => SETEXT.test(l))).toHaveLength(0);

        // No code fence lines at all, so the count is even.
        const fences = lines.filter((l) => FENCE.test(l));
        expect(fences).toHaveLength(0);
        expect(fences.length % 2).toBe(0);

        // Section order: title, link, state, cause heading, items, First step, How to use.
        const idx = {
          title: lines.findIndex((l) => l.startsWith("# Revival brief: ")),
          link: lines.findIndex((l) => l.startsWith("Repository: [")),
          state: lines.findIndex((l) => l.startsWith("State: ")),
          cause: lines.indexOf(`## ${causeHeading(f.state)}`),
          items: lines.indexOf("## Unfinished business"),
          first: lines.indexOf("## First step"),
          how: lines.indexOf("## How to use this in Kiro"),
        };
        expect(idx.title).toBe(0);
        const order = [idx.title, idx.link, idx.state, idx.cause, idx.items, idx.first, idx.how];
        expect(order.every((n) => n >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);

        // Items numbered 1..n with no gaps, one Data_Notice line per item,
        // each directly followed by a blockquote line.
        const itemNumbers = lines.flatMap((l) => {
          const m = ITEM.exec(l);
          return m ? [Number(m[1])] : [];
        });
        expect(itemNumbers).toEqual(itemNumbers.map((_, i) => i + 1));
        const noticeIdx = lines.flatMap((l, i) => (l.trim() === DATA_NOTICE ? [i] : []));
        expect(noticeIdx).toHaveLength(itemNumbers.length);
        expect(text.split(DATA_NOTICE).length - 1).toBe(itemNumbers.length);
        for (const i of noticeIdx) {
          expect(lines[i + 1].trimStart().startsWith("> Evidence: ")).toBe(true);
        }

        // Evidence appears only on blockquote lines; voice never appears.
        for (const item of marks.items) {
          for (const l of lines.filter((x) => x.includes(item.evidence))) {
            expect(l.trimStart().startsWith("> ")).toBe(true);
          }
        }
        expect(text).not.toContain(marks.voice);
      }),
      { numRuns: 100 },
    );
  });
});
