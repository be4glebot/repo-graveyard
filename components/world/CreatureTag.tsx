/**
 * CreatureTag: the mounted name tag of a creature in a world (design D6).
 *
 * Rendered as a descendant of the creature's button, absolutely positioned at
 * the feet, so it never changes the button's border box (Req 10.3) and a click
 * or hover on it reaches the Creature (Req 18.11). It is `aria-hidden`: the
 * button's accessible name already says the full name, so it is not announced
 * twice. The full name is in `title`. Text is at least 12px (`text-xs`).
 *
 * Variants: grave marker (tombstone), hanging (coffin), lantern (ghost; the
 * brightness steps with the ghost lantern level), stake (zombie and risen).
 *
 * Requirements: 18.7, 18.11, 10.3
 */

import { effectProps, ghostLanternLevel } from "@/lib/world-effects";

export type CreatureTagVariant = "grave-marker" | "hanging" | "lantern" | "stake";

export interface CreatureTagProps {
  variant: CreatureTagVariant;
  /** Full repo name (also the `title`). */
  name: string;
  /** Optional mono sub-line (for example a days-quiet phrase from data). */
  subline?: string;
  /** Ghost decay level; only the lantern variant reads it. */
  decayLevel?: number | null;
  /** Brightness of the parent creature filter; the tag cancels it so text keeps its contrast (Req 18.5). */
  parentBrightness?: number;
  /** Hanging variant in the crypt: the chains get one Discovery_Reveal (transform/opacity, 600 ms or less). */
  chainReveal?: boolean;
}

/** Lantern opacity per level 0..3 (0 brightest). */
const LANTERN_OPACITY = [1, 0.85, 0.7, 0.55] as const;

export default function CreatureTag({
  variant,
  name,
  subline,
  decayLevel,
  parentBrightness,
  chainReveal = false,
}: CreatureTagProps) {
  const level = variant === "lantern" ? ghostLanternLevel(decayLevel) : undefined;

  return (
    <span
      data-testid="scatter-plaque"
      data-variant={variant}
      data-lantern-level={level}
      aria-hidden="true"
      title={name}
      className="pointer-events-auto absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center"
      style={
        parentBrightness && parentBrightness > 0 && parentBrightness < 1
          ? { filter: `brightness(${(1 / parentBrightness).toFixed(3)})` }
          : undefined
      }
    >
      {variant === "hanging" ? (
        <span
          className={chainReveal ? "world-reveal flex gap-3" : "flex gap-3"}
          data-part="chains"
          {...(chainReveal ? { "data-reveal": "", ...effectProps("chain-reveal") } : null)}
        >
          <span className="h-2 w-px bg-[color:var(--color-iron-border,currentColor)]" />
          <span className="h-2 w-px bg-[color:var(--color-iron-border,currentColor)]" />
        </span>
      ) : null}
      {variant === "lantern" ? (
        <span
          data-part="lantern"
          {...effectProps("ghost-lantern")}
          className="mb-0.5 h-2 w-2 rounded-full bg-[color:var(--color-candle-400)]"
          style={{ opacity: LANTERN_OPACITY[level ?? 0] }}
        />
      ) : null}
      <span
        className={[
          "block max-w-[11rem] truncate whitespace-nowrap border px-2 py-0.5 text-center",
          "border-[color:var(--color-plaque-border)]",
          "bg-[linear-gradient(to_bottom,var(--color-plaque-bg-top),var(--color-plaque-bg-bottom))]",
          "text-[color:var(--color-plaque-name)]",
          variant === "grave-marker" ? "rounded-t-lg" : "rounded-sm",
        ].join(" ")}
      >
        <span className="block truncate font-heading text-xs leading-tight">{name}</span>
        {subline ? (
          <span className="block font-fact text-xs leading-tight text-[color:var(--color-plaque-sub)]">
            {subline}
          </span>
        ) : null}
      </span>
      {variant === "grave-marker" || variant === "stake" ? (
        <span
          data-part={variant === "stake" ? "stake" : "peg"}
          className={[
            "block w-0.5 bg-[color:var(--color-iron-border,currentColor)]",
            variant === "stake" ? "h-3" : "h-1",
          ].join(" ")}
        />
      ) : null}
    </span>
  );
}
