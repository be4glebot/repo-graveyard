import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source scan for the Revive in Kiro files: no hardcoded colours, no raw HTML
 * injection, and a pure revive-brief module.
 */
const FILES = [
  "components/seance/ReviveInKiro.tsx",
  "components/seance/ReviveDialog.tsx",
  "components/seance/KiroSlot.tsx",
  "lib/revive-brief.ts",
];

function load(path: string): string {
  const raw = readFileSync(join(process.cwd(), path), "utf8");
  // Strip block and line comments (line comments not preceded by ':' to keep URLs).
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("revive source scan", () => {
  for (const file of FILES) {
    describe(file, () => {
      const src = load(file);
      it("has no hex colour literals", () => {
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      });
      it("has no rgb/rgba/hsl/hsla colour functions", () => {
        expect(src).not.toMatch(/\b(rgba?|hsla?)\(/i);
      });
      it("never uses dangerouslySetInnerHTML", () => {
        expect(src).not.toContain("dangerouslySetInnerHTML");
      });
    });
  }

  describe("lib/revive-brief.ts purity", () => {
    const src = load("lib/revive-brief.ts");
    it("does not touch Date, Math.random, fetch or localStorage", () => {
      expect(src).not.toMatch(/\bDate\b/);
      expect(src).not.toMatch(/Math\.random/);
      expect(src).not.toMatch(/\bfetch\b/);
      expect(src).not.toMatch(/localStorage/);
    });
  });
});
