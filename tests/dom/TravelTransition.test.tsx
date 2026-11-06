/**
 * DOM tests for the "pulled in" travel transition (`TravelRunner` / `useTravel`
 * in components/scene/TravelTransition). These pin the ORDER of events, not
 * just the presence of layers ? the bugs they guard against are (a) the
 * destination being visible before the cut, (b) an empty element being
 * "zoomed", (c) the left place's title showing on return, and (d) an end jump.
 *
 * `TravelRunner` mounts the REAL source view until the cut and the REAL
 * destination after it, wrapping whichever is mounted in `travel-stage` (which
 * carries the zoom transform). Here `from`/`to` are simple marker nodes with
 * their own testids so we can assert exactly which one is mounted at each time.
 *
 * The clock is a `setInterval` + `Date.now()` model, so `vi.useFakeTimers()`
 * drives it deterministically: `advance(ms)` moves the timeline and flushes the
 * interval ticks, cut timer, and end timer.
 *
 * Requirements: 13.1?13.7, 9.1, 9.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  TravelRunner,
  TRAVEL_FULL_MS,
  TRAVEL_CUT_MS,
} from "@/components/scene/TravelTransition";

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

/** Advance the fake clock by `ms` inside act() so React flushes state. */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Marker source/destination nodes so the test can see which is mounted. */
const FROM = <div data-testid="src-view">source</div>;
const TO = <div data-testid="dest-view">destination</div>;

function renderForward(onCut = vi.fn(), onDone = vi.fn()) {
  // place: gate; direction "in" (map -> place).
  render(
    <TravelRunner
      place="gate"
      direction="in"
      reducedMotion={false}
      from={FROM}
      to={TO}
      onCut={onCut}
      onDone={onDone}
    />,
  );
  return { onCut, onDone };
}

describe("TravelRunner ? animates the REAL scenes with the view switch at the cut", () => {
  it("before the cut (1000ms) the SOURCE is mounted and the destination is NOT", () => {
    renderForward();
    advance(1000);
    expect(screen.queryByTestId("src-view")).not.toBeNull();
    expect(screen.queryByTestId("dest-view")).toBeNull();
  });

  it("switches to the destination only AT the cut (onCut fires at ~1150ms)", () => {
    const { onCut } = renderForward();
    advance(TRAVEL_CUT_MS - 50); // 1100ms
    expect(onCut).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dest-view")).toBeNull();

    advance(100); // cross 1150ms
    expect(onCut).toHaveBeenCalledTimes(1);
  });

  it("after the cut (1300ms) the DESTINATION is mounted and the source is NOT", () => {
    renderForward();
    advance(1300);
    expect(screen.queryByTestId("dest-view")).not.toBeNull();
    expect(screen.queryByTestId("src-view")).toBeNull();
  });

  it("the zoom transform is applied to the real stage wrapper, which HAS children (never an empty element)", () => {
    renderForward();
    advance(300);
    const stage = screen.getByTestId("travel-stage");
    // The stage carries a scale transform ?
    expect(stage.style.transform).toContain("scale(");
    // ? and it wraps the real source view (it is not empty).
    expect(stage.children.length).toBeGreaterThan(0);
    expect(stage.querySelector('[data-testid="src-view"]')).not.toBeNull();
  });

  it("the fog is fully opaque around the cut (1100ms)", () => {
    renderForward();
    advance(1100);
    const fog = screen.getByTestId("travel-fog");
    expect(Number(fog.style.opacity)).toBeGreaterThanOrEqual(0.99);
  });

  it("ends with the destination at rest: stage scale 1 / no transform and full chrome, BEFORE unmount", () => {
    const { onDone } = renderForward();
    advance(TRAVEL_FULL_MS + 1);
    // onDone has fired exactly once ?
    expect(onDone).toHaveBeenCalledTimes(1);
    // ? and at the final frame the stage is exactly at rest (no residual zoom),
    // so there is no jump when SceneView removes the overlay.
    const stage = screen.getByTestId("travel-stage");
    const t = stage.style.transform;
    expect(t === "none" || t === "" || t === "scale(1)").toBe(true);
    const f = stage.style.filter;
    expect(f === "none" || f === "" || f === "blur(0px)").toBe(true);
  });
});

describe("TravelRunner ? reverse (place -> map) shows NO left-place title", () => {
  it("on an outward motion-path travel, no element shows the left place's name", () => {
    render(
      <TravelRunner
        place="gate"
        direction="out"
        reducedMotion={false}
        from={<div data-testid="src-view">place</div>}
        to={<div data-testid="dest-view">map</div>}
        onCut={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    advance(300);
    // The motion path renders only the fog overlay ? no title card at all, so
    // the left place's name ("Beyond the Gate") never appears.
    expect(screen.queryByText(/Beyond the Gate/i)).toBeNull();
    expect(screen.queryByTestId("travel-title")).toBeNull();
  });

  it("the reduced-motion card on 'out' shows the ESTATE name, never the left place", () => {
    render(
      <TravelRunner
        place="gate"
        direction="out"
        reducedMotion
        from={<div data-testid="src-view">place</div>}
        to={<div data-testid="dest-view">map</div>}
        onCut={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    const title = screen.getByTestId("travel-title");
    expect(title.textContent).toBe("The Estate");
    expect(title.textContent).not.toMatch(/Beyond the Gate/i);
  });
});

describe("TravelRunner ? skippable + single-fire", () => {
  it("a keydown jumps to the end: onCut and onDone each fire once and the destination is mounted", () => {
    const onCut = vi.fn();
    const onDone = vi.fn();
    renderForward(onCut, onDone);
    advance(100);
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(onCut).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("dest-view")).not.toBeNull();

    // The trailing timers must not fire the callbacks again.
    advance(TRAVEL_FULL_MS);
    expect(onCut).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a pointerdown also jumps to the end once", () => {
    const onDone = vi.fn();
    renderForward(vi.fn(), onDone);
    advance(100);
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(TRAVEL_FULL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("TravelRunner ? reduced motion crossfade", () => {
  it("cuts early (~150ms) and finishes at 300ms", () => {
    const onCut = vi.fn();
    const onDone = vi.fn();
    render(
      <TravelRunner
        place="sky"
        direction="in"
        reducedMotion
        from={<div data-testid="src-view">map</div>}
        to={<div data-testid="dest-view">sky</div>}
        onCut={onCut}
        onDone={onDone}
      />,
    );
    advance(140);
    expect(onCut).not.toHaveBeenCalled();
    advance(20); // cross 150ms
    expect(onCut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("dest-view")).not.toBeNull();
    advance(200); // cross 300ms
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
