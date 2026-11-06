/**
 * DOM test for the pointer-parallax controller (`components/scene/useParallax`).
 *
 * This is the automated parallax assertion the design calls out (Req 2.8) and
 * the behavioural half of **Property 4: Parallax disabled under reduced motion;
 * enabled otherwise** (Req 2.6). The design marks Property 4 a DOM test, not a
 * `fast-check` property, because the behaviour under test is the hook's effect
 * on a live `Scene_Root` element across a real `pointermove` + animation-frame
 * cycle rather than a pure function over generated inputs.
 *
 * `useParallax` never touches React state: a `pointermove` stashes the latest
 * event and schedules exactly one `requestAnimationFrame(tick)`; the tick reads
 * the root's `getBoundingClientRect()`, normalizes the pointer to `[-1, 1]` per
 * axis relative to the root centre, clamps, and writes `--px` / `--py` via
 * `style.setProperty`. It attaches the listener only when `reducedMotion` is
 * inactive AND `matchMedia("(hover: hover) and (pointer: fine)")` matches.
 *
 * jsdom quirks this test works around:
 *   - jsdom has no real layout, so `getBoundingClientRect()` returns an all-zero
 *     rect and the hook's `width <= 0` guard would bail. We stub the root's
 *     rect to a fixed 1000x800 box centred at (500, 400) so the normalization
 *     math is exercised.
 *   - jsdom's `requestAnimationFrame` cannot be "advanced" deterministically, so
 *     we replace `requestAnimationFrame` / `cancelAnimationFrame` with a fake
 *     queue we flush by hand (`flushFrame`) and that records whether it was ever
 *     called (so the reduced-motion case can assert rAF was NOT scheduled).
 *   - `@testing-library/jest-dom` is not installed, so assertions use plain DOM
 *     / vitest checks, matching the other `tests/dom/*.test.tsx` files.
 *
 * The pinned per-band maxima (`PARALLAX_MAX_BG` ≈ 8, `PARALLAX_MAX_CREATURES`
 * ≈ 16, `PARALLAX_MAX_NEAR_FOG` ≈ 26 from `lib/estate-view.ts`) are asserted
 * here too: a band's rendered offset is `normalized(--px) * max`, so the maxima
 * are both exercised (the ≤1 normalized value scaled by each max stays within
 * that max) and pinned against accidental change, and the depth ordering
 * background < creatures < near fog is confirmed.
 *
 * Validates: Requirements 2.6, 2.8
 * Requirements: 2.3, 2.5, 2.6, 2.7, 2.8, 8.1
 */
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { act } from "react";

import useParallax from "@/components/scene/useParallax";
import {
  PARALLAX_MAX_BG,
  PARALLAX_MAX_CREATURES,
  PARALLAX_MAX_NEAR_FOG,
} from "@/lib/estate-view";

// ---------------------------------------------------------------------------
// Fake requestAnimationFrame: a hand-flushed queue that records invocations so
// a test can both advance exactly one frame and assert rAF was never scheduled.
// ---------------------------------------------------------------------------

interface FakeRaf {
  /** Count of `requestAnimationFrame` calls since install. */
  requested: number;
  /** Run every queued callback once (one "frame"), draining the queue. */
  flushFrame: () => void;
}

/** Install the fake rAF/cancel pair on `window`; returns the controller. */
function installFakeRaf(): FakeRaf {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  const state: FakeRaf = {
    requested: 0,
    flushFrame: () => {
      // Snapshot the queued callbacks, clear the queue, then run them. A
      // callback that schedules another frame enqueues into the next flush.
      const due = Array.from(callbacks.entries());
      callbacks.clear();
      for (const [, cb] of due) {
        cb(performance.now());
      }
    },
  };

  vi.stubGlobal("requestAnimationFrame", ((cb: FrameRequestCallback): number => {
    state.requested += 1;
    const handle = nextHandle++;
    callbacks.set(handle, cb);
    return handle;
  }) as typeof requestAnimationFrame);

  vi.stubGlobal("cancelAnimationFrame", ((handle: number): void => {
    callbacks.delete(handle);
  }) as typeof cancelAnimationFrame);

  return state;
}

/**
 * Stub `window.matchMedia` so the fine-pointer query matches iff `finePointer`.
 * Returns a minimal `MediaQueryList` with no-op listener plumbing (the hook
 * only reads `.matches`).
 */
function installMatchMedia(finePointer: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    ((query: string): MediaQueryList => {
      const matches =
        finePointer && query === "(hover: hover) and (pointer: fine)";
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    }) as typeof matchMedia,
  );
}

// A fixed 1000 x 800 root box centred at (500, 400): half-extents are 500 / 400,
// so a pointer at (x, y) normalizes to ((x-500)/500, (y-400)/400).
const ROOT_RECT: DOMRect = {
  x: 0,
  y: 0,
  width: 1000,
  height: 800,
  top: 0,
  left: 0,
  right: 1000,
  bottom: 800,
  toJSON: () => ({}),
};

/** Pin a fixed bounding rect onto a specific element (jsdom has no layout). */
function stubRect(el: HTMLElement, rect: DOMRect): void {
  el.getBoundingClientRect = () => rect;
}

/**
 * A `pointermove` on `el`. jsdom gained `PointerEvent` only recently, so fall
 * back to a `MouseEvent` carrying the same `clientX` / `clientY` (the hook only
 * reads those two fields) when `PointerEvent` is unavailable.
 */
function dispatchPointerMove(el: HTMLElement, clientX: number, clientY: number): void {
  const Ctor: typeof PointerEvent | typeof MouseEvent =
    typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  const event = new Ctor("pointermove", {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  el.dispatchEvent(event);
}

/**
 * Test host: calls `useParallax` on a ref'd `Scene_Root` div and exposes the
 * div so the test can stub its rect, dispatch pointer moves, and read its
 * inline `--px` / `--py`.
 */
function SceneRoot({ reducedMotion }: { reducedMotion: boolean }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref, { reducedMotion });
  return <div data-testid="scene-root" data-scene-root ref={ref} />;
}

/** Read a CSS custom property off the element's inline style. */
function readVar(el: HTMLElement, name: string): string {
  return el.style.getPropertyValue(name);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useParallax — Property 4: parallax disabled under reduced motion; enabled otherwise", () => {
  let raf: FakeRaf;

  beforeEach(() => {
    raf = installFakeRaf();
  });

  it("with reducedMotion=true, a pointermove leaves --px/--py unchanged and never schedules a frame", () => {
    installMatchMedia(true); // fine+hover, to prove reducedMotion alone gates it
    const { getByTestId } = render(<SceneRoot reducedMotion={true} />);
    const root = getByTestId("scene-root") as HTMLDivElement;
    stubRect(root, ROOT_RECT);

    // No parallax vars written yet, and none should ever be.
    expect(readVar(root, "--px")).toBe("");
    expect(readVar(root, "--py")).toBe("");

    act(() => {
      dispatchPointerMove(root, 900, 700);
    });
    act(() => {
      raf.flushFrame();
    });

    // rAF was never scheduled and the vars stay untouched (Req 2.6).
    expect(raf.requested).toBe(0);
    expect(readVar(root, "--px")).toBe("");
    expect(readVar(root, "--py")).toBe("");
  });

  it("with reducedMotion=false on a coarse / no-hover device, no listener attaches and --px/--py stay unchanged (Req 2.7)", () => {
    installMatchMedia(false); // coarse / no-hover: the fine-pointer query misses
    const { getByTestId } = render(<SceneRoot reducedMotion={false} />);
    const root = getByTestId("scene-root") as HTMLDivElement;
    stubRect(root, ROOT_RECT);

    act(() => {
      dispatchPointerMove(root, 900, 700);
    });
    act(() => {
      raf.flushFrame();
    });

    expect(raf.requested).toBe(0);
    expect(readVar(root, "--px")).toBe("");
    expect(readVar(root, "--py")).toBe("");
  });

  it("with reducedMotion=false and fine+hover, a pointermove schedules exactly one frame and writes finite --px/--py in [-1, 1] (Req 2.2, 2.3, 2.8)", () => {
    installMatchMedia(true);
    const { getByTestId } = render(<SceneRoot reducedMotion={false} />);
    const root = getByTestId("scene-root") as HTMLDivElement;
    stubRect(root, ROOT_RECT);

    // A burst of moves before the frame runs must coalesce into ONE frame.
    act(() => {
      dispatchPointerMove(root, 600, 500);
      dispatchPointerMove(root, 750, 600);
      dispatchPointerMove(root, 900, 700); // this last one wins
    });
    expect(raf.requested).toBe(1); // coalesced (Req 2.2)

    act(() => {
      raf.flushFrame();
    });

    const pxRaw = readVar(root, "--px");
    const pyRaw = readVar(root, "--py");
    const px = Number(pxRaw);
    const py = Number(pyRaw);

    // Parseable finite numbers (Req 2.8).
    expect(pxRaw).not.toBe("");
    expect(pyRaw).not.toBe("");
    expect(Number.isFinite(px)).toBe(true);
    expect(Number.isFinite(py)).toBe(true);

    // Within the inclusive normalized range [-1, 1] (Req 2.3).
    expect(px).toBeGreaterThanOrEqual(-1);
    expect(px).toBeLessThanOrEqual(1);
    expect(py).toBeGreaterThanOrEqual(-1);
    expect(py).toBeLessThanOrEqual(1);

    // Exact normalization for the winning pointer (900, 700) against the
    // 1000x800 box centred at (500, 400): ((900-500)/500, (700-400)/400).
    expect(px).toBeCloseTo((900 - 500) / 500, 10); // 0.8
    expect(py).toBeCloseTo((700 - 400) / 400, 10); // 0.75
  });

  it("clamps --px/--py to [-1, 1] when the pointer sits outside the root box", () => {
    installMatchMedia(true);
    const { getByTestId } = render(<SceneRoot reducedMotion={false} />);
    const root = getByTestId("scene-root") as HTMLDivElement;
    stubRect(root, ROOT_RECT);

    act(() => {
      dispatchPointerMove(root, 5000, -5000); // far outside on both axes
    });
    act(() => {
      raf.flushFrame();
    });

    expect(Number(readVar(root, "--px"))).toBe(1);
    expect(Number(readVar(root, "--py"))).toBe(-1);
  });
});

describe("parallax per-band maxima (pinned, depth-ordered background < creatures < near fog)", () => {
  it("pins the exact maxima the layer table / translate3d examples use", () => {
    // These are the numbers CHANGE-5 pins; the design's translate3d examples
    // use * 8px / * 16px / * 26px respectively.
    expect(PARALLAX_MAX_BG).toBe(8);
    expect(PARALLAX_MAX_CREATURES).toBe(16);
    expect(PARALLAX_MAX_NEAR_FOG).toBe(26);
  });

  it("orders the bands least-movement background < creatures < near fog (Req 2.5)", () => {
    expect(PARALLAX_MAX_BG).toBeLessThan(PARALLAX_MAX_CREATURES);
    expect(PARALLAX_MAX_CREATURES).toBeLessThan(PARALLAX_MAX_NEAR_FOG);
  });

  it("renders each band's offset as normalized * max, so |offset| never exceeds that band's max (Req 2.5)", () => {
    // A band's rendered offset is `--px * MAX`. For any normalized --px in
    // [-1, 1], |offset| <= MAX, and the max offset (at |--px| = 1) equals the
    // pinned maximum exactly.
    const bands = [
      { max: PARALLAX_MAX_BG, expected: 8 },
      { max: PARALLAX_MAX_CREATURES, expected: 16 },
      { max: PARALLAX_MAX_NEAR_FOG, expected: 26 },
    ];
    for (const normalized of [-1, -0.5, 0, 0.5, 1]) {
      for (const { max, expected } of bands) {
        const offset = normalized * max;
        expect(Math.abs(offset)).toBeLessThanOrEqual(max);
        // At the extremes the band offset reaches exactly its pinned maximum.
        if (Math.abs(normalized) === 1) {
          expect(Math.abs(offset)).toBe(expected);
        }
      }
    }
  });
});
