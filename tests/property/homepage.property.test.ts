/**
 * Feature: repo-details-hover-panel, Property 2: Homepage validator accepts only https
 *
 * For any string or null, `isValidHttpsHomepage` returns true iff the input
 * parses as a URL with scheme exactly `https`, and never throws. When true,
 * `homepageDomain` is a non-empty host with no scheme/path/query/fragment;
 * otherwise it is null.
 *
 * **Validates: Requirements 9.2, 9.3, 11.7, 11.8**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { homepageDomain, isValidHttpsHomepage } from "@/lib/repoDetails/homepage";

/** Independent oracle: does the string parse as a URL with scheme exactly https? */
function oracleIsHttps(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

const host = fc.domain();
const pathPart = fc.webPath();

const inputArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.string(),
  fc.string({ unit: "binary" }),
  fc.webUrl({ validSchemes: ["https"], withQueryParameters: true, withFragments: true }),
  fc.webUrl({ validSchemes: ["http"], withQueryParameters: true, withFragments: true }),
  fc.tuple(fc.constantFrom("javascript:", "data:", "ftp://", "file://", "mailto:", "HTTP://", "ws://", "//", ""), fc.string()).map(([p, s]) => p + s),
  fc.tuple(fc.constantFrom("https://", "HTTPS://", "  https://", "https:\n//", "https:/", "https:"), host, pathPart).map(([p, h, x]) => p + h + x),
);

describe("Feature: repo-details-hover-panel, Property 2: Homepage validator accepts only https", () => {
  it("never throws and returns true iff the scheme parses as exactly https", () => {
    fc.assert(
      fc.property(inputArb, (raw) => {
        let result: boolean | undefined;
        expect(() => {
          result = isValidHttpsHomepage(raw);
        }).not.toThrow();
        expect(result).toBe(oracleIsHttps(raw));
      }),
      { numRuns: 200 },
    );
  });

  it("homepageDomain is a bare non-empty host when valid, otherwise null; never throws", () => {
    fc.assert(
      fc.property(inputArb, (raw) => {
        let domain: string | null | undefined;
        expect(() => {
          domain = homepageDomain(raw);
        }).not.toThrow();
        if (isValidHttpsHomepage(raw)) {
          expect(typeof domain).toBe("string");
          expect((domain as string).length).toBeGreaterThan(0);
          expect(domain as string).not.toMatch(/[/?#\s]|:\/\//);
          expect(domain as string).not.toMatch(/^https?:/i);
        } else {
          expect(domain).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it("rejects well-formed non-https URLs", () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ["http"] }), (raw) => {
        expect(isValidHttpsHomepage(raw)).toBe(false);
        expect(homepageDomain(raw)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("accepts generated https URLs and returns their host", () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ["https"], withQueryParameters: true, withFragments: true }), (raw) => {
        expect(isValidHttpsHomepage(raw)).toBe(true);
        expect(homepageDomain(raw)).toBe(new URL(raw).host);
      }),
      { numRuns: 100 },
    );
  });
});
