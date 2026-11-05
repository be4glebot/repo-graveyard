/**
 * Component tests for the lights-on register (`components/scene/LightsOnTable`).
 *
 * Task 12.2 — the sortable Place column. The register is the warm-paper,
 * "lights on" readable view fed the FULL `rows` across all four places, so
 * these tests pin:
 *
 *   - one row per repository, spanning every place (sky/gate/ground/crypt),
 *     with no row dropped or duplicated (estate-map Req 14.1, 14.2);
 *   - a Place column header rendered alongside the existing Repository, State,
 *     Quiet-for, and Decay columns, as a proper `<th scope="col">` so the
 *     column is a navigable, sortable column in the register (estate-map Req
 *     14.2, 14.3);
 *   - each row's Place cell shows the correct display name derived from the
 *     frozen, pure `placeOf` mapping (value = `PLACES[placeOf(row)].name`,
 *     estate-map Req 14.2).
 *
 * The Place column is presentational and server-renderable: its value comes
 * straight from `placeOf` with no client state or clock, which is exactly what
 * these tests assert against. Column-header re-sorting interactivity (if any)
 * lives in the owning client shell; at this layer "sortable" means the Place
 * value is a first-class column with a scoped header, which is what is
 * observable here.
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (textContent, querySelector, getAttribute), matching the
 * pattern in `tests/dom/Creature.test.tsx` and `tests/graveyard-ui.test.tsx`.
 *
 * Requirements: estate-map 14.1, 14.2, 14.3
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import LightsOnTable from "@/components/scene/LightsOnTable";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { PLACES, placeOf } from "@/lib/estate-view";

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
 * One repository per place, spanning all five lifecycle states (gate holds
 * both zombie and risen, so there are two gate rows):
 *   - `drifting`  → ghost    → sky   (The Restless Sky)
 *   - `rotting`   → zombie   → gate  (Beyond the Gate)
 *   - `woke-up`   → risen    → gate  (Beyond the Gate)
 *   - `shipped`   → tombstone→ ground(Hallowed Ground)
 *   - `sealed`    → coffin   → crypt (The Crypt)
 */
const ROWS: GraveyardRow[] = [
  makeRow({ name: "drifting", state: "ghost", decayLevel: 2, daysQuiet: 40 }),
  makeRow({ name: "rotting", state: "zombie", decayLevel: 3, daysQuiet: 300 }),
  makeRow({ name: "woke-up", state: "risen", decayLevel: null, daysQuiet: 2 }),
  makeRow({ name: "shipped", state: "tombstone", decayLevel: null, daysQuiet: 120 }),
  makeRow({ name: "sealed", state: "coffin", decayLevel: null, daysQuiet: 500 }),
];

/** The register's single data table. */
function table(): HTMLTableElement {
  return screen.getByRole("table") as HTMLTableElement;
}

/** The scoped column headers in document order, as trimmed text. */
function columnHeaders(): string[] {
  return Array.from(table().querySelectorAll('thead th[scope="col"]')).map(
    (th) => th.textContent?.trim() ?? "",
  );
}

describe("LightsOnTable Place column", () => {
  it("renders one row per repository across all four places (14.1)", () => {
    render(<LightsOnTable rows={ROWS} username="octocat" />);

    // Each repository appears exactly once: one body row (<th scope="row">) per
    // input row, no drop and no duplicate.
    const rowHeaders = Array.from(
      table().querySelectorAll('tbody th[scope="row"]'),
    ).map((th) => th.textContent?.trim());

    expect(rowHeaders).toEqual(["drifting", "rotting", "woke-up", "shipped", "sealed"]);
    expect(rowHeaders).toHaveLength(ROWS.length);
  });

  it("renders a Place column header alongside the existing columns (14.2, 14.3)", () => {
    render(<LightsOnTable rows={ROWS} username="octocat" />);

    // The Place column is a proper scoped column header sitting with the other
    // four columns in the register, so it is a first-class, sortable column.
    expect(columnHeaders()).toEqual([
      "Repository",
      "Place",
      "State",
      "Quiet for",
      "Decay",
    ]);
  });

  it("shows each row's place display name from placeOf (14.2)", () => {
    render(<LightsOnTable rows={ROWS} username="octocat" />);

    // Walk every body row and read its Place cell (the 1st <td>, since the
    // Repository is a <th scope="row"> and Place is the first data column).
    const bodyRows = Array.from(table().querySelectorAll("tbody tr"));

    for (const [index, tr] of bodyRows.entries()) {
      const row = ROWS[index];
      const placeCell = tr.querySelector("td");
      const expected = PLACES[placeOf(row)].name;
      expect(placeCell?.textContent?.trim()).toBe(expected);
    }

    // And the expected display names are present across the whole table so the
    // four places are all represented: sky, gate (twice), ground, crypt.
    const placeNames = bodyRows.map(
      (tr) => tr.querySelector("td")?.textContent?.trim(),
    );
    expect(placeNames).toEqual([
      PLACES.sky.name, // drifting (ghost)
      PLACES.gate.name, // rotting (zombie)
      PLACES.gate.name, // woke-up (risen)
      PLACES.ground.name, // shipped (tombstone)
      PLACES.crypt.name, // sealed (coffin)
    ]);
  });

  it("maps every lifecycle state to its place display name (14.2)", () => {
    // The Place value is exactly `PLACES[placeOf(row)].name` for every row; this
    // guards the mapping end to end at the render layer, not just in isolation.
    render(<LightsOnTable rows={ROWS} username="octocat" />);

    const bodyRows = Array.from(table().querySelectorAll("tbody tr"));
    const byName = new Map(
      bodyRows.map((tr) => [
        tr.querySelector('th[scope="row"]')?.textContent?.trim(),
        tr.querySelector("td")?.textContent?.trim(),
      ]),
    );

    expect(byName.get("drifting")).toBe("The Restless Sky");
    expect(byName.get("rotting")).toBe("Beyond the Gate");
    expect(byName.get("woke-up")).toBe("Beyond the Gate");
    expect(byName.get("shipped")).toBe("Hallowed Ground");
    expect(byName.get("sealed")).toBe("The Crypt");
  });
});
