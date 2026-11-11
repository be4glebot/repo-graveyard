import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Strip // and /* *\/ comments and trailing commas from JSONC text.
 * String-aware, because globs such as "**\/*.ts" contain comment-like text.
 */
function stripJsonc(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

describe("root tsconfig.json", () => {
  const raw = readFileSync(join(process.cwd(), "tsconfig.json"), "utf8");
  const config = JSON.parse(stripJsonc(raw)) as { exclude?: unknown };

  it("excludes mcp/** and still excludes node_modules", () => {
    expect(Array.isArray(config.exclude)).toBe(true);
    expect(config.exclude).toContain("mcp/**");
    expect(config.exclude).toContain("node_modules");
  });

  it("strips comments and trailing commas without touching glob strings", () => {
    const parsed = JSON.parse(
      stripJsonc('{ // c\n "a": ["**/*.ts", /* x */ "b",], }'),
    );
    expect(parsed).toEqual({ a: ["**/*.ts", "b"] });
  });
});
