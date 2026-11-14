/**
 * DOM test for the ground `EmptyScene` (task 11.2).
 * Requirements: 16.1, 16.2, 16.5, 8.10
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import EmptyScene from "@/components/world/EmptyScene";

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
  return render(<EmptyScene variant="ground" viewportW={1280} viewportH={800} />);
}

describe("EmptyScene (ground)", () => {
  it("renders gate, fence, path, mausoleum, two lanterns and the plot", () => {
    const { getByTestId, getAllByTestId } = setup();
    expect(getByTestId("empty-ground-gate-image").getAttribute("data-crop-plate")).toBe(
      "mg-fence",
    );
    expect(getByTestId("empty-ground-fence-left")).toBeTruthy();
    expect(getByTestId("empty-ground-fence-right")).toBeTruthy();
    expect(getByTestId("empty-ground-path")).toBeTruthy();
    expect(
      getByTestId("empty-ground-mausoleum-image").getAttribute("data-crop-plate"),
    ).toBe("mausoleum");
    expect(getAllByTestId("empty-ground-lantern")).toHaveLength(2);
    expect(getByTestId("empty-ground-mound")).toBeTruthy();
    expect(getByTestId("empty-ground-stake")).toBeTruthy();
  });

  it("is exactly one screen, clipped, with environmental mist and no data fog", () => {
    const { getByTestId, queryByTestId } = setup();
    const root = getByTestId("empty-scene");
    expect(root.style.height).toBe("800px");
    expect(root.className).toContain("overflow-clip");
    expect(root.className).not.toMatch(/overflow-(auto|scroll|y-)/);
    expect(getByTestId("place-mist-far")).toBeTruthy();
    expect(queryByTestId("scene-fog")).toBeNull();
    expect(queryByTestId("scene-fog-near")).toBeNull();
  });

  it("carries the copy on a carved plaque in the plot, outside the decor", () => {
    const { getByTestId } = setup();
    const plaque = getByTestId("empty-scene-plaque");
    expect(getByTestId("empty-ground-plot").contains(plaque)).toBe(true);
    expect(getByTestId("empty-scene-decor").contains(plaque)).toBe(false);
    expect(plaque.textContent).toMatch(/No tombstones rest here yet/);
    expect(plaque.className).toContain("fixture-ledge");
  });

  it("keeps decor aria-hidden and inert", () => {
    const { getByTestId } = setup();
    const decor = getByTestId("empty-scene-decor");
    expect(decor.getAttribute("aria-hidden")).toBe("true");
    expect(decor.hasAttribute("inert")).toBe(true);
    expect(decor.querySelector("button, a, [tabindex]")).toBeNull();
  });

  it("drops the lantern flicker under reduced motion", () => {
    const { getAllByTestId, rerender } = setup();
    expect(getAllByTestId("empty-ground-lantern")[0].className).toContain(
      "lantern-flicker",
    );
    rerender(
      <EmptyScene variant="ground" viewportW={1280} viewportH={800} reducedMotion />,
    );
    expect(getAllByTestId("empty-ground-lantern")[0].className).not.toContain(
      "lantern-flicker",
    );
  });

  it("uses plaque colours with contrast of at least 4.5", () => {
    expect(contrast("stone-text", "stone-surface")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("stone-text-muted", "stone-surface")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the plaque when the plate fails to load", () => {
    const { getByTestId } = setup();
    getByTestId("empty-ground-plate-probe").dispatchEvent(new Event("error"));
    expect(getByTestId("empty-scene-plaque")).toBeTruthy();
    expect(getByTestId("empty-ground-plate").style.backgroundColor).toBe(
      "var(--color-night-sky)",
    );
  });
});
