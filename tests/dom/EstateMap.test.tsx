/**
 * Component tests for the estate map and its place plaques
 * (`components/scene/EstateMap` + `components/scene/Place`).
 *
 * `EstateMap` is the default map surface: it composites the reused backdrop
 * stack, the reused `TurningSoon` notice, and the four `Place` links in the
 * fixed display order sky, gate, ground, crypt. Each `Place` is a single
 * keyboard-focusable link that opens its place through `onEnterPlace`, paints
 * a plaque (Cinzel name, IM Fell italic count line, CTA), and shows the first
 * `min(3, rowCount)` representatives taken from the head of
 * `orderForPlace(place, rows)`. An empty place stays visible but quieter (lower
 * opacity) and renders no representatives. These tests pin that surface:
 *
 *   - the four place links render in display order and are focusable (Req 1.2,
 *     1.5);
 *   - each plaque exposes its name, count line, and CTA (Req 1.2);
 *   - a place is activatable by mouse click and by the Enter key, each raising
 *     `onEnterPlace(place)` (Req 1.5);
 *   - the representative count is `min(3, rowCount)` — at least one when rows
 *     exist, none when empty — and is taken from the head of `orderForPlace`
 *     (Req 2.4, 2.5);
 *   - an empty place stays visible, is quieter (lower opacity), and renders no
 *     representatives (Req 1.6);
 *   - the turning-soon notice renders iff a turning-soon ghost exists (Req 1.3,
 *     1.4 — asserted here only as present/absent with `turningSoon`
 *     non-null/null).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (data-testid, data-empty, inline opacity, document.activeElement),
 * matching the pattern in `tests/dom/SceneView.test.tsx` and
 * `tests/dom/Creature.test.tsx`. `EstateMap`/`Place` read no router, so no
 * `next/navigation` mock is needed; `next/image` works unmocked.
 *
 * Requirements: 1.2, 1.5, 1.6, 2.4, 2.5
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EstateMap from "@/components/scene/EstateMap";
import Place from "@/components/scene/Place";
import type { GraveyardRow } from "@/lib/graveyard-view";
import {
  orderForPlace,
  PLACE_ORDER,
  PLACES,
  plaqueCopy,
  type PlaceId,
} from "@/lib/estate-view";
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

/**
 * The map needs rows across every place so all four plaques are populated. The
 * counts per place are chosen to exercise the `min(3, rowCount)` representative
 * rule from both sides: `sky` has 4 ghosts (capped to 3), `gate` has 2 rows
 * (shown in full), `ground` has 1 (shown in full), `crypt` has 5 coffins
 * (capped to 3).
 */
function populatedRows(): GraveyardRow[] {
  return [
    // sky: 4 ghosts with distinct decay so the urgency ordering is observable.
    makeRow({ name: "ghost-low", state: "ghost", decayLevel: 0, daysQuiet: 2 }),
    makeRow({ name: "ghost-mid", state: "ghost", decayLevel: 2, daysQuiet: 5 }),
    makeRow({ name: "ghost-top", state: "ghost", decayLevel: 3, daysQuiet: 9 }),
    makeRow({ name: "ghost-also", state: "ghost", decayLevel: 1, daysQuiet: 3 }),
    // gate: one risen + one zombie (so the gate plaque reports both).
    makeRow({ name: "back-from-dead", state: "risen", decayLevel: null, daysQuiet: 120 }),
    makeRow({ name: "shambler", state: "zombie", decayLevel: 1, daysQuiet: 200 }),
    // ground: a single tombstone.
    makeRow({ name: "at-rest", state: "tombstone", decayLevel: null, daysQuiet: 300 }),
    // crypt: 5 coffins so representatives cap at 3.
    makeRow({ name: "sealed-a", state: "coffin", decayLevel: null, daysQuiet: 400 }),
    makeRow({ name: "sealed-b", state: "coffin", decayLevel: null, daysQuiet: 401 }),
    makeRow({ name: "sealed-c", state: "coffin", decayLevel: null, daysQuiet: 402 }),
    makeRow({ name: "sealed-d", state: "coffin", decayLevel: null, daysQuiet: 403 }),
    makeRow({ name: "sealed-e", state: "coffin", decayLevel: null, daysQuiet: 404 }),
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

/** The place link for a given place id, resolved by its data-testid. */
function placeLink(place: PlaceId): HTMLButtonElement {
  return screen.getByTestId(`estate-place-${place}`) as HTMLButtonElement;
}

describe("EstateMap", () => {
  it("renders the four place links in display order sky, gate, ground, crypt (1.2)", () => {
    renderMap();

    const container = screen.getByTestId("estate-map-places");
    // Every link is a child of the places container, in DOM order. Reading the
    // rendered data-place sequence pins the fixed display order (Req 1.2).
    const links = within(container).getAllByRole("button");
    const order = links.map((el) => el.getAttribute("data-place"));

    expect(order).toEqual(["sky", "gate", "ground", "crypt"]);
    expect(order).toEqual(PLACE_ORDER);
  });

  it("makes each place a focusable link (1.5)", () => {
    renderMap();

    for (const place of PLACE_ORDER) {
      const link = placeLink(place);
      // A native button is focusable and actually takes focus under jsdom.
      expect(link.tagName).toBe("BUTTON");
      link.focus();
      expect(document.activeElement).toBe(link);
    }
  });

  it("renders each plaque's name, count line, and CTA (1.2)", () => {
    const rows = populatedRows();
    renderMap({ rows });

    for (const place of PLACE_ORDER) {
      const meta = PLACES[place];

      // Name is the place's Cinzel display name.
      const name = screen.getByTestId(`estate-place-${place}-name`);
      expect(name.textContent).toBe(meta.name);

      // CTA is the place's call to action.
      const cta = screen.getByTestId(`estate-place-${place}-cta`);
      expect(cta.textContent).toBe(meta.cta);

      // Count line is the plaqueCopy string. The gate reports zombies and risen
      // separately; the other three report their own row count.
      const placeRows = rows.filter((r) => stateToPlace(r.state) === place);
      const expectedCount =
        place === "gate"
          ? plaqueCopy(
              "gate",
              placeRows.filter((r) => r.state === "zombie").length,
              placeRows.filter((r) => r.state === "risen").length,
            )
          : plaqueCopy(place, placeRows.length);

      const count = screen.getByTestId(`estate-place-${place}-count`);
      expect(count.textContent).toBe(expectedCount);
    }
  });

  it("shows min(3, rowCount) representatives from the head of orderForPlace for populated places (2.4, 2.5)", () => {
    const rows = populatedRows();
    renderMap({ rows });

    for (const place of PLACE_ORDER) {
      const placeRows = rows.filter((r) => stateToPlace(r.state) === place);
      const expectedHead = orderForPlace(place, placeRows)
        .slice(0, 3)
        .map((r) => r.name);

      // The representatives group holds one creature button per representative.
      // The place link's own button wraps them, so scope the query to the
      // representatives container and read its creatures.
      const repGroup = screen.getByTestId(`estate-place-${place}-representatives`);
      const creatures = repGroup.querySelectorAll("button");
      const renderedNames = Array.from(creatures).map((el) =>
        (el.getAttribute("aria-label") ?? "").split(",")[0],
      );

      // Count is min(3, rowCount): capped at 3, never fewer than one when rows
      // exist (Req 2.4), and exactly the head of orderForPlace (Req 2.5).
      const expectedCount = Math.min(3, placeRows.length);
      expect(creatures.length).toBe(expectedCount);
      expect(creatures.length).toBeGreaterThanOrEqual(1);
      // Each rendered representative's accessible name starts with its repo
      // name, in the same order as the head of orderForPlace.
      expect(renderedNames).toEqual(expectedHead);
    }
  });

  it("caps representatives at three even when a place has many rows (2.4)", () => {
    // Crypt has five coffins in the fixture; only three may show.
    renderMap();

    const repGroup = screen.getByTestId("estate-place-crypt-representatives");
    expect(repGroup.querySelectorAll("button").length).toBe(3);
  });

  it("raises onEnterPlace(place) on mouse click (1.5)", async () => {
    const user = userEvent.setup();
    const { onEnterPlace } = renderMap();

    await user.click(placeLink("gate"));

    expect(onEnterPlace).toHaveBeenCalledTimes(1);
    expect(onEnterPlace).toHaveBeenCalledWith("gate");
  });

  it("raises onEnterPlace(place) on Enter key activation (1.5)", async () => {
    const user = userEvent.setup();
    const { onEnterPlace } = renderMap();

    const link = placeLink("sky");
    link.focus();
    expect(document.activeElement).toBe(link);

    await user.keyboard("{Enter}");

    expect(onEnterPlace).toHaveBeenCalledWith("sky");
  });

  it("keeps an empty place visible and quieter with no representatives (1.6)", () => {
    // Only sky has rows; gate, ground, and crypt are empty.
    const rows = [
      makeRow({ name: "lonely-ghost", state: "ghost", decayLevel: 1, daysQuiet: 4 }),
    ];
    renderMap({ rows });

    const sky = placeLink("sky");

    // The populated place is not flagged empty and sits at full opacity.
    expect(sky.getAttribute("data-empty")).toBeNull();
    const skyOpacity = Number(sky.style.opacity);
    expect(skyOpacity).toBe(1);

    for (const place of ["gate", "ground", "crypt"] as const) {
      const link = placeLink(place);

      // The empty place still renders (visible) and is flagged empty.
      expect(link).not.toBeNull();
      expect(link.getAttribute("data-empty")).toBe("true");

      // It is quieter: lower opacity than the populated place, and > 0 so it is
      // not hidden (Req 1.6 — visible but quieter).
      const opacity = Number(link.style.opacity);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(skyOpacity);

      // No representatives render for an empty place.
      const repGroup = screen.getByTestId(`estate-place-${place}-representatives`);
      expect(repGroup.querySelectorAll("button").length).toBe(0);
    }

    // The empty gate still exposes its plaque name / count / CTA (visible).
    expect(screen.getByTestId("estate-place-gate-name").textContent).toBe(
      PLACES.gate.name,
    );
  });

  it("renders the turning-soon notice when a turning-soon ghost exists (1.3)", () => {
    renderMap({
      turningSoon: { name: "ghost-top", daysLeft: 3 },
    });

    // The reused TurningSoon notice renders its button when passed a non-null
    // selection.
    expect(screen.queryByTestId("scene-turning-soon")).not.toBeNull();
  });

  it("renders no turning-soon notice when no ghost qualifies (1.4)", () => {
    renderMap({ turningSoon: null });

    // A null selection renders nothing from TurningSoon.
    expect(screen.queryByTestId("scene-turning-soon")).toBeNull();
  });
});

describe("Place", () => {
  it("is a single focusable control activatable by click and Enter (1.5)", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    const rows = [
      makeRow({ name: "ghost-a", state: "ghost", decayLevel: 1, daysQuiet: 3 }),
    ];

    render(<Place place="sky" rows={rows} onEnter={onEnter} />);

    const link = screen.getByTestId("estate-place-sky") as HTMLButtonElement;

    // One focusable control for the whole place.
    expect(link.tagName).toBe("BUTTON");
    link.focus();
    expect(document.activeElement).toBe(link);

    await user.click(link);
    expect(onEnter).toHaveBeenCalledWith("sky");

    link.focus();
    await user.keyboard("{Enter}");
    expect(onEnter).toHaveBeenCalledTimes(2);
    expect(onEnter).toHaveBeenLastCalledWith("sky");
  });

  it("shows no representatives and reads empty copy when the place has no rows (1.6, 2.5)", () => {
    render(<Place place="crypt" rows={[]} onEnter={vi.fn()} />);

    const link = screen.getByTestId("estate-place-crypt") as HTMLButtonElement;
    expect(link.getAttribute("data-empty")).toBe("true");

    const repGroup = screen.getByTestId("estate-place-crypt-representatives");
    expect(repGroup.querySelectorAll("button").length).toBe(0);

    // The empty count line is the place's zero-copy string.
    expect(screen.getByTestId("estate-place-crypt-count").textContent).toBe(
      plaqueCopy("crypt", 0),
    );
  });
});

/**
 * Local mirror of the `placeOf` state→place mapping, used only to bucket the
 * fixture rows by place when computing expected per-place plaque copy and
 * representative heads. Kept tiny and explicit so the test does not depend on
 * `placeOf`'s internals while still agreeing with the design's mapping.
 */
function stateToPlace(state: GraveyardRow["state"]): PlaceId {
  switch (state) {
    case "ghost":
      return "sky";
    case "zombie":
    case "risen":
      return "gate";
    case "tombstone":
      return "ground";
    case "coffin":
      return "crypt";
  }
}

describe("EstateMap atmosphere layers (data-encoding regression guard)", () => {
  // The default populatedRows() fixture includes a zombie (fog density > 0) but
  // no ancient zombie. For the lightning guard we add an ancient zombie
  // (decayLevel 4) so the cadence is non-null and the layer renders. These
  // guard against a future cleanup silently dropping the estate-wide
  // data-encoding Fog/Lightning/Whisper regions from the map.
  function rowsWithAncientZombie(): GraveyardRow[] {
    return [
      ...populatedRows(),
      makeRow({ name: "ancient-z", state: "zombie", decayLevel: 4, daysQuiet: 500 }),
    ];
  }

  it("renders Fog over the estate when zombies are present (3.3)", () => {
    // populatedRows() has a zombie, so fog density > 0 and the layer renders.
    renderMap();
    expect(screen.queryByTestId("scene-fog")).not.toBeNull();
  });

  it("renders Lightning when an ancient zombie exists on the estate (3.4, 3.5)", () => {
    renderMap({ rows: rowsWithAncientZombie() });
    expect(screen.queryByTestId("scene-lightning")).not.toBeNull();
  });

  it("renders no Lightning when no ancient zombie exists (3.5)", () => {
    // populatedRows()'s only zombie is decayLevel 1 (not ancient), so lightning
    // has no cadence and the layer self-hides.
    renderMap();
    expect(screen.queryByTestId("scene-lightning")).toBeNull();
  });

  it("renders the Whisper region when whisper lines are present (8.x)", () => {
    renderMap({ whispers: ["a repo stirs in the dark"] });
    expect(screen.queryByTestId("scene-whisper")).not.toBeNull();
  });

  it("renders no Whisper region when there are no whisper lines (8.3)", () => {
    renderMap({ whispers: [] });
    expect(screen.queryByTestId("scene-whisper")).toBeNull();
  });
});
