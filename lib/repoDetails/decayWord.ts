/**
 * Decay_Word: the plain-English state label for a creature (Req 3.2).
 *
 * Reuses the ghost/zombie word tables from `lib/estate-view.ts`; risen,
 * tombstone and coffin use the plain labels from product.md ("risen",
 * "at rest", "sealed"). Pure and total: out-of-range or null decay levels
 * clamp into the band rather than throwing.
 */

import { GHOST_DECAY_WORDS, ZOMBIE_DECAY_WORDS } from "../estate-view";
import type { LifecycleState } from "../lifecycle";

function pick(words: readonly string[], level: number | null): string {
  const n = typeof level === "number" && Number.isFinite(level) ? Math.trunc(level) : 0;
  return words[Math.min(Math.max(n, 0), words.length - 1)];
}

export function decayWord(state: LifecycleState, decayLevel: number | null): string {
  switch (state) {
    case "ghost":
      return pick(GHOST_DECAY_WORDS, decayLevel);
    case "zombie":
      return pick(ZOMBIE_DECAY_WORDS, decayLevel);
    case "risen":
      return "risen";
    case "tombstone":
      return "at rest";
    case "coffin":
      return "sealed";
    default:
      return "unknown";
  }
}
