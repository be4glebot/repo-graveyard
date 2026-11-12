import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildBadgeSnippets, type BadgeTarget } from "@/lib/badge-snippets";
import type { BadgeStyle } from "@/lib/badge";

const NUM_RUNS = 100;
const ALT = "Repo Graveyard";

const tricky = fc.constantFrom("/", "?", "#", "%", "(", ")", " ", "&", '"', "'", "<", ">", "*", "!", "\u00E9", "\u{1F47B}", "..", "%2F");

const name: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 30 }),
  fc.array(fc.oneof(tricky, fc.string({ minLength: 0, maxLength: 3 })), { minLength: 1, maxLength: 12 }).map((a) => a.join("")),
  fc.string({ unit: "grapheme", minLength: 1, maxLength: 20 }),
);

// A name must survive as a UTF-16-valid string for encodeURIComponent; drop lone surrogates.
const wellFormed = name.filter((s) => s.isWellFormed());

const site = fc.constantFrom("https://example.com", "http://localhost:3000", "https://repo-graveyard.vercel.app");
const style = fc.constantFrom<BadgeStyle>("haunted", "flat");

const target: fc.Arbitrary<BadgeTarget> = fc.oneof(
  wellFormed.map((owner) => ({ kind: "owner", owner }) as BadgeTarget),
  fc.tuple(wellFormed, wellFormed).map(([owner, repo]) => ({ kind: "repo", owner, repo }) as BadgeTarget),
);

function unescapeAttr(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Split "<path>[?query]" after the prefix into decoded segments, requiring one segment per name. */
function decodeSegments(url: string, prefix: string): { segments: string[]; query: string } {
  expect(url.startsWith(prefix)).toBe(true);
  const rest = url.slice(prefix.length);
  const qi = rest.indexOf("?");
  const path = qi === -1 ? rest : rest.slice(0, qi);
  const query = qi === -1 ? "" : rest.slice(qi);
  return { segments: path.split("/").map((s) => decodeURIComponent(s)), query };
}

describe("badge snippets", () => {
  // Feature: graveyard-badges, Property 18: Snippets are single-segment, correctly styled, and round-trip
  // **Validates: Requirements 7.9, 7.10, 7.11, 7.12, 8.3, 8.4**
  it("Property 18: snippets are single-segment, correctly styled, and round-trip", () => {
    fc.assert(
      fc.property(site, target, style, (s, t, st) => {
        const out = buildBadgeSnippets(s, t, st);
        const expected = t.kind === "owner" ? [t.owner] : [t.owner, t.repo];

        // Image URL: one segment per name, decodes back, style query only for flat.
        const img = decodeSegments(out.imageUrl, `${s}/api/badge/`);
        expect(img.segments).toEqual(expected);
        expect(img.query).toBe(st === "flat" ? "?style=flat" : "");

        // Preview URL: same path, relative.
        const prev = decodeSegments(out.previewUrl, "/api/badge/");
        expect(prev.segments).toEqual(expected);
        expect(prev.query).toBe(img.query);

        // Link URL: one segment per name, never carries style.
        const link = decodeSegments(out.linkUrl, `${s}/g/`);
        expect(link.segments).toEqual(expected);
        expect(link.query).toBe("");
        expect(out.linkUrl).not.toContain("?");

        // Markdown form, and no stray ")" or "(" inside the URLs.
        expect(out.markdown).toBe(`[![${ALT}](${out.imageUrl})](${out.linkUrl})`);
        expect(/[()\s]/.test(out.imageUrl)).toBe(false);
        expect(/[()\s]/.test(out.linkUrl)).toBe(false);

        // HTML embeds the same URLs after attribute unescaping.
        const m = /^<a href="([^"]*)"><img src="([^"]*)" alt="Repo Graveyard"><\/a>$/.exec(out.html);
        expect(m).not.toBeNull();
        expect(unescapeAttr(m![1])).toBe(out.linkUrl);
        expect(unescapeAttr(m![2])).toBe(out.imageUrl);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
