/**
 * Regression tests for the creature window (task 20.3, defect 3): creatures
 * live between the top and bottom chrome, the depth marker sits in the same
 * window, and nothing is removed from the DOM or the tab order.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => cleanup());

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const noop = () => {};

function rows(state: "coffin" | "tombstone", n: number): GraveyardRow[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `r-${i}`,
    url: `https://github.com/octocat/r-${i}`,
    state,
    daysQuiet: 400 + i,
    decayLevel: null,
  })) as GraveyardRow[];
}

function props(place: "crypt" | "ground", r: GraveyardRow[]): WorldPlaceViewProps {
  return {
    place,
    rows: r,
    activeFilter: "all",
    plotIndex: 0,
    selectedName: null,
    onFilterChange: noop,
    onPlotChange: noop,
    onSelect: noop,
    onReturn: noop,
  };
}

describe("creature window CSS", () => {
  it("clips and masks the creature layer to the window between the chrome bands", () => {
    const block = css.slice(css.indexOf(".world-creatures {"));
    expect(block).toMatch(/clip-path:\s*polygon\(/);
    expect(block).toContain("mask-image");
    expect(block).toContain("var(--world-scroll");
    expect(block).toContain("var(--world-view-h");
  });

  it("derives the window and the scroll padding from the same clearance variables", () => {
    expect(css).toMatch(/--world-clip-top:\s*max\(var\(--world-pad-top\), var\(--world-chrome-top/);
    expect(css).toMatch(/--world-clip-bottom:\s*max\(/);
    expect(css).toMatch(/scroll-padding-top:\s*var\(--world-clip-top/);
    expect(css).toMatch(/scroll-padding-bottom:\s*var\(--world-clip-bottom/);
    expect(css).toMatch(/\.world-window\s*\{\s*top:\s*var\(--world-clip-top\)/);
  });
});

describe("creature window DOM", () => {
  it("keeps every creature in the DOM and focusable, and the root publishes the view height", () => {
    render(<WorldPlaceView {...props("ground", rows("tombstone", 6))} />);
    const buttons = screen
      .getAllByTestId("scatter-creature")
      .map((li) => li.querySelector("button"));
    expect(buttons).toHaveLength(6);
    for (const b of buttons) {
      expect(b).not.toBeNull();
      expect(b!.tabIndex).toBeGreaterThanOrEqual(0);
      expect(b!.closest("[inert]")).toBeNull();
      expect(b!.closest("[aria-hidden='true']")).toBeNull();
    }
    const layer = screen.getByTestId("depth-scatter");
    expect(layer.className).toContain("world-creatures");
    const root = screen.getByTestId("place-view");
    expect(root.style.getPropertyValue("--world-view-h")).toMatch(/px$/);
  });

  it("places the depth marker in the window band, not a full-height host", () => {
    render(<WorldPlaceView {...props("crypt", rows("coffin", 9))} />);
    const win = screen.getByTestId("depth-marker-window");
    expect(win.className).toContain("world-window");
    expect(win.contains(screen.getByTestId("depth-marker"))).toBe(true);
  });
});

describe("crypt coffin grounding DOM", () => {
  it("gives each crypt coffin a floor line and a contact shadow, and tombstones no floor line", () => {
    render(<WorldPlaceView {...props("crypt", rows("coffin", 3))} />);
    expect(document.querySelectorAll('[data-part="floor-line"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-testid="creature-shadow"]')).toHaveLength(3);
    cleanup();
    render(<WorldPlaceView {...props("ground", rows("tombstone", 3))} />);
    expect(document.querySelectorAll('[data-part="floor-line"]')).toHaveLength(0);
  });
});
