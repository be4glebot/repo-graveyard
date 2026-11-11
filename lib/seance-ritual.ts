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

// ---------------------------------------------------------------------------
// Staged ritual (visual pass). Timed, never tied to server progress.
//
//   stage 0   0 - 1.2 s   five candles light one at a time; panel edges dim
//   stage 1   1.2 - 2.5 s smoke rises and gathers; "Calling {repo} back…"
//   stage 2   2.5 - 4.5 s frost creeps in, flames lean; "Reading its last words…"
//   stage 3   4.5 s +     held until the response arrives; "Something is answering…"
//
// Pure: no clock, no DOM, no randomness.
// ---------------------------------------------------------------------------

/** Minimum time before the transcript may appear, even on a cache hit. */
export const RITUAL_MIN_MS = 2000;

/** Elapsed time at which each stage begins. */
export const RITUAL_STAGE_STARTS_MS = [0, 1200, 2500, 4500] as const;

/** The stage that is held until the response arrives. */
export const RITUAL_FINAL_STAGE = RITUAL_STAGE_STARTS_MS.length - 1;

export const RITUAL_CANDLE_COUNT = 5;
/** Gap between ignitions; five candles are all lit by the end of stage 0. */
export const RITUAL_CANDLE_GAP_MS = 240;

/** How long the exit layer (gutter or snuff) stays mounted, by kind. */
export const RITUAL_EXIT_MS = { resolved: 600, silent: 1400 } as const;
/** Delay between candles being snuffed out in the silent exit. */
export const RITUAL_SNUFF_GAP_MS = 180;

export type RitualExitKind = keyof typeof RITUAL_EXIT_MS;

/**
 * Stage for an elapsed time. Never goes past the held final stage, and a
 * skip jumps straight to it (a skip cannot shorten the wait for the server).
 */
export function ritualStageAt(elapsedMs: number, skipped = false): number {
  if (skipped) return RITUAL_FINAL_STAGE;
  const t = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  let stage = 0;
  for (let i = 1; i < RITUAL_STAGE_STARTS_MS.length; i += 1) {
    if (t >= RITUAL_STAGE_STARTS_MS[i]) stage = i;
  }
  return stage;
}

/** Milliseconds from ritual start until the next stage, or null at the final stage. */
export function ritualNextStageStartMs(stage: number): number | null {
  const next = RITUAL_STAGE_STARTS_MS[stage + 1];
  return next === undefined ? null : next;
}

/** The small smoke text for a stage; stage 0 has none. */
export function ritualStageText(stage: number, repo: string): string | null {
  switch (stage) {
    case 1:
      return `Calling ${repo} back…`;
    case 2:
      return "Reading its last words…";
    case 3:
      return "Something is answering…";
    default:
      return null;
  }
}

export interface RitualVisuals {
  /** Panel edges dimmed. */
  dim: boolean;
  /** Smoke has risen and gathered above the portrait. */
  smoke: boolean;
  /** Frost has crept in from the panel corners. */
  frost: boolean;
  /** Candle flames lean toward the portrait. */
  lean: boolean;
  /** The final stage: slow flame flicker and frost breathing until resolved. */
  holding: boolean;
  text: string | null;
}

export function ritualVisuals(stage: number, repo: string): RitualVisuals {
  const s = Math.min(Math.max(Math.trunc(Number.isFinite(stage) ? stage : 0), 0), RITUAL_FINAL_STAGE);
  return {
    dim: true,
    smoke: s >= 1,
    frost: s >= 2,
    lean: s >= 2,
    holding: s >= RITUAL_FINAL_STAGE,
    text: ritualStageText(s, repo),
  };
}

/** Where the ritual is centred (percent of the ritual area) and the candle ring around it. */
export const RITUAL_CENTER = { x: 50, y: 40 } as const;
export const RITUAL_RING = { rx: 34, ry: 26 } as const;

/** Slightly uneven candle heights, as a multiple of the base wax height. */
const CANDLE_HEIGHT_SCALES = [1, 0.84, 1.14, 0.92, 1.06] as const;

export interface StageCandle {
  index: number;
  /** Wax height multiplier (the candles are not all the same height). */
  heightScale: number;
  /** Ignition time from ritual start (one at a time inside stage 0). */
  igniteAtMs: number;
  /** Position around the portrait, in degrees (first candle straight up). */
  angleDeg: number;
  /** Tilt toward the portrait once the flames lean, in degrees. */
  leanDeg: number;
}

export function ritualCandles(): StageCandle[] {
  const out: StageCandle[] = [];
  const step = 360 / RITUAL_CANDLE_COUNT;
  for (let i = 0; i < RITUAL_CANDLE_COUNT; i += 1) {
    const angleDeg = Math.round((-90 + i * step) * 10) / 10;
    const cos = Math.cos((angleDeg * Math.PI) / 180);
    out.push({
      index: i,
      heightScale: CANDLE_HEIGHT_SCALES[i % CANDLE_HEIGHT_SCALES.length],
      igniteAtMs: i * RITUAL_CANDLE_GAP_MS,
      angleDeg,
      leanDeg: Math.round(-cos * 14),
    });
  }
  return out;
}