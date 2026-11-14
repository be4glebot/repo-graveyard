/**
 * DOM test for the sky `EmptyScene` (task 8.2).
 * Requirements: 7.11, 16.1, 16.4, 16.5
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import EmptyScene, { EMPTY_SKY_STAR_COUNT } from "@/components/world/EmptyScene";

afterEach(() => cleanup());

const CSS = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function hex(name: string): [number, number, number] {
  const m = CSS.match(new RegExp(`--color-${name}:\\s*#([0-9a-fA-F]{6})`));
  if (!m) throw new Error(`missing token ${name}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum([r, g, b]: [number, number, number]): number {
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function setup() {
  return render(<EmptyScene variant="sky" viewportW={1280} viewportH={800} />);
}

describe("EmptyScene (sky)", () => {
  it("renders moon, stars, cloud banks and an empty lantern hook", () => {
    const { getByTestId, getAllByTestId } = setup();
    expect(getByTestId("empty-sky-moon")).toBeTruthy();
    expect(getAllByTestId("empty-sky-star")).toHaveLength(EMPTY_SKY_STAR_COUNT);
    expect(getByTestId("empty-sky-clouds")).toBeTruthy();
    expect(getByTestId("empty-sky-hook")).toBeTruthy();
    expect(getByTestId("empty-sky-plate-image").getAttribute("data-crop-plate")).toBe(
      "place-sky",
    );
  });

  it("is exactly one screen, clipped, with no scrollbar and no data fog", () => {
    const { getByTestId, queryByTestId } = setup();
    const root = getByTestId("empty-scene");
    expect(root.style.height).toBe("800px");
    expect(root.className).toContain("overflow-clip");
    expect(root.className).not.toMatch(/overflow-(auto|scroll|y-)/);
    expect(queryByTestId("scene-fog")).toBeNull();
    expect(queryByTestId("scene-fog-near")).toBeNull();
  });

  it("hangs the copy on a plaque inside the hook, outside the decor", () => {
    const { getByTestId } = setup();
    const plaque = getByTestId("empty-scene-plaque");
    expect(getByTestId("empty-sky-hook").contains(plaque)).toBe(true);
    expect(getByTestId("empty-scene-decor").contains(plaque)).toBe(false);
    expect(plaque.textContent).toMatch(/No ghosts haunt this sky/);
    expect(plaque.className).toContain("fixture-ledge");
  });

  it("keeps decor aria-hidden and inert", () => {
    const { getByTestId } = setup();
    const decor = getByTestId("empty-scene-decor");
    expect(decor.getAttribute("aria-hidden")).toBe("true");
    expect(decor.hasAttribute("inert")).toBe(true);
    expect(decor.querySelector("button, a, [tabindex]")).toBeNull();
  });

  it("uses plaque colours with contrast of at least 4.5", () => {
    expect(contrast("stone-text", "stone-surface")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("stone-text-muted", "stone-surface")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the plaque when the plate fails to load", () => {
    const { getByTestId } = setup();
    const probe = getByTestId("empty-sky-plate-probe");
    probe.dispatchEvent(new Event("error"));
    expect(getByTestId("empty-scene-plaque")).toBeTruthy();
    expect(getByTestId("empty-sky-plate").style.backgroundColor).toBe(
      "var(--color-night-sky)",
    );
  });
});
