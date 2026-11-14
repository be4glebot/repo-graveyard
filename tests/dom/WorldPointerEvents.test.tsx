/**
 * Pointer-events coverage for the explorable worlds (task 5.15).
 *
 * jsdom has no layout, so "a click at a Creature's centre reaches its button"
 * is pinned structurally plus behaviourally:
 *   - every full-cover / decor layer is `pointer-events-none` (or inherits it),
 *     is inert, and holds no focusable control;
 *   - every Creature button resolves to `pointer-events: auto` (nearest
 *     declaration wins, as CSS inheritance does), and no decorative layer
 *     stacked above the creatures (z >= 20) can receive pointer events;
 *   - clicking a Creature button calls `onSelect` with its row.
 *
 * Requirements: 15.2, 17.7
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import WorldPlaceView from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { WorldPlace } from "@/lib/world-layout";

afterEach(() => cleanup());

const noop = () => {};
const PLACES: WorldPlace[] = ["sky", "ground", "crypt"];

function makeRows(place: WorldPlace, count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => {
    const name = `${place}-repo-${i}`;
    const url = `https://github.com/octocat/${name}`;
    if (place === "sky") {
      return { name, url, state: "ghost", daysQuiet: 10 + i, decayLevel: i % 4 };
    }
    return {
      name,
      url,
      state: place === "ground" ? "tombstone" : "coffin",
      daysQuiet: 400 + i,
      decayLevel: null,
    } as GraveyardRow;
  });
}

function renderWorld(place: WorldPlace, onSelect: (name: string) => void = noop) {
  render(
    <WorldPlaceView
      place={place}
      rows={makeRows(place, 6)}
      activeFilter="all"
      plotIndex={0}
      selectedName={null}
      onFilterChange={noop}
      onPlotChange={noop}
      onSelect={onSelect}
      onReturn={noop}
    />,
  );
  return screen.getByTestId("place-view");
}

function tokens(el: Element): string[] {
  return typeof el.className === "string" ? el.className.split(/\s+/) : [];
}

function isFullCover(el: Element): boolean {
  const t = tokens(el);
  return t.includes("absolute") && t.includes("inset-0");
}

/** Pointer-events value an element declares itself (class or inline style), if any. */
function declared(el: Element): "none" | "auto" | null {
  const inline = (el as HTMLElement).style?.pointerEvents;
  if (inline === "none" || inline === "auto") return inline;
  const t = tokens(el);
  if (t.includes("pointer-events-auto")) return "auto";
  if (t.includes("pointer-events-none")) return "none";
  return null;
}

/** Effective pointer-events: nearest declaration walking up (CSS inheritance). */
function effective(el: Element, root: Element): "none" | "auto" {
  let node: Element | null = el;
  while (node) {
    const d = declared(node);
    if (d) return d;
    if (node === root) break;
    node = node.parentElement;
  }
  return "auto";
}

function hasFocusable(el: Element): boolean {
  return el.querySelector("button, a[href], input, [tabindex]:not([tabindex='-1'])") !== null;
}

function zOf(el: Element): number {
  for (const t of tokens(el)) {
    const m = /^z-(\d+)$/.exec(t) ?? /^z-\[(\d+)\]$/.exec(t);
    if (m) return Number(m[1]);
  }
  const z = Number((el as HTMLElement).style?.zIndex);
  return Number.isFinite(z) ? z : 0;
}

describe.each(PLACES)("world pointer-events: %s", (place) => {
  it("every full-cover layer without a focusable control is pointer-events-none", () => {
    const root = renderWorld(place);
    const layers = Array.from(root.querySelectorAll("*")).filter(isFullCover);
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) {
      if (hasFocusable(layer)) continue;
      expect(
        effective(layer, root),
        `full-cover layer can receive pointer events: "${layer.className}"`,
      ).toBe("none");
    }
  });

  it("decor layers (bands, gradients, atmosphere, mist) are pointer-events-none and inert", () => {
    const root = renderWorld(place);
    const decor = [
      ...Array.from(root.querySelectorAll("[data-decor-clip]")),
      ...Array.from(root.querySelectorAll(".world-band")),
      screen.getByTestId("world-gradient-top"),
      screen.getByTestId("world-gradient-bottom"),
      screen.getByTestId("world-atmosphere"),
    ];
    expect(decor.length).toBeGreaterThan(5);
    for (const el of decor) {
      expect(effective(el, root), `decor receives pointer events: "${el.className}"`).toBe("none");
      expect(hasFocusable(el)).toBe(false);
    }
    for (const el of [
      screen.getByTestId("world-gradient-top"),
      screen.getByTestId("world-gradient-bottom"),
      screen.getByTestId("world-atmosphere"),
      ...Array.from(root.querySelectorAll("[data-decor-clip]")),
    ]) {
      expect(el.hasAttribute("inert")).toBe(true);
    }
  });

  it("no pointer-receiving layer stacked above the creatures covers them", () => {
    const root = renderWorld(place);
    const creatures = screen.getByTestId("depth-scatter");
    const creatureZ = zOf(creatures);
    const chromes = [
      root.querySelector(".world-chrome-top"),
      root.querySelector(".world-chrome-bottom"),
    ];
    // Direct decorative siblings of the world above the creatures.
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el === creatures || creatures.contains(el) || el.contains(creatures)) continue;
      if (chromes.some((c) => c && c.contains(el))) continue;
      if (!isFullCover(el) && !tokens(el).includes("world-band")) continue;
      if (zOf(el) < creatureZ) continue;
      expect(
        effective(el, root),
        `layer above creatures receives pointer events: "${el.className}"`,
      ).toBe("none");
    }
  });

  it("sticky chrome wrappers are pointer-events-none; only controls re-enable it", () => {
    const root = renderWorld(place);
    expect(effective(root.querySelector(".world-chrome-top")!, root)).toBe("none");
    expect(effective(root.querySelector(".world-chrome-bottom")!, root)).toBe("none");
    expect(effective(screen.getByTestId("place-bottom-bar"), root)).toBe("none");
    expect(effective(screen.getByTestId("place-chips-row"), root)).toBe("auto");
  });

  it("every Creature button is hit-testable (pointer-events auto)", () => {
    const root = renderWorld(place);
    const items = screen.getAllByTestId("scatter-creature");
    expect(items.length).toBe(6);
    for (const li of items) {
      const button = li.querySelector("button");
      expect(button, "creature has a button").not.toBeNull();
      expect(effective(button!, root)).toBe("auto");
    }
  });

  it("clicking a Creature button calls onSelect with its name", () => {
    const onSelect = vi.fn();
    renderWorld(place, onSelect);
    const li = screen.getAllByTestId("scatter-creature")[0];
    fireEvent.click(li.querySelector("button")!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(li.getAttribute("data-name"));
  });
});
