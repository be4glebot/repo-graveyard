/**
 * Source test: the compact chrome (return link, title block, chips, bottom bar)
 * must not carry sm:/md:/lg: responsive positioning classes, which would win
 * over the compact flow column between 640 and 767 px. Breakpoint-specific
 * styling there must use the min-[768px]:/max-[767px]: conventions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(join(process.cwd(), p), "utf8");

const RESPONSIVE_PREFIX = /(?:^|[\s"'`])(?:sm|md|lg|xl|2xl):[\w[-]/;

describe("PlaceView compact chrome has no sm:/md: classes", () => {
  const source = read("components/scene/GatePlaceView.tsx");
  const start = source.indexOf("{compact ? (");
  const end = source.indexOf(") : (", start);

  it("locates the compact branch", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it("compact branch (chrome column, title block, chips row, bottom bar) uses no sm:/md: classes", () => {
    const compactBranch = source.slice(start, end);
    expect(compactBranch).toContain('data-testid="place-compact-heading"');
    expect(compactBranch).not.toContain('data-testid="place-title-block"');
    expect(compactBranch).toContain('data-testid="place-chips-row"');
    expect(compactBranch).toContain('data-testid="place-bottom-bar"');
    expect(RESPONSIVE_PREFIX.test(compactBranch)).toBe(false);
  });

  it.each([
    "components/scene/ReturnToGate.tsx",
    "components/scene/PlaceHeading.tsx",
    "components/scene/FilterChips.tsx",
    "components/scene/Pager.tsx",
  ])("%s has no sm:/md: classes", (file) => {
    expect(RESPONSIVE_PREFIX.test(read(file))).toBe(false);
  });
});
