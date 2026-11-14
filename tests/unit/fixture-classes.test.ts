import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Chrome controls use `fixture-*` classes (explorable-worlds 5.9).
 * Requirements: 11.1, 11.5, 11.11, 18.4.
 */
const FILES = [
  "components/scene/FilterChips.tsx",
  "components/scene/Pager.tsx",
  "components/scene/ReturnToGate.tsx",
  "components/scene/EstateErrorState.tsx",
];

function read(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

describe("fixture classes on the chrome", () => {
  for (const file of FILES) {
    describe(file, () => {
      const src = read(file);

      it("uses a fixture-* class", () => {
        expect(src).toMatch(/fixture-(rail|ledge|sign|marker)/);
      });

      it("has no pills, soft shadows or white cards", () => {
        expect(src).not.toContain("rounded-full");
        expect(src).not.toMatch(/(^|[\s"'`:])shadow-/);
        expect(src).not.toContain("bg-white");
      });

      it("adds no progress or tab roles", () => {
        expect(src).not.toMatch(/role=["'](progressbar|tab|tablist|tabpanel)["']/);
        expect(src).not.toContain("<progress");
      });
    });
  }
});
