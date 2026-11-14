/**
 * Tests for the reveal request consumed by `WorldPlaceView` (task 5.11).
 *
 * Requirements: 10.5, 10.6, 10.7, 10.8, 3.9
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import GatePlaceView from "@/components/scene/GatePlaceView";
import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { PLOT_SIZE } from "@/lib/estate-view";
import { placePlots } from "@/lib/place-pipeline";

const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: scrollTo,
  });
});

afterEach(() => {
  cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (HTMLElement.prototype as any).scrollTo;
});

function ghosts(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `sky-repo-${i}`,
    url: `https://github.com/octocat/sky-repo-${i}`,
    state: "ghost",
    daysQuiet: 10 + i,
    decayLevel: i % 4,
  })) as GraveyardRow[];
}

function props(extra: Partial<WorldPlaceViewProps> = {}): WorldPlaceViewProps {
  return {
    place: "sky",
    rows: ghosts(6),
    activeFilter: "all",
    plotIndex: 0,
    selectedName: null,
    onFilterChange: vi.fn(),
    onPlotChange: vi.fn(),
    onSelect: vi.fn(),
    onReturn: vi.fn(),
    ...extra,
  };
}

describe("WorldPlaceView reveal request", () => {
  it("scrolls a matching creature into view with behavior auto and reports it handled once", () => {
    const onRevealHandled = vi.fn();
    const { rerender } = render(
      <WorldPlaceView
        {...props({ revealRequest: { name: "sky-repo-3", id: 1 }, onRevealHandled })}
      />,
    );
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const arg = scrollTo.mock.calls[0][0] as { top: number; behavior: string };
    expect(arg.behavior).toBe("auto");
    expect(arg.top).toBeGreaterThanOrEqual(0);
    expect(onRevealHandled).toHaveBeenCalledWith(1);

    // Same id again: handled once per request.
    rerender(
      <WorldPlaceView
        {...props({ revealRequest: { name: "sky-repo-3", id: 1 }, onRevealHandled })}
      />,
    );
    expect(scrollTo).toHaveBeenCalledTimes(1);

    // A new id for the same name works.
    rerender(
      <WorldPlaceView
        {...props({ revealRequest: { name: "sky-repo-3", id: 2 }, onRevealHandled })}
      />,
    );
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("a name with no match changes nothing", () => {
    const onFilterChange = vi.fn();
    const onPlotChange = vi.fn();
    const onRevealHandled = vi.fn();
    render(
      <WorldPlaceView
        {...props({
          revealRequest: { name: "nobody", id: 7 },
          onFilterChange,
          onPlotChange,
          onRevealHandled,
        })}
      />,
    );
    expect(scrollTo).not.toHaveBeenCalled();
    expect(onFilterChange).not.toHaveBeenCalled();
    expect(onPlotChange).not.toHaveBeenCalled();
    expect(onRevealHandled).toHaveBeenCalledWith(7);
  });

  it("switches the filter to all when the target is filtered out", () => {
    const rows = ghosts(8);
    const onFilterChange = vi.fn();
    // Pick a ghost that the "fading" filter hides.
    const hidden = rows.find((r) => r.decayLevel !== 1)!;
    expect(
      placePlots("sky", rows, "fading", PLOT_SIZE).some((p) =>
        p.some((r) => r.name === hidden.name),
      ),
    ).toBe(false);
    render(
      <WorldPlaceView
        {...props({
          rows,
          activeFilter: "fading",
          onFilterChange,
          revealRequest: { name: hidden.name, id: 1 },
        })}
      />,
    );
    expect(onFilterChange).toHaveBeenCalledWith("all");
  });

  it("switches Plot when the target is on another page", () => {
    const rows = ghosts(PLOT_SIZE + 1);
    const plots = placePlots("sky", rows, "all", PLOT_SIZE);
    const target = plots[1][0].name;
    const onPlotChange = vi.fn();
    render(
      <WorldPlaceView
        {...props({
          rows,
          plotIndex: 0,
          onPlotChange,
          revealRequest: { name: target, id: 1 },
        })}
      />,
    );
    expect(onPlotChange).toHaveBeenCalledWith(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("GatePlaceView with the new props", () => {
  it("ignores panelOpen and revealRequest harmlessly", () => {
    const rows = [
      {
        name: "gate-repo-0",
        url: "https://github.com/octocat/gate-repo-0",
        state: "zombie",
        daysQuiet: 200,
        decayLevel: 0,
      },
    ] as GraveyardRow[];
    const onRevealHandled = vi.fn();
    expect(() =>
      render(
        <GatePlaceView
          place="gate"
          rows={rows}
          activeFilter="all"
          plotIndex={0}
          selectedName={null}
          onFilterChange={vi.fn()}
          onPlotChange={vi.fn()}
          onSelect={vi.fn()}
          onReturn={vi.fn()}
          panelOpen
          revealRequest={{ name: "gate-repo-0", id: 1 }}
          onRevealHandled={onRevealHandled}
        />,
      ),
    ).not.toThrow();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
