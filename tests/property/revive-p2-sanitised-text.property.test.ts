// Feature: revive-in-kiro, Property 2: Sanitised text is one inert line
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { sanitiseInline, DATA_NOTICE } from "@/lib/revive-brief";
import { hostileText } from "./revive-arbitraries";

const LINE_BREAKS = /[\r\n\u0085\u2028\u2029\v\f]/;
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const BLOCK_MARKERS = "#>*+-=_|~<[`:";
const NOTICE_LOOSE = new RegExp(
  DATA_NOTICE.split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+"),
  "i",
);

function assertInert(out: string): void {
  // Non-empty, single line.
  expect(out.length).toBeGreaterThan(0);
  expect(LINE_BREAKS.test(out)).toBe(false);

  // After zero to 100 leading spaces or tabs, no unescaped block marker or "#".
  const body = out.replace(/^[ \t]{0,100}/, "");
  const first = body.charAt(0);
  expect(first === "#").toBe(false);
  expect(BLOCK_MARKERS.includes(first)).toBe(false);
  // A leading ordered-list marker ("1." or "1)") must have its delimiter escaped.
  expect(/^\d+[.)]/.test(body)).toBe(false);

  // No run of three or more unescaped backticks or tildes.
  expect(/`{3}|~{3}/.test(out)).toBe(false);

  // The Data_Notice is neutralised, and the text is valid Unicode.
  expect(NOTICE_LOOSE.test(out)).toBe(false);
  expect(LONE_SURROGATE.test(out)).toBe(false);
}

describe("Property 2: Sanitised text is one inert line", () => {
  it("holds for hostile text", () => {
    // **Validates: Requirements 6.1, 6.2, 6.3, 6.7, 6.10, 7.9**
    fc.assert(
      fc.property(hostileText, (raw) => {
        assertInert(sanitiseInline(raw));
      }),
      { numRuns: 100 },
    );
  });

  it("holds for arbitrary full-Unicode strings", () => {
    // **Validates: Requirements 6.1, 6.2, 6.3, 6.7, 6.10, 7.9**
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 200 }), (raw) => {
        assertInert(sanitiseInline(raw));
      }),
      { numRuns: 100 },
    );
  });
});
