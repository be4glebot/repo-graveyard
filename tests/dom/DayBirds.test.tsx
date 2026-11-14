/**
 * DOM tests for the day perch birds and raven suppression in day.
 *
 * Requirements: 4.1, 4.2, 4.5, 4.7, 4.8, 4.9, 4.10, 9.3
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => cleanup());

const noop = () => {};

function tombs(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tomb-${i}`,
    url: `https://github.com/octocat/tomb-${i}`,
    state: "tombstone",
    daysQuiet: 5 + i * 200,
    decayLevel: null,
  })) as GraveyardRow[];
}

function props(extra: Partial<WorldPlaceViewProps> = {}): WorldPlaceViewProps {
  return {
    place: "ground",
    rows: tombs(6),
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

const perch = () => Array.from(document.querySelectorAll<HTMLElement>('[data-part="perch-bird"]'));

describe("day birds", () => {
  it("renders two perch birds and no fly bird in day on the ground", () => {
    render(<WorldPlaceView {...props({ theme: "day" })} />);
    expect(perch()).toHaveLength(2);
    expect(document.querySelector('[data-part="fly-bird"]')).toBeNull();
  });

  it("renders no birds at night", () => {
    render(<WorldPlaceView {...props({ theme: "night" })} />);
    expect(perch()).toHaveLength(0);
  });

  it("hides birds from assistive tech and pointer events", () => {
    render(<WorldPlaceView {...props({ theme: "day" })} />);
    for (const el of perch()) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.style.pointerEvents).toBe("none");
      expect(el.hasAttribute("tabindex")).toBe(false);
    }
  });

  it("mirrors only the right perch bird", () => {
    render(<WorldPlaceView {...props({ theme: "day" })} />);
    const left = perch().find((b) => b.dataset.side === "left")!;
    const right = perch().find((b) => b.dataset.side === "right")!;
    expect(right.style.transform).toBe("scaleX(-1)");
    expect(left.style.transform).toBe("");
  });

  it("keeps perch birds free of animation classes under reduced motion", () => {
    render(<WorldPlaceView {...props({ theme: "day", reducedMotion: true })} />);
    expect(perch()).toHaveLength(2);
    for (const b of perch()) expect(b.className).toBe("");
  });

  it("renders no ravens in day but does at night", () => {
    render(<WorldPlaceView {...props({ theme: "day" })} />);
    expect(document.querySelector('[data-part="raven"]')).toBeNull();
    cleanup();
    render(<WorldPlaceView {...props({ theme: "night" })} />);
    expect(document.querySelector('[data-part="raven"]')).not.toBeNull();
  });
});
