/**
 * Tests for `WorldPlaceView` (explorable-worlds task 5.10).
 *
 * Requirements: 3.1, 11.2, 11.3, 12.6, 12.7, 12.11, 12.12, 13.2, 15.1, 15.5
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { WorldPlace } from "@/lib/world-layout";

afterEach(() => cleanup());

const noop = () => {};

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

function props(
  place: WorldPlace,
  count: number,
  extra: Partial<WorldPlaceViewProps> = {},
): WorldPlaceViewProps {
  return {
    place,
    rows: makeRows(place, count),
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

function category(el: Element): string {
  if (el.getAttribute("data-testid") === "world-scroller") return "scroller";
  if (el.closest('[data-testid="return-to-gate"]') || el.getAttribute("data-testid") === "return-to-gate")
    return "return";
  if (el.closest('[data-testid="place-chips-row"]')) return "chip";
  if (el.closest('[data-testid="depth-marker"]')) return "marker";
  if (el.closest('[data-testid="scatter-creature"]')) return "creature";
  if (el.closest('[data-testid="place-bottom-bar"]')) return "pager";
  return "other";
}

describe("WorldPlaceView shell", () => {
  it("has an h-dvh root with no overflow utility; the scroller is the only overflow-auto", () => {
    render(<WorldPlaceView {...props("sky", 6)} />);
    const root = screen.getByTestId("place-view");
    expect(root.className).toContain("h-dvh");
    expect(root.className).not.toMatch(/overflow/);
    const scroller = screen.getByTestId("world-scroller");
    expect(scroller.className).toContain("overflow-y-auto");
    const scrollers = root.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]');
    expect(Array.from(scrollers)).toEqual([scroller]);
    expect(root.hasAttribute("data-world")).toBe(true);
  });

  it("tab order: scroller, return, chips, depth marker, creatures, pager", async () => {
    render(<WorldPlaceView {...props("sky", 13)} />);
    const user = userEvent.setup();
    // Entry focus sits on the heading; start the sequence from the scroller.
    screen.getByTestId("world-scroller").focus();
    const seen: string[] = [category(document.activeElement as Element)];
    for (let i = 0; i < 80; i++) {
      await user.tab();
      const active = document.activeElement as Element;
      const cat = category(active);
      if (seen[seen.length - 1] !== cat) seen.push(cat);
      if (cat === "pager") break;
    }
    expect(seen).toEqual(["scroller", "return", "chip", "marker", "creature", "pager"]);
  });

  it("hides the depth marker at World_Length 1 and shows it above 1", () => {
    const { unmount } = render(<WorldPlaceView {...props("sky", 1)} />);
    expect(screen.queryByTestId("depth-marker")).toBeNull();
    unmount();
    render(<WorldPlaceView {...props("sky", 6)} />);
    expect(screen.getByTestId("depth-marker")).toBeTruthy();
  });

  it("marks decor aria-hidden and inert, with no focusable inside", () => {
    render(<WorldPlaceView {...props("ground", 6)} />);
    const decor = [
      ...Array.from(document.querySelectorAll("[data-decor-clip]")),
      screen.getByTestId("world-gradient-top"),
      screen.getByTestId("world-gradient-bottom"),
      screen.getByTestId("world-atmosphere"),
    ];
    expect(decor.length).toBeGreaterThan(4);
    for (const el of decor) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.hasAttribute("inert")).toBe(true);
      expect(el.querySelector("button, a[href], input, [tabindex]")).toBeNull();
    }
    for (const el of document.querySelectorAll("[data-decor-clip]")) {
      expect(el.querySelector('[data-testid="scatter-creature"]')).toBeNull();
    }
  });

  it("legibility gradients are 18 vh", () => {
    render(<WorldPlaceView {...props("sky", 3)} />);
    expect(screen.getByTestId("world-gradient-top").style.height).toBe("18vh");
    expect(screen.getByTestId("world-gradient-bottom").style.height).toBe("18vh");
  });

  it("a 3-ghost sky has 2 Strata", () => {
    render(<WorldPlaceView {...props("sky", 3)} />);
    expect(screen.getByTestId("depth-scatter").querySelectorAll("ol")).toHaveLength(2);
    expect(screen.getByTestId("depth-step-1")).toBeTruthy();
    expect(screen.queryByTestId("depth-step-2")).toBeNull();
    expect(document.querySelectorAll("[data-stratum-anchor]")).toHaveLength(2);
  });

  it("crypt has an entry plus one Stratum per chamber of 4", () => {
    const { unmount } = render(<WorldPlaceView {...props("crypt", 4)} />);
    expect(screen.getByTestId("depth-scatter").querySelectorAll("ol")).toHaveLength(2);
    unmount();
    render(<WorldPlaceView {...props("crypt", 9)} />);
    expect(screen.getByTestId("depth-scatter").querySelectorAll("ol")).toHaveLength(4);
    expect(screen.getByTestId("depth-step-3").getAttribute("aria-label")).toBe(
      "Chamber 3 of 3",
    );
  });

  it.each(["sky", "ground", "crypt"] as WorldPlace[])("renders no scene-fog for %s", (place) => {
    render(<WorldPlaceView {...props(place, 5)} />);
    expect(screen.queryByTestId("scene-fog")).toBeNull();
    expect(screen.queryByTestId("scene-fog-near")).toBeNull();
    expect(screen.getByTestId("place-view").getAttribute("data-place")).toBe(place);
    expect(screen.getAllByTestId("scatter-creature")).toHaveLength(5);
  });

  it("puts the safe-area padding on the bottom bar", () => {
    render(<WorldPlaceView {...props("sky", 3)} />);
    expect(screen.getByTestId("place-bottom-bar").style.paddingBottom).toContain(
      "safe-area-inset-bottom",
    );
  });

  it("focuses the heading once on entry and not again on re-render", () => {
    const p = props("sky", 3);
    const { rerender } = render(<WorldPlaceView {...p} />);
    expect(document.activeElement).toBe(screen.getByTestId("place-heading"));
    screen.getByTestId("return-to-gate").focus();
    rerender(<WorldPlaceView {...p} activeFilter="all" plotIndex={0} />);
    expect(document.activeElement).toBe(screen.getByTestId("return-to-gate"));
  });

  it("returns focus to the creature after the panel closes", () => {
    const p = props("sky", 3);
    const name = p.rows[1].name;
    const { rerender } = render(<WorldPlaceView {...p} />);
    rerender(<WorldPlaceView {...p} selectedName={name} panelOpen />);
    act(() => screen.getByTestId("return-to-gate").focus());
    rerender(<WorldPlaceView {...p} selectedName={null} panelOpen={false} />);
    const li = screen
      .getAllByTestId("scatter-creature")
      .find((el) => el.getAttribute("data-name") === name);
    expect(li?.contains(document.activeElement)).toBe(true);
  });
});
