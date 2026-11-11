import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  loadingLabel,
  usernameFromPath,
  LOADING_GENERIC,
  LOADING_NAME_MAX,
} from "@/lib/edge-states";

// Feature: landing-mobile-states, Property 8: Loading label is safe, bounded and falls back
// **Validates: Requirements 8.1, 8.5, 8.6**

const PREFIX = "Digging up ";
const SUFFIX = "'s graveyard…";

function tryDecode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

// Mix of arbitrary text, markup characters, %-escapes (valid and malformed).
const rawArb = fc.oneof(
  fc.string({ unit: "binary", maxLength: 120 }),
  fc.string({ maxLength: 120 }),
  fc
    .array(
      fc.oneof(
        fc.constantFrom("%", "%E0%A4%A", "%zz", "%41", "%F0%9F%91%BB", "<", ">", "&", '"', "'", "<script>"),
        fc.string({ maxLength: 8 }),
      ),
      { maxLength: 30 },
    )
    .map((p) => p.join("")),
  fc.string({ unit: "grapheme", minLength: 30, maxLength: 80 }),
);

describe("Property 8: Loading label is safe, bounded and falls back", () => {
  it("never throws and follows the label contract for any string", () => {
    fc.assert(
      fc.property(rawArb, (raw) => {
        const out = loadingLabel(raw);
        const decoded = tryDecode(raw);
        if (raw === "" || decoded === null || decoded === "") {
          expect(out).toBe(LOADING_GENERIC);
          return;
        }
        expect(out.startsWith(PREFIX)).toBe(true);
        expect(out.endsWith(SUFFIX)).toBe(true);
        const name = out.slice(PREFIX.length, out.length - SUFFIX.length);
        const points = Array.from(decoded);
        if (points.length > LOADING_NAME_MAX) {
          expect(name).toBe(points.slice(0, LOADING_NAME_MAX).join("") + "…");
          expect(Array.from(name).length).toBe(LOADING_NAME_MAX + 1);
        } else {
          // Kept literally: markup characters are not altered or escaped.
          expect(name).toBe(decoded);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("falls back for undefined, empty and malformed input", () => {
    expect(loadingLabel(undefined)).toBe("Digging up this graveyard…");
    expect(loadingLabel("")).toBe("Digging up this graveyard…");
    expect(loadingLabel("%")).toBe("Digging up this graveyard…");
    expect(loadingLabel("%E0%A4%A")).toBe("Digging up this graveyard…");
  });

  it("preserves markup characters literally", () => {
    expect(loadingLabel("%3Cb%3E%26")).toBe("Digging up <b>&'s graveyard…");
  });

  it("truncates by code points, not UTF-16 units", () => {
    const name = "👻".repeat(40);
    const out = loadingLabel(encodeURIComponent(name));
    expect(out).toBe(`Digging up ${"👻".repeat(39)}…'s graveyard…`);
  });

  it("usernameFromPath never throws and returns a non-empty slash-free segment or undefined", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 80 }), (p) => {
        const seg = usernameFromPath(p);
        if (seg !== undefined) {
          expect(seg.length).toBeGreaterThan(0);
          expect(seg).not.toMatch(/[/?#]/);
        }
      }),
      { numRuns: 200 },
    );
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !/[/?#]/.test(s)),
        fc.constantFrom("", "/", "/repo"),
        (seg, tail) => {
          expect(usernameFromPath(`/g/${seg}${tail}`)).toBe(seg);
        },
      ),
      { numRuns: 100 },
    );
    expect(usernameFromPath("/g/")).toBeUndefined();
    expect(usernameFromPath("/estate")).toBeUndefined();
  });
});
