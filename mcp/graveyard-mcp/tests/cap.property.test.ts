import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RESULT_CAP, TRUNCATION_MARKER, byteLength, capResult } from "../src/cap";

// Characters of 1, 2, 3 and 4 UTF-8 bytes (the last are surrogate pairs in UTF-16). No newlines.
const unit = fc.constantFrom("a", "Z", " ", "é", "ß", "世", "€", "👻", "🧟", "𝒳");

const shortLine = fc.string({ unit, maxLength: 40 });
const longLine = fc
  .tuple(fc.string({ unit, minLength: 1, maxLength: 30 }), fc.integer({ min: 100, max: 1500 }))
  .map(([s, n]) => s.repeat(n));
const line = fc.oneof({ weight: 4, arbitrary: shortLine }, { weight: 1, arbitrary: longLine });
const lines = fc.array(line, { maxLength: 400 });

// A head that alone exceeds the cap, and heads/bodies of any size.
const hugeHead = fc.array(longLine, { minLength: 1, maxLength: 3 });
const anyHead = fc.oneof(fc.array(shortLine, { maxLength: 5 }), hugeHead);

const hasLoneSurrogate = (s: string) => !s.isWellFormed();

function check(head: string[], body: string[]): void {
  const all = [...head, ...body];
  const full = all.join("\n");
  const out = capResult(head, body);

  // Requirement 10.1: never above the cap, measured in UTF-8 bytes.
  expect(byteLength(out)).toBeLessThanOrEqual(RESULT_CAP);

  if (byteLength(full) <= RESULT_CAP) {
    // Requirement 10.5: unchanged, no marker added.
    expect(out).toBe(full);
    return;
  }

  // Requirements 10.2, 10.6: marker on its own final line.
  expect(out.endsWith("\n" + TRUNCATION_MARKER)).toBe(true);
  const kept = out.slice(0, out.length - TRUNCATION_MARKER.length - 1);

  // Requirement 10.4: never split a surrogate pair or produce invalid UTF-8.
  expect(hasLoneSurrogate(out)).toBe(false);

  const keptLines = kept.split("\n");
  if (all.length > 0 && keptLines.length === 1 && keptLines[0] !== all[0]) {
    // First line alone did not fit: the kept text is a code-point prefix of it.
    expect(all[0].startsWith(keptLines[0])).toBe(true);
  } else {
    // Requirements 10.2, 10.3: whole lines, in order, dropped from the end.
    expect(keptLines.length).toBeLessThan(all.length);
    expect(keptLines).toEqual(all.slice(0, keptLines.length));
    // Maximal: the next line would not have fit.
    const next = all[keptLines.length];
    expect(byteLength(kept + "\n" + next + "\n" + TRUNCATION_MARKER)).toBeGreaterThan(RESULT_CAP);
  }
}

describe("capResult property tests", () => {
  // Feature: graveyard-mcp, Property 13: Result cap
  // **Validates: Requirements 6.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**
  it("keeps results within the cap, at line and character boundaries", () => {
    fc.assert(
      fc.property(anyHead, lines, (head, body) => check(head, body)),
      { numRuns: 200 },
    );
  });

  // Feature: graveyard-mcp, Property 13: Result cap
  it("returns input within the cap unchanged without the marker", () => {
    fc.assert(
      fc.property(fc.array(shortLine, { maxLength: 5 }), fc.array(shortLine, { maxLength: 20 }), (head, body) => {
        const out = capResult(head, body);
        expect(out).toBe([...head, ...body].join("\n"));
        expect(out.includes(TRUNCATION_MARKER)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: graveyard-mcp, Property 13: Result cap
  it("cuts a single oversized multi-byte line on a code point", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom("世", "👻", "é", "a"), minLength: 1, maxLength: 20 }),
        fc.integer({ min: 5000, max: 20000 }),
        (s, n) => check([s.repeat(n)], ["tail"]),
      ),
      { numRuns: 100 },
    );
  });
});
