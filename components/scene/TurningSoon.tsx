/**
 * Turning-soon notice (presentational).
 *
 * Calls out the single ghost nearest to crossing the ghost→zombie boundary when
 * it sits inside the scene's turning-soon window. The selection itself is the
 * pure `pickTurningSoon(repos, rows, now)` view-model function — fewest whole
 * days left, tie-broken by latest `pushedAt` — which the parent/page computes
 * once from the injected `now` and passes in here as a precomputed
 * `TurningSoon | null`. This keeps the component free of any clock read and
 * leaves the "render only when a ghost has ≤30 whole days left" gate to the
 * pure function: a `null` result means nothing qualifies and the notice renders
 * nothing (Req 7.8).
 *
 * Activating the notice selects that ghost's creature via the `onSelect`
 * callback, raising the ghost's repo name exactly as a creature button would
 * (Req 7.9). The notice is a focusable `<button>` so keyboard users reach it;
 * because its only behavior is to invoke a prop callback, it stays a shared /
 * presentational component (no `"use client"`) that the client `SceneView`
 * renders.
 *
 * Styling is the crimson-700 fill / crimson-400 border-and-glow treatment in
 * the narrative (IM Fell English) face, all from `@theme` tokens — no hardcoded
 * hex (Req 7.8).
 *
 * Requirements: 7.8, 7.9
 */

import { type TurningSoon as TurningSoonResult } from "@/lib/scene-view";

export interface TurningSoonProps {
  /**
   * The precomputed turning-soon selection from `pickTurningSoon(repos, rows,
   * now)`, or `null` when no ghost qualifies. Passing the precomputed value
   * (rather than the raw repos/rows/now) keeps this component from reading the
   * clock — the parent already holds the injected `now`.
   */
  turningSoon: TurningSoonResult | null;
  /**
   * Raised with the turning-soon ghost's repo name when the notice is
   * activated, selecting that ghost's creature (Req 7.9).
   */
  onSelect?: (name: string) => void;
}

export default function TurningSoon({ turningSoon, onSelect }: TurningSoonProps) {
  // No qualifying ghost → render nothing. `pickTurningSoon` already applied the
  // ≤30-whole-days window, so a non-null value is always inside it (Req 7.8).
  if (turningSoon === null) {
    return null;
  }

  const { name, daysLeft } = turningSoon;
  // Whole-day countdown with natural singular/plural. `daysLeft` is a whole-day
  // count from the pure selector, so no rounding happens here.
  const dayLabel = daysLeft === 1 ? "day" : "days";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(name)}
      data-testid="scene-turning-soon"
      data-days-left={daysLeft}
      className={[
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5",
        "font-[family-name:var(--font-narrative)] italic leading-snug",
        "cursor-pointer transition-[transform,filter] duration-200 ease-out",
        "motion-safe:hover:scale-[1.03]",
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-candle-400)]",
      ].join(" ")}
      style={{
        // crimson-700 fill, crimson-400 border + glow — all tokens, no hex.
        backgroundColor: "var(--color-crimson-700)",
        borderColor: "var(--color-crimson-400)",
        color: "var(--color-scene-fg)",
        boxShadow: "0 0 14px var(--color-crimson-glow)",
      }}
    >
      <span>
        {name} turns in {daysLeft} {dayLabel}
      </span>
    </button>
  );
}
