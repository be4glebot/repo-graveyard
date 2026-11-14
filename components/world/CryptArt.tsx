/**
 * CryptArt: the painted art of the Crypt (design: The Crypt composition, Plate
 * and Crop table, ambient brightness).
 *
 * Three families of clipped bands, all `aria-hidden` and `inert`:
 *  - background (rate 0.88): ONE `place-crypt` Crop per Stratum (entry,
 *    chamber-1 warm, chamber-2 flipped and cool at brightness 0.85, chamber-3
 *    offset 25 percent at brightness 0.7; later chambers alternate flip and
 *    offset) with blend-zone fades;
 *  - mid-ground (rate 0.94): the entry's arch silhouette and stair steps (CSS
 *    gradients), wall-torch glow in the chambers, and `EnvMist` as dust at the
 *    crypt token (0.15);
 *  - foreground (rate 1.12): dark rail edge pieces at the entry, a
 *    chain-shadow gradient in chamber 1.
 *
 * Stair and arch Blend_Zones are CSS gradients. One ambient-darkness overlay
 * spans the stage with opacity `1 - ambientBrightness(depth)`, driven by
 * `--world-depth` through `.crypt-darkness` (opacity only, never below 0.8
 * brightness). Nothing here is focusable or an ancestor of a Creature.
 *
 * Requirements: 9.2, 9.4, 9.6, 9.10, 18.2, 19.5, 19.7, 19.8
 */
import type { CSSProperties } from "react";

import {
  WORLD_ART,
  bleedPx,
  type WorldCropSpec,
} from "@/lib/world-art";
import { effectProps } from "@/lib/world-effects";
import type { Theme } from "@/lib/theme-art";
import DayPalette from "@/components/scene/DayPalette";
import { ambientBrightness } from "@/lib/world-motion";
import { WORLD_CONFIG, bottomTailPx, type Stratum, type WorldLayout } from "@/lib/world-layout";

import CropLayer from "./CropLayer";
import EnvMist from "./EnvMist";

/** Band rates and pointer maxima (globals.css `.world-band-bg|mid|fg`). */
const RATE_BG = 0.88;
const POINTER_BG = 8;

/** Largest darkness opacity: `1 - ambientBrightness(1)`, i.e. 0.2 or less. */
export const CRYPT_DARKNESS_MAX = 1 - ambientBrightness(1);

export interface CryptArtProps {
  layout: WorldLayout;
  viewportW: number;
  reducedMotion?: boolean;
  /** Art theme (default night). Day draws the day palette and no gothic decor. */
  theme?: Theme;
}

/**
 * Crop spec for a crypt stratum id. Chambers past the third alternate between
 * the flipped cool Crop and an offset Crop, so neighbours always differ (Req 19.5).
 */
export function cryptSpecFor(id: string): WorldCropSpec {
  const table = WORLD_ART.crypt;
  const byId = (k: string): WorldCropSpec =>
    table.find((c) => c.stratumId === k) ?? table[0];
  if (id === "entry" || id === "chamber-1" || id === "chamber-2" || id === "chamber-3") {
    return byId(id);
  }
  const m = /^chamber-(\d+)$/.exec(id);
  if (!m) return byId("chamber-1");
  const n = Number(m[1]);
  if (n % 2 === 0) {
    return { ...byId("chamber-2"), stratumId: id, offset: { x: -0.25, y: 0 } };
  }
  return { ...byId("chamber-3"), stratumId: id, offset: { x: 0.5, y: 0 } };
}

export interface CryptBandGeometry {
  stratum: Stratum;
  index: number;
  spec: WorldCropSpec;
  /** Wrapper top and height on the stage (extended into the Blend_Zones). */
  top: number;
  height: number;
  fadeTop: number;
  fadeBottom: number;
}

export function cryptBandGeometry(layout: WorldLayout): CryptBandGeometry[] {
  const last = layout.strata.length - 1;
  const fallbackBlend = WORLD_CONFIG.BLEND_VH * layout.viewportH;
  const blendAt = (boundary: number): number =>
    layout.blendZones.find((z) => Math.abs(z.y + z.height / 2 - boundary) < 1)
      ?.height ?? fallbackBlend;
  const tail = bottomTailPx(layout.strata, layout.viewportH);
  return layout.strata.map((stratum, index) => {
    const fadeTop = index > 0 ? blendAt(stratum.top) : 0;
    const fadeBottom = index < last ? blendAt(stratum.bottom) : 0;
    return {
      stratum,
      index,
      spec: cryptSpecFor(stratum.id),
      top: stratum.top - fadeTop / 2,
      height:
        stratum.bottom - stratum.top + fadeTop / 2 + fadeBottom / 2 + (index === last ? tail : 0),
      fadeTop,
      fadeBottom,
    };
  });
}

function bleedFor(
  layout: WorldLayout,
  height: number,
  fade: number,
  rate: number,
  pointer: number,
  reduced: boolean,
): { x: number; y: number } {
  return bleedPx({
    viewportH: layout.viewportH,
    stratumH: height,
    blendH: fade,
    rate,
    maxPointer: pointer,
    drift: 0,
    reduced,
  });
}

function bandMask(fadeTop: number, fadeBottom: number): string | undefined {
  if (fadeTop <= 0 && fadeBottom <= 0) return undefined;
  const stops = [
    fadeTop > 0 ? `transparent 0, black ${fadeTop}px` : "black 0",
    fadeBottom > 0 ? `black calc(100% - ${fadeBottom}px), transparent 100%` : "black 100%",
  ];
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

/** Tint overlay: warm (torch) or cool (ghost light), a low-alpha colour wash. */
function tintBackground(tint: WorldCropSpec["tint"]): string | undefined {
  if (tint === "warm") {
    return "linear-gradient(color-mix(in srgb, var(--color-candle-400) 14%, transparent), color-mix(in srgb, var(--color-candle-400) 14%, transparent))";
  }
  if (tint === "cool") {
    return "linear-gradient(color-mix(in srgb, var(--color-ghost-300) 10%, transparent), color-mix(in srgb, var(--color-ghost-300) 10%, transparent))";
  }
  return undefined;
}

/** Stair treads: thin faint seams, then a gentle darkening ramp. */
export const STAIR_STEPS =
  "repeating-linear-gradient(to bottom, transparent 0, transparent 16px, color-mix(in srgb, var(--color-night-sky) 22%, transparent) 16px, color-mix(in srgb, var(--color-night-sky) 22%, transparent) 18px), linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-night-sky) 35%, transparent) 50%, transparent)";

/**
 * Stair mask: the treads form one staircase confined to the middle of the
 * entry (soft sides, at most `CRYPT_STAIR_SPAN_PCT` of the width), never a
 * full-width line, plus a vertical fade so they dissolve before the band's
 * bottom edge instead of stopping on a hard line (Blend_Zone seam).
 */
export const CRYPT_STAIR_SPAN_PCT = 44;
export const STAIR_MASK =
  "linear-gradient(to right, transparent 22%, black 36%, black 64%, transparent 78%), linear-gradient(to bottom, black 0, black 40%, transparent 85%)";

/** Blend_Zone overlay mask: both ends dissolve so the overlay never stops on a line. */
const ZONE_MASK =
  "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)";

/** Peak strength of the Blend_Zone darkening overlay (kept low: it is a seam, not a band). */
export const CRYPT_ZONE_OPACITY = 0.18;

/**
 * Mask for a crypt background band. A band only fades IN at its top: the band
 * above stays fully opaque underneath (extended past the join), so the two
 * plates cross-fade linearly. Fading both bands out and in at once would let
 * the night colour show through the middle of the join (a dark bar).
 */
export function cryptBackgroundMask(fadeTop: number): string | undefined {
  return bandMask(fadeTop, 0);
}

/** Arch silhouette: a dark mass with an elliptical opening. */
const ARCH_SILHOUETTE =
  "radial-gradient(ellipse 34% 100% at 50% 100%, transparent 0, transparent 92%, color-mix(in srgb, var(--color-night-sky) 60%, transparent) 100%)";

function blendBackground(kind: string): string {
  if (kind === "stairs") {
    // No tread lines here: the zone spans the full width, so lines would read
    // as a hard seam. The treads live in the entry's confined staircase.
    return "linear-gradient(to bottom, transparent, var(--color-night-sky), transparent)";
  }
  if (kind === "arch") {
    return `${ARCH_SILHOUETTE}, linear-gradient(to bottom, transparent, var(--color-night-sky), transparent)`;
  }
  return "linear-gradient(to bottom, transparent, var(--color-night-sky), transparent)";
}

/** Torch positions as percent of the band width (left wall first, the key light). */
const TORCHES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 10, y: 22 },
  { x: 90, y: 30 },
];

const TORCH_SIZE = 140;

export default function CryptArt({
  layout,
  viewportW,
  reducedMotion = false,
  theme = "night",
}: CryptArtProps) {
  const isDay = theme === "day";
  const w = Math.max(1, viewportW);
  const bands = cryptBandGeometry(layout);
  const lastIndex = bands.length - 1;

  return (
    <>
      {/* Background: one place-crypt Crop per Stratum. */}
      {bands.map((band) => {
        const { stratum, spec } = band;
        const bleed = bleedFor(
          layout,
          band.height,
          Math.max(band.fadeTop, band.fadeBottom),
          RATE_BG,
          POINTER_BG,
          reducedMotion,
        );
        const element = { w: w + 2 * bleed.x, h: band.height + 2 * bleed.y };
        const mask = cryptBackgroundMask(band.fadeTop);
        const tint = tintBackground(spec.tint);
        return (
          <div
            key={`crypt-bg-${stratum.id}`}
            data-testid="crypt-band"
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
              <DayPalette variant="meadow" />
            ) : (
            <CropLayer
              data-testid="crypt-crop"
              data-place="crypt"
              plate={spec.plate}
              element={element}
              focal={spec.focal}
              anchor={spec.anchor}
              flip={spec.flip}
              offset={spec.offset}
              filter={spec.filter}
              className="pointer-events-none absolute overflow-clip"
              style={{
                left: -bleed.x,
                top: -bleed.y,
                width: element.w,
                height: element.h,
              }}
            />
            )}
            {tint && !isDay ? (
              <div
                data-testid="crypt-tint"
                data-tint={spec.tint}
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: tint }}
              />
            ) : null}
          </div>
        );
      })}

      {(isDay ? [] : layout.blendZones).map((z, i) => (
        <div
          key={`crypt-blend-${i}`}
          data-blend-zone={z.kind}
          data-decor-clip=""
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-x-0 z-[2]"
          style={{
            top: z.y,
            height: z.height,
            opacity: CRYPT_ZONE_OPACITY,
            backgroundImage: blendBackground(z.kind),
            maskImage: ZONE_MASK,
            WebkitMaskImage: ZONE_MASK,
          }}
        />
      ))}

      {/* Mid-ground: arch and steps at the entry, torch glow, dust. */}
      {bands.map((band) => {
        const { stratum, index } = band;
        const isEntry = index === 0;
        const isChamber = !isEntry;
        const isLast = index === lastIndex;
        return (
          <div
            key={`crypt-mid-${stratum.id}`}
            data-testid="crypt-mid-band"
            data-stratum={stratum.id}
            data-decor-clip=""
            aria-hidden="true"
            inert
            className="world-band world-band-mid pointer-events-none z-[5] overflow-clip"
            style={
              {
                top: band.top,
                height: band.height,
                "--band-anchor": stratum.top,
                maskImage: bandMask(band.fadeTop, band.fadeBottom),
                WebkitMaskImage: bandMask(band.fadeTop, band.fadeBottom),
              } as CSSProperties
            }
          >
            {isEntry && !isDay ? (
              <>
                <div
                  data-testid="crypt-arch"
                  className="pointer-events-none absolute inset-x-0 top-0"
                  style={{
                    height: "62%",
                    backgroundImage: ARCH_SILHOUETTE,
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div
                  data-testid="crypt-stairs"
                  className="pointer-events-none absolute inset-x-0 bottom-0"
                  style={{
                    height: "38%",
                    backgroundImage: STAIR_STEPS,
                    maskImage: STAIR_MASK,
                    WebkitMaskImage: STAIR_MASK,
                    maskComposite: "intersect",
                    WebkitMaskComposite: "source-in",
                  }}
                />
              </>
            ) : null}

            {isChamber && !isDay
              ? TORCHES.map((t, k) => (
                  <div
                    key={`torch-${k}`}
                    data-testid="crypt-torch"
                    className="pointer-events-none absolute"
                    style={{
                      left: `calc(${t.x}% - ${TORCH_SIZE / 2}px)`,
                      top: `calc(${t.y}% - ${TORCH_SIZE / 2}px)`,
                      width: TORCH_SIZE,
                      height: TORCH_SIZE,
                    }}
                  >
                    <div
                      {...effectProps("torch-flicker")}
                      className={`absolute inset-0 ${reducedMotion ? "" : "lantern-flicker"}`.trim()}
                      style={{
                        backgroundImage:
                          "radial-gradient(circle, var(--light-crypt-glow) 0, var(--light-crypt-glow) 18%, transparent 70%)",
                        opacity: 0.8,
                      }}
                    />
                  </div>
                ))
              : null}

            <div
              data-testid="crypt-dust"
              {...effectProps("crypt-dust")}
              data-place="crypt"
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ height: Math.min(band.height, 420) }}
            >
              <EnvMist place="crypt" layer="far" reducedMotion={reducedMotion} />
              {isLast ? (
                <EnvMist place="crypt" layer="near" reducedMotion={reducedMotion} />
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Ambient darkness: opacity = 1 - ambientBrightness(depth), scroll-linked. */}
      {isDay ? null : (
      <div
        data-testid="crypt-darkness"
        {...effectProps("chamber-darkness")}
        data-max-opacity={CRYPT_DARKNESS_MAX}
        data-decor-clip=""
        aria-hidden="true"
        inert
        className="crypt-darkness pointer-events-none absolute inset-x-0 top-0 z-[12]"
        style={{
          height: layout.heightPx,
          backgroundColor: "var(--color-night-sky)",
        }}
      />
      )}

      {/* Foreground: rail edge pieces (entry), chain shadow (chamber 1). */}
      {bands.map((band) => {
        const { stratum, index } = band;
        const isEntry = index === 0;
        const isChainBand = index === (lastIndex >= 1 ? 1 : 0);
        return (
          <div
            key={`crypt-fg-${stratum.id}`}
            data-testid="crypt-fg-band"
            data-stratum={stratum.id}
            data-decor-clip=""
            aria-hidden="true"
            inert
            className="world-band world-band-fg pointer-events-none z-[15] overflow-clip"
            style={
              {
                top: band.top,
                height: band.height,
                "--band-anchor": stratum.top,
                maskImage: bandMask(band.fadeTop, band.fadeBottom),
                WebkitMaskImage: bandMask(band.fadeTop, band.fadeBottom),
              } as CSSProperties
            }
          >
            {isEntry && !isDay ? (
              <>
                {(["left", "right"] as const).map((side) => (
                  <div
                    key={side}
                    data-testid="crypt-rail"
                    className="pointer-events-none absolute inset-y-0"
                    style={{
                      [side]: 0,
                      width: Math.round(Math.min(72, Math.max(24, 0.05 * w))),
                      backgroundImage: `linear-gradient(to ${side === "left" ? "right" : "left"}, var(--color-iron-900, black) 0, transparent 100%)`,
                      opacity: 0.85,
                    }}
                  />
                ))}
              </>
            ) : null}
            {isChainBand && !isDay ? (
              <>
                {[18, 82].map((x) => (
                  <div
                    key={x}
                    data-testid="crypt-chain-shadow"
                    className="pointer-events-none absolute top-0"
                    style={{
                      left: `${x}%`,
                      width: 8,
                      height: "42%",
                      filter: "blur(2px)",
                      opacity: 0.55,
                      backgroundImage:
                        "repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-night-sky) 55%, transparent) 0, color-mix(in srgb, var(--color-night-sky) 55%, transparent) 10px, transparent 10px, transparent 18px)",
                      maskImage: "linear-gradient(to bottom, black, transparent)",
                      WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
                    }}
                  />
                ))}
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
