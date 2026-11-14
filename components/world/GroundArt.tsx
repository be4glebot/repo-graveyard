/**
 * GroundArt: the painted art of Hallowed Ground (design: Hallowed Ground
 * composition, Plate and Crop table).
 *
 * Three families of clipped bands, all `aria-hidden` and `inert`:
 *  - background (rate 0.88): ONE `place-ground` Crop per Stratum (gate-path,
 *    flipped grass mid-path, mausoleum-approach) with blend-zone fades;
 *  - mid-ground (rate 0.94): the `mg-fence` gate centerpiece once, with
 *    `mg-fence-tile` repeated horizontally (the ONLY repeat), the CSS path
 *    ribbon (`ceil(H / 90)` radial gradients from the layout `path`), path
 *    lanterns, `mausoleum` once at `H - 0.35 Vh`, and `EnvMist` at the ground
 *    token;
 *  - foreground (rate 1.12): `fg-frame` edge pieces at the left and right edges
 *    and grass tufts as gradients.
 *
 * Requirements: 8.3, 8.4, 8.5, 8.9, 18.2, 19.4, 19.5, 19.7, 19.8
 */
import type { CSSProperties } from "react";

import {
  PLATE_SIZE,
  WORLD_ART,
  bleedPx,
  type WorldCropSpec,
} from "@/lib/world-art";
import { themeArt, themeFilter, type Theme } from "@/lib/theme-art";
import { effectProps } from "@/lib/world-effects";
import { WORLD_CONFIG, bottomTailPx, type Stratum, type WorldLayout } from "@/lib/world-layout";

import CropLayer from "./CropLayer";
import { PerchBirds } from "./DayBirds";
import EnvMist, { mistLayerWidth } from "./EnvMist";

/** Band rates and pointer maxima (globals.css `.world-band-bg|mid|fg`). */
const RATE_BG = 0.88;
const RATE_MID = 0.94;
const RATE_FG = 1.12;
const POINTER_BG = 8;
const POINTER_MID = 16;
const POINTER_FG = 26;

/** Distance between path samples and ribbon stones (matches the layout). */
export const PATH_STONE_PX = 90;

export interface GroundArtProps {
  layout: WorldLayout;
  viewportW: number;
  reducedMotion?: boolean;
  theme?: Theme;
}

/** Crop spec for a ground stratum id. Extra mid strata vary by flip and offset (Req 19.5). */
export function groundSpecFor(id: string): WorldCropSpec {
  const table = WORLD_ART.ground;
  const byId = (k: string): WorldCropSpec =>
    table.find((c) => c.stratumId === k) ?? table[0];
  if (id === "gate-path" || id === "mid-path" || id === "mausoleum-approach") {
    return byId(id);
  }
  const m = /^mid-path-(\d+)$/.exec(id);
  if (!m) return byId("mid-path");
  const n = Math.max(1, Number(m[1]));
  const base = byId("mid-path");
  const k = Math.floor((n - 1) / 2);
  // 0, +0.3, -0.3, +0.6, -0.6 ...: every step is at least 25 percent apart.
  const x = k === 0 ? 0 : k % 2 === 1 ? 0.3 * ((k + 1) / 2) : -0.3 * (k / 2);
  return {
    ...base,
    stratumId: id,
    // Grass region only (focal fy stays >= 0.48), so flips keep one lantern direction.
    flip: { h: n % 2 === 1, v: false },
    offset: { x, y: 0 },
  };
}

export interface GroundBandGeometry {
  stratum: Stratum;
  index: number;
  spec: WorldCropSpec;
  /** Wrapper top and height on the stage (extended into the Blend_Zones). */
  top: number;
  height: number;
  fadeTop: number;
  fadeBottom: number;
}

interface Extents {
  top: number;
  height: number;
  fadeTop: number;
  fadeBottom: number;
}

function extentsFor(layout: WorldLayout): Extents[] {
  const last = layout.strata.length - 1;
  const fallbackBlend = WORLD_CONFIG.BLEND_VH * layout.viewportH;
  const blendAt = (boundary: number): number =>
    layout.blendZones.find((z) => Math.abs(z.y + z.height / 2 - boundary) < 1)
      ?.height ?? fallbackBlend;
  const tail = bottomTailPx(layout.strata, layout.viewportH);
  return layout.strata.map((s, i) => {
    const fadeTop = i > 0 ? blendAt(s.top) : 0;
    const fadeBottom = i < last ? blendAt(s.bottom) : 0;
    return {
      top: s.top - fadeTop / 2,
      height: s.bottom - s.top + fadeTop / 2 + fadeBottom / 2 + (i === last ? tail : 0),
      fadeTop,
      fadeBottom,
    };
  });
}

export function groundBandGeometry(layout: WorldLayout): GroundBandGeometry[] {
  const ext = extentsFor(layout);
  return layout.strata.map((stratum, index) => ({
    stratum,
    index,
    spec: groundSpecFor(stratum.id),
    ...ext[index],
  }));
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

/** Linear interpolation of the path centreline at `y` (total: no path -> centre). */
export function pathXAt(
  path: { x: number; y: number }[] | undefined,
  y: number,
  fallbackX: number,
): number {
  if (!path || path.length === 0) return fallbackX;
  if (y <= path[0].y) return path[0].x;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (y <= b.y) {
      const span = b.y - a.y;
      return span <= 0 ? b.x : a.x + ((b.x - a.x) * (y - a.y)) / span;
    }
  }
  return path[path.length - 1].x;
}

export interface RibbonStone {
  x: number;
  y: number;
}

/** Fence height (px) for a viewport height. */
export function fenceHeightFor(vh: number): number {
  return Math.round(Math.min(260, Math.max(140, 0.28 * vh)));
}

/** Gap between the fence base and the first stone (px). */
const STONE_FENCE_GAP = 12;
/** Gap between the last stone and the mausoleum base (px). */
const STONE_MAUSOLEUM_GAP = 10;

/**
 * The stretch of the stage that may hold path stones: from below the fence
 * (and below the heading clearance, so none sit behind the heading when the
 * world is scrolled to its top) down to just above the mausoleum base.
 */
export function pathSpan(layout: WorldLayout): { top: number; bottom: number } {
  const cfg = layout.compact ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const gate = layout.features.find((f) => f.kind === "entry-gate");
  const gateY = gate?.y ?? 0.25 * layout.viewportH;
  const fenceBottom = gateY + fenceHeightFor(layout.viewportH) / 2;
  const mausoleumY = layout.features
    .filter((f) => f.kind === "mausoleum")
    .reduce((m, f) => Math.max(m, f.y), -Infinity);
  const base = Number.isFinite(mausoleumY)
    ? mausoleumY
    : layout.heightPx - 0.35 * layout.viewportH;
  return {
    top: Math.max(fenceBottom + STONE_FENCE_GAP, cfg.TOP_CLEAR),
    bottom: Math.min(layout.heightPx, base - STONE_MAUSOLEUM_GAP),
  };
}

/**
 * Stones along the layout path every 90 px (Req 8.3), kept inside `pathSpan`:
 * the path starts just below the fence and stops before the mausoleum, so no
 * stone sits on the fence or behind the heading.
 */
export function ribbonStones(layout: WorldLayout, viewportW: number): RibbonStone[] {
  const n = Math.max(1, Math.ceil(layout.heightPx / PATH_STONE_PX));
  const mid = Math.max(1, viewportW) / 2;
  const span = pathSpan(layout);
  return Array.from({ length: n }, (_, i) => {
    const y = i * PATH_STONE_PX;
    return { x: px2(pathXAt(layout.path, y, mid)), y };
  }).filter((s) => s.y >= span.top && s.y <= span.bottom);
}

/** Indices of stones that carry a lantern (at least one whenever stones exist). */
export function lanternIndices(stoneCount: number): number[] {
  if (stoneCount <= 0) return [];
  const out: number[] = [];
  for (let i = 1; i < stoneCount; i += 3) out.push(i);
  if (out.length === 0) out.push(0);
  return out;
}

function stratumIndexAt(layout: WorldLayout, y: number): number {
  const i = layout.strata.findIndex((s) => y >= s.top && y < s.bottom);
  return i >= 0 ? i : Math.max(0, layout.strata.length - 1);
}

function bandMask(fadeTop: number, fadeBottom: number): string | undefined {
  if (fadeTop <= 0 && fadeBottom <= 0) return undefined;
  const stops = [
    fadeTop > 0 ? `transparent 0, black ${fadeTop}px` : "black 0",
    fadeBottom > 0 ? `black calc(100% - ${fadeBottom}px), transparent 100%` : "black 100%",
  ];
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

// Worn flagstones catch the lantern light: tan, not the near-black panel
// stone (which vanished against the grass in the ground visual review).
const STONE_COLOR = "color-mix(in srgb, var(--color-candle-tan) 22%, var(--color-stone-surface-raised))";

/** Round a px coordinate to 2 decimals so inline-style strings are stable. */
export function px2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function stoneGradient(x: number, y: number): string {
  x = px2(x);
  y = px2(y);
  // Flat-ish flagstone: solid core with a short soft rim (not a blurred disc).
  // Top-left lit highlight, tan body, then a dark seam so each slab reads as
  // a set stone rather than a flat pale disc.
  const hi = `radial-gradient(ellipse 18px 6px at ${px2(x - 8)}px ${px2(y - 5)}px, color-mix(in srgb, var(--color-candle-tan) 34%, transparent) 0, transparent 100%)`;
  const body = `radial-gradient(ellipse 36px 15px at ${x}px ${y}px, ${STONE_COLOR} 0, ${STONE_COLOR} 82%, transparent 100%)`;
  const seam = `radial-gradient(ellipse 42px 19px at ${x}px ${px2(y + 2)}px, color-mix(in srgb, var(--color-night-sky) 45%, transparent) 0, color-mix(in srgb, var(--color-night-sky) 45%, transparent) 80%, transparent 100%)`;
  return `${hi}, ${body}, ${seam}`;
}

export default function GroundArt({
  layout,
  viewportW,
  reducedMotion = false,
  theme = "night",
}: GroundArtProps) {
  const w = Math.max(1, viewportW);
  const vh = layout.viewportH;
  // Mist layer: wider than the feathered box plus the +-2 percent sway, so the
  // animated element's own edges never enter the box.
  const mistW = mistLayerWidth(w, true);
  const bands = groundBandGeometry(layout);
  const lastIndex = bands.length - 1;
  const stones = ribbonStones(layout, w);
  const lanterns = new Set(lanternIndices(stones.length));
  // The empty cemetery draws its own path and two lanterns in EmptyScene; the
  // ribbon and lanterns here would paint over its plaque copy.
  const emptyCemetery = layout.slots.length === 0;

  // Landmarks, each rendered ONCE (Req 19.4).
  const gateFeature = layout.features.find((f) => f.kind === "entry-gate");
  const gateY = gateFeature?.y ?? 0.25 * vh;
  const gateIndex = gateFeature
    ? Math.min(Math.max(0, gateFeature.stratum), lastIndex)
    : 0;
  const mausoleumY = layout.features
    .filter((f) => f.kind === "mausoleum")
    .reduce((m, f) => Math.max(m, f.y), -Infinity);
  const mausoleumBase = Number.isFinite(mausoleumY)
    ? mausoleumY
    : layout.heightPx - 0.35 * vh;
  const mausoleumIndex = stratumIndexAt(layout, mausoleumBase);

  const fenceH = fenceHeightFor(vh);
  const gateW = Math.round((fenceH * PLATE_SIZE["mg-fence"].w) / PLATE_SIZE["mg-fence"].h);
  const gateX = pathXAt(layout.path, gateY, w / 2);

  return (
    <>
      {/* Background: one place-ground Crop per Stratum. */}
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
        const mask = bandMask(band.fadeTop, band.fadeBottom);
        return (
          <div
            key={`ground-bg-${stratum.id}`}
            data-testid="ground-band"
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
            <CropLayer
              data-testid="ground-crop"
              data-place="ground"
              plate={spec.plate}
              theme={theme}
              filter={theme === "night" ? spec.filter : themeFilter(theme, "", "--art-filter-ground")}
              element={element}
              focal={spec.focal}
              anchor={spec.anchor}
              flip={spec.flip}
              offset={spec.offset}
              className="pointer-events-none absolute overflow-clip"
              style={{
                left: -bleed.x,
                top: -bleed.y,
                width: element.w,
                height: element.h,
              }}
            />
          </div>
        );
      })}

      {layout.blendZones.map((z, i) => (
        <div
          key={`ground-blend-${i}`}
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

      {/* Mid-ground: fence, path ribbon, lanterns, mausoleum, mist. */}
      {bands.map((band) => {
        const { stratum, index } = band;
        const bleed = bleedFor(
          layout,
          band.height,
          Math.max(band.fadeTop, band.fadeBottom),
          RATE_MID,
          POINTER_MID,
          reducedMotion,
        );
        const inBand = (y: number): boolean =>
          (index === 0 || y >= stratum.top) &&
          (index === lastIndex || y < stratum.bottom);
        const bandStones = stones
          .map((s, i) => ({ ...s, i }))
          .filter((s) => inBand(s.y));
        const rel = (y: number): number => y - band.top;

        const showGate = index === gateIndex;
        // The empty cemetery (no slots) draws its own far mausoleum in
        // EmptyScene; this one would sit centred over its plaque copy.
        const showMausoleum = index === mausoleumIndex && layout.slots.length > 0;
        const mausoleumH = Math.max(
          60,
          Math.min(0.42 * vh, 340, rel(mausoleumBase) - 4),
        );
        const mausoleumW = Math.round(
          (mausoleumH * PLATE_SIZE.mausoleum.w) / PLATE_SIZE.mausoleum.h,
        );
        const mausoleumX = Math.min(
          Math.max(pathXAt(layout.path, mausoleumBase, w / 2), mausoleumW / 2),
          Math.max(mausoleumW / 2, w - mausoleumW / 2),
        );
        const isLast = index === lastIndex;

        return (
          <div
            key={`ground-mid-${stratum.id}`}
            data-testid="ground-mid-band"
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
              } as CSSProperties
            }
          >
            {showGate ? (
              <div
                data-testid="ground-fence"
                className="pointer-events-none absolute"
                style={{
                  left: -bleed.x,
                  width: w + 2 * bleed.x,
                  top: Math.max(0, rel(gateY) - fenceH / 2),
                  height: fenceH,
                  filter: themeFilter(theme, "brightness(0.5)", "--art-filter-fence"),
                }}
              >
                <div
                  data-testid="ground-fence-tile"
                  data-art="mg-fence-tile"
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${themeArt(theme, "/art/mg-fence-tile.webp")})`,
                    backgroundRepeat: "repeat-x",
                    backgroundPosition: "0 bottom",
                    backgroundSize: "auto 100%",
                  }}
                />
                <div
                  data-testid="ground-fence-gate"
                  data-art="mg-fence"
                  className="absolute top-0"
                  style={{
                    left: gateX + bleed.x - gateW / 2,
                    width: gateW,
                    height: fenceH,
                    backgroundImage: `url(${themeArt(theme, "/art/mg-fence.webp")})`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center bottom",
                    backgroundSize: "100% 100%",
                  }}
                >
                  <PerchBirds theme={theme} place="ground" reducedMotion={reducedMotion} />
                </div>
              </div>
            ) : null}

            <div
              data-testid="ground-path"
              data-stones={bandStones.length}
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: bandStones.length && !emptyCemetery
                  ? bandStones.map((s) => stoneGradient(s.x, rel(s.y))).join(", ")
                  : undefined,
                backgroundRepeat: "no-repeat",
                opacity: 0.85,
              }}
            />

            {bandStones
              .filter((s) => theme !== "day" && !emptyCemetery && lanterns.has(s.i))
              .map((s) => {
                const side = s.i % 2 === 0 ? -1 : 1;
                const lx = s.x + side * 78;
                return (
                  <div
                    key={`lantern-${s.i}`}
                    data-testid="path-lantern"
                    className="pointer-events-none absolute"
                    style={{ left: lx - 24, top: rel(s.y) - 24, width: 48, height: 48 }}
                  >
                    <div
                      {...effectProps("path-lantern-flicker")}
                      className={`absolute inset-0 ${reducedMotion ? "" : "lantern-flicker"}`.trim()}
                      style={{
                        backgroundImage:
                          "radial-gradient(circle, var(--color-candle-400) 0, var(--color-candle-400) 12%, transparent 70%)",
                        opacity: 0.8,
                      }}
                    />
                  </div>
                );
              })}

            {showMausoleum ? (
              <div
                data-testid="ground-mausoleum"
                data-art="mausoleum"
                className="pointer-events-none absolute"
                style={{
                  left: mausoleumX - mausoleumW / 2,
                  top: rel(mausoleumBase) - mausoleumH,
                  width: mausoleumW,
                  height: mausoleumH,
                  backgroundImage: `url(${themeArt(theme, "/art/mausoleum.webp")})`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center bottom",
                  backgroundSize: "100% 100%",
                  filter: themeFilter(theme, "brightness(0.7)", "--art-filter-ground"),
                }}
              />
            ) : null}

            <div
              data-testid="ground-mist"
              {...effectProps("ground-mist")}
              data-place="ground"
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ height: Math.min(band.height, 420) }}
            >
              <EnvMist place="ground" layer="far" reducedMotion={reducedMotion} feather width={mistW} />
              {isLast ? (
                <EnvMist place="ground" layer="near" reducedMotion={reducedMotion} feather width={mistW} />
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Foreground: dark fg-frame edge pieces, grass tufts as gradients. */}
      {bands.map((band) => {
        const { stratum, index } = band;
        const bleed = bleedFor(
          layout,
          band.height,
          Math.max(band.fadeTop, band.fadeBottom),
          RATE_FG,
          POINTER_FG,
          reducedMotion,
        );
        const isMid = index !== 0 && index !== lastIndex;
        const edgeW = Math.round(Math.min(320, Math.max(96, 0.22 * w)));
        const element = { w: edgeW + 2 * bleed.x, h: band.height + 2 * bleed.y };
        // The last stratum differs from the first by a 30 percent offset (Req 19.5).
        const offset = index === 0 ? undefined : { x: 0.3, y: 0 };
        const edge = (side: "left" | "right") => (
          <CropLayer
            key={side}
            data-testid="ground-fg-crop"
            data-place="ground"
            plate="fg-frame"
            theme={theme}
            element={element}
            focal={side === "left" ? { fx: 0.1, fy: 0.5 } : { fx: 0.7, fy: 0.5 }}
            anchor={side === "left" ? { ax: 0.1, ay: 0.5 } : { ax: 0.9, ay: 0.5 }}
            flip={{ h: side === "right", v: false }}
            offset={offset}
            filter={themeFilter(theme, "brightness(0.45)", "--art-filter-fence")}
            backdrop={false}
            className="pointer-events-none absolute overflow-clip"
            style={{
              [side]: -bleed.x,
              top: -bleed.y,
              width: element.w,
              height: element.h,
            }}
          />
        );
        const tuftStops =
          "linear-gradient(to top, var(--color-night-sky) 0, transparent 100%)";

        return (
          <div
            key={`ground-fg-${stratum.id}`}
            data-testid="ground-fg-band"
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
              } as CSSProperties
            }
          >
            {isMid && theme === "day" ? null : isMid ? (
              <div
                data-testid="ground-tufts"
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{ height: 64, backgroundImage: tuftStops, opacity: 0.6 }}
              />
            ) : (
              <>
                {edge("left")}
                {edge("right")}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
