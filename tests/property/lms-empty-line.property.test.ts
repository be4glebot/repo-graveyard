import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { emptyGraveyardLine } from "@/lib/edge-states";

// Feature: landing-mobile-states, Property 7: Empty graveyard line names the owner
// **Validates: Requirements 7.6**

// GitHub usernames: alphanumerics and single hyphens, 1-39 chars.
const username = fc.stringMatching(/^[A-Za-z0-9]{1,20}(-[A-Za-z0-9]{1,10}){0,1}$/);

describe("Property 7: Empty graveyard line names the owner", () => {
  it("contains the username as a substring for any non-empty username", () => {
    fc.assert(
      fc.property(username, (name) => {
        expect(emptyGraveyardLine(name)).toContain(name);
      }),
      { numRuns: 200 },
    );
  });

  it("contains the username for arbitrary non-empty strings too", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        expect(emptyGraveyardLine(name)).toContain(name);
      }),
      { numRuns: 200 },
    );
  });

  it("adds no digits beyond those in the username", () => {
    fc.assert(
      fc.property(username, (name) => {
        const rest = emptyGraveyardLine(name).replace(name, "");
        expect(rest).not.toMatch(/\d/);
      }),
      { numRuns: 200 },
    );
  });
});
