import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseBaseUrl } from "../src/config";

function referenceParse(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

const validUrl = fc
  .record({
    scheme: fc.constantFrom("http", "https"),
    host: fc.domain(),
    port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
    path: fc.array(fc.stringMatching(/^[a-z0-9]{1,6}$/), { maxLength: 3 }),
    trailing: fc.constantFrom("", "/", "//"),
    query: fc.option(fc.stringMatching(/^[a-z0-9=&]{1,8}$/), { nil: undefined }),
    hash: fc.option(fc.stringMatching(/^[a-z0-9]{1,8}$/), { nil: undefined }),
  })
  .map(
    (p) =>
      `${p.scheme}://${p.host}${p.port ? `:${p.port}` : ""}${p.path.map((s) => `/${s}`).join("")}${p.trailing}${p.query ? `?${p.query}` : ""}${p.hash ? `#${p.hash}` : ""}`,
  );

const otherScheme = fc
  .tuple(fc.constantFrom("ftp", "file", "ws", "javascript", "data", "mailto"), fc.stringMatching(/^[a-z0-9]{0,8}$/))
  .map(([s, rest]) => `${s}://${rest}`);

describe("parseBaseUrl properties", () => {
  // Feature: graveyard-mcp, Property 16: Base URL parsing
  it("defaults for undefined and empty string", () => {
    expect(parseBaseUrl(undefined)).toEqual({ ok: true, baseUrl: "http://localhost:3000" });
    expect(parseBaseUrl("")).toEqual({ ok: true, baseUrl: "http://localhost:3000" });
  });

  // Feature: graveyard-mcp, Property 16: Base URL parsing
  it("accepts valid http(s) URLs without trailing slash, query or hash", () => {
    fc.assert(
      fc.property(validUrl, (raw) => {
        const result = parseBaseUrl(raw);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.baseUrl.endsWith("/")).toBe(false);
        expect(result.baseUrl).not.toContain("?");
        expect(result.baseUrl).not.toContain("#");
        const parsed = new URL(result.baseUrl);
        expect(["http:", "https:"]).toContain(parsed.protocol);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: graveyard-mcp, Property 16: Base URL parsing
  it("accepts iff the string parses as http(s); failures never contain the input", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.webUrl(), otherScheme, validUrl, fc.string({ unit: "binary" })),
        (raw) => {
          fc.pre(raw !== "");
          const result = parseBaseUrl(raw);
          const expected = referenceParse(raw);
          expect(result.ok).toBe(expected !== null);
          if (!result.ok) {
            expect(result.line.startsWith("GRAVEYARD_URL must be")).toBe(true);
            expect(result.line.length).toBeLessThanOrEqual(200);
            // The fixed line is constant, so it can only "contain" the input
            // if the input is itself a substring of that constant text.
            const fixed = parseBaseUrl("not a url");
            expect(fixed.ok).toBe(false);
            if (!fixed.ok) expect(result.line).toBe(fixed.line);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  // Feature: graveyard-mcp, Property 16: Base URL parsing
  it("failure lines never contain a distinctive input", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 60 }).filter((s) => referenceParse(s) === null && s !== ""),
        (raw) => {
          const result = parseBaseUrl(raw);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.line.includes(raw)).toBe(false);
            expect(result.line.length).toBeLessThanOrEqual(200);
          }
        },
      ),
      { numRuns: 200 },
    );
    fc.assert(
      fc.property(otherScheme, (raw) => {
        const result = parseBaseUrl(raw);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.line.includes(raw)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
