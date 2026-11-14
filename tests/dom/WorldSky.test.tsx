/**
 * Sky world DOM tests (explorable-worlds task 8.6).
 *
 * Requirements: 6.4, 7.1, 7.2, 7.3, 7.9, 7.10, 15.9
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import Ghost from "@/components/creatures/Ghost";
import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { placePlots } from "@/lib/place-pipeline";
import { computeWorldLayout, LAYOUT_MIN_VH } from "@/lib/world-layout";

afterEach(() => cleanup());

const noop = () => {};

function ghosts(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `ghost-${i}`,
    url: `https://github.com/octocat/ghost-${i}`,
    state: "ghost",
    daysQuiet: 3 + i * 7,
    decayLevel: i % 4,
  })) as GraveyardRow[];
}

function props(rows: GraveyardRow[]): WorldPlaceViewProps {
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
  };
}

function layoutFor(rows: GraveyardRow[]) {
  const plot = placePlots("sky", rows, "all", 100)[0] ?? [];
  return {
    plot,
    layout: computeWorldLayout({
      place: "sky",
      names: plot.map((r) => r.name),
      viewportW: window.innerWidth > 0 ? window.innerWidth : 1024,
      viewportH: window.innerHeight > 0 ? window.innerHeight : 812,
    }),
  };
}

describe("sky world", () => {
  it("a 3-ghost sky has two Strata and a length of 1.25 to 1.5", () => {
    const rows = ghosts(3);
    render(<WorldPlaceView {...props(rows)} />);
    expect(screen.getByTestId("depth-scatter").querySelectorAll("ol")).toHaveLength(2);
    const { layout } = layoutFor(rows);
    expect(layout.strata).toHaveLength(2);
    expect(layout.lengthVh).toBeGreaterThanOrEqual(1.25);
    expect(layout.lengthVh).toBeLessThanOrEqual(1.5);
  });

  it("puts the most urgent ghost in the first screen", () => {
    const rows = ghosts(3);
    render(<WorldPlaceView {...props(rows)} />);
    const { plot, layout } = layoutFor(rows);
    const vhEff = Math.max(layout.viewportH, LAYOUT_MIN_VH);
    const urgent = plot[0].name;
    const li = screen
      .getAllByTestId("scatter-creature")
      .find((el) => el.getAttribute("data-name") === urgent)!;
    const top = parseFloat(li.style.top);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(vhEff);
  });

  it("spreads 12 ghosts across at least two Strata", () => {
    render(<WorldPlaceView {...props(ghosts(12))} />);
    const lists = Array.from(
      screen.getByTestId("depth-scatter").querySelectorAll("ol"),
    );
    const populated = lists.filter((ol) => ol.querySelectorAll("li").length > 0);
    expect(populated.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTestId("scatter-creature")).toHaveLength(12);
  });

  it("keeps each ghost's decay class identical to the original Ghost", () => {
    const rows = ghosts(8);
    render(<WorldPlaceView {...props(rows)} />);
    const decayClass = (root: ParentNode): string[] =>
      Array.from(root.querySelectorAll("[class*='ghost-decay-']")).map(
        (el) => el.className.split(/\s+/).find((c) => c.startsWith("ghost-decay-"))!,
      );
    for (const li of screen.getAllByTestId("scatter-creature")) {
      const row = rows.find((r) => r.name === li.getAttribute("data-name"))!;
      const { container, unmount } = render(
        <Ghost row={row} onSelect={noop} selected={false} size={100} />,
      );
      const original = decayClass(container);
      unmount();
      expect(original).toEqual([`ghost-decay-${row.decayLevel}`]);
      expect(decayClass(li)).toEqual(original);
    }
  });

  it("renders no scene-fog", () => {
    render(<WorldPlaceView {...props(ghosts(5))} />);
    expect(screen.queryByTestId("scene-fog")).toBeNull();
    expect(screen.queryByTestId("scene-fog-near")).toBeNull();
  });

  it("renders the finished empty scene for an empty sky", () => {
    render(<WorldPlaceView {...props([])} />);
    expect(screen.getByTestId("empty-scene")).toBeTruthy();
    expect(screen.getByTestId("empty-sky-moon")).toBeTruthy();
    expect(screen.getByTestId("empty-sky-hook")).toBeTruthy();
    expect(screen.getByTestId("empty-scene-plaque")).toBeTruthy();
    expect(screen.queryAllByTestId("scatter-creature")).toHaveLength(0);
    expect(screen.queryByTestId("scene-fog")).toBeNull();
  });
});
