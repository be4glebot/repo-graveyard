/**
 * Tests for the sky wiring in `WorldPlaceView` / `WorldCreatures` (task 8.3).
 *
 * Requirements: 7.7, 7.8, 7.9, 18.6, 18.7, 18.10
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { rimFor } from "@/lib/world-light";

afterEach(() => cleanup());

const noop = () => {};

function ghosts(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `ghost-${i}`,
    url: `https://github.com/octocat/ghost-${i}`,
    state: "ghost",
    daysQuiet: 5 + i * 20,
    decayLevel: i % 4,
  })) as GraveyardRow[];
}

function props(rows: GraveyardRow[], extra: Partial<WorldPlaceViewProps> = {}): WorldPlaceViewProps {
  return {
    place: "sky",
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

describe("sky wiring", () => {
  it("mounts SkyArt with star-twinkle and cloud-drift effects", () => {
    render(<WorldPlaceView {...props(ghosts(4))} />);
    expect(screen.getAllByTestId("sky-band").length).toBeGreaterThan(0);
    expect(document.querySelector('[data-effect="star-twinkle"]')).not.toBeNull();
    expect(document.querySelector('[data-effect="cloud-drift"]')).not.toBeNull();
    expect(screen.queryByTestId("empty-scene")).toBeNull();
  });

  it("mounts the sky empty scene when there are no ghosts", () => {
    render(<WorldPlaceView {...props([])} />);
    expect(screen.getByTestId("empty-scene")).toBeTruthy();
  });

  it("gives each ghost the rim glow in the existing filter, plus a lantern tag", () => {
    const rows = ghosts(4);
    render(<WorldPlaceView {...props(rows)} />);
    const items = screen.getAllByTestId("scatter-creature");
    expect(items).toHaveLength(4);
    for (const li of items) {
      const row = rows.find((r) => r.name === li.getAttribute("data-name"))!;
      expect(li.getAttribute("data-effect")).toBe("ghost-rim-glow");
      expect(li.style.filter).toContain("brightness(");
      expect(li.style.filter).toContain("drop-shadow(");
      expect(rimFor("sky", row).filter).toContain("drop-shadow(");
      expect(li.querySelector("filter")).toBeNull();
      const lantern = li.querySelector('[data-effect="ghost-lantern"]');
      expect(lantern).not.toBeNull();
      expect(li.querySelector("[data-lantern-level]")?.getAttribute("data-lantern-level")).toBe(
        String(row.decayLevel),
      );
    }
  });

  it("marks each ghost with one Discovery_Reveal and reveals all under reduced motion", () => {
    render(<WorldPlaceView {...props(ghosts(3), { reducedMotion: true })} />);
    for (const li of screen.getAllByTestId("scatter-creature")) {
      const reveals = li.querySelectorAll("[data-reveal]");
      expect(reveals).toHaveLength(1);
      expect(reveals[0].classList.contains("world-reveal")).toBe(true);
      expect(reveals[0].getAttribute("data-revealed")).toBe("true");
    }
  });
});
