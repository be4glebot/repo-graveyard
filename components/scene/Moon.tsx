/**
 * The moon: a code-drawn disc whose treatment encodes overall graveyard health.
 *
 * The moon is drawn entirely in code and positioned over the Parallax_Backdrop
 * (Req 3.1). Its treatment is decided by the pure `moonTreatment(rows)`
 * view-model function: `"blood-red"` when the undead (zombie + risen) outnumber
 * the settled (ghost + tombstone), otherwise `"pale"` (Req 3.2). This component
 * recomputes no threshold of its own — it delegates the comparison to
 * `moonTreatment` and the per-state tallies to `summaryCounts`.
 *
 * The blood-red glow is proportional to the undead share: the fraction of all
 * souls that are zombie or risen, `(zombie + risen) / souls`, guarded against a
 * divide-by-zero when there are no souls. That share scales both the glow
 * spread and its opacity, so a graveyard that is barely over the blood-red line
 * glows faintly while an overrun one glows hard. In the pale treatment the glow
 * is the calm, fixed pale halo.
 *
 * Purely presentational: no state, no clock, no I/O. All colors come from
 * `@theme` tokens (`--color-moon-pale`, `--color-moon-blood`,
 * `--color-moon-glow-pale`, `--color-moon-glow-blood`, `--color-moon-crater`);
 * no hardcoded hex appears here.
 *
 * Requirements: 3.1, 3.2
 */

import { moonTreatment, summaryCounts } from "@/lib/scene-view";
import type { GraveyardRow } from "@/lib/graveyard-view";

/** Base glow blur radius (px) at zero intensity for the blood-red treatment. */
const BLOOD_GLOW_BASE_BLUR = 80;
/** Additional blood-red glow blur (px) added at full undead share. */
const BLOOD_GLOW_MAX_EXTRA_BLUR = 90;
/** Base blood-red glow spread (px) at zero intensity. */
const BLOOD_GLOW_BASE_SPREAD = 20;
/** Additional blood-red glow spread (px) added at full undead share. */
const BLOOD_GLOW_MAX_EXTRA_SPREAD = 50;

/** Pale-treatment glow, independent of the undead share. */
const PALE_GLOW_BLUR = 110;
const PALE_GLOW_SPREAD = 36;

export interface MoonProps {
  /** Classified rows the treatment and undead share are derived from. */
  rows: GraveyardRow[];
  /** Extra classes for the moon wrapper (e.g. positioning within the Scene). */
  className?: string;
}

/**
 * Undead share in [0, 1]: the fraction of souls that are zombie or risen.
 * Guards the divide-by-zero for an empty graveyard (no souls → share 0).
 */
function undeadShare(rows: GraveyardRow[]): number {
  const { souls, zombie, risen } = summaryCounts(rows);
  if (souls <= 0) {
    return 0;
  }
  return (zombie + risen) / souls;
}

export default function Moon({ rows, className }: MoonProps) {
  const treatment = moonTreatment(rows);
  const isBlood = treatment === "blood-red";

  // The undead share scales the blood-red glow; the pale glow is fixed. Clamp
  // defensively so a surprising input can never push the glow outside its band.
  const share = Math.min(1, Math.max(0, undeadShare(rows)));

  const fill = isBlood
    ? "var(--color-moon-blood)"
    : "var(--color-moon-pale)";

  const glowColor = isBlood
    ? "var(--color-moon-glow-blood)"
    : "var(--color-moon-glow-pale)";

  const blur = isBlood
    ? BLOOD_GLOW_BASE_BLUR + BLOOD_GLOW_MAX_EXTRA_BLUR * share
    : PALE_GLOW_BLUR;
  const spread = isBlood
    ? BLOOD_GLOW_BASE_SPREAD + BLOOD_GLOW_MAX_EXTRA_SPREAD * share
    : PALE_GLOW_SPREAD;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute right-[24%] top-[8%] h-[130px] w-[130px] rounded-full${
        className ? ` ${className}` : ""
      }`}
      style={{
        backgroundColor: fill,
        boxShadow: `0 0 ${Math.round(blur)}px ${Math.round(spread)}px ${glowColor}`,
      }}
    >
      {/* Craters: a few token-tinted dimples so the disc reads as a moon. */}
      <span
        className="absolute left-[28%] top-[32%] h-[23%] w-[23%] rounded-full"
        style={{ backgroundColor: "var(--color-moon-crater)" }}
      />
      <span
        className="absolute left-[75%] top-[66%] h-[15%] w-[15%] rounded-full"
        style={{ backgroundColor: "var(--color-moon-crater)" }}
      />
      <span
        className="absolute left-[48%] top-[89%] h-[11%] w-[11%] rounded-full"
        style={{ backgroundColor: "var(--color-moon-crater)" }}
      />
    </div>
  );
}
