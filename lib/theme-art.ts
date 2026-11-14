/**
 * Pure theme art helpers for the daytime "Lights on" theme.
 * No I/O, no clock, no React.
 */

export type Theme = "night" | "day";

/** Night asset path -> day asset path. Only files that exist in public/art/day/. */
export const DAY_ART: Readonly<Record<string, string>> = {
  "/art/place-ground.webp": "/art/day/place-ground.webp",
  "/art/mg-fence.webp": "/art/day/mg-fence.webp",
  "/art/mg-fence-tile.webp": "/art/day/mg-fence-tile.webp",
  "/art/mausoleum.webp": "/art/day/mausoleum.webp",
  "/art/tomb-arch-fresh.webp": "/art/day/tomb-arch-fresh.webp",
  "/art/fg-frame.webp": "/art/day/fg-frame.webp",
};

/** Resolve an art path for a theme. Unmapped paths fall back to night art. */
export function themeArt(theme: Theme, nightPath: string): string {
  if (theme === "night") return nightPath;
  return Object.prototype.hasOwnProperty.call(DAY_ART, nightPath)
    ? DAY_ART[nightPath]
    : nightPath;
}

/**
 * Static CSS filter for a layer. Night keeps its own filter; day uses the
 * token. A bare custom property name ("--art-filter-ground") is wrapped in
 * var(); any other value is returned as given.
 */
export function themeFilter(
  theme: Theme,
  nightFilter: string,
  dayToken: string,
): string {
  if (theme === "night") return nightFilter;
  return dayToken.startsWith("--") ? `var(${dayToken})` : dayToken;
}

export type PerchSide = "left" | "right";

export interface PerchBird {
  side: PerchSide;
  /** Fraction of the gate box width (box top-left corner of the bird). */
  x: number;
  /** Fraction of the gate box height. */
  y: number;
  mirror: boolean;
}

export const PERCH_BIRDS: readonly PerchBird[] = [
  { side: "left", x: 0.285, y: 0.18, mirror: false },
  { side: "right", x: 0.713, y: 0.18, mirror: true },
];

/** bird-perch.webp native size. */
export const BIRD_PERCH_NATIVE = { w: 160, h: 160 } as const;

/** Perch bird box size as a fraction of the gate box height. */
export const BIRD_PERCH_HEIGHT_RATIO = 0.2;

export interface PerchBirdBox {
  side: PerchSide;
  left: number;
  top: number;
  size: number;
  mirror: boolean;
}

/** Pixel placement of the perch birds inside a gate box. */
export function perchBirdBox(gate: { w: number; h: number }): PerchBirdBox[] {
  const size = Math.round(gate.h * BIRD_PERCH_HEIGHT_RATIO);
  return PERCH_BIRDS.map((b) => ({
    side: b.side,
    left: b.x * gate.w,
    top: b.y * gate.h,
    size,
    mirror: b.mirror,
  }));
}
