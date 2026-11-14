/**
 * Ground world DOM tests (explorable-worlds task 11.6).
 *
 * Requirements: 8.1, 8.2, 8.9, 8.11, 8.12, 8.13, 15.9
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { placePlots } from "@/lib/place-pipeline";
import { computeWorldLayout } from "@/lib/world-layout";

afterEach(() => cleanup());

const noop = () => {};

function tombs(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tomb-${i}`,
    url: `https://github.com/octocat/tomb-${i}`,
    state: "tombstone",
    daysQuiet: 5 + i * 120,
    decayLevel: null,
  })) as GraveyardRow[];
}

function zombies(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `zed-${i}`,
    url: `https://github.com/octocat/zed-${i}`,
    state: "zombie",
    daysQuiet: 200 + i * 90,
    decayLevel: i % 5,
  })) as GraveyardRow[];
}

function props(rows: GraveyardRow[]): WorldPlaceViewProps {
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
  };
}

function layoutFor(rows: GraveyardRow[]) {
  const plot = placePlots("ground", rows, "all", 100)[0] ?? [];
  const viewportW = window.innerWidth > 0 ? window.innerWidth : 1024;
  return {
    viewportW,
    layout: computeWorldLayout({
      place: "ground",
      names: plot.map((r) => r.name),
      viewportW,
      viewportH: window.innerHeight > 0 ? window.innerHeight : 812,
    }),
  };
}

describe("ground world", () => {
  it("descends the tombstones and alternates sides of the path", () => {
    const rows = tombs(6);
    render(<WorldPlaceView {...props(rows)} />);
    const items = screen.getAllByTestId("scatter-creature");
    expect(items).toHaveLength(6);
    const { layout } = layoutFor(rows);
    const slots = layout.slots;
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].cy).toBeGreaterThan(slots[i - 1].cy);
      expect(slots[i].side).not.toBe(0);
      expect(slots[i].side).toBe(-slots[i - 1].side);
    }
    const tops = items.map((li) => parseFloat(li.style.top));
    const sorted = [...tops].sort((a, b) => a - b);
    // DOM order follows the layout order, so tops must already be ascending.
    expect(tops).toEqual(sorted);
    expect(new Set(tops).size).toBe(tops.length);
  });

  it("puts the mausoleum below the last tombstone for every count of 2 or more", () => {
    for (const count of [2, 3, 4, 6, 10, 25, 60]) {
      const { layout } = layoutFor(tombs(count));
      const mausoleum = layout.features.find((f) => f.kind === "mausoleum");
      const lastCy = Math.max(...layout.slots.map((s) => s.cy));
      expect(mausoleum).toBeTruthy();
      expect(mausoleum!.y).toBeGreaterThan(lastCy);
      expect(mausoleum!.y).toBeLessThan(layout.heightPx);
    }
  });

  it("centres a single tombstone within 5 percent in the first screen", () => {
    const rows = tombs(1);
    render(<WorldPlaceView {...props(rows)} />);
    const { layout, viewportW } = layoutFor(rows);
    expect(layout.lengthVh).toBe(1);
    const li = screen.getByTestId("scatter-creature");
    const leftPct = parseFloat(li.style.left);
    expect(Math.abs(leftPct - 50)).toBeLessThanOrEqual(5);
    expect(Math.abs(layout.slots[0].cx - viewportW / 2) / viewportW).toBeLessThanOrEqual(0.05);
    expect(parseFloat(li.style.top)).toBeLessThan(layout.viewportH);
  });

  it.each([2, 3])("%i tombstones use a length of 1.25 to 1.5 with a mausoleum", (n) => {
    const rows = tombs(n);
    render(<WorldPlaceView {...props(rows)} />);
    const { layout } = layoutFor(rows);
    expect(layout.lengthVh).toBeGreaterThanOrEqual(1.25);
    expect(layout.lengthVh).toBeLessThanOrEqual(1.5);
    expect(layout.features.some((f) => f.kind === "mausoleum")).toBe(true);
    expect(screen.getAllByTestId("ground-mausoleum")).toHaveLength(1);
    // The path continues from the last tombstone to the far mausoleum.
    const mausoleum = layout.features.find((f) => f.kind === "mausoleum")!;
    expect(mausoleum.y).toBeGreaterThan(layout.slots[layout.slots.length - 1].cy);
  });

  it("keeps the night-sky fallback and controls when the art fails to load", () => {
    const onSelect = () => {};
    render(<WorldPlaceView {...props(tombs(3))} onSelect={onSelect} />);
    const probes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid$="crop-probe"]'),
    );
    expect(probes.length).toBeGreaterThan(0);
    for (const p of probes) fireEvent.error(p);

    const images = document.querySelectorAll<HTMLElement>('[data-testid$="crop-image"]');
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img.getAttribute("data-crop-failed")).toBe("true");
      expect(img.style.backgroundImage).toBe("none");
    });
    const root = screen.getByTestId("place-view");
    expect(root.style.backgroundColor).toBe("var(--color-night-sky)");
    document
      .querySelectorAll<HTMLElement>('[data-testid="ground-crop"]')
      .forEach((c) => expect(c.style.backgroundColor).toBe("var(--color-night-sky)"));

    // Every tombstone and the controls stay present and activatable.
    for (const li of screen.getAllByTestId("scatter-creature")) {
      const button = li.querySelector("button");
      expect(button).not.toBeNull();
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
    expect(screen.getAllByRole("button").length).toBeGreaterThan(3);
    // No visible image inside any decorative layer (probes are hidden).
    expect(document.querySelectorAll("[data-decor-clip] img:not([hidden])")).toHaveLength(0);
  });

  it("renders no scene-fog or scene-fog-near", () => {
    render(<WorldPlaceView {...props([...tombs(4), ...zombies(6)])} />);
    expect(screen.queryByTestId("scene-fog")).toBeNull();
    expect(screen.queryByTestId("scene-fog-near")).toBeNull();
    expect(document.querySelector(".scene-fog, .scene-fog-near")).toBeNull();
  });

  it("leaves the mist unchanged when the zombie count changes", () => {
    const mistOf = (): string[] =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="place-mist-far"], [data-testid="place-mist-near"]',
        ),
      ).map((el) => el.outerHTML);

    // Mist is drawn once per Stratum, and the Stratum count follows the Plot
    // size (Req 6). Hold the Plot size at 12 so only the zombie count varies
    // (0 vs 9); adding rows would change the world length, not the mist.
    const first = render(<WorldPlaceView {...props(tombs(12))} />);
    const none = mistOf();
    first.unmount();
    const second = render(<WorldPlaceView {...props([...tombs(3), ...zombies(9)])} />);
    const many = mistOf();
    second.unmount();

    expect(none.length).toBeGreaterThan(0);
    expect(many).toEqual(none);
    for (const html of none) {
      expect(html).toContain('data-place="ground"');
      expect(html).toContain("var(--env-mist-opacity, 0)");
    }
  });
});
