/**
 * DOM test for the lights-off lantern cursor overlay
 * (`components/scene/LanternCursor`), task 5.2.
 *
 * `LanternCursor` paints the lights-off dimming effect and nothing else: a
 * `pointer-events: none` layer in the lantern band (z 35, below chrome) whose
 * exact rendering depends on two inputs — the `lightsOn` prop and the device's
 * pointer capability (`matchMedia("(hover: hover) and (pointer: fine)")`):
 *
 *   - **lights-on** → renders `null` (no lantern, no vignette, Req 3.7);
 *   - **lights-off + fine/hover** → the pointer-following lantern
 *     (`data-testid="lantern-cursor"`): a PLAIN `radial-gradient` driven by
 *     `--lx` / `--ly`, with NO `mix-blend-mode` and `pointer-events: none`
 *     (Req 3.1, 3.8); `focusin` on a creature moves the light centre (Req 3.4)
 *     and `pointerleave` eases `--lx` / `--ly` back to `50%` / `50%`;
 *   - **lights-off + coarse/no-hover** → a single static soft vignette
 *     (`data-testid="lantern-vignette"`, Req 3.6).
 *
 * jsdom quirks this test works around:
 *   - `isFinePointer` starts `false` and is synced from `matchMedia` in a mount
 *     effect, so `matchMedia` must be stubbed to the desired capability BEFORE
 *     render and every render / event is wrapped in `act()` so that mount
 *     effect (and any rAF flush) settles before assertions.
 *   - jsdom's `requestAnimationFrame` cannot be advanced deterministically, so
 *     we install a hand-flushed fake rAF queue (`flushFrame`), matching
 *     `tests/dom/Parallax.test.tsx`.
 *   - jsdom has no real layout, so every `getBoundingClientRect()` returns an
 *     all-zero rect; we stub the rects the component reads (the overlay's own
 *     box, and a focused creature's box) so the centre math is exercised.
 *   - The component treats the overlay's `parentElement` as the Scene_Root and
 *     attaches `pointermove` / `pointerleave` / `focusin` THERE, so the host
 *     renders the overlay inside a scene-root div and drives events on it.
 *   - `@testing-library/jest-dom` is not installed, so assertions use plain DOM
 *     / vitest checks, matching the other `tests/dom/*.test.tsx` files.
 *
 * Requirements: 3.2, 3.4, 3.6, 3.7, 3.8, 8.1
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { cleanup, render } from "@testing-library/react";

import LanternCursor from "@/components/scene/LanternCursor";

// ---------------------------------------------------------------------------
// Fake requestAnimationFrame: a hand-flushed queue (same strategy as
// tests/dom/Parallax.test.tsx) so a pointermove's coalesced frame can be run on
// demand.
// ---------------------------------------------------------------------------

interface FakeRaf {
  /** Count of `requestAnimationFrame` calls since install. */
  requested: number;
  /** Run every queued callback once (one "frame"), draining the queue. */
  flushFrame: () => void;
}

function installFakeRaf(): FakeRaf {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  const state: FakeRaf = {
    requested: 0,
    flushFrame: () => {
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
 * The component only reads `.matches` and subscribes to `change`, so a minimal
 * `MediaQueryList` with no-op listener plumbing is enough.
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

/** Build a fixed DOMRect from a top-left origin and size. */
function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    left,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

/** Pin a fixed bounding rect onto a specific element (jsdom has no layout). */
function stubRect(el: HTMLElement, rect: DOMRect): void {
  el.getBoundingClientRect = () => rect;
}

/**
 * A `pointermove` on `el`. jsdom gained `PointerEvent` only recently, so fall
 * back to a `MouseEvent` carrying the same `clientX` / `clientY` (the component
 * only reads those two fields) when `PointerEvent` is unavailable.
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

/** A `pointerleave` on `el`. */
function dispatchPointerLeave(el: HTMLElement): void {
  const Ctor: typeof PointerEvent | typeof MouseEvent =
    typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  el.dispatchEvent(new Ctor("pointerleave", { bubbles: false }));
}

/**
 * Render `LanternCursor` inside a scene-root div that owns it (the component
 * treats the overlay's `parentElement` as the Scene_Root). Returns the root and
 * a cleanup-safe render result. matchMedia must be installed before calling.
 */
function renderInSceneRoot(props: {
  lightsOn: boolean;
  reducedMotion: boolean;
}): { root: HTMLElement } {
  const result = render(
    <div data-testid="scene-root" data-scene-root>
      <LanternCursor {...props} />
    </div>,
  );
  const root = result.getByTestId("scene-root");
  return { root };
}

/** Read a CSS custom property off the element's inline style. */
function readVar(el: HTMLElement, name: string): string {
  return el.style.getPropertyValue(name);
}

let raf: FakeRaf;

beforeEach(() => {
  raf = installFakeRaf();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LanternCursor — lights-on renders nothing (Req 3.7)", () => {
  it("renders neither the lantern nor the vignette when lightsOn is true, even on a fine pointer", () => {
    installMatchMedia(true); // fine + hover, to prove lightsOn alone suppresses it
    let container: HTMLElement;
    act(() => {
      const result = render(<LanternCursor lightsOn={true} reducedMotion={false} />);
      container = result.container;
    });
    // No overlay element of either kind is present.
    expect(container!.querySelector('[data-testid="lantern-cursor"]')).toBeNull();
    expect(container!.querySelector('[data-testid="lantern-vignette"]')).toBeNull();
  });
});

describe("LanternCursor — lights-off + fine/hover renders the lantern overlay (Req 3.1, 3.8)", () => {
  beforeEach(() => {
    installMatchMedia(true);
  });

  it("renders the lantern overlay in the z-35 band (below chrome), pointer-events none, plain radial-gradient with no mix-blend-mode", () => {
    let container: HTMLElement;
    act(() => {
      const result = render(<LanternCursor lightsOn={false} reducedMotion={false} />);
      container = result.container;
    });

    const overlay = container!.querySelector(
      '[data-testid="lantern-cursor"]',
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    const el = overlay!;

    // In the lantern band (z 35) BELOW chrome (header / chips / pager at z 40+).
    expect(el.className).toContain("z-[35]");

    // Never intercepts pointer clicks or keyboard focus (Req 3.8): both the
    // utility class and the resolved inline/computed pointer-events agree.
    expect(el.className).toContain("pointer-events-none");

    // Background is a PLAIN radial-gradient (Req 3.1) ...
    expect(el.style.background).toContain("radial-gradient");
    // ... and carries NO mix-blend-mode anywhere (Req 3.1).
    expect(el.style.mixBlendMode === "" || el.style.mixBlendMode === "normal").toBe(true);
    expect(el.getAttribute("style") ?? "").not.toContain("mix-blend-mode");
  });

  it("applies the flicker class only when reducedMotion is inactive (Req 3.3 / 3.5)", () => {
    // Motion allowed → flicker loop present.
    let moving: HTMLElement;
    act(() => {
      const result = render(<LanternCursor lightsOn={false} reducedMotion={false} />);
      moving = result.container;
    });
    const movingOverlay = moving!.querySelector(
      '[data-testid="lantern-cursor"]',
    ) as HTMLElement;
    expect(movingOverlay.className).toContain("lantern-flicker");
    cleanup();

    // Reduced motion → held steady, no flicker class.
    let steady: HTMLElement;
    act(() => {
      const result = render(<LanternCursor lightsOn={false} reducedMotion={true} />);
      steady = result.container;
    });
    const steadyOverlay = steady!.querySelector(
      '[data-testid="lantern-cursor"]',
    ) as HTMLElement;
    expect(steadyOverlay.className).not.toContain("lantern-flicker");
  });
});

describe("LanternCursor — coarse / no-hover renders the static vignette (Req 3.6)", () => {
  beforeEach(() => {
    installMatchMedia(false); // coarse / no-hover: the fine-pointer query misses
  });

  it("renders the static vignette (not the lantern) with pointer-events none and a plain radial-gradient, no mix-blend-mode", () => {
    let container: HTMLElement;
    act(() => {
      const result = render(<LanternCursor lightsOn={false} reducedMotion={false} />);
      container = result.container;
    });

    // The pointer-following lantern is absent; the static vignette is present.
    expect(container!.querySelector('[data-testid="lantern-cursor"]')).toBeNull();
    const vignette = container!.querySelector(
      '[data-testid="lantern-vignette"]',
    ) as HTMLElement | null;
    expect(vignette).not.toBeNull();

    const el = vignette!;
    expect(el.className).toContain("z-[35]");
    expect(el.className).toContain("pointer-events-none");
    expect(el.style.background).toContain("radial-gradient");
    expect(el.getAttribute("style") ?? "").not.toContain("mix-blend-mode");
  });
});

describe("LanternCursor — pointer tracking (Req 3.2)", () => {
  beforeEach(() => {
    installMatchMedia(true);
  });

  it("coalesces a pointermove burst into one frame and writes --lx/--ly relative to the overlay box", () => {
    const { root } = renderInSceneRoot({ lightsOn: false, reducedMotion: false });
    const overlay = root.querySelector(
      '[data-testid="lantern-cursor"]',
    ) as HTMLElement;

    // Overlay sits at (100, 50); a pointer at (400, 250) lands at (300, 200)
    // inside the overlay's own coordinate space.
    stubRect(overlay, makeRect(100, 50, 1000, 800));

    act(() => {
      dispatchPointerMove(root, 200, 120);
      dispatchPointerMove(root, 300, 180);
      dispatchPointerMove(root, 400, 250); // last one wins
    });
    // The burst collapses into a single scheduled frame.
    expect(raf.requested).toBe(1);

    act(() => {
      raf.flushFrame();
    });

    expect(readVar(overlay, "--lx")).toBe(`${400 - 100}px`); // 300px
    expect(readVar(overlay, "--ly")).toBe(`${250 - 50}px`); // 200px
  });
});

describe("LanternCursor — focusin moves the light centre (Req 3.4)", () => {
  beforeEach(() => {
    installMatchMedia(true);
  });

  it("writes --lx/--ly to the focused creature's bounding-box centre (relative to the overlay box)", () => {
    const { root } = renderInSceneRoot({ lightsOn: false, reducedMotion: false });
    const overlay = root.querySelector(
      '[data-testid="lantern-cursor"]',
    ) as HTMLElement;

    // Overlay origin at (100, 50).
    stubRect(overlay, makeRect(100, 50, 1000, 800));

    // A focusable creature whose box centre is at client (500, 350):
    // left 460 + width 80/2, top 330 + height 40/2.
    const creature = document.createElement("button");
    creature.setAttribute("data-testid", "creature");
    root.appendChild(creature);
    stubRect(creature, makeRect(460, 330, 80, 40));

    act(() => {
      creature.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    // Centre (500, 350) mapped into the overlay box at (100, 50): (400, 300).
    expect(readVar(overlay, "--lx")).toBe(`${500 - 100}px`); // 400px
    expect(readVar(overlay, "--ly")).toBe(`${350 - 50}px`); // 300px
  });
});

describe("LanternCursor — pointerleave eases the light home (Req: back to 50%/50%)", () => {
  beforeEach(() => {
    installMatchMedia(true);
  });

  it("resets --lx/--ly to 50% / 50% when the pointer leaves the scene root", () => {
    const { root } = renderInSceneRoot({ lightsOn: false, reducedMotion: false });
    const overlay = root.querySelector(
      '[data-testid="lantern-cursor"]',
    ) as HTMLElement;

    stubRect(overlay, makeRect(0, 0, 1000, 800));

    // Move the light off-centre first ...
    act(() => {
      dispatchPointerMove(root, 700, 600);
    });
    act(() => {
      raf.flushFrame();
    });
    expect(readVar(overlay, "--lx")).toBe("700px");
    expect(readVar(overlay, "--ly")).toBe("600px");

    // ... then leave: the centre eases home via the CSS transition on --lx/--ly,
    // which both reset to 50%.
    act(() => {
      dispatchPointerLeave(root);
    });

    expect(readVar(overlay, "--lx")).toBe("50%");
    expect(readVar(overlay, "--ly")).toBe("50%");

    // The transition that animates the move home is present on the vars.
    expect(overlay.style.transition).toContain("--lx");
    expect(overlay.style.transition).toContain("--ly");
  });
});
