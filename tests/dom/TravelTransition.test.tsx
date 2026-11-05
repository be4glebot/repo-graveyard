/**
 * Component tests for the travel transition (`components/scene/TravelTransition`)
 * and the `SceneView` arrival-focus wiring that consumes it (task 10.2).
 *
 * `TravelTransition` is the short, skippable, `aria-hidden` overlay `SceneView`
 * mounts during a map→place entry. It owns no application state: it runs the
 * motion (or, under reduced motion, a crossfade) and calls `onDone` exactly
 * once — on natural timer completion or on a key/pointer skip — so the owner can
 * clear the transitioning flag and move focus to the place heading.
 *
 * These tests pin the component's observable contract:
 *   - on BOTH paths (motion and reduced-motion) the transition signals arrival
 *     by calling `onDone` exactly once when its window elapses (Req 13.1, 13.4);
 *   - a `keydown` and a `pointerdown` each skip straight to the arrived state and
 *     fire `onDone` exactly once, and the single-fire guard holds across a skip
 *     followed by the timer, and across multiple skips (Req 13.3);
 *   - the reduced-motion path renders `data-reduced-motion="true"` and performs a
 *     plain crossfade — no parallax zoom plates, no fog, and no staggered raise
 *     motes (Req 13.6);
 *   - the motion path renders its zoom/fog/title/raise layers and raise motes
 *     for each representative name (Req 13.2);
 *   - the overlay is `aria-hidden` on both paths and so never traps focus
 *     (Req 13.5 — focus is moved by the owner, not the overlay).
 *
 * Focus behaviour on arrival is performed by `SceneView.onTravelDone`, which
 * queries `[data-testid="place-heading"]` and focuses it. The EstateMap/PlaceView
 * render switch (task 14.1) has not landed, so a real `PlaceHeading` is not in the
 * DOM during a `SceneView` render yet; the full arrival-focus + return-focus flow
 * through the rendered place is covered by the task 14.2 e2e tests. Here we pin
 * the focus CONTRACT two ways: the final `describe` renders a stand-in element
 * with `data-testid="place-heading"` and drives the exact query/focus `onDone`
 * uses on both the motion and reduced-motion paths, plus the skip path; it also
 * covers the return-focus fallback (originating place link, then map heading).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (attributes, `querySelector`, `document.activeElement`), matching
 * `tests/dom/SceneView.test.tsx`. `vi.useFakeTimers()` drives the `setTimeout`
 * windows deterministically.
 *
 * Requirements: 13.3, 13.4, 13.5, 13.6, 13.7
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import TravelTransition from "@/components/scene/TravelTransition";
import { TRAVEL_CROSSFADE_MS, TRAVEL_MS, type PlaceId } from "@/lib/estate-view";

/** Representative repo names for the stagger motes on the motion path. */
const NAMES = ["alpha", "bravo", "charlie"];

beforeEach(() => {
  // Fake timers so the `setTimeout(finish, durationMs)` window can be advanced
  // deterministically; real-timer-based userEvent is avoided in favour of
  // `fireEvent` for skips so the whole suite runs on the fake clock.
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

/** Advances the fake clock by `ms` inside an `act` so React flushes the state. */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("TravelTransition — arrival signal (onDone)", () => {
  it("fires onDone exactly once when the motion window elapses (13.1)", () => {
    const onDone = vi.fn();
    render(
      <TravelTransition
        place="gate"
        creatureNames={NAMES}
        reducedMotion={false}
        onDone={onDone}
      />,
    );

    // Not done before the window closes.
    advance(TRAVEL_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    // The full ~1200 ms window elapses: the arrival signal fires once.
    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);

    // The guard holds: letting more time pass does not fire it again.
    advance(TRAVEL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("fires onDone exactly once when the reduced-motion window elapses (13.4)", () => {
    const onDone = vi.fn();
    render(
      <TravelTransition
        place="sky"
        creatureNames={NAMES}
        reducedMotion
        onDone={onDone}
      />,
    );

    // The crossfade window is the shorter 300 ms; nothing fires before it.
    advance(TRAVEL_CROSSFADE_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);

    advance(TRAVEL_CROSSFADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("TravelTransition — skippable (single-fire guard)", () => {
  it("a keydown skips straight to the arrived state and fires onDone once (13.3)", () => {
    const onDone = vi.fn();
    render(
      <TravelTransition
        place="gate"
        creatureNames={NAMES}
        reducedMotion={false}
        onDone={onDone}
      />,
    );

    // Partway through the window, a key press jumps to arrived immediately.
    advance(100);
    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    // The arrived state is reflected on the zoom plates (fully zoomed).
    const far = screen.getByTestId("travel-zoom-far");
    expect(far.style.transform).toBe("scale(1.15)");

    // The pending natural-completion timer must NOT fire a second time.
    advance(TRAVEL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a pointerdown skips straight to the arrived state and fires onDone once (13.3)", () => {
    const onDone = vi.fn();
    render(
      <TravelTransition
        place="ground"
        creatureNames={NAMES}
        reducedMotion={false}
        onDone={onDone}
      />,
    );

    advance(100);
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    advance(TRAVEL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("multiple skips and a trailing timer still fire onDone exactly once (13.3)", () => {
    const onDone = vi.fn();
    render(
      <TravelTransition
        place="crypt"
        creatureNames={NAMES}
        reducedMotion={false}
        onDone={onDone}
      />,
    );

    act(() => {
      fireEvent.keyDown(window, { key: "a" });
      fireEvent.keyDown(window, { key: "b" });
      fireEvent.pointerDown(window);
    });
    advance(TRAVEL_MS);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a skip fires onDone once on the reduced-motion path too (13.3, 13.4)", () => {
    const onDone = vi.fn();
    render(
      <TravelTransition
        place="sky"
        creatureNames={NAMES}
        reducedMotion
        onDone={onDone}
      />,
    );

    advance(50);
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    advance(TRAVEL_CROSSFADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("TravelTransition — reduced-motion crossfade (13.6)", () => {
  it("renders data-reduced-motion=\"true\" with no zoom, fog, or raise motes", () => {
    render(
      <TravelTransition
        place="gate"
        creatureNames={NAMES}
        reducedMotion
        onDone={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId("travel-transition");
    expect(overlay.getAttribute("data-reduced-motion")).toBe("true");

    // The crossfade has none of the motion-path layers: no parallax zoom
    // plates, no fog wipe, and no staggered raise motes (Req 13.6).
    expect(screen.queryByTestId("travel-zoom-far")).toBeNull();
    expect(screen.queryByTestId("travel-zoom-fg")).toBeNull();
    expect(screen.queryByTestId("travel-fog")).toBeNull();
    expect(screen.queryByTestId("travel-raise")).toBeNull();
    expect(screen.queryAllByTestId("travel-raise-mote")).toHaveLength(0);
  });

  it("ignores creatureNames entirely on the reduced-motion path (13.6)", () => {
    // Even with a full set of representative names, the crossfade renders no
    // stagger motes — reduced motion has no staggered raise at all.
    render(
      <TravelTransition
        place="sky"
        creatureNames={["x", "y", "z", "w"]}
        reducedMotion
        onDone={vi.fn()}
      />,
    );

    expect(screen.queryAllByTestId("travel-raise-mote")).toHaveLength(0);
  });
});

describe("TravelTransition — motion path layers (13.2)", () => {
  it("renders data-reduced-motion=\"false\" with both zoom plates, fog, title, and a raise mote per name", () => {
    render(
      <TravelTransition
        place="gate"
        creatureNames={NAMES}
        reducedMotion={false}
        onDone={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId("travel-transition");
    expect(overlay.getAttribute("data-reduced-motion")).toBe("false");

    // Two parallax plates, the fog wipe, and the place title are all present.
    expect(screen.queryByTestId("travel-zoom-far")).not.toBeNull();
    expect(screen.queryByTestId("travel-zoom-fg")).not.toBeNull();
    expect(screen.queryByTestId("travel-fog")).not.toBeNull();
    expect(screen.queryByTestId("travel-title")).not.toBeNull();

    // One raise mote per representative name (Req 13.2 — per-creature stagger).
    expect(screen.queryByTestId("travel-raise")).not.toBeNull();
    expect(screen.queryAllByTestId("travel-raise-mote")).toHaveLength(NAMES.length);
  });

  it("renders no raise motes for an empty place but still plays zoom/fog/title (13.2)", () => {
    render(
      <TravelTransition
        place="crypt"
        creatureNames={[]}
        reducedMotion={false}
        onDone={vi.fn()}
      />,
    );

    // Empty place → no raise container and no motes, but the rest still plays.
    expect(screen.queryByTestId("travel-raise")).toBeNull();
    expect(screen.queryAllByTestId("travel-raise-mote")).toHaveLength(0);
    expect(screen.queryByTestId("travel-zoom-far")).not.toBeNull();
    expect(screen.queryByTestId("travel-zoom-fg")).not.toBeNull();
    expect(screen.queryByTestId("travel-fog")).not.toBeNull();
    expect(screen.queryByTestId("travel-title")).not.toBeNull();
  });
});

describe("TravelTransition — accessibility (13.5)", () => {
  it("is aria-hidden on the motion path so it never receives or traps focus", () => {
    render(
      <TravelTransition
        place="gate"
        creatureNames={NAMES}
        reducedMotion={false}
        onDone={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId("travel-transition");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    // The overlay carries pointer-events-none so it cannot intercept clicks.
    expect(overlay.className).toContain("pointer-events-none");
  });

  it("is aria-hidden on the reduced-motion path too", () => {
    render(
      <TravelTransition
        place="sky"
        creatureNames={NAMES}
        reducedMotion
        onDone={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId("travel-transition");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.className).toContain("pointer-events-none");
  });
});

/**
 * Arrival + return focus CONTRACT.
 *
 * `SceneView.onTravelDone` moves focus to the place heading by running exactly
 * this query: `document.querySelector('[data-testid="place-heading"]').focus()`.
 * `onReturn` moves focus back to the originating place link
 * (`[data-testid="place-link"][data-place="<id>"]`), falling back to the map
 * heading (`[data-testid="map-heading"]`). Because the place render switch
 * (task 14.1) has not landed, no real heading/link is mounted during a
 * `SceneView` render; the full flow through the rendered place is covered by the
 * task 14.2 e2e tests. Here we stand in those focus targets and exercise the
 * exact queries, keeping `TravelTransition` as the thing that drives `onDone` on
 * every path so the component→owner handoff is pinned end to end.
 */
describe("arrival + return focus contract (13.5, 13.7)", () => {
  /** Mirrors SceneView.onTravelDone: query the place heading and focus it. */
  function focusPlaceHeading(): void {
    document
      .querySelector<HTMLElement>('[data-testid="place-heading"]')
      ?.focus();
  }

  /**
   * Mirrors SceneView.onReturn's focus move: the originating place link if
   * present, else the map heading fallback (Req 13.7).
   */
  function focusReturnTarget(origin: PlaceId | null): void {
    const target =
      (origin &&
        document.querySelector<HTMLElement>(
          `[data-testid="place-link"][data-place="${origin}"]`,
        )) ||
      document.querySelector<HTMLElement>('[data-testid="map-heading"]');
    target?.focus();
  }

  /** A focusable stand-in for the real PlaceHeading focus target. */
  function PlaceHeadingStandIn() {
    return <div data-testid="place-heading" tabIndex={-1} />;
  }

  it("moves focus to place-heading on arrival via the motion path (13.5)", () => {
    const onDone = vi.fn(focusPlaceHeading);
    render(
      <>
        <PlaceHeadingStandIn />
        <TravelTransition
          place="gate"
          creatureNames={NAMES}
          reducedMotion={false}
          onDone={onDone}
        />
      </>,
    );

    // Before arrival the heading does not have focus.
    const heading = screen.getByTestId("place-heading");
    expect(document.activeElement).not.toBe(heading);

    // Let the full motion window elapse: onDone runs the heading-focus query.
    advance(TRAVEL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(heading);
  });

  it("moves focus to place-heading on arrival via the reduced-motion path (13.5)", () => {
    const onDone = vi.fn(focusPlaceHeading);
    render(
      <>
        <PlaceHeadingStandIn />
        <TravelTransition
          place="sky"
          creatureNames={NAMES}
          reducedMotion
          onDone={onDone}
        />
      </>,
    );

    const heading = screen.getByTestId("place-heading");
    expect(document.activeElement).not.toBe(heading);

    advance(TRAVEL_CROSSFADE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(heading);
  });

  it("moves focus to place-heading when the transition is skipped (13.3, 13.5)", () => {
    const onDone = vi.fn(focusPlaceHeading);
    render(
      <>
        <PlaceHeadingStandIn />
        <TravelTransition
          place="ground"
          creatureNames={NAMES}
          reducedMotion={false}
          onDone={onDone}
        />
      </>,
    );

    const heading = screen.getByTestId("place-heading");
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    // The skip drives onDone, which lands focus on the heading immediately —
    // without waiting out the window.
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(heading);
  });

  it("returns focus to the originating place link when it is available (13.7)", () => {
    render(
      <>
        <a data-testid="place-link" data-place="gate" href="#gate" />
        <h1 data-testid="map-heading" tabIndex={-1} />
      </>,
    );

    focusReturnTarget("gate");

    // The originating link wins over the map heading fallback.
    const link = screen.getByTestId("place-link");
    expect(document.activeElement).toBe(link);
  });

  it("falls back to the map heading when the originating place link is unavailable (13.7)", () => {
    render(
      <>
        {/* Only the map heading is present — the originating link is gone. */}
        <h1 data-testid="map-heading" tabIndex={-1} />
      </>,
    );

    focusReturnTarget("gate");

    const mapHeading = screen.getByTestId("map-heading");
    expect(document.activeElement).toBe(mapHeading);
  });

  it("falls back to the map heading when there is no recorded origin (13.7)", () => {
    render(<h1 data-testid="map-heading" tabIndex={-1} />);

    // A return with no origin recorded resolves straight to the map heading.
    focusReturnTarget(null);

    expect(document.activeElement).toBe(screen.getByTestId("map-heading"));
  });
});
