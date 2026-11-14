/**
 * Layout-robustness + performance-budget DOM assertions (task 9.4).
 *
 * This file VERIFIES the Requirement 1 layout fixes landed in task 9.0 and the
 * Requirement 9 performance budget, structurally. jsdom performs no layout and
 * evaluates no media/container queries, so none of these assertions can measure
 * computed geometry (`getBoundingClientRect` is all zeros, `@media`/`md:` never
 * resolve). Instead they pin the STRUCTURE that makes the layout robust — the
 * scroll affordance, the full set of reachable places/controls, the header's
 * self-contained box with its condense utility, native focusable chips/pager,
 * the ≤12 animated-creature cap, and the transform/opacity-only loop classes —
 * which is the testable proxy for the viewport-size guarantees.
 *
 * The three Reference_Viewports (1440×900, 1280×720, 390×844) are not simulated
 * as pixel sizes (jsdom can't fit/clip anything); they appear here as the
 * requirement framing. What is asserted at every size is size-INDEPENDENT:
 *
 *   - Req 1.2: the `EstateMap` / `PlaceView` roots allow vertical scroll
 *     (`overflow-y-auto`) and do NOT lock with `overflow-hidden`, and no
 *     ancestor wrapping the places band / a control carries `overflow-hidden`
 *     (which would clip it). The only `overflow-hidden` in the tree belongs to
 *     the decorative fog strips, which wrap no place or control.
 *   - Req 1.1/1.2: all four `Place` links render (reachable) on the map.
 *   - Req 1.3: the Header's return/lights/sound/visit controls live inside the
 *     `scene-header` element's own subtree, and the header carries the
 *     `[@media(max-height:899px)]` condense utility.
 *   - Req 1.4: the filter chips and the two pager controls are native,
 *     non-aria-disabled `<button>`s (keyboard- and pointer-reachable), and an
 *     enabled chip/pager control is not `disabled`.
 *   - Req 9.3: at most 12 (`PLOT_SIZE`) animated creatures render per view even
 *     when the plot is over-filled (20 rows → 12 shown).
 *   - Req 9.1/9.2: the fog drift strips carry the `translateX` `.fog-wisps` /
 *     `.fog-wisps-thin` classes (not `background-position`) and the gate
 *     fresh-zombie wander carries `.gate-wander`. The keyframes themselves
 *     (globals.css) animate only transform/opacity; that is CSS-level and not
 *     evaluable in jsdom, so class presence is the testable proxy.
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks, matching `tests/dom/PlaceView.test.tsx`,
 * `tests/dom/EstateMap.test.tsx`, and `tests/dom/PointerEvents.test.tsx`.
 * `Header` calls `useRouter`, which has no provider under jsdom, so it is
 * mocked to a no-op `push` exactly as `tests/dom/Chrome.test.tsx` does.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1, 9.3, 8.1
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

// Hoisted spy so the `next/navigation` mock can close over it; the Header's
// visit form calls `useRouter().push`, which would otherwise throw under jsdom.
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import EstateMap, { type EstateMapMode } from "@/components/scene/EstateMap";
import PlaceView from "@/components/scene/PlaceView";
import Header from "@/components/ui/Header";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";
import {
  PLACE_ORDER,
  PLOT_SIZE,
  type PlaceFilter,
  type PlaceId,
} from "@/lib/estate-view";
import type { TurningSoon as TurningSoonResult } from "@/lib/scene-view";

afterEach(() => {
  cleanup();
  push.mockReset();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Builds a minimal display row; overrides merge onto sensible defaults. */
function makeRow(
  overrides: Partial<GraveyardRow> & { name: string },
): GraveyardRow {
  return {
    url: `https://github.com/octocat/${overrides.name}`,
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

/** Rows across every place so all four map plaques populate. */
function populatedRows(): GraveyardRow[] {
  return [
    makeRow({ name: "ghost-top", state: "ghost", decayLevel: 3, daysQuiet: 9 }),
    makeRow({ name: "shambler", state: "zombie", decayLevel: 1, daysQuiet: 200 }),
    makeRow({ name: "fresh-z", state: "zombie", decayLevel: 0, daysQuiet: 20 }),
    makeRow({ name: "ancient-z", state: "zombie", decayLevel: 4, daysQuiet: 500 }),
    makeRow({ name: "back-from-dead", state: "risen", decayLevel: null, daysQuiet: 120 }),
    makeRow({ name: "at-rest", state: "tombstone", decayLevel: null, daysQuiet: 300 }),
    makeRow({ name: "sealed-a", state: "coffin", decayLevel: null, daysQuiet: 400 }),
  ];
}

/** A gate fixture with zombies (fog renders) + fresh zombies (wander renders). */
function gateRows(): GraveyardRow[] {
  return [
    makeRow({ name: "fresh-a", state: "zombie", decayLevel: 0, daysQuiet: 20 }),
    makeRow({ name: "fresh-b", state: "zombie", decayLevel: 0, daysQuiet: 22 }),
    makeRow({ name: "rotting-a", state: "zombie", decayLevel: 1, daysQuiet: 90 }),
    makeRow({ name: "ancient-z", state: "zombie", decayLevel: 4, daysQuiet: 500 }),
    makeRow({ name: "risen-one", state: "risen", decayLevel: null, daysQuiet: 10 }),
  ];
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderMap(
  options: {
    rows?: GraveyardRow[];
    mode?: EstateMapMode;
    turningSoon?: TurningSoonResult | null;
    whispers?: string[];
  } = {},
) {
  render(
    <EstateMap
      rows={options.rows ?? populatedRows()}
      username="octocat"
      mode={options.mode ?? "live"}
      turningSoon={options.turningSoon ?? null}
      whispers={options.whispers ?? []}
      onEnterPlace={vi.fn()}
      reducedMotion={false}
    />,
  );
}

function renderPlace(
  props: Partial<{
    place: PlaceId;
    rows: GraveyardRow[];
    activeFilter: PlaceFilter;
    plotIndex: number;
    reducedMotion: boolean;
  }> = {},
) {
  const place = props.place ?? "gate";
  render(
    <PlaceView
      place={place}
      rows={props.rows ?? gateRows()}
      activeFilter={props.activeFilter ?? "all"}
      plotIndex={props.plotIndex ?? 0}
      selectedName={null}
      onFilterChange={() => {}}
      onPlotChange={() => {}}
      onSelect={() => {}}
      onReturn={() => {}}
      reducedMotion={props.reducedMotion ?? false}
    />,
  );
}

function renderHeader(mode: EstateMapMode = "estate") {
  render(
    <Header
      counts={{
        souls: 3,
        ghost: 1,
        risen: 0,
        zombie: 1,
        tombstone: 1,
        coffin: 0,
      }}
      username="octocat"
      mode={mode}
      lightsOn={false}
      onLightsOnChange={() => {}}
      soundOn={false}
      onSoundChange={() => {}}
    />,
  );
}

// ---------------------------------------------------------------------------
// Class-list helpers (plain DOM — no computed geometry in jsdom)
// ---------------------------------------------------------------------------

/** The element's own class tokens as an array (empty for non-string className). */
function classTokens(el: Element): string[] {
  const cls = el.className;
  return typeof cls === "string" ? cls.split(/\s+/).filter(Boolean) : [];
}

/** Whether `el`'s own class list contains `token`. */
function hasClass(el: Element, token: string): boolean {
  return classTokens(el).includes(token);
}

/**
 * Whether `el`, or any ancestor up to and including `root`, carries the exact
 * `overflow-hidden` utility. A clipping ancestor is what Req 1.2 forbids on the
 * path to a place/control.
 */
function hasOverflowHiddenAtOrAbove(el: Element, root: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (hasClass(node, "overflow-hidden")) {
      return true;
    }
    if (node === root) {
      break;
    }
    node = node.parentElement;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Req 1.2 — scroll affordance, no clipping lock on the roots
// ---------------------------------------------------------------------------

describe("Scene roots allow vertical scroll and are not overflow-hidden locked (1.1, 1.2)", () => {
  it("the EstateMap root scrolls vertically and is not overflow-hidden", () => {
    renderMap();

    const root = screen.getByTestId("estate-map");
    // The root allows vertical scroll so nothing below the fold is clipped
    // (Req 1.1), and it carries no `overflow-hidden` lock on its own box
    // (Req 1.2).
    expect(hasClass(root, "overflow-y-auto")).toBe(true);
    expect(hasClass(root, "overflow-hidden")).toBe(false);
    // A `min-h-dvh` root grows with content rather than clipping to one screen.
    expect(hasClass(root, "min-h-dvh")).toBe(true);
  });

  it("the PlaceView root scrolls vertically and is not overflow-hidden", () => {
    renderPlace({ place: "gate", rows: gateRows() });

    const root = screen.getByTestId("place-view");
    expect(hasClass(root, "overflow-y-auto")).toBe(true);
    expect(hasClass(root, "overflow-hidden")).toBe(false);
    expect(hasClass(root, "min-h-dvh")).toBe(true);
  });
});

describe("No clipping overflow-hidden ancestor on places / controls (1.2)", () => {
  it("the estate-map places band has no overflow-hidden ancestor", () => {
    renderMap();

    const map = screen.getByTestId("estate-map");
    const placesBand = screen.getByTestId("estate-map-places");
    // The places band — and therefore every Place link inside it — must not be
    // clipped by an ancestor with `overflow-hidden` (Req 1.2).
    expect(hasOverflowHiddenAtOrAbove(placesBand, map)).toBe(false);
  });

  it("each estate-map Place link has no overflow-hidden ancestor", () => {
    renderMap();

    const map = screen.getByTestId("estate-map");
    for (const place of PLACE_ORDER) {
      const link = screen.getByTestId(`estate-place-${place}`);
      expect(
        hasOverflowHiddenAtOrAbove(link, map),
        `Place "${place}" is clipped by an overflow-hidden ancestor`,
      ).toBe(false);
    }
  });

  it("the PlaceView chips, pager, and return controls have no overflow-hidden ancestor", () => {
    renderPlace({ place: "gate", rows: gateRows() });

    const view = screen.getByTestId("place-view");
    for (const testId of [
      "filter-chips",
      "pager",
      "return-to-gate",
      "place-heading",
    ]) {
      const control = screen.getByTestId(testId);
      expect(
        hasOverflowHiddenAtOrAbove(control, view),
        `"${testId}" is clipped by an overflow-hidden ancestor`,
      ).toBe(false);
    }
  });

  it("the only overflow-hidden elements are the decorative fog strips (wrapping no control)", () => {
    // The fog strip root sets `overflow-hidden` on purpose (to clip the
    // double-width drifting strip). Assert every overflow-hidden element in a
    // gate PlaceView contains no focusable control, so none clips a place/control.
    renderPlace({ place: "gate", rows: gateRows() });

    const view = screen.getByTestId("place-view");
    const clippers = Array.from(
      view.querySelectorAll<HTMLElement>("*"),
    ).filter((el) => hasClass(el, "overflow-hidden"));

    for (const clipper of clippers) {
      const focusable = clipper.querySelectorAll(
        "button, a[href], input, [tabindex]:not([tabindex='-1'])",
      );
      expect(
        focusable.length,
        `overflow-hidden element wraps a control: "${clipper.className}"`,
      ).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Req 1.1 — every place reachable on the map
// ---------------------------------------------------------------------------

describe("Every place is rendered/reachable on the estate map (1.1)", () => {
  it("renders all four Place links regardless of viewport (structural)", () => {
    renderMap();

    const placesBand = screen.getByTestId("estate-map-places");
    const rendered = within(placesBand)
      .getAllByRole("button")
      .map((el) => el.getAttribute("data-place"));
    // All four places present and in display order — none dropped at any size.
    expect(rendered).toEqual(PLACE_ORDER);
  });
});

// ---------------------------------------------------------------------------
// Req 1.3 — Header controls stay inside the header's own box
// ---------------------------------------------------------------------------

describe("Header controls live within the header's own box and condense on short viewports (1.3)", () => {
  it("the return/lights/sound/visit controls are all inside the scene-header subtree", () => {
    renderHeader("estate");

    const header = screen.getByTestId("scene-header");

    // The visit input + submit button and both toggles are the header's own
    // controls; each must be a descendant of the header element (so they never
    // spill outside its box onto scene content, Req 1.3).
    const visitInput = header.querySelector("input[name='visit-username']");
    expect(visitInput).not.toBeNull();

    const submit = within(header).getByRole("button", { name: /visit/i });
    expect(header.contains(submit)).toBe(true);

    // The Lights-on / Sound toggles render as `role="switch"` (styled Toggle).
    const lights = within(header).getByRole("switch", { name: /lights on/i });
    const sound = within(header).getByRole("switch", { name: /sound/i });
    expect(header.contains(lights)).toBe(true);
    expect(header.contains(sound)).toBe(true);
  });

  it("the header carries the max-height condense utility so controls reflow, not overlap", () => {
    renderHeader("estate");

    const header = screen.getByTestId("scene-header");
    // On short viewports the header switches to a column and lets the control
    // clusters wrap, keeping every control inside the header box (Req 1.3).
    // The exact utility is the testable proxy (jsdom evaluates no media query).
    expect(
      classTokens(header).some((t) =>
        t.startsWith("[@media(max-height:899px)]:flex-col"),
      ),
      `header missing the max-height condense utility: "${header.className}"`,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Req 1.4 — chips + pager keyboard- and pointer-reachable below 1440px
// ---------------------------------------------------------------------------

describe("Filter chips and pager stay keyboard- and pointer-reachable (1.4)", () => {
  it("every rendered filter chip is a native button (keyboard + pointer reachable)", () => {
    // The gate renders the richest chip set (All + 5 decay words + Risen).
    renderPlace({ place: "gate", rows: gateRows() });

    const chips = screen.getByTestId("filter-chips");
    const buttons = Array.from(
      chips.querySelectorAll<HTMLElement>("button"),
    );
    expect(buttons.length).toBeGreaterThan(0);

    for (const chip of buttons) {
      // A native <button> is in the tab order (keyboard) and has a hit area
      // (pointer); it must never be removed from the tab order via tabindex=-1.
      expect(chip.tagName).toBe("BUTTON");
      const ti = chip.getAttribute("tabindex");
      expect(ti === null || Number(ti) >= 0).toBe(true);
    }
  });

  it("an enabled filter chip is focusable and not disabled; a zero-count chip disables natively", () => {
    // Gate fixture: "fresh" (decay 0) has 2 rows → enabled; "decayed" (decay 2)
    // has 0 rows → natively disabled. Both are the native-button variant so
    // disabling uses the `disabled` attribute, never aria-disabled-only.
    renderPlace({ place: "gate", rows: gateRows() });

    const fresh = screen.getByTestId("filter-chip-fresh") as HTMLButtonElement;
    expect(fresh.disabled).toBe(false);
    // Reachable by keyboard: it takes focus under jsdom.
    fresh.focus();
    expect(document.activeElement).toBe(fresh);
    // Not merely visually disabled via aria — an enabled chip carries no
    // aria-disabled lie that would mask it from assistive tech.
    expect(fresh.getAttribute("aria-disabled")).not.toBe("true");

    const decayed = screen.getByTestId(
      "filter-chip-decayed",
    ) as HTMLButtonElement;
    expect(decayed.disabled).toBe(true);
  });

  it("both pager controls are native buttons; the enabled one is reachable and not disabled", () => {
    // 20 ghosts → 2 plots; on the first plot "deeper" is enabled, "nearer" is
    // disabled at the end. Both are native <button>s either way (Req 1.4).
    renderPlace({ place: "sky", rows: makeRows(20, "ghost"), plotIndex: 0 });

    const nearer = screen.getByTestId("pager-nearer") as HTMLButtonElement;
    const deeper = screen.getByTestId("pager-deeper") as HTMLButtonElement;

    expect(nearer.tagName).toBe("BUTTON");
    expect(deeper.tagName).toBe("BUTTON");

    // The enabled control is keyboard-reachable (takes focus) and not disabled.
    expect(deeper.disabled).toBe(false);
    deeper.focus();
    expect(document.activeElement).toBe(deeper);

    // The disabled control uses the native `disabled` attribute (removed from
    // the tab order) rather than an aria-disabled-only sham.
    expect(nearer.disabled).toBe(true);
    expect(nearer.getAttribute("aria-disabled")).not.toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Req 9.3 — at most 12 animated creatures per view
// ---------------------------------------------------------------------------

describe("Performance budget: at most PLOT_SIZE (12) animated creatures per view (9.3)", () => {
  /**
   * The creature `li` elements painted for the current plot. Task 8.5: sky is
   * now a world, whose creatures are `li` slots (still tagged
   * `scatter-creature`) inside per-stratum `ol`s; the gate's DepthScatter
   * wrappers are `div`s. Counting `li` for the sky and `scatter-creature` for
   * the gate keeps the cap-of-12 intent for both.
   */
  function scatterCreatureCount(place: "sky" | "gate" = "gate"): number {
    const scatter = screen.getByTestId("depth-scatter");
    return place === "sky"
      ? scatter.querySelectorAll("li[data-testid='scatter-creature']").length
      : scatter.querySelectorAll("[data-testid='scatter-creature']").length;
  }

  it("caps the rendered creatures at 12 even when the plot is over-filled (20 rows)", () => {
    // 20 rows → the first plot holds a FULL PLOT_SIZE of 12; the renderer must
    // never animate more than 12 creatures in a single view (Req 9.3).
    renderPlace({ place: "sky", rows: makeRows(20, "ghost"), plotIndex: 0 });

    const count = scatterCreatureCount("sky");
    expect(count).toBeLessThanOrEqual(PLOT_SIZE);
    expect(count).toBe(PLOT_SIZE);
  });

  it("caps at 12 on an over-filled gate plot too", () => {
    renderPlace({ place: "gate", rows: makeRows(20, "zombie", 0), plotIndex: 0 });

    expect(scatterCreatureCount()).toBeLessThanOrEqual(PLOT_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Req 9.1 / 9.2 — looping animations use transform/opacity classes (proxy)
// ---------------------------------------------------------------------------

describe("Performance budget: loop classes use translateX, not background-position (9.1, 9.2)", () => {
  /**
   * Whether `root` contains an element carrying `token` in its class list. Used
   * as the testable proxy for "this loop uses the transform-only keyframe": the
   * keyframes in globals.css animate only transform/opacity, which jsdom cannot
   * evaluate, so class presence is what we can assert here.
   */
  function hasDescendantWithClass(root: Element, token: string): boolean {
    if (hasClass(root, token)) {
      return true;
    }
    return Array.from(root.querySelectorAll<HTMLElement>("*")).some((el) =>
      hasClass(el, token),
    );
  }

  /** Whether any element in `root` sets an inline `background-position`. */
  function anyInlineBackgroundPosition(root: Element): boolean {
    return Array.from(root.querySelectorAll<HTMLElement>("*")).some(
      (el) => el.style.backgroundPosition !== "",
    );
  }

  it("the gate fog strips carry the translateX .fog-wisps / .fog-wisps-thin classes", () => {
    renderPlace({ place: "gate", rows: gateRows() });

    // Both fog sites render for a zombie-populated gate; each drifts via a
    // translateX keyframe class on its double-width strip (Req 9.2).
    const dense = screen.getByTestId("scene-fog");
    const near = screen.getByTestId("scene-fog-near");
    expect(hasDescendantWithClass(dense, "fog-wisps")).toBe(true);
    expect(hasDescendantWithClass(near, "fog-wisps-thin")).toBe(true);

    // No fog element implements drift by animating background-position (Req 9.2).
    expect(anyInlineBackgroundPosition(dense)).toBe(false);
    expect(anyInlineBackgroundPosition(near)).toBe(false);
  });

  it("the estate-map fog strips carry the translateX .fog-wisps / .fog-wisps-thin classes", () => {
    renderMap();

    const dense = screen.getByTestId("scene-fog");
    const near = screen.getByTestId("scene-fog-near");
    expect(hasDescendantWithClass(dense, "fog-wisps")).toBe(true);
    expect(hasDescendantWithClass(near, "fog-wisps-thin")).toBe(true);
    expect(anyInlineBackgroundPosition(dense)).toBe(false);
    expect(anyInlineBackgroundPosition(near)).toBe(false);
  });

  it("gate fresh zombies carry the translateX .gate-wander loop class (motion on)", () => {
    renderPlace({ place: "gate", rows: gateRows(), reducedMotion: false });

    const scatter = screen.getByTestId("depth-scatter");
    // At least one fresh (decay-0) zombie wanders; its wrapper carries the
    // transform-only `.gate-wander` class (Req 9.1).
    expect(hasDescendantWithClass(scatter, "gate-wander")).toBe(true);
  });

  it("gate fresh zombies drop the .gate-wander loop class under reduced motion (9.1)", () => {
    renderPlace({ place: "gate", rows: gateRows(), reducedMotion: true });

    const scatter = screen.getByTestId("depth-scatter");
    // Under reduced motion the wander loop is omitted entirely, so no element
    // carries the class — the scene holds still (Req 5.14 / 9.1 budget).
    expect(hasDescendantWithClass(scatter, "gate-wander")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Explorable worlds — clip rules (Req 3.2, 3.4, 3.11, 17.6)
//
// `overflow-clip` / `overflow-x-clip` may appear only on the WorldScroller and
// on `data-decor-clip` wrappers; those wrappers hold no focusable element and
// are never ancestors of a Creature or control. Only fog strips carry
// `overflow-hidden`, and the world root has no overflow utility at all.
// ---------------------------------------------------------------------------

import WorldPlaceView from "@/components/world/WorldPlaceView";

type WorldCase = { place: "sky" | "ground" | "crypt"; rows: GraveyardRow[] };

const WORLD_CASES: WorldCase[] = [
  { place: "sky", rows: makeRows(6, "ghost") },
  { place: "ground", rows: makeRows(6, "tombstone", null) },
  { place: "crypt", rows: makeRows(6, "coffin", null) },
];

const FOCUSABLE =
  "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

function renderWorld({ place, rows }: WorldCase) {
  render(
    <WorldPlaceView
      place={place}
      rows={rows}
      activeFilter="all"
      plotIndex={0}
      selectedName={null}
      onFilterChange={() => {}}
      onPlotChange={() => {}}
      onSelect={() => {}}
      onReturn={() => {}}
      reducedMotion={false}
    />,
  );
}

function isClipUtility(token: string): boolean {
  return token === "overflow-clip" || token === "overflow-x-clip";
}

function hasClipUtility(el: Element): boolean {
  return classTokens(el).some(isClipUtility);
}

function isFogStrip(el: Element): boolean {
  const id = el.getAttribute("data-testid");
  return id === "scene-fog" || id === "scene-fog-near";
}

describe.each(WORLD_CASES)(
  "World clip rules: $place (3.2, 3.4, 3.11, 17.6)",
  (worldCase) => {
    it("the world root carries no overflow utility", () => {
      renderWorld(worldCase);

      const root = screen.getByTestId("place-view");
      expect(root.hasAttribute("data-world")).toBe(true);
      const overflow = classTokens(root).filter((t) => /(^|:)overflow/.test(t));
      expect(overflow).toEqual([]);
    });

    it("the scroller is the only overflow-auto element and carries overflow-x-clip, not overflow-hidden", () => {
      renderWorld(worldCase);

      const root = screen.getByTestId("place-view");
      const scroller = screen.getByTestId("world-scroller");
      expect(hasClass(scroller, "overflow-y-auto")).toBe(true);
      expect(hasClass(scroller, "overflow-x-clip")).toBe(true);
      expect(hasClass(scroller, "overflow-hidden")).toBe(false);

      const autoScrollers = Array.from(
        root.querySelectorAll<HTMLElement>("*"),
      ).filter((el) =>
        classTokens(el).some(
          (t) => t === "overflow-auto" || t === "overflow-y-auto",
        ),
      );
      expect(autoScrollers).toEqual([scroller]);
    });

    it("overflow-clip / overflow-x-clip appear only on the scroller and data-decor-clip wrappers", () => {
      renderWorld(worldCase);

      const root = screen.getByTestId("place-view");
      const scroller = screen.getByTestId("world-scroller");
      const clippers = Array.from(
        root.querySelectorAll<HTMLElement>("*"),
      ).filter(hasClipUtility);

      expect(clippers).toContain(scroller);
      for (const el of clippers) {
        const allowed = el === scroller || el.hasAttribute("data-decor-clip");
        expect(
          allowed,
          `clip utility on a non-allowed element: "${el.className}"`,
        ).toBe(true);
      }
    });

    it("data-decor-clip wrappers hold no focusable element and no Creature or control", () => {
      renderWorld(worldCase);

      const root = screen.getByTestId("place-view");
      const wrappers = Array.from(
        root.querySelectorAll<HTMLElement>("[data-decor-clip]"),
      );
      expect(wrappers.length).toBeGreaterThan(0);

      for (const wrapper of wrappers) {
        expect(
          wrapper.querySelectorAll(FOCUSABLE).length,
          `decor wrapper holds a focusable element: "${wrapper.className}"`,
        ).toBe(0);
        expect(
          wrapper.querySelector("[data-testid='scatter-creature']"),
        ).toBeNull();
        for (const testId of [
          "filter-chips",
          "pager",
          "return-to-gate",
          "place-heading",
        ]) {
          expect(wrapper.querySelector(`[data-testid='${testId}']`)).toBeNull();
        }
        expect(wrapper.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("no ancestor of a Creature or control clips, other than the scroller", () => {
      renderWorld(worldCase);

      const root = screen.getByTestId("place-view");
      const scroller = screen.getByTestId("world-scroller");
      const targets: Element[] = [
        ...Array.from(
          root.querySelectorAll("[data-testid='scatter-creature']"),
        ),
        // Filter chips render only for places with filterable groups.
        ...["filter-chips", "pager", "return-to-gate", "place-heading"]
          .map((id) => screen.queryByTestId(id))
          .filter((el): el is HTMLElement => el !== null),
      ];
      expect(targets.length).toBeGreaterThan(3);

      for (const target of targets) {
        let node: Element | null = target.parentElement;
        while (node && node !== root) {
          if (node !== scroller) {
            expect(
              hasClipUtility(node) || hasClass(node, "overflow-hidden"),
              `clipping ancestor "${node.className}" wraps a creature/control`,
            ).toBe(false);
          }
          node = node.parentElement;
        }
        // Sanity: the scroller really is on the path.
        expect(scroller.contains(target)).toBe(true);
      }
    });

    it("only fog strips carry overflow-hidden (a world renders none)", () => {
      renderWorld(worldCase);

      const root = screen.getByTestId("place-view");
      const hidden = Array.from(
        root.querySelectorAll<HTMLElement>("*"),
      ).filter((el) => hasClass(el, "overflow-hidden"));
      for (const el of hidden) {
        expect(
          isFogStrip(el),
          `non-fog element carries overflow-hidden: "${el.className}"`,
        ).toBe(true);
      }
      // Worlds use Environmental_Mist only, so there is no Data_Fog strip.
      expect(hidden.length).toBe(0);
    });
  },
);
