"use client";

/**
 * Pointer-parallax controller (client-only hook).
 *
 * `useParallax` wires subtle pointer-driven parallax onto a `Scene_Root`
 * element (the estate-map root or a place root) WITHOUT ever touching React
 * state. It writes two CSS custom properties — `--px` and `--py`, each a
 * normalized pointer offset from the root's centre in the inclusive range
 * `[-1, 1]` — directly onto the root element with `style.setProperty`. Layers
 * read those vars purely in CSS (`translate3d(calc(var(--px) * Npx), ...)`),
 * so a `pointermove` never triggers a re-render (Req 2.3, 2.4).
 *
 * How it stays cheap and correct:
 *
 *   - **rAF coalescing (Req 2.2).** A `pointermove` does not write
 *     immediately; it stashes the latest event and, only if no frame is
 *     already pending, schedules exactly one `requestAnimationFrame(tick)`.
 *     Any further moves before that frame runs simply overwrite the stashed
 *     event, so a burst of moves collapses into a single scheduled update.
 *   - **The tick** reads the root's `getBoundingClientRect()`, maps the
 *     pointer to `[-1, 1]` on each axis relative to the root centre, clamps to
 *     the range, and writes `--px` / `--py` (Req 2.3).
 *   - **Gating (Req 2.6, 2.7).** The pointer listener is attached ONLY when
 *     `reducedMotion` is inactive AND the device reports a fine pointer with
 *     hover (`(hover: hover) and (pointer: fine)` — the same query the lantern
 *     uses). When reduced motion is active, or on a coarse / no-hover device,
 *     no listener is attached and no frame is ever scheduled, so `--px` /
 *     `--py` keep whatever values they had (never touched here — the existing
 *     slow idle drift keeps running).
 *   - **SSR / teardown.** `window`, `matchMedia`, and `requestAnimationFrame`
 *     are all guarded so the hook is inert during SSR and on hosts missing any
 *     of them. Cleanup removes the listener and cancels any pending frame.
 *
 * The hook deliberately re-subscribes when `reducedMotion` flips (or on mount)
 * so turning reduced motion off starts parallax and turning it on stops it,
 * matching the media-query-change behaviour of the other scene effects.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { useEffect, type RefObject } from "react";

export interface UseParallaxOptions {
  /**
   * Mirror of `SceneView`'s reduced-motion state. While `true`, pointer
   * parallax is disabled entirely: no listener, no scheduled frame, and
   * `--px` / `--py` are left unchanged (Req 2.6).
   */
  reducedMotion: boolean;
  /**
   * While `true` (a travel transition is running), pointer parallax is paused:
   * no listener is attached, no frame is scheduled, and `--px` / `--py` are
   * RESET to `0` on the root so the zoom origin can't drift mid-transition
   * (visual fix r3 travel). Defaults to `false`.
   */
  paused?: boolean;
}

/** The media query gating pointer parallax: a fine pointer with hover. This is
 *  the same query the lantern uses to choose lantern vs static vignette, so
 *  fine+hover devices get parallax + lantern while coarse / no-hover devices
 *  get the idle drift and the static vignette (Req 2.7). */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Clamp a value into the inclusive `[-1, 1]` range.
 */
function clampUnit(value: number): number {
  if (value < -1) {
    return -1;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * Attach pointer parallax to `rootRef`, writing normalized `--px` / `--py`
 * onto the root element on a coalesced `requestAnimationFrame` tick. No React
 * state is read or written per frame.
 */
export function useParallax(
  rootRef: RefObject<HTMLElement | null>,
  options: UseParallaxOptions,
): void {
  const { reducedMotion, paused = false } = options;

  useEffect(() => {
    // SSR / missing-API guard: do nothing without a DOM, matchMedia, or rAF.
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      return;
    }

    // Paused for a travel transition: attach nothing AND reset the vars to 0 so
    // the zoom transform-origin stays put rather than drifting with a stale
    // pointer offset (visual fix r3 travel).
    if (paused) {
      const root = rootRef.current;
      if (root) {
        root.style.setProperty("--px", "0");
        root.style.setProperty("--py", "0");
      }
      return;
    }

    // Reduced motion disables pointer parallax outright (Req 2.6).
    if (reducedMotion) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    // Only fine+hover pointers get parallax; coarse / no-hover devices keep the
    // existing idle drift and no listener is attached (Req 2.7).
    if (!window.matchMedia(FINE_POINTER_QUERY).matches) {
      return;
    }

    // The latest pointer event awaiting a frame, and the pending rAF handle
    // (`0` means none scheduled). These live in the effect closure so they are
    // per-subscription and never leak into React state.
    let pending: PointerEvent | null = null;
    let frame = 0;

    // The coalesced update: read the root rect, normalize the pointer to
    // [-1, 1] per axis relative to the root centre, clamp, and write the vars
    // (Req 2.3). No setState, so no re-render (Req 2.4).
    const tick = (): void => {
      frame = 0;
      const event = pending;
      pending = null;
      if (!event) {
        return;
      }
      const rect = root.getBoundingClientRect();
      // A zero-area root cannot produce a meaningful offset; leave the vars be.
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Divide by the half-extent so the edges map to ±1, then clamp in case
      // the pointer sits outside the root bounds.
      const px = clampUnit((event.clientX - cx) / (rect.width / 2));
      const py = clampUnit((event.clientY - cy) / (rect.height / 2));
      root.style.setProperty("--px", String(px));
      root.style.setProperty("--py", String(py));
    };

    // Stash the latest event and schedule exactly one frame if none is pending.
    // Further moves before the frame runs overwrite `pending`, collapsing the
    // burst into a single scheduled update (Req 2.2 coalescing).
    const onPointerMove = (event: PointerEvent): void => {
      pending = event;
      if (frame === 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    root.addEventListener("pointermove", onPointerMove);

    return () => {
      root.removeEventListener("pointermove", onPointerMove);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      pending = null;
    };
  }, [rootRef, reducedMotion, paused]);
}

export default useParallax;
