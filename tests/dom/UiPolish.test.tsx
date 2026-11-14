/**
 * Component tests for the 2C UI-polish controls (task 3.3).
 *
 * Pins the boards' bevelled-iron treatment onto the restyled chips, buttons,
 * and the new creature plaque:
 *
 *   - filter chips carry the shared `.fixture-ledge` class; the active filter
 *     chip adds the `border-crimson-400!` modifier so it is visually distinct
 *     from every inactive chip, which never carries it (Req 7.2, 7.3);
 *   - the iron buttons (`ReturnToGate`, both `Pager` controls) carry the
 *     `.fixture-rail` class (Req 7.1);
 *   - the plaque renders exactly one Cinzel name line (`.plq b`) and exactly
 *     one monospace sub-line (`.plq i`), caps its width at the fixed `PLAQUE_W`,
 *     ellipsizes a long name instead of widening, and exposes the full name via
 *     both `title` and `aria-label` (Req 7.4).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (classList, data- attributes, inline style, attributes),
 * matching the pattern in `tests/dom/PlaceView.test.tsx` and
 * `tests/dom/Chrome.test.tsx`. jsdom does not apply authored stylesheet rules
 * to computed styles, so the boards' treatment is verified by the presence of
 * the `.chip2` / `.chip2.on` / `.btn2` / `.plq` classes (the same classes the
 * `app/globals.css` rules bind the iron/crimson styling to) rather than by
 * reading resolved colors.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import FilterChips from "@/components/scene/FilterChips";
import Pager from "@/components/scene/Pager";
import ReturnToGate from "@/components/scene/ReturnToGate";
import Plaque from "@/components/ui/Plaque";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { PLAQUE_W, type PlaceFilter } from "@/lib/estate-view";

afterEach(() => {
  cleanup();
});

const noop = () => {};

/** Builds `count` fresh-zombie gate rows (decay band 0) with unique names. */
function gateZombieRows(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `zombie-${i}`,
    url: `https://github.com/octocat/zombie-${i}`,
    state: "zombie" as const,
    daysQuiet: i + 1,
    decayLevel: 0,
  }));
}

describe("FilterChips iron/crimson treatment (7.2, 7.3)", () => {
  it("renders every chip with the inactive .chip2 plaque class", () => {
    render(
      <FilterChips
        place="gate"
        rows={gateZombieRows(3)}
        activeFilter="all"
        onFilterChange={noop}
      />,
    );

    const chips = Array.from(
      screen.getByTestId("filter-chips").querySelectorAll("button"),
    );
    expect(chips.length).toBeGreaterThan(0);
    // Every chip is a .chip2 bevelled plaque (Req 7.2).
    for (const chip of chips) {
      expect(chip.classList.contains("fixture-ledge")).toBe(true);
    }
  });

  it("adds .chip2.on only to the active filter chip (7.3)", () => {
    // "fresh" is the active filter; it must be visually distinct via the `on`
    // crimson modifier, and no inactive chip may carry it.
    const active: PlaceFilter = "fresh";
    render(
      <FilterChips
        place="gate"
        rows={gateZombieRows(3)}
        activeFilter={active}
        onFilterChange={noop}
      />,
    );

    const activeChip = screen.getByTestId(`filter-chip-${active}`);
    // The active chip carries both .chip2 and the .on crimson modifier, so
    // `.chip2.on` matches it — it is visually distinguishable from the rest.
    expect(activeChip.classList.contains("fixture-ledge")).toBe(true);
    expect(activeChip.classList.contains("border-crimson-400!")).toBe(true);
    expect(activeChip.matches('.fixture-ledge[class~="border-crimson-400!"]')).toBe(true);

    // Every other (inactive) chip is a plain .chip2 with no .on modifier.
    const inactiveChips = Array.from(
      screen.getByTestId("filter-chips").querySelectorAll("button"),
    ).filter((chip) => chip !== activeChip);
    expect(inactiveChips.length).toBeGreaterThan(0);
    for (const chip of inactiveChips) {
      expect(chip.classList.contains("fixture-ledge")).toBe(true);
      expect(chip.classList.contains("border-crimson-400!")).toBe(false);
      expect(chip.matches('.fixture-ledge[class~="border-crimson-400!"]')).toBe(false);
    }
  });

  it("moves the .on modifier when the active filter changes", () => {
    // Re-rendering with a different active filter must hand the crimson `on`
    // modifier to the newly-active chip and strip it from the old one, so
    // exactly one chip is ever visually active.
    const { rerender } = render(
      <FilterChips
        place="gate"
        rows={gateZombieRows(3)}
        activeFilter="all"
        onFilterChange={noop}
      />,
    );
    expect(screen.getByTestId("filter-chip-all").matches('.fixture-ledge[class~="border-crimson-400!"]')).toBe(
      true,
    );
    expect(screen.getByTestId("filter-chip-fresh").matches('.fixture-ledge[class~="border-crimson-400!"]')).toBe(
      false,
    );

    rerender(
      <FilterChips
        place="gate"
        rows={gateZombieRows(3)}
        activeFilter="fresh"
        onFilterChange={noop}
      />,
    );
    expect(screen.getByTestId("filter-chip-all").matches('.fixture-ledge[class~="border-crimson-400!"]')).toBe(
      false,
    );
    expect(screen.getByTestId("filter-chip-fresh").matches('.fixture-ledge[class~="border-crimson-400!"]')).toBe(
      true,
    );

    // Exactly one chip is the active crimson chip at a time.
    const onChips = Array.from(
      screen.getByTestId("filter-chips").querySelectorAll('button.fixture-ledge[class~="border-crimson-400!"]'),
    );
    expect(onChips).toHaveLength(1);
  });
});

describe("Iron buttons carry .btn2 (7.1)", () => {
  it("renders the return control as a .btn2 iron plaque", () => {
    render(<ReturnToGate onReturn={noop} />);

    const ret = screen.getByTestId("return-to-gate");
    expect(ret.tagName).toBe("BUTTON");
    expect(ret.classList.contains("fixture-rail")).toBe(true);
  });

  it("renders both pager controls as .btn2 iron plaques", () => {
    // Two plots so neither control is removed; both pager buttons are iron.
    render(<Pager plotIndex={0} plotCount={2} onPlotChange={noop} />);

    const nearer = screen.getByTestId("pager-nearer");
    const deeper = screen.getByTestId("pager-deeper");
    expect(nearer.classList.contains("fixture-rail")).toBe(true);
    expect(deeper.classList.contains("fixture-rail")).toBe(true);
  });
});

describe("Plaque .plq structure, fixed width, and full name (7.4)", () => {
  it("renders exactly one Cinzel name line and one mono sub-line", () => {
    render(<Plaque name="octocat/hello-world" sub="fresh" />);

    const plaque = screen.getByTestId("plaque");
    expect(plaque.classList.contains("plq")).toBe(true);

    // Exactly one name line (`.plq b`) and one sub-line (`.plq i`).
    const nameLines = plaque.querySelectorAll("b");
    const subLines = plaque.querySelectorAll("i");
    expect(nameLines).toHaveLength(1);
    expect(subLines).toHaveLength(1);

    const name = screen.getByTestId("plaque-name");
    const sub = screen.getByTestId("plaque-sub");
    expect(name.tagName).toBe("B");
    expect(sub.tagName).toBe("I");
    expect(name.textContent).toBe("octocat/hello-world");
    expect(sub.textContent).toBe("fresh");
  });

  it("caps the plaque at the fixed PLAQUE_W max width", () => {
    render(<Plaque name="a-repo" sub="fresh" />);

    const plaque = screen.getByTestId("plaque");
    // Fixed max width equals the single-source-of-truth PLAQUE_W at scale 1.
    expect(plaque.style.maxWidth).toBe(`${PLAQUE_W}px`);
  });

  it("scales the fixed max width in lockstep with the render scale", () => {
    render(<Plaque name="a-repo" sub="fresh" scale={0.5} />);

    const plaque = screen.getByTestId("plaque");
    expect(plaque.style.maxWidth).toBe(`${PLAQUE_W * 0.5}px`);
  });

  it("ellipsizes a long name instead of widening the slab", () => {
    // A very long name must clip with an ellipsis: nowrap + hidden overflow +
    // text-overflow ellipsis on the name line (Req 7.4).
    const longName =
      "octocat/an-extremely-long-repository-name-that-would-overflow-the-plaque";
    render(<Plaque name={longName} sub="fresh" />);

    const name = screen.getByTestId("plaque-name");
    expect(name.style.whiteSpace).toBe("nowrap");
    expect(name.style.overflow).toBe("hidden");
    expect(name.style.textOverflow).toBe("ellipsis");
    // The name line is capped to the slab width so it clips rather than grows.
    expect(name.style.maxWidth).toBe("100%");
  });

  it("exposes the full name via both title and aria-label", () => {
    const longName =
      "octocat/an-extremely-long-repository-name-that-would-overflow-the-plaque";
    render(<Plaque name={longName} sub="fresh" />);

    const name = screen.getByTestId("plaque-name");
    // Even when the visible text clips, the full name stays available to a
    // pointer hover tooltip (title) and to assistive tech (aria-label).
    expect(name.getAttribute("title")).toBe(longName);
    expect(name.getAttribute("aria-label")).toBe(longName);
  });
});
