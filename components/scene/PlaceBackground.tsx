/**
 * Per-place painted backdrop (presentational, client).
 *
 * Draws one place's painted WebP (`place-sky` / `place-gate` / `place-ground`
 * / `place-crypt`) to cover the viewport with the exact brightness filter the
 * boards pin (sky 0.8, gate 0.85, ground 0.55, crypt 0.7, Req 4.1-4.4), top and
 * bottom dark legibility gradients each spanning ≥15% of the viewport height so
 * the header and pager stay readable over the painting (Req 4.5), and a solid
 * dark fallback fill that is *always* present behind the image so a failed
 * image load still leaves a readable ground with the creatures and header
 * intact (Req 4.6). The whole layer is `pointer-events: none` (Req 7.5).
 *
 * Layer structure (back to front):
 *
 *   1. Solid fallback fill (`--color-night-sky`) — always rendered, so the
 *      scene never shows a broken-image box or a transparent hole (Req 4.6).
 *   2. The `-3%` bleed box — the painted image drawn `object-cover` with the
 *      per-place brightness filter. The bleed makes this element 106% of the
 *      container on each axis; it is the element the background parallax
 *      transform moves later (task 9.x), and the `-3%` inset (≈10.8px per side
 *      at the 360px viewport floor) strictly exceeds `PARALLAX_MAX_BG` (8px) so
 *      a painted edge is never exposed during parallax (CHANGE 5). On image
 *      load error the image is hidden and the fallback fill shows through.
 *   3. The top + bottom dark gradients (each ≥15% viewport height).
 *
 * Task 6.2 nests the Sky `Moon` inside the bleed box so it shares the
 * painting's transform. The component measures its own bleed box (the `-3%`
 * element, *including* the bleed — so the observed width/height are the actual
 * 106% painted-element dimensions, not the viewport) with a `ResizeObserver`,
 * re-measuring on resize, and feeds those as `viewW`/`viewH` plus the
 * `PAINTED_MOON` fractions to `coverRect`. The resulting `cx`/`cy`/`diameter`
 * are in the bleed box's coordinate space, so a `Moon` rendered as a child of
 * that box lands exactly over the painted moon and tracks it through parallax
 * (Background band z 0, `--d: 0.15`). Only the sky place nests the moon; the
 * other places render no nested moon (Req 4.7, 4.8, 4.9, 2.5). The painted
 * image and the gradients consume only `@theme` tokens for color — no
 * hardcoded hex (steering rule).
 *
 * This is a client component because tracking the image `onError` flag (to keep
 * the solid fallback showing) requires client-side state, and the moon
 * placement needs a `ResizeObserver` on the bleed box.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 2.5, 7.5, 9.1
 */

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { coverRect, PAINTED_MOON, type PlaceId } from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";
import DayPalette from "./DayPalette";
import Moon from "./Moon";
import { useTheme } from "./ThemeProvider";

/** Base path for the painted place art under `public/art`. */
const ART_BASE = "/art";

/**
 * Intrinsic pixel dimensions of `place-sky.webp`, read from the file's WebP
 * header (lossy VP8: 1536×1024). `coverRect` needs the painting's native size
 * to compute the cover scale that maps `PAINTED_MOON`'s image fractions into
 * the on-screen bleed box. These are the *image's* dimensions, independent of
 * however the image is displayed, so they are a safe constant. If the sky art
 * is ever re-exported at a different size, update these two numbers.
 */
const PLACE_SKY_INTRINSIC = { width: 1536, height: 1024 };

/**
 * Per-place painted image basename + exact brightness filter, pinned from the
 * PolishPlaces board (Req 4.1-4.4). The brightness keeps each place dark enough
 * for the creatures and plaques to read while staying within ±0.02 of the
 * board value.
 */
const PLACE_PAINTING: Record<PlaceId, { image: string; brightness: number }> = {
  sky: { image: "place-sky", brightness: 0.8 },
  gate: { image: "place-gate", brightness: 0.85 },
  ground: { image: "place-ground", brightness: 0.55 },
  crypt: { image: "place-crypt", brightness: 0.7 },
};

/**
 * Minimum height of each legibility gradient as a fraction of the viewport
 * height. The board gradient stops at 30%/70%, but the dark bands themselves
 * must each span at least 15% of the viewport height (Req 4.5); 18vh keeps a
 * comfortable margin over that floor.
 */
const GRADIENT_BAND_VH = 18;

/**
 * Gate bleed. The gate adds a 6 px `camera-drift` to the 8 px pointer
 * parallax, so it needs 14 px of overscan; `-4%` is 14.4 px at the 360 px
 * floor (the other places keep `-3%`).
 */
const GATE_BLEED_INSET = "-4%";

/**
 * Gate-only idle drift wrapper (`camera-drift`, 6 px peak, off under reduced
 * motion via the globals.css media block). A decorative sibling layer: it holds
 * no focusable element and no creature. Other places render no wrapper.
 */
function DriftWrap({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }
  return (
    <div
      data-testid="place-background-drift"
      className="camera-drift absolute inset-0"
    >
      {children}
    </div>
  );
}

export interface PlaceBackgroundProps {
  /** Which place's painting to draw (selects the image + brightness). */
  place: PlaceId;
  /**
   * Classified rows the Sky `Moon` derives its health-encoding fill from. Only
   * consulted on the sky place, where the moon is nested inside the bleed box;
   * optional (and ignored) on every other place, which renders no nested moon.
   */
  rows?: GraveyardRow[];
  /**
   * Optional extra content nested *inside* the `-3%` bleed box so it shares the
   * painting's parallax transform.
   */
  children?: ReactNode;
}

export default function PlaceBackground({
  place,
  rows,
  children,
}: PlaceBackgroundProps) {
  const { image, brightness } = PLACE_PAINTING[place];
  // Day: no night plate, no brightness filter and no dark legibility
  // gradients. A warm day palette is drawn from tokens instead.
  const { theme } = useTheme();
  const isDay = theme === "day";
  // When the painted image fails to load we hide it and let the always-present
  // solid fallback fill show through (Req 4.6). We never render a broken-image
  // box, and the creatures + header keep rendering regardless.
  const [imageFailed, setImageFailed] = useState(false);

  // The sky place nests the data `Moon` inside the bleed box so it shares the
  // painting's transform. We measure the bleed box's *own* box (the `-3%`
  // element, so the observed size is the actual 106% painted-element size — not
  // the viewport) with a `ResizeObserver`, feed it to `coverRect`, and position
  // the moon over the painted moon in the box's coordinate space (Req 4.7-4.9,
  // 2.5). Non-sky places skip all of this.
  const isSky = place === "sky";
  const bleedRef = useRef<HTMLDivElement | null>(null);
  const [bleedBox, setBleedBox] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    // Only the sky place needs the measured box, and `ResizeObserver` is a
    // browser-only API — guard SSR and the no-element case.
    if (!isSky) {
      return;
    }
    const el = bleedRef.current;
    if (el === null || typeof ResizeObserver === "undefined") {
      return;
    }

    // Seed from the current box so the first paint after mount already has a
    // measurement, then let the observer deliver every subsequent resize.
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBleedBox((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSky]);

  // Cover-math placement for the Sky `Moon`, in the bleed box's coordinate
  // space. `coverRect` guards a zero box (pre-measurement / SSR) with a
  // centered zero-diameter default, so the moon stays hidden until the box is
  // measured rather than rendering at a bogus position.
  const moonPlacement = isSky
    ? coverRect({
        imageW: PLACE_SKY_INTRINSIC.width,
        imageH: PLACE_SKY_INTRINSIC.height,
        viewW: bleedBox.width,
        viewH: bleedBox.height,
        fx: PAINTED_MOON.fx,
        fy: PAINTED_MOON.fy,
        diamFrac: PAINTED_MOON.diamFrac,
      })
    : null;

  return (
    <div
      aria-hidden="true"
      data-testid="place-background"
      data-place={place}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 1. Solid fallback fill — always present behind the painting so a
             failed image load (or SSR before the image paints) still shows a
             dark readable ground (Req 4.6). */}
      <div
        data-testid="place-background-fallback"
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-night-sky)" }}
      />

      {/* 2. The `-3%` bleed box: the painted image drawn object-cover with the
             per-place brightness filter. This 106%-sized element is what the
             background parallax transform moves later (bleed ≈10.8px > 8px max
             offset at the 360px floor, CHANGE 5). The Sky `Moon` (task 6.2)
             nests here so it shares this transform. */}
      <DriftWrap enabled={place === "gate"}>
      <div
        ref={bleedRef}
        data-testid="place-background-bleed"
        className="absolute"
        style={{
          inset: place === "gate" ? GATE_BLEED_INSET : "-3%",
          filter: isDay ? "none" : `brightness(${brightness})`,
        }}
      >
        {isDay && (
          <DayPalette variant={place === "sky" ? "sky" : place === "crypt" ? "meadow" : "full"} />
        )}
        {!isDay && !imageFailed && (
          <Image
            src={`${ART_BASE}/${image}.webp`}
            alt=""
            aria-hidden
            fill
            priority
            draggable={false}
            sizes="100vw"
            className="select-none object-cover"
            onError={() => setImageFailed(true)}
          />
        )}
        {/* Sky data moon: nested inside the bleed box (Background band z 0,
            `--d: 0.15`) so it shares the painting's transform and stays locked
            over the painted moon through parallax. Positioned by `coverRect`
            from the measured box; hidden until measured (diameter 0). Its
            health-encoding fill stays distinct from the painted moon beneath it
            (Req 4.9). */}
        {isSky && moonPlacement !== null && moonPlacement.diameter > 0 && (
          <Moon rows={rows ?? []} placement={moonPlacement} />
        )}
        {children}
      </div>
      </DriftWrap>

      {/* 3. Top + bottom dark legibility gradients, each ≥15% of viewport
             height, so the header and pager read over the painting (Req 4.5).
             Token-based colors only — no hardcoded hex. */}
      {!isDay && (
      <>
      <div
        data-testid="place-background-gradient-top"
        className="absolute inset-x-0 top-0"
        style={{
          height: `${GRADIENT_BAND_VH}vh`,
          backgroundImage: `linear-gradient(to bottom, ${
            place === "gate"
              ? "var(--color-night-cover-top-gate)"
              : "var(--color-night-cover-top)"
          }, transparent)`,
        }}
      />
      <div
        data-testid="place-background-gradient-bottom"
        className="absolute inset-x-0 bottom-0"
        style={{
          height: `${GRADIENT_BAND_VH}vh`,
          backgroundImage:
            "linear-gradient(to top, var(--color-night-cover-bottom), transparent)",
        }}
      />
      </>
      )}
    </div>
  );
}
