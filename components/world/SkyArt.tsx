/**
 * SkyArt: the painted art of the Restless Sky (design: Restless Sky
 * composition, Plate and Crop table).
 *
 * One clipped band wrapper per Stratum, each holding ONE `place-sky` Crop from
 * `WORLD_ART.sky` (high-air moon crop, flipped mid-sky, cloud-bank), a CSS
 * star field (high air and mid-sky only), cloud wisps through `EnvMist` at the
 * sky token, and, in the high-air band only, the data `Moon`. The Moon sits
 * inside the SAME wrapper as the painted moon and is placed with
 * `plateToStage` from the same Crop geometry, so the two move together and
 * stay within 2 px at every Depth_Position (Req 7.6).
 *
 * Adjacent bands overlap by the Blend_Zone height and fade with a vertical
 * mask, so the join is a crossfade, never a cut (Req 19.5-19.8). Every layer is
 * `aria-hidden` and `inert`; the Plate is never repeated or tiled.
 *
 * Requirements: 7.5, 7.6, 7.12, 18.2, 19.1, 19.5, 19.7, 19.8
 */
import type { CSSProperties } from "react";

import Moon from "@/components/scene/Moon";
import { PAINTED_MOON } from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";
import {
  PLATE_SIZE,
  WORLD_ART,
  bleedPx,
  computeCrop,
  plateToStage,
  type CropResult,
  type WorldCropSpec,
} from "@/lib/world-art";
import { effectProps } from "@/lib/world-effects";
import { WORLD_CONFIG, bottomTailPx, type Stratum, type WorldLayout } from "@/lib/world-layout";
import type { Theme } from "@/lib/theme-art";
import DayPalette from "@/components/scene/DayPalette";

import CropLayer from "./CropLayer";
import EnvMist from "./EnvMist";

/** Band rate of the background layer and its pointer maximum (globals.css `.world-band-bg`). */
const BG_RATE = 0.88;
const BG_POINTER_PX = 8;

export interface SkyArtProps {
  layout: WorldLayout;
  /** Classified rows; the Moon derives its health treatment from them. */
  rows: GraveyardRow[];
  viewportW: number;
  reducedMotion?: boolean;
  /** Art theme (default night). Day draws the day palette instead of the plate. */
  theme?: Theme;
}

/** Everything one band needs to render; pure so tests can recompute it. */
export interface SkyBandGeometry {
  stratum: Stratum;
  spec: WorldCropSpec;
  /** Wrapper top and height on the stage (extended into the Blend_Zones). */
  top: number;
  height: number;
  fadeTop: number;
  fadeBottom: number;
  bleed: { x: number; y: number };
  element: { w: number; h: number };
  crop: CropResult;
}

/** Crop spec for a sky stratum id. Extra mid strata vary by flip and offset (Req 19.5). */
export function skySpecFor(id: string): WorldCropSpec {
  const table = WORLD_ART.sky;
  const byId = (k: string): WorldCropSpec =>
    table.find((c) => c.stratumId === k) ?? table[0];
  if (id === "high-air" || id === "cloud-bank" || id === "mid-sky") return byId(id);
  const m = /^mid-sky-(\d+)$/.exec(id);
  if (!m) return byId("mid-sky");
  const n = Number(m[1]);
  const base = byId("mid-sky");
  return {
    ...base,
    stratumId: id,
    flip: { h: n % 2 === 0, v: true },
    offset: { x: n % 2 === 0 ? 0.3 : -0.3, y: 0 },
  };
}

export function skyBandGeometry(
  layout: WorldLayout,
  viewportW: number,
  reducedMotion: boolean,
): SkyBandGeometry[] {
  const w = Math.max(1, viewportW);
  const last = layout.strata.length - 1;
  const fallbackBlend = WORLD_CONFIG.BLEND_VH * layout.viewportH;
  const blendAt = (boundary: number): number =>
    layout.blendZones.find((z) => Math.abs(z.y + z.height / 2 - boundary) < 1)
      ?.height ?? fallbackBlend;

  const tail = bottomTailPx(layout.strata, layout.viewportH);
  return layout.strata.map((stratum, i) => {
    const spec = skySpecFor(stratum.id);
    const blendTop = i > 0 ? blendAt(stratum.top) : 0;
    const blendBottom = i < last ? blendAt(stratum.bottom) : 0;
    const top = stratum.top - blendTop / 2;
    const height =
      stratum.bottom - stratum.top + blendTop / 2 + blendBottom / 2 + (i === last ? tail : 0);
    const bleed = bleedPx({
      viewportH: layout.viewportH,
      stratumH: height,
      blendH: Math.max(blendTop, blendBottom),
      rate: BG_RATE,
      maxPointer: BG_POINTER_PX,
      drift: 0,
      reduced: reducedMotion,
    });
    const element = { w: w + 2 * bleed.x, h: height + 2 * bleed.y };
    const crop = computeCrop({
      plate: PLATE_SIZE[spec.plate],
      element,
      focal: spec.focal,
      anchor: spec.anchor,
      flip: spec.flip,
      offset: spec.offset,
    });
    return {
      stratum,
      spec,
      top,
      height,
      fadeTop: blendTop,
      fadeBottom: blendBottom,
      bleed,
      element,
      crop,
    };
  });
}

/**
 * Wrapper-relative centre and diameter of the painted moon (and so of the data
 * Moon) for a band. Both come from the same Crop.
 */
export function skyMoonPlacement(band: SkyBandGeometry): {
  cx: number;
  cy: number;
  diameter: number;
} {
  const p = plateToStage(band.crop, band.element, PAINTED_MOON.fx, PAINTED_MOON.fy);
  return {
    cx: p.x - band.bleed.x,
    cy: p.y - band.bleed.y,
    diameter: PAINTED_MOON.diamFrac * band.crop.plate.w * band.crop.scale,
  };
}

/** Fixed star dots (percent positions), so the field is deterministic. */
const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [6, 8, 1.2], [14, 22, 1], [22, 12, 1.5], [31, 30, 1], [38, 6, 1.2],
  [45, 18, 1], [52, 34, 1.5], [58, 9, 1], [64, 26, 1.2], [70, 14, 1],
  [84, 7, 1.5], [90, 24, 1], [96, 13, 1.2], [10, 44, 1], [27, 52, 1.2],
  [41, 60, 1], [60, 48, 1], [76, 40, 1.5], [88, 56, 1], [18, 72, 1],
  [48, 78, 1.2], [80, 70, 1], [93, 84, 1.2], [34, 90, 1], [66, 88, 1],
];

const STAR_FIELD: CSSProperties = {
  backgroundImage: STARS.map(
    ([x, y, r]) =>
      `radial-gradient(circle at ${x}% ${y}%, var(--color-moon-100) 0, var(--color-moon-100) ${r}px, transparent ${r + 0.8}px)`,
  ).join(", "),
  backgroundRepeat: "no-repeat",
};

function bandMask(fadeTop: number, fadeBottom: number): string | undefined {
  if (fadeTop <= 0 && fadeBottom <= 0) return undefined;
  const stops = [
    fadeTop > 0 ? `transparent 0, black ${fadeTop}px` : "black 0",
    fadeBottom > 0 ? `black calc(100% - ${fadeBottom}px), transparent 100%` : "black 100%",
  ];
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

export default function SkyArt({
  layout,
  rows,
  viewportW,
  reducedMotion = false,
  theme = "night",
}: SkyArtProps) {
  const isDay = theme === "day";
  const bands = skyBandGeometry(layout, viewportW, reducedMotion);

  return (
    <>
      {bands.map((band) => {
        const { stratum, spec } = band;
        const isHigh = stratum.id === "high-air";
        const isBank = stratum.id === "cloud-bank" && layout.strata.length > 1;
        const starsOpacity = isHigh ? 0.7 : isBank ? 0 : 0.35;
        const mask = bandMask(band.fadeTop, band.fadeBottom);
        const moon = isHigh ? skyMoonPlacement(band) : null;

        return (
          <div
            key={`sky-${stratum.id}`}
            data-testid="sky-band"
            data-stratum={stratum.id}
            data-decor-clip=""
            aria-hidden="true"
            inert
            className="world-band world-band-bg pointer-events-none z-[1] overflow-clip"
            style={
              {
                top: band.top,
                height: band.height,
                "--band-anchor": stratum.top,
                maskImage: mask,
                WebkitMaskImage: mask,
              } as CSSProperties
            }
          >
            {isDay ? (
              <DayPalette variant="sky" />
            ) : (
            <CropLayer
              data-testid="sky-crop"
              data-place="sky"
              plate={spec.plate}
              element={band.element}
              focal={spec.focal}
              anchor={spec.anchor}
              flip={spec.flip}
              offset={spec.offset}
              filter={spec.filter}
              className="pointer-events-none absolute overflow-clip"
              style={{
                left: -band.bleed.x,
                top: -band.bleed.y,
                width: band.element.w,
                height: band.element.h,
              }}
            />
            )}

            {!isDay && starsOpacity > 0 ? (
              <div
                data-testid="sky-stars"
                {...effectProps("star-twinkle")}
                className="pointer-events-none absolute inset-0"
                style={{ ...STAR_FIELD, opacity: starsOpacity }}
              />
            ) : null}

            <div
              data-testid="sky-clouds"
              {...effectProps("cloud-drift")}
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ height: Math.min(band.height, 420) }}
            >
              <EnvMist place="sky" layer="far" reducedMotion={reducedMotion} />
              {isBank ? (
                <EnvMist place="sky" layer="near" reducedMotion={reducedMotion} />
              ) : null}
            </div>

            {isBank && !isDay ? (
              <div
                data-testid="sky-bank-shade"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
                style={{
                  backgroundImage:
                    "linear-gradient(to top, var(--color-night-cover-bottom), transparent)",
                }}
              />
            ) : null}

            {moon ? (
              <div
                data-testid="sky-moon"
                {...effectProps("moon-glow")}
                data-moon-cx={moon.cx}
                data-moon-cy={moon.cy}
                data-moon-diameter={moon.diameter}
              >
                <Moon rows={rows} placement={moon} glowScale={0.5} />
              </div>
            ) : null}
          </div>
        );
      })}

      {layout.blendZones.map((z, i) => (
        <div
          key={`sky-blend-${i}`}
          data-blend-zone={z.kind}
          data-decor-clip=""
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-x-0 z-[2]"
          style={{
            top: z.y,
            height: z.height,
            opacity: 0.3,
            backgroundImage:
              "linear-gradient(to bottom, transparent, var(--color-night-sky), transparent)",
          }}
        />
      ))}
    </>
  );
}
