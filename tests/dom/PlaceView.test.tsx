/**
 * Component tests for `PlaceView` and its controls (tasks 9.2 + 9.1).
 *
 * `PlaceView` is the in-place scene: it applies the active filter, orders the
 * rows with `orderForPlace`, paginates them into fixed-size plots with
 * `paginate(ordered, PLOT_SIZE)`, and renders the current plot through the
 * organic `DepthScatter` (one `scatter-creature` per row, a `scatter-plaque`
 * per creature) with `FilterChips`, a `Pager`, a `ReturnToGate` control, and a
 * focusable `PlaceHeading`, all under the 2C polish layers (`PlaceBackground`,
 * two-site `Fog`, `LanternCursor`, pointer `useParallax`). These tests pin the
 * interactive and layout behavior not covered by the pure view-model property
 * tests:
 *
 *   - the scatter renders one creature per plotted row (Req 5.1) and every
 *     creature carries a depth-band brightness in (0, 1] (Req 5.2);
 *   - plots hold up to `PLOT_SIZE` (12) creatures with no "+N more" collapse
 *     (Req 5.5);
 *   - filter chips change the visible set and show counts; zero-count chips are
 *     dimmed/disabled; `ground`/`crypt` render no chips (Req 8.7, 8.8, 8.9);
 *   - the pager reads "Plot X of Y", clamps an out-of-range index, and the two
 *     controls step and disable correctly at the ends (Req 8.1, 8.3);
 *   - the return control is reachable and returns to the map via `onReturn`,
 *     and focus moves to `PlaceHeading` on arrival (Req 9.2, 9.3).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (data- attributes, textContent, disabled, activeElement),
 * matching the pattern in `tests/dom/SceneView.test.tsx`.
 *
 * Requirements: 5.1, 5.2, 5.5, 8.1, 8.3, 8.7, 8.8, 8.9, 9.2, 9.3
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PlaceView from "@/components/scene/PlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";
import { PLOT_SIZE, type PlaceFilter, type PlaceId } from "@/lib/estate-view";

afterEach(() => {
  cleanup();
});

/** Builds a minimal display row; overrides merge onto sensible defaults. */
function makeRow(overrides: Partial<GraveyardRow> = {}): GraveyardRow {
  return {
    name: "repo",
    url: "https://github.com/octocat/repo",
    state: "ghost",
    daysQuiet: 1,
    decayLevel: 0,
    ...overrides,
  };
}

/** Builds `count` rows of a single state with stable, unique names. */
function makeRows(
  count: number,
  state: LifecycleState,
  decayLevel: number | null = 0,
): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeRow({ name: `${state}-${i}`, state, decayLevel, daysQuiet: i + 1 }),
  );
}

/** No-op handlers shared by renders that don't exercise a given callback. */
const noop = () => {};

/** Renders a PlaceView; only the props a test cares about need be supplied. */
function renderPlace(
  props: Partial<{
    place: PlaceId;
    rows: GraveyardRow[];
    activeFilter: PlaceFilter;
    plotIndex: number;
    selectedName: string | null;
    onFilterChange: (f: PlaceFilter) => void;
    onPlotChange: (i: number) => void;
    onSelect: (n: string) => void;
    onReturn: () => void;
  }> = {},
) {
  const place = props.place ?? "sky";
  return render(
    <PlaceView
      place={place}
      rows={props.rows ?? makeRows(3, "ghost")}
      activeFilter={props.activeFilter ?? "all"}
      plotIndex={props.plotIndex ?? 0}
      selectedName={props.selectedName ?? null}
      onFilterChange={props.onFilterChange ?? noop}
      onPlotChange={props.onPlotChange ?? noop}
      onSelect={props.onSelect ?? noop}
      onReturn={props.onReturn ?? noop}
    />,
  );
}

/** The `scatter-creature` elements `DepthScatter` paints, in DOM order. */
function scatterCreatures(): HTMLElement[] {
  return Array.from(
    screen
      .getByTestId("depth-scatter")
      .querySelectorAll("[data-testid='scatter-creature']"),
  ) as HTMLElement[];
}

/**
 * Reads a scatter creature's depth-band brightness from the `filter:
 * brightness(x)` inline style `DepthScatter` sets on each creature wrapper.
 * Returns `NaN` if no brightness filter is present.
 */
function creatureBrightness(el: HTMLElement): number {
  const match = /brightness\(([\d.]+)\)/.exec(el.style.filter ?? "");
  return match ? Number(match[1]) : NaN;
}

/** Counts the creatures rendered by the scatter for the current plot. */
function renderedCreatureCount(): number {
  return scatterCreatures().length;
}

describe("PlaceView depth scatter (5.1, 5.2)", () => {
  it("renders one creature per plotted row for a full plot", () => {
    // A full plot of PLOT_SIZE (12) creatures scatters one creature per row.
    renderPlace({ rows: makeRows(PLOT_SIZE, "ghost") });

    expect(renderedCreatureCount()).toBe(PLOT_SIZE);
  });

  it("gives every creature a depth-band brightness in (0, 1]", () => {
    renderPlace({ rows: makeRows(PLOT_SIZE, "ghost") });

    const brightnesses = scatterCreatures().map(creatureBrightness);
    expect(brightnesses.length).toBe(PLOT_SIZE);
    for (const b of brightnesses) {
      expect(Number.isFinite(b)).toBe(true);
      expect(b).toBeGreaterThan(0);
      expect(b).toBeLessThanOrEqual(1);
    }
    // The depth bands dim toward the back, so not every creature is at full
    // brightness — the scatter carries a visible depth gradient (Req 5.2).
    expect(Math.min(...brightnesses)).toBeLessThan(Math.max(...brightnesses));
  });
});

describe("PlaceView plots (5.5)", () => {
  it("renders every creature in a full plot with no '+N more' collapse", () => {
    // 20 ghosts => first plot is a full PLOT_SIZE (12). The place must render
    // each of those 12 individually, never a "+N more" summary (Req 5.5).
    renderPlace({ rows: makeRows(20, "ghost"), plotIndex: 0 });

    expect(renderedCreatureCount()).toBe(PLOT_SIZE);
    expect(screen.queryByText(/\+\s*\d+\s*more/i)).toBeNull();
  });

  it("renders the remainder on the final plot", () => {
    // 20 ghosts, PLOT_SIZE 12 => plot 2 (index 1) holds the remaining 8.
    renderPlace({ rows: makeRows(20, "ghost"), plotIndex: 1 });

    expect(renderedCreatureCount()).toBe(20 - PLOT_SIZE);
    expect(screen.queryByText(/\+\s*\d+\s*more/i)).toBeNull();
  });
});

describe("PlaceView filter chips (8.7, 8.8, 8.9)", () => {
  it("shows a count per sky decay chip and changes the visible set on select", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    // 3 healthy (band 0) + 2 fading (band 1) ghosts.
    const rows = [
      ...makeRows(3, "ghost", 0),
      ...makeRows(2, "ghost", 1).map((r, i) =>
        makeRow({ ...r, name: `fading-${i}` }),
      ),
    ];
    renderPlace({ place: "sky", rows, onFilterChange });

    // The "All" chip counts every row; each decay chip shows its band count.
    const all = screen.getByTestId("filter-chip-all");
    const healthy = screen.getByTestId("filter-chip-healthy");
    const fading = screen.getByTestId("filter-chip-fading");
    expect(within(all).getByText("5")).not.toBeNull();
    expect(within(healthy).getByText("3")).not.toBeNull();
    expect(within(fading).getByText("2")).not.toBeNull();

    // Selecting a chip reports the new filter to the parent (the parent owns
    // the controlled `activeFilter`, so the visible set changes on re-render).
    await user.click(fading);
    expect(onFilterChange).toHaveBeenCalledWith("fading");
  });

  it("narrows the rendered creatures when a decay filter is active", () => {
    // With the "fading" filter active the parent passes activeFilter="fading";
    // only the 2 band-1 ghosts should render.
    const rows = [
      ...makeRows(3, "ghost", 0),
      ...makeRows(2, "ghost", 1).map((r, i) =>
        makeRow({ ...r, name: `fading-${i}` }),
      ),
    ];
    renderPlace({ place: "sky", rows, activeFilter: "fading" });

    expect(renderedCreatureCount()).toBe(2);
  });

  it("dims and disables a zero-count decay chip", () => {
    // Only band-0 (healthy) ghosts, so every other sky decay chip has count 0.
    renderPlace({ place: "sky", rows: makeRows(3, "ghost", 0) });

    const flickering = screen.getByTestId(
      "filter-chip-flickering",
    ) as HTMLButtonElement;
    expect(within(flickering).getByText("0")).not.toBeNull();
    expect(flickering.disabled).toBe(true);
    // The disabled chip carries the dimmed styling.
    expect(flickering.className).toContain("opacity-40");

    // The "All" chip is always enabled even though it is not the zero case.
    const all = screen.getByTestId("filter-chip-all") as HTMLButtonElement;
    expect(all.disabled).toBe(false);
  });

  it("renders a Risen chip with its own count for the gate", () => {
    // 2 risen + 3 fresh zombies (band 0) at the gate.
    const rows = [
      ...makeRows(2, "risen", null),
      ...makeRows(3, "zombie", 0),
    ];
    renderPlace({ place: "gate", rows });

    const risen = screen.getByTestId("filter-chip-risen");
    const fresh = screen.getByTestId("filter-chip-fresh");
    expect(within(risen).getByText("2")).not.toBeNull();
    expect(within(fresh).getByText("3")).not.toBeNull();
  });

  it("renders no filter chips for ground or crypt", () => {
    renderPlace({ place: "ground", rows: makeRows(3, "tombstone", null) });
    expect(screen.queryByTestId("filter-chips")).toBeNull();

    cleanup();

    renderPlace({ place: "crypt", rows: makeRows(3, "coffin", null) });
    expect(screen.queryByTestId("filter-chips")).toBeNull();
  });
});

describe("PlaceView pager (8.1, 8.3)", () => {
  it("reads 'Plot X of Y' and disables 'Nearer the gate' on the first plot", () => {
    // 20 ghosts => 2 plots (12 + 8). On plot index 0 the pager reads 1 of 2,
    // "Nearer the gate" is disabled, "Deeper into the dark" is enabled.
    renderPlace({ rows: makeRows(20, "ghost"), plotIndex: 0 });

    expect(screen.getByTestId("pager-label").textContent).toBe("Plot 1 of 2");

    const nearer = screen.getByTestId("pager-nearer") as HTMLButtonElement;
    const deeper = screen.getByTestId("pager-deeper") as HTMLButtonElement;
    expect(nearer.disabled).toBe(true);
    expect(deeper.disabled).toBe(false);
  });

  it("disables 'Deeper into the dark' on the last plot", () => {
    renderPlace({ rows: makeRows(20, "ghost"), plotIndex: 1 });

    expect(screen.getByTestId("pager-label").textContent).toBe("Plot 2 of 2");

    const nearer = screen.getByTestId("pager-nearer") as HTMLButtonElement;
    const deeper = screen.getByTestId("pager-deeper") as HTMLButtonElement;
    expect(nearer.disabled).toBe(false);
    expect(deeper.disabled).toBe(true);
  });

  it("'Nearer the gate' decrements the plot and 'Deeper into the dark' increments it", async () => {
    const user = userEvent.setup();
    const onPlotChange = vi.fn();
    // Three plots (36 ghosts => 12+12+12); on the middle plot both steps work.
    renderPlace({
      rows: makeRows(36, "ghost"),
      plotIndex: 1,
      onPlotChange,
    });

    await user.click(screen.getByTestId("pager-nearer"));
    expect(onPlotChange).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByTestId("pager-deeper"));
    expect(onPlotChange).toHaveBeenLastCalledWith(2);
  });

  it("clamps an out-of-range plot index into the valid range", () => {
    // 20 ghosts => 2 plots. A stale index of 9 must clamp to the last plot (1),
    // rendering a coherent "Plot 2 of 2" rather than "Plot 10 of 2" (Req 8.3).
    renderPlace({ rows: makeRows(20, "ghost"), plotIndex: 9 });

    expect(screen.getByTestId("pager-label").textContent).toBe("Plot 2 of 2");
    // The clamped-to-last plot disables the forward control.
    const deeper = screen.getByTestId("pager-deeper") as HTMLButtonElement;
    expect(deeper.disabled).toBe(true);
    // And renders the final-plot remainder (8), not an empty plot.
    expect(renderedCreatureCount()).toBe(20 - PLOT_SIZE);
  });
});

describe("PlaceView return control and focus (9.2, 9.3)", () => {
  it("renders a reachable return control that returns to the map on activation", async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    renderPlace({ onReturn });

    const ret = screen.getByTestId("return-to-gate") as HTMLButtonElement;
    // It is a focusable native button (not aria-disabled, in the tab order).
    expect(ret.tagName).toBe("BUTTON");
    expect(ret.disabled).toBe(false);

    // Reachable by keyboard: it can take focus and Enter activates it.
    ret.focus();
    expect(document.activeElement).toBe(ret);
    await user.keyboard("{Enter}");
    expect(onReturn).toHaveBeenCalledTimes(1);

    // And a pointer click activates it too.
    await user.click(ret);
    expect(onReturn).toHaveBeenCalledTimes(2);
  });

  it("moves focus to the place heading on arrival", () => {
    renderPlace({ place: "gate", rows: makeRows(3, "zombie", 0) });

    const heading = screen.getByTestId("place-heading");
    expect(document.activeElement).toBe(heading);
  });
});

describe("PlaceView atmosphere layers (data-encoding regression guard)", () => {
  // A gate fixture with zombies (so fog has density > 0 and renders) and at
  // least one ancient zombie (decayLevel 4, so lightning has a cadence and
  // renders). These guard against a future cleanup silently dropping the
  // data-encoding Fog/Lightning layers from the gate place.
  function gateRows(): GraveyardRow[] {
    return [
      makeRow({ name: "ancient-z", state: "zombie", decayLevel: 4, daysQuiet: 400 }),
      makeRow({ name: "fresh-z", state: "zombie", decayLevel: 0, daysQuiet: 200 }),
      makeRow({ name: "risen-one", state: "risen", decayLevel: null, daysQuiet: 10 }),
    ];
  }

  it("renders Fog in the gate when zombies are present (3.3)", () => {
    renderPlace({ place: "gate", rows: gateRows() });
    expect(screen.queryByTestId("scene-fog")).not.toBeNull();
  });

  it("renders Lightning in the gate when an ancient zombie exists (3.4, 3.5)", () => {
    renderPlace({ place: "gate", rows: gateRows() });
    expect(screen.queryByTestId("scene-lightning")).not.toBeNull();
  });

  it("renders no Fog or Lightning for a non-gate place (sky)", () => {
    // Sky holds ghosts; it carries neither the fog nor the lightning layer, so
    // the atmosphere stays gate-only even though ghosts are present.
    renderPlace({ place: "sky", rows: makeRows(3, "ghost", 3) });
    expect(screen.queryByTestId("scene-fog")).toBeNull();
    expect(screen.queryByTestId("scene-lightning")).toBeNull();
  });

  it("never renders the whisper region in a place (whispers are map-only)", () => {
    renderPlace({ place: "gate", rows: gateRows() });
    expect(screen.queryByTestId("scene-whisper")).toBeNull();
  });
});


describe("PlaceView title block: heading, subtitle, chips are one centered flow column (visual fix r3 #1)", () => {
  it("renders title, then subtitle, then the chip row in normal document flow, in that order", () => {
    renderPlace({ place: "gate", rows: makeRows(4, "zombie", 0) });

    const block = screen.getByTestId("place-title-block");
    const heading = screen.getByTestId("place-heading");
    const chips = screen.getByTestId("filter-chips");

    // The heading (title + subtitle) and the chip row are BOTH children of the
    // one title-block column (normal flow), not absolutely stacked over each
    // other.
    expect(block.contains(heading)).toBe(true);
    expect(block.contains(chips)).toBe(true);

    // The column flows top-to-bottom with a gap (flex-col + gap-4 = 16px), and
    // its items are not individually absolutely positioned.
    expect(block.className).toContain("flex-col");
    expect(block.className).toContain("items-center");
    expect(block.className).toContain("gap-4");
    expect(heading.className).not.toContain("absolute");
    expect(chips.className).not.toContain("absolute");

    // Order: the heading precedes the chips in document order, and INSIDE the
    // heading the title (<h1>) precedes the subtitle (<p>) ? title, subtitle,
    // then chips, reading top to bottom.
    expect(
      heading.compareDocumentPosition(chips) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const title = heading.querySelector("h1");
    const subtitle = heading.querySelector("p");
    expect(title).not.toBeNull();
    expect(subtitle).not.toBeNull();
    expect(
      title!.compareDocumentPosition(subtitle!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // And the subtitle precedes the chip row (subtitle -> chips, in flow).
    expect(
      subtitle!.compareDocumentPosition(chips) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the same flow column with no chips (ground/crypt): heading + subtitle still flow, chips absent", () => {
    renderPlace({ place: "ground", rows: makeRows(3, "tombstone", null) });
    const block = screen.getByTestId("place-title-block");
    const heading = screen.getByTestId("place-heading");
    expect(block.contains(heading)).toBe(true);
    expect(screen.queryByTestId("filter-chips")).toBeNull();
    // The title still precedes its subtitle in flow.
    const title = heading.querySelector("h1");
    const subtitle = heading.querySelector("p");
    expect(
      title!.compareDocumentPosition(subtitle!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
