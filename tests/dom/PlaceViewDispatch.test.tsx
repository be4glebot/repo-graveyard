/**
 * PlaceView is a thin dispatcher: sky, ground and crypt (WORLD_PLACES) render
 * the explorable world; only the gate renders the old stage (GatePlaceView)
 * with the same props.
 * Requirements: 1.8, 17.3, 17.13
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import PlaceView, { WORLD_PLACES } from "@/components/scene/PlaceView";
import GatePlaceView from "@/components/scene/GatePlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { PlaceId } from "@/lib/estate-view";

afterEach(() => cleanup());

const noop = () => {};
const rows: GraveyardRow[] = [
  {
    name: "z-0",
    url: "https://github.com/o/z-0",
    state: "zombie",
    daysQuiet: 200,
    decayLevel: 1,
  },
  {
    name: "z-1",
    url: "https://github.com/o/z-1",
    state: "zombie",
    daysQuiet: 400,
    decayLevel: 2,
  },
];

function props(place: PlaceId) {
  return {
    place,
    rows,
    activeFilter: "all" as const,
    plotIndex: 0,
    selectedName: null,
    onFilterChange: noop,
    onPlotChange: noop,
    onSelect: noop,
    onReturn: noop,
  };
}

describe("PlaceView dispatcher", () => {
  it("has sky, ground and crypt as world places (gate stays the old stage)", () => {
    // Req 17.5 (task 14.4): crypt joined the set; same intent, the set now
    // holds every place except the gate.
    expect([...WORLD_PLACES]).toEqual(["sky", "ground", "crypt"]);
  });

  it.each(["sky", "ground", "crypt"] as PlaceId[])(
    "renders %s as a world (world-scroller), not the old stage",
    (place) => {
      const { getByTestId } = render(<PlaceView {...props(place)} />);
      expect(getByTestId("world-scroller")).toBeTruthy();
      expect(getByTestId("place-view").getAttribute("data-place")).toBe(place);
    },
  );

  // Req 17.5 (tasks 11.4, 14.4): "ground" and "crypt" removed from this list
  // because they now render the world, covered by the test above; only the
  // gate still matches GatePlaceView markup.
  it.each(["gate"] as PlaceId[])(
    "renders the same markup as GatePlaceView for %s",
    (place) => {
      const a = render(<PlaceView {...props(place)} />);
      const dispatched = a.container.innerHTML;
      cleanup();
      const b = render(<GatePlaceView {...props(place)} />);
      expect(dispatched).toBe(b.container.innerHTML);
      expect(dispatched).toContain(`data-place="${place}"`);
    },
  );

  it("passes handlers through to the old stage", () => {
    const onReturn = vi.fn();
    const { getByTestId } = render(
      <PlaceView {...props("gate")} onReturn={onReturn} selectedName="z-0" />,
    );
    expect(getByTestId("place-view").getAttribute("data-place")).toBe("gate");
    const ret = getByTestId("place-chrome").querySelector("button");
    ret?.click();
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
