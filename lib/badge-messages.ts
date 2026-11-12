/**
 * Badge message composition (pure).
 *
 * Turns graveyard counts or a single repo's state into the message text and
 * colour tone used by `buildBadge`. No I/O, no React, no `server-only`.
 */

import { SEPARATOR, type BadgeTone } from "./badge";
import type { LifecycleState } from "./lifecycle";
import { decayWord } from "./repoDetails/decayWord";

export type BadgeCounts = Record<LifecycleState, number>;

/** Display order of the summary message. */
const MESSAGE_ORDER: readonly LifecycleState[] = ["ghost", "risen", "zombie", "tombstone", "coffin"];

/** Urgency order of the summary tone, most urgent first. */
const TONE_ORDER: readonly LifecycleState[] = ["zombie", "ghost", "risen", "tombstone", "coffin"];

const NOUNS: Record<LifecycleState, { one: string; many: string }> = {
  ghost: { one: "ghost", many: "ghosts" },
  risen: { one: "risen", many: "risen" },
  zombie: { one: "zombie", many: "zombies" },
  tombstone: { one: "at rest", many: "at rest" },
  coffin: { one: "sealed", many: "sealed" },
};

/** Counts that are not finite non-negative integers are treated as 0. */
function safeCount(counts: Partial<BadgeCounts> | null | undefined, state: LifecycleState): number {
  const n = counts?.[state];
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 0;
}

export function summaryMessage(counts: BadgeCounts): string {
  const parts: string[] = [];
  for (const state of MESSAGE_ORDER) {
    const n = safeCount(counts, state);
    if (n > 0) parts.push(`${n} ${n === 1 ? NOUNS[state].one : NOUNS[state].many}`);
  }
  return parts.length === 0 ? "empty" : parts.join(SEPARATOR);
}

export function summaryTone(counts: BadgeCounts): BadgeTone {
  for (const state of TONE_ORDER) {
    if (safeCount(counts, state) > 0) return state;
  }
  return "neutral";
}

export function repoMessage(state: LifecycleState, decayLevel: number | null): string {
  if (state === "ghost" || state === "zombie") {
    return `${state}${SEPARATOR}${decayWord(state, decayLevel)}`;
  }
  return decayWord(state, null);
}

export function repoTone(state: LifecycleState): BadgeTone {
  switch (state) {
    case "ghost":
    case "risen":
    case "zombie":
    case "tombstone":
    case "coffin":
      return state;
    default:
      return "neutral";
  }
}
