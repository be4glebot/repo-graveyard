/**
 * No-hardcoded-hex assertion for scene and creature components (task 20.1).
 *
 * The design's core principle is "No hardcoded hex in components": colors come
 * from Tailwind v4 `@theme` tokens in `app/globals.css`, and components
 * reference those tokens, never a literal hex color (design.md, Req 1.8 / 10.1,
 * 10.2). This test enforces that principle statically by scanning every source
 * file under `components/scene/` and `components/creatures/` and failing on any
 * literal CSS hex color.
 *
 * A CSS hex color is a `#` followed by exactly 3, 4, 6, or 8 hex digits, bounded
 * by a word boundary. Restricting to those run lengths keeps legitimate non-color
 * `#` uses safe: for example the Atmosphere SVG noise filter id `#n`
 * (`filter="url(#n)"`) is a 1-character id and never matches. Token usage such as
 * `var(--color-...)` contains no `#` and is likewise untouched.
 *
 * Requirements: 10.1, 10.2
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** Directories whose components must be token-only (resolved from repo root). */
const SCAN_DIRS = ["components/scene", "components/creatures"];

/** Source extensions to scan. */
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/**
 * Matches a CSS hex color literal: `#` plus exactly 3, 4, 6, or 8 hex digits,
 * ended by a word boundary so a longer hex-ish run or a short id does not slip
 * through. `#abc` / `#abcd` / `#aabbcc` / `#aabbccdd` match; `#n` and `#ab`
 * (2 digits) and `#abcde` (5 digits, which `{3,8}` would otherwise reach into)
 * are handled by anchoring to the longest valid run first. We test the 4 exact
 * lengths explicitly rather than a loose `{3,8}` to avoid matching a 5/7-digit
 * run's leading 3/4/6 digits.
 */
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
const HEX_COLOR_GLOBAL = new RegExp(HEX_COLOR.source, "g");

interface Violation {
  file: string;
  line: number;
  match: string;
  snippet: string;
}

/** Recursively collect every `.ts`/`.tsx` file path under `dir`. */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

/** Find every hex color literal in `content`, with 1-based line numbers. */
function findHexViolations(repoRelPath: string, content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((text, index) => {
    for (const m of text.matchAll(HEX_COLOR_GLOBAL)) {
      violations.push({
        file: repoRelPath,
        line: index + 1,
        match: m[0],
        snippet: text.trim(),
      });
    }
  });
  return violations;
}

describe("no hardcoded hex in scene and creature components (Req 10.1, 10.2)", () => {
  const repoRoot = process.cwd();

  it("the hex-color pattern matches real CSS hex forms and rejects non-colors", () => {
    // 3/4/6/8-digit forms are colors.
    expect("#abc").toMatch(HEX_COLOR);
    expect("#abcd").toMatch(HEX_COLOR);
    expect("#aabbcc").toMatch(HEX_COLOR);
    expect("#aabbccdd").toMatch(HEX_COLOR);
    expect("color: #f6f3ea").toMatch(HEX_COLOR);
    // The Atmosphere SVG filter id `#n` and other short / non-color `#` uses.
    expect('filter="url(#n)"').not.toMatch(HEX_COLOR);
    expect("#x").not.toMatch(HEX_COLOR);
    expect("#g1").not.toMatch(HEX_COLOR);
  });

  it("scans every component source file and finds no hex color literal", () => {
    const violations: Violation[] = [];
    let scannedCount = 0;

    for (const relDir of SCAN_DIRS) {
      const absDir = join(repoRoot, relDir);
      for (const file of collectSourceFiles(absDir)) {
        scannedCount += 1;
        const content = readFileSync(file, "utf8");
        const repoRelPath = relative(repoRoot, file).replace(/\\/g, "/");
        violations.push(...findHexViolations(repoRelPath, content));
      }
    }

    // Guard against the scan silently matching nothing (wrong path, empty dirs).
    expect(scannedCount).toBeGreaterThan(0);

    const message =
      violations.length === 0
        ? ""
        : `Found ${violations.length} hardcoded hex color literal(s). Components must reference @theme tokens, not literal hex:\n` +
          violations
            .map((v) => `  ${v.file}:${v.line}  ${v.match}  ->  ${v.snippet}`)
            .join("\n");

    expect(violations, message).toEqual([]);
  });
});
