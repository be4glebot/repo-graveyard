// Feature: revive-in-kiro, Property 8: Slugs are always valid
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/revive-brief";

describe("Property 8: Slugs are always valid", () => {
  /**
   * **Validates: Requirements 5.7, 5.9**
   */
  it("returns a non-empty slug of a-z, 0-9 and - with no edge dashes", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (repo) => {
        const slug = slugify(repo);
        expect(slug).toMatch(/^[a-z0-9-]+$/);
        expect(slug.startsWith("-")).toBe(false);
        expect(slug.endsWith("-")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.7, 5.9**
   */
  it("falls back to `repo` when no valid character remains", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(" ", "-", "_", ".", "/", "é", "日", "😀", "\n") }),
        (repo) => {
          expect(slugify(repo)).toBe("repo");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("slugifies a typical name", () => {
    expect(slugify("My_Cool.Repo")).toBe("my-cool-repo");
    expect(slugify("")).toBe("repo");
  });
});
