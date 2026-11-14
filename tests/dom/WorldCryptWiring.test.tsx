/**
 * Tests for the crypt wiring in `WorldPlaceView` / `WorldCreatures` (task 14.3).
 *
 * Requirements: 9.1, 9.5, 9.7, 9.8, 9.9, 9.12, 18.11
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => cleanup());

const noop = () => {};

function coffins(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `coffin-${i}`,
    url: `https://github.com/octocat/coffin-${i}`,
    state: "coffin",
    daysQuiet: 400 + i,
    decayLevel: null,
  })) as GraveyardRow[];
}

function props(
  rows: GraveyardRow[],
  extra: Partial<WorldPlaceViewProps> = {},
): WorldPlaceViewProps {
  return {
    place: "crypt",
    rows,
    activeFilter: "all",
    plotIndex: 0,
    selectedName: null,
    onFilterChange: noop,
    onPlotChange: noop,
    onSelect: noop,
    onReturn: noop,
    ...extra,
  };
}

describe("crypt wiring", () => {
  it("mounts CryptArt and no empty scene when there are coffins", () => {
    render(<WorldPlaceView {...props(coffins(5))} />);
    expect(screen.getAllByTestId("crypt-band").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("empty-scene")).toBeNull();
  });

  it("mounts the crypt empty scene when there are no rows", () => {
    render(<WorldPlaceView {...props([])} />);
    const scene = screen.getByTestId("empty-scene");
    expect(scene.getAttribute("data-variant")).toBe("crypt");
  });

  it("groups coffins into ceil(count / 4) chambers", () => {
    render(<WorldPlaceView {...props(coffins(9))} />);
    const chambers = document.querySelectorAll("ol[data-chamber]");
    expect(chambers).toHaveLength(3);
    const counts = Array.from(chambers).map((ol) => ol.querySelectorAll("li").length);
    expect(counts).toEqual([4, 4, 1]);
  });

  it("hangs a tag with a chain reveal on each coffin", () => {
    render(<WorldPlaceView {...props(coffins(3), { reducedMotion: true })} />);
    const tags = screen.getAllByTestId("scatter-plaque");
    expect(tags).toHaveLength(3);
    for (const t of tags) {
      expect(t.getAttribute("data-variant")).toBe("hanging");
      const chain = t.querySelector('[data-effect="chain-reveal"]');
      expect(chain).not.toBeNull();
      expect(chain!.hasAttribute("data-reveal")).toBe(true);
      expect(chain!.getAttribute("data-revealed")).toBe("true");
    }
    expect(document.querySelector(".scene-fog")).toBeNull();
  });

  it("keeps the darkness overlay below the creature layer and coffins opaque", () => {
    render(<WorldPlaceView {...props(coffins(3))} />);
    const dark = screen.getByTestId("crypt-darkness");
    expect(dark.className).toContain("z-[12]");
    expect(screen.getByTestId("depth-scatter").className).toContain("z-20");
    expect(dark.contains(screen.getAllByTestId("scatter-creature")[0])).toBe(false);
    for (const li of screen.getAllByTestId("scatter-creature")) {
      expect(li.style.opacity).toBe("");
      expect(li.style.filter).not.toContain("opacity(");
    }
  });
});
