import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sanitiseInline } from "@/lib/revive-brief";
import { createClient } from "../src/client";
import { checkArgs } from "../src/validate";

const BASE = "http://localhost:3000";
const PREFIX = `${BASE}/api/graveyard/`;

// Feature: graveyard-mcp, Property 8: Echo bound and URL path encoding
describe("Property 8: echo bound and URL path encoding", () => {
  /** **Validates: Requirements 4.9** */
  it("echoes at most 40 code points of a string argument", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 200 }),
        fc.boolean(),
        (s, onRepo) => {
          // Prefix a character that is never valid so the argument is always rejected.
          const bad = `!${s}`;
          const args = onRepo ? { owner: "octo", repo: bad } : { owner: bad };
          const res = checkArgs(args, onRepo);
          expect(res.ok).toBe(false);
          if (res.ok) return;
          const idx = res.text.indexOf(" Got: ");
          expect(idx).toBeGreaterThan(-1);
          const echoed = res.text.slice(idx + " Got: ".length);
          const first40 = Array.from(bad).slice(0, 40).join("");
          expect(echoed).toBe(sanitiseInline(first40));
        },
      ),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 4.9** */
  it("never echoes more than 40 code points when no escaping applies", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(..."xyz!@ 09".split("")), maxLength: 300 }), (s) => {
        const bad = `!${s}`.replace(/^!/, "x!");
        const res = checkArgs({ owner: bad }, false);
        expect(res.ok).toBe(false);
        if (res.ok) return;
        const echoed = res.text.slice(res.text.indexOf(" Got: ") + " Got: ".length);
        expect(Array.from(echoed).length).toBeLessThanOrEqual(40);
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 4.9** */
  it("echoes nothing for non-string arguments", () => {
    const nonString = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.string(), { maxLength: 3 }),
      fc.dictionary(fc.string({ maxLength: 5 }), fc.string({ maxLength: 5 }), { maxKeys: 3 }),
    );
    fc.assert(
      fc.property(nonString, fc.boolean(), (v, onRepo) => {
        const args = onRepo ? { owner: "octo", repo: v } : { owner: v };
        const res = checkArgs(args, onRepo);
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.text).not.toContain("Got:");
      }),
      { numRuns: 100 },
    );
  });

  /** **Validates: Requirements 4.10** */
  it("encodes the owner as a single path segment", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: "binary", minLength: 1, maxLength: 60 }), async (owner) => {
        let seen = "";
        const client = createClient({
          baseUrl: BASE,
          fetch: (async (url: string | URL | Request) => {
            seen = String(url);
            return new Response("{}", { status: 500 });
          }) as typeof fetch,
        });
        await client.getGraveyard(owner);
        expect(seen.startsWith(PREFIX)).toBe(true);
        const segment = seen.slice(PREFIX.length);
        expect(segment).toBe(encodeURIComponent(owner));
        expect(segment).not.toMatch(/[/?#]/);
        expect(decodeURIComponent(segment)).toBe(owner);
      }),
      { numRuns: 200 },
    );
  });
});
