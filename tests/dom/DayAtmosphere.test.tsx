/**
 * DOM tests: the day theme removes night atmosphere (mist, candles, lanterns,
 * ravens, vignette, cream wash) and never dims painted art with brightness().
 * Night keeps all of it.
 *
 * Requirements: 2.3, 2.4, 3.5, 4.10
 */
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import Atmosphere from "@/components/scene/Atmosphere";
import { ThemeProvider, useTheme } from "@/components/scene/ThemeProvider";
import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
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

function tombs(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tomb-${i}`,
    url: `https://github.com/octocat/tomb-${i}`,
    state: "tombstone",
    daysQuiet: 5 + i * 200,
    decayLevel: null,
  })) as GraveyardRow[];
}

function props(theme: Theme, rows: GraveyardRow[]): WorldPlaceViewProps {
  return {
    place: "ground",
    rows,
    activeFilter: "all",
    plotIndex: 0,
    selectedName: null,
    onFilterChange: noop,
    onPlotChange: noop,
    onSelect: noop,
    onReturn: noop,
    theme,
  };
}

const q = (sel: string) => document.querySelectorAll(sel);

function brightnessFilters(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("*"))
    .map((el) => el.getAttribute("style") ?? "")
    .filter((s) => /filter:[^;]*brightness\(/.test(s));
}

describe("day atmosphere", () => {
  it("renders no mist, candles, lanterns, ravens, wash or brightness filter in day", () => {
    render(withTheme("day", <WorldPlaceView {...props("day", tombs(6))} />));
    expect(q('[data-testid^="place-mist"]')).toHaveLength(0);
    expect(q('[data-part="raven"]')).toHaveLength(0);
    expect(q('[data-part="candle-glow"]')).toHaveLength(0);
    expect(q('[data-testid="path-lantern"]')).toHaveLength(0);
    expect(q('[data-testid="lantern-cursor"], [data-testid="lantern-vignette"]')).toHaveLength(0);
    expect(q('[data-testid="scene-vignette"]')).toHaveLength(0);
    expect(q('[data-testid^="world-gradient"]')).toHaveLength(0);
    expect(brightnessFilters()).toEqual([]);
  });

  it("renders no empty-cemetery lanterns, path tint or mist in day", () => {
    render(withTheme("day", <WorldPlaceView {...props("day", [])} />));
    expect(q('[data-testid="empty-scene"]')).toHaveLength(1);
    expect(q('[data-testid="empty-ground-lantern"]')).toHaveLength(0);
    expect(q('[data-testid="empty-ground-path"]')).toHaveLength(0);
    expect(q('[data-testid^="place-mist"]')).toHaveLength(0);
    expect(brightnessFilters()).toEqual([]);
  });

  it("empty-state card shows day copy and parchment styling in day, night copy unchanged", () => {
    render(withTheme("day", <WorldPlaceView {...props("day", [])} />));
    const day = document.querySelector<HTMLElement>('[data-testid="empty-scene-plaque"]')!;
    expect(day.textContent).toBe(
      "No memorials yet.A stone will be placed here when a project is finished.",
    );
    expect(day.textContent).not.toMatch(/tombstones|unmarked/);
    expect(day.style.backgroundColor).toBe("var(--color-day-parchment)");
    expect(day.style.border).toContain("--color-day-card-border");
    const mound = document.querySelector<HTMLElement>('[data-testid="empty-ground-mound"]')!;
    expect(mound.style.border).toContain("--color-day-card-border");
    cleanup();
    render(withTheme("night", <WorldPlaceView {...props("night", [])} />));
    const night = document.querySelector<HTMLElement>('[data-testid="empty-scene-plaque"]')!;
    expect(night.textContent).toContain("No tombstones rest here yet");
    expect(night.textContent).toContain(
      "One plot waits, unmarked. A stone will stand here when a project is done.",
    );
  });

  it("Atmosphere (vignette, grain, cobwebs, bats) renders nothing in day", () => {
    const { container } = render(withTheme("day", <Atmosphere />));
    expect(container.querySelector('[data-testid="scene-atmosphere"]')).toBeNull();
    expect(container.querySelector('[data-testid="scene-vignette"]')).toBeNull();
  });

  it("night keeps mist, ravens, candle glow, lanterns, vignette and dimming", () => {
    render(withTheme("night", <WorldPlaceView {...props("night", tombs(6))} />));
    expect(q('[data-testid^="place-mist"]').length).toBeGreaterThan(0);
    expect(q('[data-part="raven"]').length).toBeGreaterThan(0);
    expect(q('[data-part="candle-glow"]').length).toBeGreaterThan(0);
    expect(q('[data-testid="scene-vignette"]').length).toBeGreaterThan(0);
    expect(q('[data-testid^="world-gradient"]')).toHaveLength(2);
    expect(brightnessFilters().length).toBeGreaterThan(0);
    cleanup();
    render(withTheme("night", <WorldPlaceView {...props("night", [])} />));
    expect(q('[data-testid="empty-ground-lantern"]')).toHaveLength(2);
  });
});
