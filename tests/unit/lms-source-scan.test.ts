import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { COMPACT_MAX_WIDTH_PX, MOBILE_BREAKPOINT } from "@/lib/estate-view";

/**
 * Feature: landing-mobile-states. Source scan and threshold checks.
 * Requirements 2.11, 5.11, 9.1.
 *
 * Every new or changed component/page file of this spec is scanned for colour
 * literals (tokens only), and the responsive code is checked against the
 * shared breakpoint constants.
 */
const FILES = [
  "app/page.tsx",
  "app/not-found.tsx",
  "app/g/[username]/loading.tsx",
  "components/landing/GateScene.tsx",
  "components/landing/HowItWorks.tsx",
  "components/landing/LandingFooter.tsx",
  "components/landing/UsernameForm.tsx",
  "components/scene/ShellBackdrop.tsx",
  "components/scene/ShellFog.tsx",
  "components/scene/ThemedShell.tsx",
  "components/scene/GraveyardLoading.tsx",
  "components/scene/GraveyardLoadingLabel.tsx",
  "components/scene/EmptyGraveyard.tsx",
  "components/scene/SceneErrorState.tsx",
  "components/scene/useHeaderHeightVar.ts",
  "components/ui/ThemedButton.tsx",
  "components/ui/ReloadButton.tsx",
  "components/ui/useMedia.ts",
  "components/ui/Header.tsx",
  "components/detail/DetailPanel.tsx",
  "components/scene/PlaceView.tsx",
  "components/scene/DepthScatter.tsx",
];

/** Responsive code that must not keep the old 430/431 breakpoint. */
const RESPONSIVE_FILES = [
  "components/ui/Header.tsx",
  "components/detail/DetailPanel.tsx",
  "components/scene/PlaceView.tsx",
  "components/scene/DepthScatter.tsx",
  "components/scene/SceneView.tsx",
  "components/scene/EstateMap.tsx",
  "lib/estate-view.ts",
];

/** Reads a file with block and line comments removed (URLs are kept). */
function load(path: string): string {
  const raw = readFileSync(join(process.cwd(), path), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("lms source scan: no colour literals", () => {
  for (const file of FILES) {
    describe(file, () => {
      const src = load(file);
      it("has no hex colour literals", () => {
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      });
      it("has no rgb/rgba/hsl/hsla colour functions", () => {
        expect(src).not.toMatch(/\b(rgba?|hsla?)\(/i);
      });
    });
  }
});

describe("lms breakpoint thresholds", () => {
  it("COMPACT_MAX_WIDTH_PX is one below MOBILE_BREAKPOINT", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(COMPACT_MAX_WIDTH_PX).toBe(MOBILE_BREAKPOINT - 1);
    expect(COMPACT_MAX_WIDTH_PX).toBe(767);
  });

  it("every max-[Npx] / min-[Npx] variant and literal max-width query matches the constants", () => {
    let maxVariants = 0;
    let minVariants = 0;
    for (const file of [...FILES, ...RESPONSIVE_FILES]) {
      const src = load(file);
      for (const m of src.matchAll(/max-\[(\d+)px\]/g)) {
        maxVariants += 1;
        expect(Number(m[1]), `${file}: ${m[0]}`).toBe(COMPACT_MAX_WIDTH_PX);
      }
      for (const m of src.matchAll(/min-\[(\d+)px\]/g)) {
        minVariants += 1;
        expect(Number(m[1]), `${file}: ${m[0]}`).toBe(MOBILE_BREAKPOINT);
      }
      for (const m of src.matchAll(/\(max-width:\s*(\d+)px\)/g)) {
        expect(Number(m[1]), `${file}: ${m[0]}`).toBe(COMPACT_MAX_WIDTH_PX);
      }
      for (const m of src.matchAll(/\(min-width:\s*(\d+)px\)/g)) {
        expect(Number(m[1]), `${file}: ${m[0]}`).toBe(MOBILE_BREAKPOINT);
      }
    }
    // The header, detail sheet and scene header really use both variants.
    expect(maxVariants).toBeGreaterThan(0);
    expect(minVariants).toBeGreaterThan(0);
  });

  it("compact media queries are derived from COMPACT_MAX_WIDTH_PX", () => {
    expect(load("components/ui/useIsCompact.ts")).toContain("COMPACT_MAX_WIDTH_PX");
    // Every other decider goes through the one shared hook.
    for (const file of [
      "components/ui/Header.tsx",
      "components/detail/DetailPanel.tsx",
      "components/scene/PlaceView.tsx",
    ]) {
      expect(load(file), file).toContain("useIsCompact");
    }
  });

  for (const file of RESPONSIVE_FILES) {
    it(`${file} keeps no 430/431 breakpoint literal`, () => {
      expect(load(file)).not.toMatch(/\b43[01]\b/);
    });
  }
});
