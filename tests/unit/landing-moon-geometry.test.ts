import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MOON_SIZE_MAX_PX,
  MOON_SIZE_MIN_PX,
  WIDE_MIN_PX,
  moonDiameter,
  moonRect,
  moonRectWithParallax,
  rectsIntersect,
  textBlockRect,
} from "@/lib/landing-moon";

const css = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("landing moon geometry", () => {
  it("never intersects the text block at any width 375..2560", () => {
    for (let vw = 375; vw <= 2560; vw += 1) {
      const moon = moonRectWithParallax(vw);
      const text = textBlockRect(vw);
      expect(rectsIntersect(moon, text), `vw=${vw}`).toBe(false);
    }
  });

  it("stays inside the viewport and in the upper-right", () => {
    for (let vw = 375; vw <= 2560; vw += 5) {
      const r = moonRectWithParallax(vw);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(vw);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(moonRect(vw).left).toBeGreaterThan(vw / 2);
    }
  });

  it("is ~72px on a phone and caps at 120px on large screens", () => {
    expect(moonDiameter(375)).toBe(MOON_SIZE_MIN_PX);
    expect(moonDiameter(2560)).toBe(MOON_SIZE_MAX_PX);
    expect(MOON_SIZE_MIN_PX).toBeGreaterThanOrEqual(64);
    expect(MOON_SIZE_MAX_PX).toBeLessThanOrEqual(120);
  });

  it("globals.css uses the same wide breakpoint as the helper", () => {
    expect(css("app/globals.css")).toContain(`@media (min-width: ${WIDE_MIN_PX}px)`);
  });

  it("GateScene and the landing page use the helper and token-based colours", () => {
    const gate = css("components/landing/GateScene.tsx");
    expect(gate).toContain("@/lib/landing-moon");
    expect(gate).toContain("fillParent");
    expect(css("app/page.tsx")).toContain("landing-main");
  });
});

describe("place title clears the Return link (non-compact layout)", () => {
  it("PlaceView title block carries place-title-clear, defined in globals.css", () => {
    expect(css("components/scene/PlaceView.tsx")).toContain("place-title-clear");
    const g = css("app/globals.css");
    expect(g).toMatch(/\.place-title-clear\s*\{\s*padding-top:\s*4\.5rem/);
    expect(g).toContain("@media (min-width: 1100px)");
  });
});
