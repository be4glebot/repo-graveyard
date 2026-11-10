/**
 * Pure, deterministic plan for the séance ritual (Req 10.3, 10.6).
 * No clock, no DOM, no Math.random: equal seeds give equal plans.
 */

export const WHISPER_LINES: readonly string[] = [
  "…someone is listening…",
  "…the candle burns lower…",
  "…the dark leans closer…",
  "…something remembers your name…",
];

export interface RitualCandle {
  /** Milliseconds from ritual start at which the candle ignites. */
  igniteAtMs: number;
  /** Duration over which the glow grows from 0 to full. */
  fadeMs: number;
  /** Position around the portrait, in degrees. */
  angleDeg: number;
}

export interface RitualPlan {
  candles: RitualCandle[];
  whispers: string[];
}

const MIN_CANDLES = 3;
const MAX_CANDLES = 6;
const MIN_GAP_MS = 200;
const MAX_GAP_MS = 600;
const MIN_FADE_MS = 500;
const MAX_FADE_MS = 1500;
const ALL_LIT_BY_MS = 2000;

/** xmur3 string hash: returns the first 32-bit value. */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 PRNG: floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rand: () => number, min: number, max: number): number {
  return Math.round(min + rand() * (max - min));
}

export function buildRitualPlan(seed: string): RitualPlan {
  const rand = mulberry32(hashSeed(typeof seed === "string" ? seed : ""));

  const count = MIN_CANDLES + Math.floor(rand() * (MAX_CANDLES - MIN_CANDLES + 1));

  // Gaps between consecutive ignitions (count - 1 of them).
  const gaps: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    gaps.push(between(rand, MIN_GAP_MS, MAX_GAP_MS));
  }

  // The last candle must be fully lit by 2000 ms. Reserve the minimum fade,
  // then shorten gaps toward 200 ms from the end until the last ignition fits.
  const maxLastIgnite = ALL_LIT_BY_MS - MIN_FADE_MS;
  let total = gaps.reduce((sum, g) => sum + g, 0);
  for (let i = gaps.length - 1; i >= 0 && total > maxLastIgnite; i -= 1) {
    const cut = Math.min(gaps[i] - MIN_GAP_MS, total - maxLastIgnite);
    gaps[i] -= cut;
    total -= cut;
  }

  const baseAngle = rand() * 360;
  const step = 360 / count;
  const candles: RitualCandle[] = [];
  let igniteAtMs = 0;
  for (let i = 0; i < count; i += 1) {
    if (i > 0) igniteAtMs += gaps[i - 1];
    const rawFade = between(rand, MIN_FADE_MS, MAX_FADE_MS);
    const fadeMs = Math.max(
      MIN_FADE_MS,
      Math.min(rawFade, ALL_LIT_BY_MS - igniteAtMs),
    );
    const angleDeg = Math.round(((baseAngle + i * step) % 360) * 10) / 10;
    candles.push({ igniteAtMs, fadeMs, angleDeg });
  }

  return { candles, whispers: [...WHISPER_LINES] };
}
