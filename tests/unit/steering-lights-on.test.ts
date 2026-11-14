import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Validates: Requirements 8.2, 8.3, 8.4
describe("steering design.md lights-on text", () => {
  const text = readFileSync(
    join(process.cwd(), ".kiro", "steering", "design.md"),
    "utf8",
  ).toLowerCase();

  it("no longer describes a paper register", () => {
    expect(text).not.toContain("paper register");
  });

  it("no longer contains the sinister copy table", () => {
    expect(text).not.toContain("copy turns sinister");
  });

  it('mentions the "View as list" accessibility view', () => {
    expect(text).toContain("view as list");
  });
});
