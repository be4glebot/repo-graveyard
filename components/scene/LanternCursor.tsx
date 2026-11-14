"use client";

/**
 * Lights-off lantern cursor overlay (client-only).
 *
 * The default readable mode is lights-OFF: the scene is dimmed to ~45–55% of
 * full brightness everywhere EXCEPT a ~300px warm pool of light that follows
 * the pointer (or the focused creature), where the scene reads at full
 * brightness plus a faint warm tint. This overlay paints that effect and
 * nothing else — it is a `pointer-events: none` layer in the lantern band
 * (z 35), BELOW all chrome (header / chips / pager at z 40+), so it dims only
 * the scene and creatures and never the controls (Req 3.1, 3.8, 7.5).
 *
 * How it works:
 *
 *   - **Lights-on → nothing.** When `theme` is "day" the component renders
 *     `null`: no lantern, no vignette (Req 3.7).
 *   - **Lantern vs static vignette** is chosen by the SAME media query the
 *     parallax hook uses, `(hover: hover) and (pointer: fine)`. A fine pointer
 *     with hover gets the pointer-following lantern; a coarse / no-hover device
 *     (touch) gets a single static soft vignette instead, since there is no
 *     hovering pointer to track (Req 3.6).
 *   - **The lantern** is a full-cover layer whose background is a PLAIN
 *     `radial-gradient` centred on two CSS vars `--lx` / `--ly` (written
 *     imperatively). It goes from a transparent warm centre inside ~300px to
 *     roughly `rgba(0,0,0,0.5)` outside, so the scene inside the pool reads at
 *     full brightness (plus a faint warm tint) while the scene outside is
 *     dimmed to ~45–55%. The dimming is achieved PURELY by the ~0.5-alpha black
 *     of the gradient — there is **no** `mix-blend-mode` (Req 3.1).
 *   - **Pointer tracking (Req 3.2).** A `pointermove` listener reuses the same
 *     rAF-coalescing strategy as `useParallax`: it stashes the latest event and
 *     schedules exactly one `requestAnimationFrame` tick, which writes `--lx` /
 *     `--ly` in pixels relative to the overlay box. A burst of moves collapses
 *     into one write, and the light follows well within 100ms.
 *   - **Pointer leave (eases home).** On `pointerleave` of the scene root the
 *     light centre eases smoothly back to the scene centre: `--lx` / `--ly`
 *     transition back to `50%` / `50%` via a CSS transition on those vars,
 *     rather than being left where the pointer exited.
 *   - **Keyboard focus (Req 3.4).** A `focusin` listener reads the focused
 *     creature's `getBoundingClientRect()` centre and writes it to `--lx` /
 *     `--ly`, moving the pool to the focused creature.
 *   - **Flicker (Req 3.3 / 3.5).** When `reducedMotion` is inactive the overlay
 *     carries the `.lantern-flicker` class (a ≤±10% opacity loop defined in
 *     `app/globals.css`). When `reducedMotion` is active the class is omitted
 *     and the light holds steady.
 *
 * SSR / teardown: `window`, `matchMedia`, and `requestAnimationFrame` are all
 * guarded so the component renders inert during SSR (and on hosts missing any
 * of them, where it falls back to the static vignette). Listeners and any
 * pending frame are cleaned up on unmount.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 7.5
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Theme } from "@/lib/theme-art";

export interface LanternCursorProps {
  /**
   * The scene theme. In `"day"` the overlay renders nothing — no lantern, no
   * vignette (Req 3.7).
   */
  theme: Theme;
  /**
   * Mirror of `SceneView`'s reduced-motion state. When `true` the lantern holds
   * steady (no flicker, Req 3.5); when `false` the `.lantern-flicker` loop runs
   * (Req 3.3).
   */
  reducedMotion: boolean;
}

/** The media query gating the pointer-following lantern: a fine pointer with
 *  hover. Identical to the query `useParallax` uses, so fine+hover devices get
 *  lantern + parallax while coarse / no-hover devices get the static vignette
 *  (Req 3.6). */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * The warm light radius, in pixels (Req 3.1: 300px ±30px). The gradient reads
 * as transparent (full brightness) out to roughly this radius, then ramps to
 * ~0.5-alpha black beyond it.
 */
const LANTERN_RADIUS_PX = 300;

export default function LanternCursor({
  theme,
  reducedMotion,
}: LanternCursorProps) {
  const isDay = theme === "day";
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Pointer capability is read on the client only (after mount) so the first
  // server/client paint matches: we start as "not fine" (the static vignette,
  // the universally-safe default) and upgrade to the lantern once we know the
  // device has a fine pointer with hover. We also re-subscribe to the media
  // query so a change (e.g. attaching a mouse) flips modes live.
  const [isFinePointer, setIsFinePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(FINE_POINTER_QUERY);
    const sync = () => setIsFinePointer(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Pointer / focus tracking: only runs for the active lantern (lights-off +
  // fine pointer). Writes `--lx` / `--ly` imperatively via a coalesced rAF tick
  // and eases home on pointerleave. No React state is touched per frame.
  useEffect(() => {
    // Nothing to track when the overlay is absent (lights-on) or when we're in
    // static-vignette mode (coarse / no-hover).
    if (isDay || !isFinePointer) {
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      return;
    }
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    // The scene root is the overlay's offset parent (the Scene_Root the lantern
    // lives in); pointer / focus events are observed there so a leave fires when
    // the pointer exits the scene, and focus moves follow creatures in it.
    const root = overlay.parentElement;
    if (!root) {
      return;
    }

    let pending: PointerEvent | null = null;
    let frame = 0;

    // Write the light centre in pixels relative to the overlay's own box, so
    // the gradient's `--lx` / `--ly` land under the pointer regardless of where
    // the scene sits on the page.
    const writeCentre = (clientX: number, clientY: number): void => {
      const rect = overlay.getBoundingClientRect();
      overlay.style.setProperty("--lx", `${clientX - rect.left}px`);
      overlay.style.setProperty("--ly", `${clientY - rect.top}px`);
    };

    // Coalesced rAF tick: a burst of pointermoves collapses into one write.
    const tick = (): void => {
      frame = 0;
      const event = pending;
      pending = null;
      if (!event) {
        return;
      }
      // Leaving the scene clears the eased-home transition suppression so the
      // CSS transition on `--lx` / `--ly` animates back to centre.
      writeCentre(event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent): void => {
      pending = event;
      if (frame === 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    // Ease the light back to the scene centre when the pointer exits. Clearing
    // `--lx` / `--ly` lets them fall back to their CSS defaults (50% / 50%); the
    // CSS transition on those vars animates the move home.
    const onPointerLeave = (): void => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      pending = null;
      overlay.style.setProperty("--lx", "50%");
      overlay.style.setProperty("--ly", "50%");
    };

    // Keyboard focus moves the pool to the focused creature's bounding-box
    // centre (Req 3.4). We follow any focused element inside the scene root; the
    // creatures are the focusable targets in the scene.
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) {
        return;
      }
      writeCentre(rect.left + rect.width / 2, rect.top + rect.height / 2);
    };

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);

    return () => {
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      pending = null;
    };
  }, [isDay, isFinePointer]);

  // Day: no lantern, no vignette (Req 3.7).
  if (isDay) {
    return null;
  }

  // Coarse / no-hover (or SSR): a single static soft vignette — no pointer
  // tracking, since there is no hovering pointer to follow (Req 3.6). The
  // vignette dims the edges toward ~45–55% with the same ~0.5-alpha black, and
  // is pointer-events-none like the lantern.
  if (!isFinePointer) {
    return (
      <div
        aria-hidden="true"
        data-testid="lantern-vignette"
        className="pointer-events-none absolute inset-0 z-[35]"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, transparent 0%, transparent 45%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    );
  }

  // Lights-off + fine pointer: the pointer-following lantern. A PLAIN
  // radial-gradient centred on `--lx` / `--ly` (defaulting to the scene centre),
  // transparent warm centre out to ~300px, ramping to ~0.5-alpha black outside.
  // No `mix-blend-mode` (Req 3.1). `--lx` / `--ly` transition so pointerleave
  // eases the light home. The `.lantern-flicker` class runs only when motion is
  // allowed (Req 3.3 / 3.5).
  const lanternStyle: CSSProperties = {
    // Defaults so the first paint (before any pointermove) and the eased-home
    // state both centre the pool.
    ["--lx" as string]: "50%",
    ["--ly" as string]: "50%",
    background: `radial-gradient(circle ${LANTERN_RADIUS_PX}px at var(--lx) var(--ly), rgba(255,214,150,0.08) 0%, rgba(255,214,150,0.04) 55%, transparent 72%, rgba(0,0,0,0.5) 100%)`,
    // Ease the light centre home on pointerleave (Req: eases back to 50%/50%).
    transition: "--lx 320ms ease-out, --ly 320ms ease-out",
  };

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      data-testid="lantern-cursor"
      className={`pointer-events-none absolute inset-0 z-[35]${
        reducedMotion ? "" : " lantern-flicker"
      }`}
      style={lanternStyle}
    />
  );
}
