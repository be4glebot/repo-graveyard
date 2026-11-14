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
 * On the estate map the notice additionally carries an opt-in **"Go to it"**
 * action (estate-map Req 12.1–12.6): when the optional `onGoTo` callback is
 * supplied, a second keyboard-focusable control renders inside the notice and,
 * on activation, raises the ghost's repo name so `SceneView` can jump straight
 * into The Restless Sky on the exact plot holding that ghost. The action only
 * exists while a turning-soon ghost exists — the whole notice already returns
 * `null` otherwise, so no "Go to it" renders when nothing qualifies (Req 12.6).
 * The action is opt-in: the existing full-scene usage passes no `onGoTo`, so it
 * is unaffected and renders only the original notice.
 *
 * Styling is the crimson-700 fill / crimson-400 border-and-glow treatment in
 * the narrative (IM Fell English) face, all from `@theme` tokens — no hardcoded
 * hex (Req 7.8).
 *
 * Requirements: 7.8, 7.9, 12.1, 12.2, 12.6
 */

import type { CSSProperties } from "react";
import { turningPulseSeconds } from "@/lib/turning-pulse";
import { useTheme } from "@/components/scene/ThemeProvider";
import { dayCopy } from "@/lib/day-copy";
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
  /**
   * Opt-in estate-map "Go to it" action (Req 12.1–12.6). When supplied, a
   * second keyboard-focusable control renders inside the notice and raises the
   * ghost's repo name on activation so the parent can jump into the sky place
   * on the exact plot holding the ghost. When omitted (the full-scene usage),
   * no "Go to it" action renders and the notice keeps its original shape.
   */
  onGoTo?: (name: string) => void;
}

export default function TurningSoon({
  turningSoon,
  onSelect,
  onGoTo,
}: TurningSoonProps) {
  const { theme } = useTheme();
  // No qualifying ghost → render nothing. `pickTurningSoon` already applied the
  // ≤30-whole-days window, so a non-null value is always inside it (Req 7.8).
  // This single gate is also why the "Go to it" action never renders without a
  // turning-soon ghost (estate-map Req 12.6).
  if (turningSoon === null) {
    return null;
  }

  const { name, daysLeft } = turningSoon;
  const phrase = dayCopy(theme, "turning.phrase");
  // Whole-day countdown with natural singular/plural. `daysLeft` is a whole-day
  // count from the pure selector, so no rounding happens here.
  const dayLabel = daysLeft === 1 ? "day" : "days";

  // Shared crimson treatment for the notice chrome — all tokens, no hex.
  const isDay = theme === "day";
  const noticeStyle = {
    backgroundColor: isDay
      ? "var(--color-day-gold-bg)"
      : "var(--color-crimson-700)",
    borderColor: isDay
      ? "var(--color-day-gold-border)"
      : "var(--color-crimson-400)",
    color: isDay ? "var(--color-day-gold-ink)" : "var(--color-scene-fg)",
    "--pulse-period": `${turningPulseSeconds(daysLeft)}s`,
  } as CSSProperties;
  const dayClass = isDay ? "turning-soon-day" : "";

  const label = (
    <span>
      {name} {phrase}
      {theme === "day" ? " · " : " "}
      {daysLeft} {dayLabel}
    </span>
  );

  // Full-scene usage (no `onGoTo`): keep the original single focusable button
  // that selects the ghost on activation, so existing behavior is unchanged.
  if (!onGoTo) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(name)}
        data-testid="scene-turning-soon"
        data-days-left={daysLeft}
        className={[
          "turning-soon-pulse inline-flex items-center gap-2 rounded-md border px-3 py-1.5",
          dayClass,
          "font-[family-name:var(--font-narrative)] italic leading-snug",
          "cursor-pointer transition-[transform,filter] duration-200 ease-out",
          "motion-safe:hover:scale-[1.03]",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-candle-400)]",
        ].join(" ")}
        style={noticeStyle}
      >
        {label}
      </button>
    );
  }

  // Estate-map usage (opt-in `onGoTo`): the notice becomes a container holding
  // the countdown text and a dedicated, keyboard-focusable "Go to it" action.
  // A <button> cannot nest inside a <button>, so the wrapper is a plain element
  // and the "Go to it" control is the single interactive child. It is reachable
  // by keyboard focus and activatable by click and by Enter/Space (native
  // <button> semantics), and on activation raises the ghost's name so the
  // parent can jump straight to it (Req 12.1, 12.2).
  return (
    <div
      data-testid="scene-turning-soon"
      data-days-left={daysLeft}
      className={[
        "turning-soon-pulse inline-flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5",
        dayClass,
        "font-[family-name:var(--font-narrative)] italic leading-snug",
      ].join(" ")}
      style={noticeStyle}
    >
      {label}
      <button
        type="button"
        onClick={() => onGoTo(name)}
        data-testid="scene-turning-soon-goto"
        className={[
          "inline-flex items-center rounded border px-2 py-0.5 not-italic",
          "text-sm font-[family-name:var(--font-display)] uppercase tracking-wide",
          "cursor-pointer transition-[transform,filter] duration-200 ease-out",
          "motion-safe:hover:scale-[1.05]",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-candle-400)]",
        ].join(" ")}
        style={{
          borderColor: isDay
            ? "var(--color-day-gold-border)"
            : "var(--color-crimson-400)",
          color: isDay ? "var(--color-day-gold-ink)" : "var(--color-scene-fg)",
        }}
      >
        Go to it
      </button>
    </div>
  );
}
