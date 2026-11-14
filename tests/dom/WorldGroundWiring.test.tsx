/**
 * Tests for the ground wiring in `WorldPlaceView` / `WorldCreatures` (task 11.3).
 *
 * Requirements: 8.6, 8.7, 8.8, 18.10, 18.11
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import { MAX_RAVENS } from "@/components/world/WorldCreatures";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => cleanup());

const noop = () => {};

function tombs(count: number, daysQuiet = (i: number) => 5 + i * 200): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tomb-${i}`,
    url: `https://github.com/octocat/tomb-${i}`,
    state: "tombstone",
    daysQuiet: daysQuiet(i),
    decayLevel: null,
  })) as GraveyardRow[];
}

function props(rows: GraveyardRow[], extra: Partial<WorldPlaceViewProps> = {}): WorldPlaceViewProps {
  return {
    place: "ground",
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

describe("ground wiring", () => {
  it("mounts GroundArt and no empty scene when there are tombstones", () => {
    render(<WorldPlaceView {...props(tombs(3))} />);
    expect(document.querySelector('[data-effect="path-lantern-flicker"]')).not.toBeNull();
    expect(screen.queryByTestId("empty-scene")).toBeNull();
  });

  it("mounts the ground empty scene when there are no rows", () => {
    render(<WorldPlaceView {...props([])} />);
    expect(screen.getByTestId("empty-scene")).toBeTruthy();
  });

  it("shows fresh earth only on graves quiet for fewer days than the active threshold", () => {
    const rows = tombs(2, (i) => (i === 0 ? 5 : 800));
    render(<WorldPlaceView {...props(rows)} />);
    for (const li of screen.getAllByTestId("scatter-creature")) {
      const has = li.querySelector('[data-effect="fresh-earth"]') !== null;
      expect(has).toBe(li.getAttribute("data-name") === "tomb-0");
    }
  });

  it("perches at most two ravens", () => {
    render(<WorldPlaceView {...props(tombs(6))} />);
    const n = document.querySelectorAll('[data-effect="ravens"]').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(MAX_RAVENS);
  });

  it("gives each tombstone one candle-glow reveal, revealed under reduced motion", () => {
    render(<WorldPlaceView {...props(tombs(3), { reducedMotion: true })} />);
    for (const li of screen.getAllByTestId("scatter-creature")) {
      const reveals = li.querySelectorAll("[data-reveal]");
      expect(reveals).toHaveLength(1);
      expect(reveals[0].getAttribute("data-effect")).toBe("candle-glow-reveal");
      expect(reveals[0].getAttribute("data-revealed")).toBe("true");
    }
  });

  it("renders a grave marker tag on each tombstone and no fog", () => {
    render(<WorldPlaceView {...props(tombs(3))} />);
    const tags = screen.getAllByTestId("scatter-plaque");
    expect(tags).toHaveLength(3);
    for (const t of tags) expect(t.getAttribute("data-variant")).toBe("grave-marker");
    expect(document.querySelector(".scene-fog")).toBeNull();
  });
});
