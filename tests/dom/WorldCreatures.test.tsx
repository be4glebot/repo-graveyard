/**
 * Tests for `WorldStage` / `WorldCreatures`.
 *
 * Requirements: 3.7, 5.2, 12.5, 12.6, 18.7, 18.11
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import WorldCreatures from "@/components/world/WorldCreatures";
import WorldStage from "@/components/world/WorldStage";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";
import { computeWorldLayout, type WorldPlace } from "@/lib/world-layout";

afterEach(() => cleanup());

const W = 1024;
const H = 800;

function makeRows(states: LifecycleState[]): GraveyardRow[] {
  return states.map((state, i) => ({
    name: `repo-${i}`,
    url: `https://github.com/octocat/repo-${i}`,
    state,
    daysQuiet: 40 + i,
    decayLevel: state === "tombstone" || state === "coffin" ? null : 1,
  }));
}

function setup(place: WorldPlace, states: LifecycleState[]) {
  const rows = makeRows(states);
  const layout = computeWorldLayout({
    place,
    names: rows.map((r) => r.name),
    viewportW: W,
    viewportH: H,
  });
  render(
    <WorldStage heightPx={layout.heightPx}>
      <WorldCreatures
        layout={layout}
        rows={rows}
        viewportW={W}
        selectedName={null}
        onSelect={() => {}}
      />
    </WorldStage>,
  );
  return { rows, layout };
}

describe("WorldCreatures", () => {
  it("renders a stage of heightPx with ol/li per stratum and preserved testids", () => {
    const { rows, layout } = setup("ground", ["tombstone", "tombstone", "tombstone", "tombstone", "tombstone"]);
    expect(screen.getByTestId("world-stage").style.height).toBe(`${layout.heightPx}px`);
    const layer = screen.getByTestId("depth-scatter");
    const lists = layer.querySelectorAll("ol");
    expect(lists).toHaveLength(layout.strata.length);
    const items = screen.getAllByTestId("scatter-creature");
    expect(items).toHaveLength(rows.length);
    for (const li of items) {
      expect(li.tagName).toBe("LI");
      expect(li.parentElement?.tagName).toBe("OL");
      expect(li.style.left).toMatch(/%$/);
      expect(li.style.top).toMatch(/px$/);
      expect(li.getAttribute("data-name")).toMatch(/^repo-/);
    }
    expect(screen.getAllByTestId("scatter-plaque")).toHaveLength(rows.length);
  });

  it("orders buttons by domOrder and z-index by cy rank", () => {
    const { rows, layout } = setup("sky", ["ghost", "ghost", "ghost", "ghost", "ghost", "ghost"]);
    const names = screen
      .getAllByTestId("scatter-creature")
      .map((li) => li.getAttribute("data-name"));
    expect(names).toEqual(layout.domOrder.map((i) => rows[i].name));
    const z = screen
      .getAllByTestId("scatter-creature")
      .map((li) => Number(li.style.zIndex));
    expect(z).toEqual([...z].sort((a, b) => a - b));
  });

  it("gives shadows to standing states only, never to ghosts", () => {
    setup("ground", ["zombie", "risen", "tombstone", "coffin", "ghost"]);
    for (const li of screen.getAllByTestId("scatter-creature")) {
      const shadows = within(li).queryAllByTestId("creature-shadow");
      const name = li.getAttribute("data-name");
      expect(shadows).toHaveLength(name === "repo-4" ? 0 : 1);
    }
  });

  it("applies no pointer offset transform to the layer", () => {
    setup("sky", ["ghost", "ghost"]);
    const layer = screen.getByTestId("depth-scatter");
    expect(layer.getAttribute("data-band-rate")).toBe("1");
    expect(layer.style.transform).toBe("");
  });
});
