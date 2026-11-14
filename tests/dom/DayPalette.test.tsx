/**
 * DOM tests: worlds without day art (EstateMap hub, The Open Sky, The Garden
 * Gate, The Keepsake Vault, plus their empty variants) draw the day palette in
 * day. No night `/art/` plate is visible (creatures excepted), and no
 * brightness filter dims the scene. Night keeps its plates.
 *
 * Requirements: 2.3, 3.4, 3.5, 3.6
 */
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import EstateMap from "@/components/scene/EstateMap";
import PlaceView from "@/components/scene/PlaceView";
import { ThemeProvider, useTheme } from "@/components/scene/ThemeProvider";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { PlaceId } from "@/lib/estate-view";
import type { Theme } from "@/lib/theme-art";

afterEach(() => cleanup());

const noop = () => {};

function SetTheme({ theme, children }: { theme: Theme; children: ReactNode }) {
  const { setTheme } = useTheme();
  useEffect(() => setTheme(theme), [setTheme, theme]);
  return <>{children}</>;
}

function withTheme(theme: Theme, node: ReactNode) {
  return (
    <ThemeProvider>
      <SetTheme theme={theme}>{node}</SetTheme>
    </ThemeProvider>
  );
}

function row(
  name: string,
  state: GraveyardRow["state"],
  decayLevel: number | null,
  daysQuiet: number,
): GraveyardRow {
  return { name, url: `https://github.com/octocat/${name}`, state, decayLevel, daysQuiet };
}

const ROWS: Record<PlaceId, GraveyardRow[]> = {
  sky: [row("g-a", "ghost", 0, 2), row("g-b", "ghost", 2, 40)],
  gate: [row("z-a", "zombie", 1, 200), row("r-a", "risen", null, 120)],
  ground: [row("t-a", "tombstone", null, 300)],
  crypt: [row("c-a", "coffin", null, 400), row("c-b", "coffin", null, 410)],
};

function allRows(): GraveyardRow[] {
  return [...ROWS.sky, ...ROWS.gate, ...ROWS.ground, ...ROWS.crypt];
}

function renderMap(theme: Theme, rows: GraveyardRow[]) {
  return render(
    withTheme(
      theme,
      <EstateMap
        rows={rows}
        username="octocat"
        mode="live"
        turningSoon={null}
        whispers={[]}
        onEnterPlace={vi.fn()}
        reducedMotion={false}
        theme={theme}
      />,
    ),
  );
}

function renderPlace(theme: Theme, place: PlaceId, rows: GraveyardRow[]) {
  return render(
    withTheme(
      theme,
      <PlaceView
        place={place}
        rows={rows}
        activeFilter="all"
        plotIndex={0}
        selectedName={null}
        onFilterChange={noop}
        onPlotChange={noop}
        onSelect={noop}
        onReturn={noop}
        theme={theme}
      />,
    ),
  );
}

/** Creature art keeps its night files (tombstones use day art through themeArt). */
const CREATURE_ART = /\/art\/(ghost-\d|zombie-\d|risen|coffin|tomb-)/;
const NIGHT_PLATE = /\/art\/(?!day\/)/;

/** Every `/art/` reference (img src or CSS url) that is not a creature or day file. */
function nightPlates(): string[] {
  const found: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
    const refs: string[] = [];
    if (el instanceof HTMLImageElement) {
      refs.push(decodeURIComponent(el.getAttribute("src") ?? ""));
    }
    refs.push(el.getAttribute("style") ?? "");
    for (const ref of refs) {
      if (NIGHT_PLATE.test(ref) && !CREATURE_ART.test(ref)) found.push(ref);
    }
  }
  return found;
}

function brightnessFilters(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("*"))
    .map((el) => el.getAttribute("style") ?? "")
    .filter((s) => /filter:[^;]*brightness\(/.test(s));
}

const q = (sel: string) => document.querySelectorAll(sel);

describe("day palette for worlds without day art", () => {
  it("EstateMap hub draws the day palette and no night plate", () => {
    renderMap("day", allRows());
    expect(q('[data-testid="day-palette"]').length).toBeGreaterThan(0);
    expect(q('[data-testid="backdrop-night-gradient"]')).toHaveLength(0);
    expect(q('[data-testid="backdrop-bg-far"]')).toHaveLength(0);
    expect(nightPlates()).toEqual([]);
    expect(brightnessFilters()).toEqual([]);
  });

  it("EstateMap hub shows the sun and no moon in day", () => {
    renderMap("day", allRows());
    expect(q("[data-sun-source]").length).toBeGreaterThan(0);
    expect(q("[data-moon-treatment]")).toHaveLength(0);
  });

  it("EstateMap hub with no rows is still palette-only in day", () => {
    renderMap("day", []);
    expect(q('[data-testid="day-palette"]').length).toBeGreaterThan(0);
    expect(nightPlates()).toEqual([]);
  });

  it.each([
    ["sky", "The Open Sky"],
    ["gate", "The Garden Gate"],
    ["crypt", "The Keepsake Vault"],
  ] as const)("%s (%s) renders the day palette, no night plate or dimming", (place, name) => {
    expect(name).toBeTruthy();
    renderPlace("day", place, ROWS[place]);
    expect(q('[data-testid="day-palette"]').length).toBeGreaterThan(0);
    expect(nightPlates()).toEqual([]);
    expect(brightnessFilters()).toEqual([]);
  });

  it.each(["sky", "gate", "crypt"] as const)(
    "empty %s renders the day palette, no night plate or dimming",
    (place) => {
      renderPlace("day", place, []);
      expect(q('[data-testid="day-palette"]').length).toBeGreaterThan(0);
      expect(nightPlates()).toEqual([]);
      expect(brightnessFilters()).toEqual([]);
    },
  );

  it("empty sky and vault drop gothic decor and use day copy", () => {
    renderPlace("day", "sky", []);
    expect(q('[data-testid="empty-sky-stars"] span')).toHaveLength(0);
    expect(q('[data-testid="empty-sky-chains"]')).toHaveLength(0);
    expect(q('[data-testid="empty-sky-sun"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="empty-scene-plaque"]')!.textContent).toBe(
      "The sky is clearA little light will appear here when a project wakes.",
    );
    cleanup();
    renderPlace("day", "crypt", []);
    expect(q('[data-testid="empty-crypt-torch"]')).toHaveLength(0);
    expect(q('[data-testid="empty-crypt-ceiling"]')).toHaveLength(0);
    expect(q('[data-testid="empty-crypt-arch"]')).toHaveLength(0);
    expect(document.querySelector('[data-testid="empty-scene-plaque"]')!.textContent).toBe(
      "Nothing kept here yetA keepsake will be placed here when a project is set aside.",
    );
  });

  it("Hallowed Ground still draws its painted day art", () => {
    renderPlace("day", "ground", ROWS.ground);
    const refs = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .map((el) => el.getAttribute("style") ?? "")
      .join(" ");
    expect(refs).toContain("/art/day/place-ground.webp");
    expect(refs).toContain("/art/day/mg-fence.webp");
    expect(refs).toContain("/art/day/mausoleum.webp");
    expect(q('[data-testid="day-palette"]')).toHaveLength(0);
  });

  it("night keeps its painted plates and no day palette", () => {
    renderMap("night", allRows());
    expect(q('[data-testid="day-palette"]')).toHaveLength(0);
    expect(q('[data-testid="backdrop-night-gradient"]').length).toBeGreaterThan(0);
    cleanup();
    renderPlace("night", "gate", ROWS.gate);
    expect(q('[data-testid="day-palette"]')).toHaveLength(0);
    expect(nightPlates().length).toBeGreaterThan(0);
  });
});
