/**
 * World lighting model (explorable-worlds, Req 18.6, 18.7, 18.12).
 *
 * Pure: no I/O, clock, randomness or DOM. Every colour is a CSS token name
 * (`var(--light-...)`), never a hex value. Each place has exactly one key
 * light, expressed as one unit shadow offset `(sx, sy)`.
 */

export type LightPlace = "sky" | "ground" | "crypt";

export interface LightSource {
  place: LightPlace;
  /** Unit shadow offset, x (positive = right). */
  sx: number;
  /** Unit shadow offset, y (positive = down). */
  sy: number;
  /** Token name for the rim / glow colour, e.g. `--light-sky-rim`. */
  rimToken: string;
  /** Token name for the shadow (sky: glow) colour. */
  shadowToken: string;
}

/** One entry per place. Sky: moon, upper right. Ground/crypt: light from the left. */
export const LIGHT_SOURCES: Record<LightPlace, LightSource> = {
  sky: {
    place: "sky",
    sx: -0.6,
    sy: 0.5,
    rimToken: "--light-sky-rim",
    shadowToken: "--light-sky-glow",
  },
  ground: {
    place: "ground",
    sx: 0.8,
    sy: 0.2,
    rimToken: "--light-ground-rim",
    shadowToken: "--light-ground-shadow",
  },
  crypt: {
    place: "crypt",
    sx: 0.7,
    sy: 0.35,
    rimToken: "--light-crypt-rim",
    shadowToken: "--light-crypt-shadow",
  },
};

/** Shadow offset is `(sx, sy) * SHADOW_OFFSET_FACTOR * size`. */
export const SHADOW_OFFSET_FACTOR = 0.35;
/** Shadow opacity at band brightness 1 (front). */
export const SHADOW_MAX_OPACITY = 0.5;
/** Shadow blur as a fraction of creature size. */
export const SHADOW_BLUR_FACTOR = 0.2;
/** Default creature size in px when the caller does not pass one. */
export const DEFAULT_CREATURE_SIZE = 64;

/** Rim glow alpha bounds: freshest push -> max, `RIM_QUIET_DAYS` or more -> min. */
export const RIM_ALPHA_MAX = 0.6;
export const RIM_ALPHA_MIN = 0.15;
export const RIM_QUIET_DAYS = 90;
/** Rim offset in px per unit of key direction. */
export const RIM_OFFSET_PX = 3;
export const RIM_BLUR_PX = 6;

export interface ContactShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
  /** Token name of the shadow colour. */
  token: string;
}

export interface RimLight {
  offsetX: number;
  offsetY: number;
  blur: number;
  /** Glow alpha, `RIM_ALPHA_MIN`..`RIM_ALPHA_MAX`; follows recency. */
  alpha: number;
  /** Token name of the rim colour. */
  token: string;
  /** Ready-to-use `drop-shadow(...)` filter fragment built from the token. */
  filter: string;
}

function clamp01(n: number | null | undefined, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function sourceFor(place: LightPlace): LightSource {
  return LIGHT_SOURCES[place] ?? LIGHT_SOURCES.ground;
}

/**
 * Contact_Shadow for a standing creature. `band` is the creature's depth-band
 * brightness in 0..1 (back creatures are dimmer, so their shadows are fainter).
 * Missing or non-finite brightness is treated as 1 (front).
 */
export function shadowFor(
  place: LightPlace,
  band: number | null | undefined,
  size: number = DEFAULT_CREATURE_SIZE,
): ContactShadow {
  const src = sourceFor(place);
  const px = typeof size === "number" && Number.isFinite(size) && size > 0 ? size : DEFAULT_CREATURE_SIZE;
  const brightness = clamp01(band, 1);
  return {
    offsetX: src.sx * SHADOW_OFFSET_FACTOR * px,
    offsetY: src.sy * SHADOW_OFFSET_FACTOR * px,
    blur: SHADOW_BLUR_FACTOR * px,
    opacity: SHADOW_MAX_OPACITY * brightness,
    token: src.shadowToken,
  };
}

/** A grounded coffin: a tight, dark contact shadow plus a floor line at its base. */
export interface CoffinGrounding {
  shadow: ContactShadow;
  /** Shadow width as a multiple of the art size. */
  shadowWidthFactor: number;
  /** Floor line (a thin ledge) under the base. */
  floorLine: { widthFactor: number; thickness: number; opacity: number; token: string };
}

/** Coffin shadows never get fainter than this, so back-row coffins still sit on the floor. */
export const COFFIN_SHADOW_MIN_OPACITY = 0.45;
export const COFFIN_SHADOW_MAX_OPACITY = 0.85;

/**
 * Grounding for a crypt coffin. The shadow hugs the base (a small fraction of
 * the normal key-light offset, a small blur, wider and darker than a standing
 * creature's), and a floor line crosses the base so the coffin reads as
 * resting on the stone rather than floating against the wall. Opacity stays in
 * [COFFIN_SHADOW_MIN_OPACITY, COFFIN_SHADOW_MAX_OPACITY] for any band value.
 */
export function coffinGroundingFor(
  band: number | null | undefined,
  size: number = DEFAULT_CREATURE_SIZE,
): CoffinGrounding {
  const src = LIGHT_SOURCES.crypt;
  const px = typeof size === "number" && Number.isFinite(size) && size > 0 ? size : DEFAULT_CREATURE_SIZE;
  const b = clamp01(band, 1);
  const opacity =
    COFFIN_SHADOW_MIN_OPACITY + (COFFIN_SHADOW_MAX_OPACITY - COFFIN_SHADOW_MIN_OPACITY) * b;
  return {
    shadow: {
      offsetX: src.sx * 0.08 * px,
      offsetY: 0.1 * px,
      blur: Math.max(1, 0.08 * px),
      opacity,
      token: src.shadowToken,
    },
    shadowWidthFactor: 1.3,
    floorLine: { widthFactor: 1.25, thickness: 2, opacity: 0.35 + 0.25 * b, token: src.rimToken },
  };
}

/**
 * Rim light and glow for a ghost. Offset follows the place's key direction;
 * glow alpha follows recency (`daysQuiet`): fresher pushes glow brighter.
 * Missing or non-finite `daysQuiet` gets the dimmest glow.
 */
export function rimFor(
  place: LightPlace,
  row: { daysQuiet?: number | null } | null | undefined,
): RimLight {
  const src = sourceFor(place);
  const d = row?.daysQuiet;
  const quiet =
    typeof d === "number" && Number.isFinite(d)
      ? Math.min(RIM_QUIET_DAYS, Math.max(0, d))
      : RIM_QUIET_DAYS;
  const alpha =
    RIM_ALPHA_MAX - (RIM_ALPHA_MAX - RIM_ALPHA_MIN) * (quiet / RIM_QUIET_DAYS);
  const offsetX = src.sx * RIM_OFFSET_PX;
  const offsetY = src.sy * RIM_OFFSET_PX;
  const pct = Math.round(alpha * 1000) / 10;
  return {
    offsetX,
    offsetY,
    blur: RIM_BLUR_PX,
    alpha,
    token: src.rimToken,
    filter: `drop-shadow(${offsetX}px ${offsetY}px ${RIM_BLUR_PX}px color-mix(in srgb, var(${src.rimToken}) ${pct}%, transparent))`,
  };
}
