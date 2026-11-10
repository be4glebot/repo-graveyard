/**
 * Decay profiles for the Séance spirit transcript (Requirements 11.7, 12.1-12.8).
 * Pure and client-safe: no I/O, no randomness, no clock.
 *
 * Colour values are token names from app/globals.css, never literals.
 */

export type DecayProfileId =
  | "ghost-steady"
  | "ghost-fading"
  | "ghost-jitter"
  | "risen-cyan"
  | "zombie-rough"
  | "cold-still";

export interface DecayProfile {
  id: DecayProfileId;
  /** Small human label printed in the AI section (not colour or motion dependent). */
  label: string;
  jitterPx: number; // revealing only
  splitPx: number; // red/cyan channel split, revealing only
  glowScale: number; // 1 = ghost-steady baseline
  glowHue: "cyan" | "red" | "grey";
  glowToken: string; // token name of the text-shadow colour
  smokeToken: string; // token name of the Smoke_Field fill
  roughness: number; // relative to ghost-steady = 1
  brightness: number; // relative to ghost-steady = 1
  motionScale: number; // relative to ghost-steady = 1
}

export const DECAY_PROFILES: Record<DecayProfileId, DecayProfile> = {
  "ghost-steady": {
    id: "ghost-steady",
    label: "steady",
    jitterPx: 0,
    splitPx: 0,
    glowScale: 1,
    glowHue: "cyan",
    glowToken: "--color-glow-ghost",
    smokeToken: "--color-smoke-ghost-steady",
    roughness: 1,
    brightness: 1,
    motionScale: 1,
  },
  "ghost-fading": {
    id: "ghost-fading",
    label: "fading",
    jitterPx: 0,
    splitPx: 0,
    glowScale: 0.7, // 30% lower than baseline
    glowHue: "cyan",
    glowToken: "--color-glow-ghost",
    smokeToken: "--color-smoke-ghost-fading",
    roughness: 1,
    brightness: 1,
    motionScale: 1,
  },
  "ghost-jitter": {
    id: "ghost-jitter",
    label: "flickering",
    jitterPx: 0.5,
    splitPx: 1.5,
    glowScale: 0.7,
    glowHue: "cyan",
    glowToken: "--color-glow-ghost",
    smokeToken: "--color-smoke-ghost-jitter",
    roughness: 1,
    brightness: 1,
    motionScale: 1,
  },
  "risen-cyan": {
    id: "risen-cyan",
    label: "risen",
    jitterPx: 0,
    splitPx: 0,
    glowScale: 1,
    glowHue: "cyan",
    glowToken: "--color-glow-risen",
    smokeToken: "--color-smoke-risen-cyan",
    roughness: 1,
    brightness: 1,
    motionScale: 1,
  },
  "zombie-rough": {
    id: "zombie-rough",
    label: "decayed",
    jitterPx: 0,
    splitPx: 0,
    glowScale: 1,
    glowHue: "red",
    glowToken: "--color-glow-zombie",
    smokeToken: "--color-smoke-zombie-rough",
    roughness: 1.5,
    brightness: 0.7,
    motionScale: 1,
  },
  "cold-still": {
    id: "cold-still",
    label: "at rest",
    jitterPx: 0,
    splitPx: 0,
    glowScale: 0.5,
    glowHue: "grey",
    glowToken: "--color-moon-300",
    smokeToken: "--color-smoke-cold-still",
    roughness: 1,
    brightness: 0.6,
    motionScale: 0.1,
  },
};

/** Total and pure: unknown or missing inputs give `ghost-steady`. */
export function selectDecayProfile(
  state: unknown,
  decayLevel: unknown,
): DecayProfile {
  switch (state) {
    case "ghost": {
      const n =
        typeof decayLevel === "number" && !Number.isNaN(decayLevel)
          ? Math.trunc(decayLevel)
          : 0;
      const level = Math.min(3, Math.max(0, n));
      if (level === 0) return DECAY_PROFILES["ghost-steady"];
      if (level === 1) return DECAY_PROFILES["ghost-fading"];
      return DECAY_PROFILES["ghost-jitter"];
    }
    case "risen":
      return DECAY_PROFILES["risen-cyan"];
    case "zombie":
      return DECAY_PROFILES["zombie-rough"];
    case "tombstone":
    case "coffin":
      return DECAY_PROFILES["cold-still"];
    default:
      return DECAY_PROFILES["ghost-steady"];
  }
}

export const FLICKER_MAX_MS = 150;

/** 32-bit FNV-1a over UTF-16 code units, then a final avalanche mix. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Seeded single-letter flicker for one line (sentence). Null for roughly two
 * lines in three; otherwise a letter index in [0, lineLength) and a duration
 * of at most 150 ms. Deterministic.
 */
export function flickerFor(
  repoName: string,
  lineIndex: number,
  lineLength: number,
): { letterIndex: number; durationMs: number } | null {
  if (!Number.isFinite(lineLength) || lineLength < 1) return null;
  const length = Math.floor(lineLength);
  const h = hash32(`${repoName}:${lineIndex}`);
  if (h % 3 !== 0) return null;
  const letterIndex = Math.floor(h / 3) % length;
  const durationMs = 60 + (Math.floor(h / 7) % 91); // 60..150
  return { letterIndex, durationMs };
}
