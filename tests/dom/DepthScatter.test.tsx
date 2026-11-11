/**
 * DOM test for the depth-scatter renderer (`components/scene/DepthScatter.tsx`,
 * tasks 8.1 + 8.2).
 *
 * `DepthScatter` is the organic creature-placement renderer `PlaceView` points
 * at. It consumes the seeded `scatterLayout` record for each creature and lays
 * the plot out in two stacked, pointer-events-none layers:
 *
 *   - the **creatures layer** (`depth-scatter-creatures`, z 20): one
 *     `scatter-creature` per row, absolutely positioned at its `x`/`y`, scaled
 *     and brightness-filtered, `scaleX(-1)` on the creature image only when the
 *     record is `mirrored`, and a seeded `rotate()` tilt on the ground place's
 *     tombstones (Req 5.1, 5.8);
 *   - the **plaque layer** (`depth-scatter-plaques`, z 30): a single layer above
 *     every creature (z 20) and above the near fog (`Fog_Thin`, z 25), with one
 *     `scatter-plaque` / `Plaque` per creature, at the same `x`, never mirrored
 *     (Req 5.11).
 *
 * A `ResizeObserver` reads the plot container width: ≥768px uses the seeded
 * scatter positions (`data-layout="scatter"`), below 768px switches to a
 * two-column staggered layout (`data-layout="two-column"`) (Req 5.9/5.10). At
 * the gate with reduced motion inactive, fresh (decay 0) zombies gain a
 * `translateX`-only wander (`data-wander="true"`, class `gate-wander`); decay
 * 1–4 zombies do not (`data-wander="false"`); reduced motion drops the wander
 * entirely (Req 5.12/5.13/5.14).
 *
 * jsdom quirks this test works around:
 *   - jsdom has no layout, so `el.clientWidth` is 0 and the hook's initial
 *     synchronous read keeps the ≥768px scatter branch. To exercise the
 *     two-column branch we stub a fake `ResizeObserver` that immediately calls
 *     its callback with a narrow (< 768px) `contentRect.width`.
 *   - `@testing-library/jest-dom` is not installed, so assertions use plain DOM
 *     / vitest checks (testids, data- attributes, inline style transforms),
 *     matching the other `tests/dom/*.test.tsx` files.
 *
 * Requirements: 5.8, 5.10, 5.11, 5.12, 5.13, 5.14, 8.1
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";

import DepthScatter from "@/components/scene/DepthScatter";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";

const noop = () => {};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Builds one display row; overrides merge onto sensible defaults. */
function makeRow(overrides: Partial<GraveyardRow> = {}): GraveyardRow {
  return {
    name: "octocat/repo",
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
    makeRow({
      name: `${state}-${i}`,
      url: `https://github.com/octocat/${state}-${i}`,
      state,
      decayLevel,
      daysQuiet: i + 1,
    }),
  );
}

/** A mixed plot: ghosts, zombies, and tombstones so every path is exercised. */
function mixedPlot(): GraveyardRow[] {
  return [
    makeRow({ name: "octocat/ghost-a", state: "ghost", decayLevel: 0 }),
    makeRow({ name: "octocat/zombie-a", state: "zombie", decayLevel: 0 }),
    makeRow({ name: "octocat/tomb-a", state: "tombstone", decayLevel: null }),
  ];
}

// ---------------------------------------------------------------------------
// Fake ResizeObserver: immediately reports a fixed `contentRect.width` so the
// width branch can be driven without real layout. The width is read from the
// module-scoped `fakeWidth` each time a new observer is constructed/observed.
// ---------------------------------------------------------------------------

let fakeWidth = 0;

/** Install a `ResizeObserver` stub reporting `width` on observe. */
function installResizeObserver(width: number): void {
  fakeWidth = width;
  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      // Report the faked width synchronously as a single entry.
      const entry = {
        target,
        contentRect: { width: fakeWidth, height: fakeWidth } as DOMRectReadOnly,
      } as ResizeObserverEntry;
      this.callback([entry], this as unknown as ResizeObserver);
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver as unknown as typeof ResizeObserver);
}

// ---------------------------------------------------------------------------
// Helpers to read the rendered structure.
// ---------------------------------------------------------------------------

/** The creature image transform wrapper (innermost div with `transform`). */
function creatureTransform(scatterCreature: HTMLElement): string {
  // creatures layer markup: [positioned] > [wander/passthrough] > [transform].
  const transformDiv = scatterCreature.querySelector(
    "div[style*='transform']",
  ) as HTMLElement | null;
  if (transformDiv === null) {
    throw new Error("scatter-creature has no transform wrapper");
  }
  return transformDiv.style.transform;
}

/** z-index of a layer element read from its Tailwind class. */
function hasZClass(el: HTMLElement, z: number): boolean {
  return el.classList.contains(`z-${z}`);
}

// ---------------------------------------------------------------------------
// Plaque layer: one plaque per creature, single layer above creatures + fog.
// ---------------------------------------------------------------------------

describe("DepthScatter — plaque layer (Req 5.8, 5.11)", () => {
  it("renders exactly one plaque per creature", () => {
    const plot = makeRows(5, "ghost");
    const { getAllByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const creatures = getAllByTestId("scatter-creature");
    const plaques = getAllByTestId("scatter-plaque");
    expect(creatures).toHaveLength(plot.length);
    expect(plaques).toHaveLength(plot.length);

    // One plaque per creature name — same set, no dup, no omission.
    const creatureNames = creatures
      .map((c) => c.getAttribute("data-name"))
      .sort();
    const plaqueNames = plaques.map((p) => p.getAttribute("data-name")).sort();
    expect(plaqueNames).toEqual(creatureNames);

    // Each plaque carries exactly one Plaque unit with the full name available.
    for (const plaque of plaques) {
      expect(within(plaque).getAllByTestId("plaque")).toHaveLength(1);
    }
  });

  it("stacks a single plaque layer (z 30) above every creature (z 20) and above the near fog (z 25)", () => {
    const { getByTestId } = render(
      <DepthScatter
        place="sky"
        plot={mixedPlot()}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const creaturesLayer = getByTestId("depth-scatter-creatures");
    const plaqueLayer = getByTestId("depth-scatter-plaques");

    // Creatures sit at z 20; plaques at z 30 — above both creatures and the
    // z-25 near fog. Exactly one plaque layer wraps all plaques.
    expect(hasZClass(creaturesLayer, 20)).toBe(true);
    expect(hasZClass(plaqueLayer, 30)).toBe(true);

    // The plaque layer is a single layer that contains every plaque.
    const plaques = within(plaqueLayer).getAllByTestId("scatter-plaque");
    expect(plaques).toHaveLength(mixedPlot().length);

    // z 30 (plaques) > z 25 (near fog) > z 20 (creatures): the ordering holds.
    expect(30).toBeGreaterThan(25);
    expect(25).toBeGreaterThan(20);
  });

  it("gives each plaque a fixed max width, ellipsizes a long name, and keeps the full name in title + aria-label", () => {
    const longName =
      "octocat/an-extremely-long-repository-name-that-overflows-the-slab";
    const plot = [makeRow({ name: longName, state: "ghost", decayLevel: 0 })];
    const { getByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const plaque = getByTestId("plaque");
    // Fixed max width in px (the single-source PLAQUE_W, scaled by the record).
    expect(plaque.style.maxWidth).toMatch(/px$/);
    expect(parseFloat(plaque.style.maxWidth)).toBeGreaterThan(0);

    const name = getByTestId("plaque-name");
    // Ellipsize rather than widen.
    expect(name.style.whiteSpace).toBe("nowrap");
    expect(name.style.overflow).toBe("hidden");
    expect(name.style.textOverflow).toBe("ellipsis");
    // The full name stays available to pointer hover and assistive tech.
    expect(name.getAttribute("title")).toBe(longName);
    expect(name.getAttribute("aria-label")).toBe(longName);
  });
});

// ---------------------------------------------------------------------------
// Mirroring: flips the creature image, never the plaque text.
// ---------------------------------------------------------------------------

describe("DepthScatter — mirroring flips only the creature, not the plaque (Req 5.11)", () => {
  it("applies scaleX(-1) to a mirrored creature's image transform while its plaque text is unmirrored", () => {
    // A full plot guarantees at least one mirrored record (round(n/3) > 0).
    const plot = makeRows(9, "ghost");
    const { getAllByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const creatures = getAllByTestId("scatter-creature");
    const mirrored = creatures.filter(
      (c) => c.getAttribute("data-mirrored") === "true",
    );
    // round(9/3) = 3 creatures are mirrored.
    expect(mirrored.length).toBeGreaterThan(0);

    for (const creature of mirrored) {
      // The creature image transform carries the horizontal flip.
      expect(creatureTransform(creature)).toContain("scaleX(-1)");
    }

    // Not-mirrored creatures never flip their image.
    const notMirrored = creatures.filter(
      (c) => c.getAttribute("data-mirrored") === "false",
    );
    for (const creature of notMirrored) {
      expect(creatureTransform(creature)).not.toContain("scaleX(-1)");
    }

    // No plaque ever carries a scaleX(-1) flip — the plaque text always reads
    // left-to-right even when its creature image is mirrored.
    const plaqueLayer = getAllByTestId("depth-scatter-plaques")[0];
    expect(plaqueLayer.innerHTML).not.toContain("scaleX(-1)");
  });
});

// ---------------------------------------------------------------------------
// Ground tombstones carry a seeded tilt.
// ---------------------------------------------------------------------------

describe("DepthScatter — ground tombstones carry a tilt (Req 5.8)", () => {
  it("applies a rotate() tilt to ground tombstone creature transforms", () => {
    const plot = makeRows(4, "tombstone", null);
    const { getAllByTestId } = render(
      <DepthScatter
        place="ground"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const creatures = getAllByTestId("scatter-creature");
    for (const creature of creatures) {
      expect(creatureTransform(creature)).toContain("rotate(");
    }
  });

  it("does not apply a rotate() tilt on a non-ground place", () => {
    const plot = makeRows(4, "tombstone", null);
    const { getAllByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const creatures = getAllByTestId("scatter-creature");
    for (const creature of creatures) {
      expect(creatureTransform(creature)).not.toContain("rotate(");
    }
  });
});

// ---------------------------------------------------------------------------
// Gate fresh-zombie wander.
// ---------------------------------------------------------------------------

describe("DepthScatter — gate fresh-zombie wander (Req 5.12, 5.13, 5.14)", () => {
  it("gives gate fresh (decay 0) zombies a wander and decay 1-4 zombies none", () => {
    const plot: GraveyardRow[] = [
      makeRow({ name: "octocat/fresh-0", state: "zombie", decayLevel: 0 }),
      makeRow({ name: "octocat/rotting-1", state: "zombie", decayLevel: 1 }),
      makeRow({ name: "octocat/rotting-2", state: "zombie", decayLevel: 2 }),
      makeRow({ name: "octocat/rotting-4", state: "zombie", decayLevel: 4 }),
    ];
    const { getByTestId } = render(
      <DepthScatter
        place="gate"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    // Look each creature up by its data-name via the creatures layer.
    const creatures = within(
      getByTestId("depth-scatter-creatures"),
    ).getAllByTestId("scatter-creature");
    const byName = new Map(
      creatures.map((c) => [c.getAttribute("data-name"), c]),
    );

    expect(byName.get("octocat/fresh-0")?.getAttribute("data-wander")).toBe(
      "true",
    );
    // The wander lives on a `.gate-wander` wrapper inside the fresh creature.
    expect(
      byName.get("octocat/fresh-0")?.querySelector(".gate-wander"),
    ).not.toBeNull();

    // Decay 1-4 zombies keep their existing lurch/twitch — no wander.
    for (const name of ["octocat/rotting-1", "octocat/rotting-2", "octocat/rotting-4"]) {
      expect(byName.get(name)?.getAttribute("data-wander")).toBe("false");
      expect(byName.get(name)?.querySelector(".gate-wander")).toBeNull();
    }
  });

  it("drops the wander for fresh gate zombies under reduced motion (Req 5.14)", () => {
    const plot = makeRows(3, "zombie", 0);
    const { getByTestId } = render(
      <DepthScatter
        place="gate"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={true}
      />,
    );

    const root = getByTestId("depth-scatter");
    expect(root.getAttribute("data-reduced-motion")).toBe("true");

    const creatures = within(
      getByTestId("depth-scatter-creatures"),
    ).getAllByTestId("scatter-creature");
    for (const creature of creatures) {
      expect(creature.getAttribute("data-wander")).toBe("false");
      expect(creature.querySelector(".gate-wander")).toBeNull();
    }
  });

  it("never wanders fresh zombies off the gate (place !== gate)", () => {
    const plot = makeRows(3, "zombie", 0);
    const { getByTestId } = render(
      <DepthScatter
        place="crypt"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    const creatures = within(
      getByTestId("depth-scatter-creatures"),
    ).getAllByTestId("scatter-creature");
    for (const creature of creatures) {
      expect(creature.getAttribute("data-wander")).toBe("false");
    }
  });
});

// ---------------------------------------------------------------------------
// Width branch: two-column layout below 768px.
// ---------------------------------------------------------------------------

describe("DepthScatter — width branch (Req 5.9, 5.10)", () => {
  it("uses the scatter layout at >=768px (default, no narrow measurement)", () => {
    const { getByTestId } = render(
      <DepthScatter
        place="sky"
        plot={mixedPlot()}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );
    // Without a narrow ResizeObserver measurement the root stays in scatter.
    expect(getByTestId("depth-scatter").getAttribute("data-layout")).toBe(
      "scatter",
    );
  });

  it("switches to the two-column layout once the container measures below 768px", () => {
    // A fake ResizeObserver immediately reports a 390px-wide container, forcing
    // the two-column branch (390 < MOBILE_BREAKPOINT 768).
    installResizeObserver(390);

    const plot = makeRows(6, "ghost");
    const { getByTestId, getAllByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
        compactBand={{ top: 120, bottom: 500 }}
      />,
    );

    expect(getByTestId("depth-scatter").getAttribute("data-layout")).toBe(
      "two-column",
    );

    // Two columns: every creature's left falls into one of two x-bands. Read
    // the inline `left` percentage off each positioned creature wrapper.
    const creatures = getAllByTestId("scatter-creature");
    const lefts = new Set(creatures.map((c) => c.style.left));
    // Exactly two distinct column x-positions in the staggered two-column grid.
    expect(lefts.size).toBe(2);

    // One plaque per creature is still rendered in the two-column layout.
    const plaques = getAllByTestId("scatter-plaque");
    expect(plaques).toHaveLength(plot.length);
  });

  it("stays on the scatter layout when the container measures >=768px", () => {
    installResizeObserver(1200);

    const { getByTestId } = render(
      <DepthScatter
        place="sky"
        plot={mixedPlot()}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );

    expect(getByTestId("depth-scatter").getAttribute("data-layout")).toBe(
      "scatter",
    );
  });
});


// ---------------------------------------------------------------------------
// Visual fix 2C: tombstones/coffins never mirror; creatures are feet-anchored
// and the plaque sits below the feet.
// ---------------------------------------------------------------------------

describe("DepthScatter — ground/crypt never mirror (visual fix 2C)", () => {
  it("applies no scaleX(-1) to any tombstone on the ground", () => {
    // A full plot guarantees scatterLayout marks some records `mirrored`; none
    // of them may flip, because tombstones carry RIP text.
    const plot = makeRows(9, "tombstone", null);
    const { getAllByTestId } = render(
      <DepthScatter
        place="ground"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );
    const creatures = getAllByTestId("scatter-creature");
    expect(creatures.length).toBe(plot.length);
    for (const creature of creatures) {
      expect(creatureTransform(creature)).not.toContain("scaleX(-1)");
    }
  });

  it("applies no scaleX(-1) to any coffin in the crypt", () => {
    const plot = makeRows(9, "coffin", null);
    const { getAllByTestId } = render(
      <DepthScatter
        place="crypt"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );
    const creatures = getAllByTestId("scatter-creature");
    for (const creature of creatures) {
      expect(creatureTransform(creature)).not.toContain("scaleX(-1)");
    }
  });

  it("still mirrors some ghosts on the sky (control: mirroring is sky/gate only)", () => {
    // The sky place DOES mirror, so a full plot shows at least one scaleX(-1):
    // this proves the ground/crypt result above is the gating, not a dead flag.
    const plot = makeRows(9, "ghost", 0);
    const { getAllByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );
    const mirrored = getAllByTestId("scatter-creature").filter((c) =>
      creatureTransform(c).includes("scaleX(-1)"),
    );
    expect(mirrored.length).toBeGreaterThan(0);
  });
});

describe("DepthScatter — creatures are feet-anchored, plaque over the creature's lower body (visual fix r3 #2)", () => {
  /** The outer positioning wrapper (the one carrying left/top + translate). */
  function positioner(creature: HTMLElement): HTMLElement {
    return creature;
  }

  it("anchors each creature by its feet with translate(-50%, -100%)", () => {
    const plot = makeRows(5, "zombie", 1);
    const { getAllByTestId } = render(
      <DepthScatter
        place="gate"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );
    for (const creature of getAllByTestId("scatter-creature")) {
      // The positioning wrapper puts (x, y) at the FEET, so the body rises from
      // the ground line rather than being centred on the point.
      expect(positioner(creature).style.transform).toContain(
        "translate(-50%, -100%)",
      );
    }
  });

  it("centres each plaque on the resolved plaque point in its own creature's lower body (Option A)", () => {
    const plot = makeRows(5, "zombie", 1);
    const { getAllByTestId } = render(
      <DepthScatter
        place="gate"
        plot={plot}
        selectedName={null}
        onSelect={noop}
        reducedMotion={false}
      />,
    );
    for (const plaque of getAllByTestId("scatter-plaque")) {
      // The plaque is CENTRED on its resolved point (its own creature's lower
      // body), so both axes translate by -50% — no longer a feet-hugging
      // +6px-below offset, and it is not flipped/anchored to a corner.
      expect(plaque.style.transform).toBe("translate(-50%, -50%)");
      // `top` is a plain percentage of the scene box (the resolved plaque y),
      // never the old `calc(... + 6px)` below-the-feet offset.
      expect(plaque.style.top).toMatch(/%$/);
      expect(plaque.style.top).not.toContain("+ 6px");
    }
  });
});
