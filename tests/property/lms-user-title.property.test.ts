/**
 * Feature: landing-mobile-states, Property 4: Per-user title text is unchanged
 *
 * **Validates: Requirements 3.5**
 *
 * For any valid GitHub username, `generateMetadata` of `/g/[username]` titles
 * the page exactly `Repo Graveyard \u2014 {username}` (em dash U+2014).
 * Page-module server-only imports are mocked to inert stubs, as in
 * tests/dom/metadata.test.ts.
 */
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/graveyard-loader", () => ({ loadGraveyard: vi.fn() }));
vi.mock("@/lib/estate-loader", () => ({ loadEstate: vi.fn() }));

import { generateMetadata } from "@/app/g/[username]/page";

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

/** Valid GitHub logins: 1-39 chars of alphanumerics and single hyphens. */
const usernameArb = fc
  .array(fc.constantFrom(...ALNUM, "-"), { minLength: 1, maxLength: 39 })
  .map((chars) => chars.join(""));

describe("Property 4: Per-user title text is unchanged", () => {
  it("title is exactly 'Repo Graveyard \u2014 {username}'", async () => {
    await fc.assert(
      fc.asyncProperty(usernameArb, async (username) => {
        const meta = await generateMetadata({
          params: Promise.resolve({ username }),
          searchParams: Promise.resolve({}),
        });
        expect(meta.title).toEqual({
          absolute: `Repo Graveyard \u2014 ${username}`,
        });
      }),
      { numRuns: 100 },
    );
  });
});
