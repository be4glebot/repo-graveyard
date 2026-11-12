import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  BADGE_PALETTE,
  ELLIPSIS,
  FALLBACK_NOT_FOUND,
  FALLBACK_UNAVAILABLE,
  buildBadge,
  sanitizeBadgeText,
  segmentWidthPx,
  textWidthPx,
  truncateBadgeText,
} from "@/lib/badge";
import { isWellFormedXml } from "../helpers/xml";

const NUM_RUNS = 100;
const ENC = new TextEncoder();

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const hostileChars = fc.constantFrom("&", "<", ">", '"', "'");
const emoji = fc.constantFrom("\u{1F47B}", "\u{1F9DF}", "\u{1FAA6}", "\u{1F480}");

const anyText: fc.Arbitrary<string> = fc.oneof(
  fc.constant(""),
  fc.string({ unit: "binary", maxLength: 100 }), // includes control chars and lone surrogates
  fc.string({ unit: "grapheme", maxLength: 100 }), // unicode
  fc.string({ maxLength: 100 }),
  fc.array(hostileChars, { minLength: 1, maxLength: 200 }).map((a) => a.join("")),
  fc.array(emoji, { minLength: 1, maxLength: 200 }).map((a) => a.join("")),
  fc.integer({ min: 60, max: 70 }).chain((n) => fc.string({ minLength: n, maxLength: n })),
  fc.string({ minLength: 1000, maxLength: 1000 }),
  fc.string({ unit: "binary", minLength: 10_000, maxLength: 10_000 }),
  fc.constantFrom("\uD800", "\uDC00", "\uD800a", "\uFFFE\uFFFF", "\u0000\u0001\u001F", "a\tb\nc\rd"),
);

const anyTone = fc.oneof(
  fc.constantFrom(...(Object.keys(BADGE_PALETTE) as string[])),
  fc.constantFrom("", "constructor", "__proto__", "toString", "hasOwnProperty"),
  fc.string({ maxLength: 30 }),
);
const anyStyle = fc.oneof(fc.constantFrom("haunted", "flat", "", "FLAT", "x".repeat(33)), fc.string({ maxLength: 40 }));

const params = fc.record({ label: anyText, message: anyText, tone: anyTone, style: anyStyle });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function cleaned(s: string): string {
  return truncateBadgeText(sanitizeBadgeText(s));
}

function rootWidth(svg: string): number {
  const m = /^<svg [^>]*?\bwidth="([0-9.]+)"/.exec(svg);
  if (!m) throw new Error("no width attr");
  return Number(m[1]);
}

/** Independent integer-cent width computation for one code point. */
function centsFor(ch: string): number {
  // Unknown code points (outside the ASCII table and U+00B7, and not the ellipsis) cost 7 px.
  const cp = ch.codePointAt(0)!;
  const known = (cp >= 0x20 && cp <= 0x7e) || cp === 0xb7;
  if (!known && ch !== ELLIPSIS) return 700;
  return Math.round(textWidthPx(ch) * 100);
}

describe("badge builder properties", () => {
  // Feature: graveyard-badges, Property 1: Output is well-formed XML for any input
  it("Property 1: output is well-formed XML for any input", () => {
    // **Validates: Requirements 3.5, 6.1, 10.1**
    fc.assert(
      fc.property(params, (p) => {
        expect(isWellFormedXml(buildBadge(p))).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 2: Truncation never exceeds 64 and never alters short text
  it("Property 2: truncation never exceeds 64 and never alters short text", () => {
    // **Validates: Requirements 6.2**
    fc.assert(
      fc.property(anyText, (s) => {
        const sane = sanitizeBadgeText(s);
        const saneCps = Array.from(sane);
        const out = Array.from(truncateBadgeText(sane));
        expect(out.length).toBeLessThanOrEqual(64);
        if (saneCps.length <= 64) {
          expect(out).toEqual(saneCps);
        } else {
          expect(out).toEqual([...saneCps.slice(0, 63), ELLIPSIS]);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 3: Output is under 4,096 bytes
  it("Property 3: output is under 4,096 bytes", () => {
    // **Validates: Requirements 5.7, 6.4, 10.1**
    fc.assert(
      fc.property(params, (p) => {
        expect(ENC.encode(buildBadge(p)).length).toBeLessThan(4096);
      }),
      { numRuns: NUM_RUNS },
    );
    // Worst-case fixed inputs.
    for (const unit of ["'", '"', "&", "<", "\u{1F47B}"]) {
      for (const n of [64, 65, 10_000]) {
        const t = unit.repeat(n);
        for (const style of ["haunted", "flat"]) {
          const svg = buildBadge({ label: t, message: t, tone: "zombie", style });
          expect(ENC.encode(svg).length).toBeLessThan(4096);
          expect(isWellFormedXml(svg)).toBe(true);
        }
      }
    }
    // Both fallback badges.
    for (const message of [FALLBACK_NOT_FOUND, FALLBACK_UNAVAILABLE]) {
      for (const style of ["haunted", "flat"]) {
        const svg = buildBadge({ label: "repo graveyard", message, tone: "fallback", style });
        expect(ENC.encode(svg).length).toBeLessThan(4096);
      }
    }
  });

  // Feature: graveyard-badges, Property 4: Output is inert
  it("Property 4: output is inert", () => {
    // **Validates: Requirements 6.3, 6.6, 10.1**
    // Markup that must never appear anywhere (user `<` is always escaped).
    const forbiddenAnywhere: RegExp[] = [/<script/i, /<foreignObject/i, /<image/i, /<style/i];
    // Markup skeleton: tags with attribute values and text nodes blanked out, so
    // user text that merely spells "url(" or "href=" inside a text node is not
    // mistaken for an attribute or reference.
    const skeleton = (svg: string): string =>
      svg
        .replace(/"[^"]*"/g, '""')
        .replace(/>([^<]*)</g, "><");
    const forbiddenInSkeleton: RegExp[] = [
      /url\(/i,
      /data:/i,
      /@font-face/i,
      /\bxlink:href\b/i,
      /\bhref\b/i,
      /\son[A-Za-z0-9_:.-]*\s*=/i, // attribute name beginning with "on"
    ];
    // No attribute VALUE may reference an external resource either. Only
    // trusted constant values (xmlns, colours, path data, fonts) are allowed
    // to contain a URL, and `aria-label` carries sanitised, escaped text.
    const attrValuesOutsideLabel = (svg: string): string[] =>
      [...svg.matchAll(/\s([A-Za-z:-]+)="([^"]*)"/g)]
        .filter(([, name]) => name !== "aria-label")
        .map(([, , value]) => value);
    const hostile = fc.constantFrom(
      '<script>alert(1)</script>',
      '"><image href="http://x"/>',
      "' onload='alert(1)",
      "url(http://x)",
      "<foreignObject>",
      "xlink:href=http://x",
      "data:text/html,x",
      "@font-face",
    );
    const text = fc.oneof(anyText, hostile);
    fc.assert(
      fc.property(text, text, anyTone, anyStyle, (label, message, tone, style) => {
        const svg = buildBadge({ label, message, tone, style });
        for (const re of forbiddenAnywhere) expect(svg).not.toMatch(re);
        const skel = skeleton(svg);
        for (const re of forbiddenInSkeleton) expect(skel).not.toMatch(re);
        for (const v of attrValuesOutsideLabel(svg)) {
          expect(v).not.toMatch(/url\(|data:|javascript:/i);
          if (v !== "http://www.w3.org/2000/svg") expect(v).not.toMatch(/https?:/i);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 5: Width is monotone in text length
  it("Property 5: width is monotone in text length", () => {
    // **Validates: Requirements 3.4, 10.1**
    const nearLimit = fc
      .integer({ min: 60, max: 66 })
      .chain((n) => fc.string({ minLength: n, maxLength: n }));
    const base = fc.oneof(anyText, nearLimit, fc.constant("W".repeat(64)), fc.constant("i".repeat(64)));
    const oneChar = fc.oneof(
      fc.string({ minLength: 1, maxLength: 1 }),
      fc.constantFrom("W", "i", "\u4E2D", "\u00B7", "\uD800", "\n"),
    );
    fc.assert(
      fc.property(base, oneChar, anyTone, anyStyle, (s, c, tone, style) => {
        const a = rootWidth(buildBadge({ label: "repo graveyard", message: s, tone, style }));
        const b = rootWidth(buildBadge({ label: "repo graveyard", message: s + c, tone, style }));
        expect(b).toBeGreaterThanOrEqual(a);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 6: Segment widths follow the width formula
  it("Property 6: segment widths follow the width formula", () => {
    // **Validates: Requirements 3.4, 3.5**
    fc.assert(
      fc.property(anyText, anyText, anyStyle, (label, message, style) => {
        const expectedSegment = (s: string): number => {
          let cents = 0;
          for (const ch of Array.from(s)) cents += centsFor(ch);
          return Math.ceil((cents + 2000) / 100);
        };
        const l = cleaned(label);
        const m = cleaned(message);
        expect(segmentWidthPx(l)).toBe(expectedSegment(l));
        expect(segmentWidthPx(m)).toBe(expectedSegment(m));
        const svg = buildBadge({ label, message, tone: "ghost", style });
        expect(rootWidth(svg)).toBe(expectedSegment(l) + expectedSegment(m));
      }),
      { numRuns: NUM_RUNS },
    );
    // Unknown code points are charged exactly 7 px.
    expect(textWidthPx("\u4E2D")).toBe(7);
    expect(segmentWidthPx("\u4E2D\u4E2D")).toBe(34);
  });

  // Feature: graveyard-badges, Property 7: Builder is deterministic and substitutes defaults
  it("Property 7: builder is deterministic and substitutes defaults", () => {
    // **Validates: Requirements 6.7, 6.8**
    fc.assert(
      fc.property(params, (p) => {
        expect(buildBadge(p)).toBe(buildBadge({ ...p }));
      }),
      { numRuns: NUM_RUNS },
    );

    const validTones = new Set(Object.keys(BADGE_PALETTE).filter((k) => !k.includes("haunted") && !k.includes("flat")));
    const unknownTone = fc
      .oneof(
        fc.constantFrom("constructor", "__proto__", "toString", "hasOwnProperty", "hauntedLabel", "flatLabel", ""),
        fc.string({ maxLength: 20 }).map((s) => `zz!${s}`),
      )
      .filter((t) => !validTones.has(t));
    fc.assert(
      fc.property(anyText, anyText, unknownTone, fc.constantFrom("haunted", "flat"), (label, message, tone, style) => {
        expect(buildBadge({ label, message, tone, style })).toBe(buildBadge({ label, message, tone: "neutral", style }));
      }),
      { numRuns: NUM_RUNS },
    );

    const unknownStyle = fc
      .oneof(fc.constantFrom("", "FLAT", "Haunted", "x".repeat(40)), fc.string({ maxLength: 20 }).map((s) => `zz!${s}`))
      .filter((s) => s !== "haunted" && s !== "flat");
    fc.assert(
      fc.property(anyText, anyText, anyTone, unknownStyle, (label, message, tone, style) => {
        expect(buildBadge({ label, message, tone, style })).toBe(buildBadge({ label, message, tone, style: "haunted" }));
      }),
      { numRuns: NUM_RUNS },
    );

    // Unrecognised tone/style text never reaches the output.
    const marker = "ZZQ<&>\"'unknown";
    const svg = buildBadge({ label: "a", message: "b", tone: marker, style: marker });
    expect(svg).not.toContain("ZZQ");
  });

  // Feature: graveyard-badges, Property 8: Accessible name is identical and complete
  it("Property 8: accessible name is identical and complete", () => {
    // **Validates: Requirements 3.6**
    fc.assert(
      fc.property(params, (p) => {
        const svg = buildBadge(p);
        const root = /^<svg [^>]*>/.exec(svg)?.[0] ?? "";
        expect(root).toContain('role="img"');
        const aria = /\baria-label="([^"]*)"/.exec(root)?.[1];
        const title = /<title>([^<]*)<\/title>/.exec(svg)?.[1];
        expect(aria).toBeDefined();
        expect(title).toBeDefined();
        expect(aria).toBe(title);
        expect(unescapeXml(title as string)).toBe(`${cleaned(p.label)}: ${cleaned(p.message)}`);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
