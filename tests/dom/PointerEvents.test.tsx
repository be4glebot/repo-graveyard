/**
 * Pointer-events regression test for the estate map and place views.
 *
 * The bug: nothing on the estate map was clickable because `EstateMap` wrapped
 * its restored data-encoding effects in full-cover (`absolute inset-0`) divs
 * with the default `pointer-events: auto`. The z-40 Atmosphere+Lightning
 * wrapper sat above the places band and swallowed every click. The painted
 * reference (`docs/design-canvas/EstateMap.dc.html`) marks every decorative
 * overlay `pointer-events: none`, so only the real controls receive clicks.
 *
 * This test pins the fix structurally, with plain-DOM assertions (no jest-dom):
 *
 *   (a) every absolutely-positioned full-cover layer in `EstateMap` that is NOT
 *       the places band and holds no focusable control carries
 *       `pointer-events-none`;
 *   (b) no `absolute inset-0` layer lacking `pointer-events-none` has a z-index
 *       >= the places band's z-index (so the clickable band is never covered by
 *       a higher, click-swallowing layer);
 *   (c) each `Place` button is clickable — it carries `pointer-events-auto`
 *       (directly or via an ancestor within the map);
 *   (d) the same `pointer-events-none` guarantee holds for `PlaceView`'s
 *       decorative wrappers (asserted on the gate, which renders fog +
 *       lightning).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import EstateMap from "@/components/scene/EstateMap";
import PlaceView from "@/components/scene/PlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { PLACE_ORDER, type PlaceId } from "@/lib/estate-view";
import type { TurningSoon as TurningSoonResult } from "@/lib/scene-view";

afterEach(() => {
  cleanup();
});

/** Builds a minimal display row; overrides merge onto sensible defaults. */
function makeRow(overrides: Partial<GraveyardRow> & { name: string }): GraveyardRow {
  return {
    url: `https://github.com/octocat/${overrides.name}`,
    state: "ghost",
    daysQuiet: 1,
    decayLevel: 0,
    ...overrides,
  };
}

/** Rows across every place, including an ancient zombie so lightning renders. */
function populatedRows(): GraveyardRow[] {
  return [
    makeRow({ name: "ghost-top", state: "ghost", decayLevel: 3, daysQuiet: 9 }),
    makeRow({ name: "shambler", state: "zombie", decayLevel: 1, daysQuiet: 200 }),
    makeRow({ name: "ancient-z", state: "zombie", decayLevel: 4, daysQuiet: 500 }),
    makeRow({ name: "back-from-dead", state: "risen", decayLevel: null, daysQuiet: 120 }),
    makeRow({ name: "at-rest", state: "tombstone", decayLevel: null, daysQuiet: 300 }),
    makeRow({ name: "sealed-a", state: "coffin", decayLevel: null, daysQuiet: 400 }),
  ];
}

/** Renders `EstateMap` with the given rows / turning-soon; handler defaults to a spy. */
function renderMap(
  options: {
    rows?: GraveyardRow[];
    turningSoon?: TurningSoonResult | null;
    whispers?: string[];
    onEnterPlace?: (place: PlaceId) => void;
  } = {},
) {
  const onEnterPlace = options.onEnterPlace ?? vi.fn();
  render(
    <EstateMap
      rows={options.rows ?? populatedRows()}
      username="octocat"
      mode="live"
      turningSoon={options.turningSoon ?? null}
      whispers={options.whispers ?? []}
      onEnterPlace={onEnterPlace}
      reducedMotion={false}
    />,
  );
  return { onEnterPlace };
}

/** True if `el`'s own class list declares a full-cover absolute layer. */
function isFullCoverAbsolute(el: Element): boolean {
  const cls = el.className;
  return (
    typeof cls === "string" &&
    cls.split(/\s+/).includes("absolute") &&
    cls.split(/\s+/).includes("inset-0")
  );
}

/** True if `el`'s own class list declares `pointer-events-none`. */
function hasPointerEventsNone(el: Element): boolean {
  const cls = el.className;
  return typeof cls === "string" && cls.split(/\s+/).includes("pointer-events-none");
}

/** True if `el`'s own class list declares `pointer-events-auto`. */
function hasPointerEventsAuto(el: Element): boolean {
  const cls = el.className;
  return typeof cls === "string" && cls.split(/\s+/).includes("pointer-events-auto");
}

/**
 * Whether some ANCESTOR of `el` (strictly up to, but not including, `root`)
 * already declares `pointer-events-none`. Such an `el` inherits the disabled
 * pointer events, so it cannot swallow a click regardless of its own classes —
 * the decorative inner layers of the reused backdrop components (e.g.
 * `layer-idle-drift`) are exactly this case and need no class of their own.
 */
function hasPointerEventsNoneAncestor(el: Element, root: Element): boolean {
  let node = el.parentElement;
  while (node && node !== root) {
    if (hasPointerEventsNone(node)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * The numeric z-index declared by a `z-<n>` utility on `el`'s own class list,
 * or 0 when none is present (Tailwind's `z-0` default).
 */
function zIndexOf(el: Element): number {
  const cls = el.className;
  if (typeof cls !== "string") {
    return 0;
  }
  for (const token of cls.split(/\s+/)) {
    const m = /^z-(\d+)$/.exec(token);
    if (m) {
      return Number(m[1]);
    }
  }
  return 0;
}

/** Whether `el` contains a focusable control (a button or a non-negative tabindex). */
function containsFocusable(el: Element): boolean {
  for (const candidate of Array.from(
    el.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]"),
  )) {
    if (candidate.tagName === "BUTTON" || candidate.tagName === "A" || candidate.tagName === "INPUT") {
      const ti = candidate.getAttribute("tabindex");
      if (ti === null || Number(ti) >= 0) {
        return true;
      }
    } else if (Number(candidate.getAttribute("tabindex")) >= 0) {
      return true;
    }
  }
  return false;
}

/** All full-cover absolute layers in `root`'s subtree, in DOM order. */
function fullCoverLayers(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    isFullCoverAbsolute,
  );
}

describe("EstateMap pointer-events (click-through regression)", () => {
  it("(a) every full-cover decorative layer (not the places band, no focusable control) is pointer-events-none", () => {
    renderMap();

    const map = screen.getByTestId("estate-map");
    const placesBand = screen.getByTestId("estate-map-places");

    for (const layer of fullCoverLayers(map)) {
      // The places band is the one full-cover layer that INTENTIONALLY hosts
      // clickable controls (its own pointer-events-none plus per-place
      // pointer-events-auto), so it is exempt from this assertion.
      if (layer === placesBand) {
        continue;
      }
      // Any other full-cover layer holding a focusable control would be real
      // chrome; none of the decorative wrappers do. Skip those defensively.
      if (containsFocusable(layer)) {
        continue;
      }
      // A full-cover layer nested under a pointer-events-none wrapper inherits
      // the disabled pointer events (e.g. the reused backdrop components' inner
      // decorative layers), so it cannot swallow clicks and needs no class of
      // its own — only the top-level wrappers must carry pointer-events-none.
      if (hasPointerEventsNoneAncestor(layer, map)) {
        continue;
      }
      expect(
        hasPointerEventsNone(layer),
        `full-cover decorative layer missing pointer-events-none: "${layer.className}"`,
      ).toBe(true);
    }
  });

  it("(b) no full-cover layer that lacks pointer-events-none sits at or above the places band's z-index", () => {
    renderMap();

    const map = screen.getByTestId("estate-map");
    const placesBand = screen.getByTestId("estate-map-places");
    const bandZ = zIndexOf(placesBand);

    for (const layer of fullCoverLayers(map)) {
      if (
        layer === placesBand ||
        hasPointerEventsNone(layer) ||
        hasPointerEventsNoneAncestor(layer, map)
      ) {
        continue;
      }
      // A click-passing (pointer-events:auto) full-cover layer must sit BELOW
      // the places band, or it would swallow the clicks meant for the places.
      expect(
        zIndexOf(layer),
        `click-swallowing full-cover layer at z >= band (${bandZ}): "${layer.className}"`,
      ).toBeLessThan(bandZ);
    }
  });

  it("(c) each Place button is clickable (pointer-events-auto on the button or an ancestor)", () => {
    renderMap();

    const map = screen.getByTestId("estate-map");

    for (const place of PLACE_ORDER) {
      const button = screen.getByTestId(`estate-place-${place}`);
      // Walk from the button up to the map root; some element in that chain
      // must re-enable pointer events (the places band is pointer-events-none).
      let node: Element | null = button;
      let clickable = false;
      while (node && node !== map.parentElement) {
        if (hasPointerEventsAuto(node)) {
          clickable = true;
          break;
        }
        if (hasPointerEventsNone(node)) {
          // A pointer-events-none ancestor without an intervening -auto would
          // block the button; keep walking only if we have not yet re-enabled.
        }
        node = node.parentElement;
      }
      expect(
        clickable,
        `Place button "${place}" is not re-enabled by any pointer-events-auto ancestor`,
      ).toBe(true);
    }
  });
});

describe("PlaceView pointer-events (click-through regression)", () => {
  /** A gate fixture with zombies + an ancient zombie so fog AND lightning render. */
  function gateRows(): GraveyardRow[] {
    return [
      makeRow({ name: "ancient-z", state: "zombie", decayLevel: 4, daysQuiet: 400 }),
      makeRow({ name: "fresh-z", state: "zombie", decayLevel: 0, daysQuiet: 200 }),
      makeRow({ name: "risen-one", state: "risen", decayLevel: null, daysQuiet: 10 }),
    ];
  }

  it("(d) every full-cover decorative wrapper in the gate PlaceView is pointer-events-none", () => {
    render(
      <PlaceView
        place="gate"
        rows={gateRows()}
        activeFilter="all"
        plotIndex={0}
        selectedName={null}
        onFilterChange={() => {}}
        onPlotChange={() => {}}
        onSelect={() => {}}
        onReturn={() => {}}
      />,
    );

    const view = screen.getByTestId("place-view");
    // Confirm the fog + lightning layers actually rendered (the whole point).
    expect(screen.queryByTestId("scene-fog")).not.toBeNull();
    expect(screen.queryByTestId("scene-lightning")).not.toBeNull();

    for (const layer of fullCoverLayers(view)) {
      // The place chrome bands (heading/return, chips, depth rows, pager) are
      // NOT full-cover inset-0 layers, so every inset-0 layer here is
      // decorative and must not swallow clicks.
      if (containsFocusable(layer)) {
        continue;
      }
      // Inner decorative layers inherit pointer-events-none from their wrapper
      // (e.g. the reused backdrop components' `layer-idle-drift`), so only the
      // top-level decorative wrappers must declare the class themselves.
      if (hasPointerEventsNoneAncestor(layer, view)) {
        continue;
      }
      expect(
        hasPointerEventsNone(layer),
        `full-cover decorative layer missing pointer-events-none: "${layer.className}"`,
      ).toBe(true);
    }
  });
});
