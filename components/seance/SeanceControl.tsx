"use client";

/**
 * "Hold a séance": the primary control of the Actions section. Native button,
 * ember border, ghost-300 text on night-800, full width on mobile (see
 * `.seance-primary`). While a séance is running or shown it uses
 * `aria-disabled="true"` (never the `disabled` attribute) so it stays
 * focusable, reads "The circle is open…" and ignores clicks. The accessible
 * name keeps "Hold a séance" and contains the visible text. Once a result or
 * fallback is showing it is enabled again and reads "Hold another séance".
 *
 * Requirements: 1.1, 1.2, 1.3, 18.4, 18.5
 */

import type { MouseEvent } from "react";

export interface SeanceControlProps {
  /** True while a séance is running (ritual or reveal). */
  busy: boolean;
  /** True once a result or fallback is showing: the control offers another séance. */
  again?: boolean;
  onActivate: () => void;
}

/** Decorative candle glyph; colours via currentColor and tokens only. */
function CandleGlyph() {
  return (
    <svg
      viewBox="0 0 12 18"
      width="12"
      height="18"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 text-candle-400"
    >
      <path d="M6 0 C8 3 8.5 4.5 6 6.5 C3.5 4.5 4 3 6 0 Z" fill="currentColor" />
      <rect x="4" y="7.5" width="4" height="10" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function SeanceControl({ busy, again = false, onActivate }: SeanceControlProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    onActivate();
  };

  return (
    <button
      type="button"
      className="seance-primary seance-focus"
      aria-disabled={busy ? "true" : undefined}
      aria-label={busy ? "Hold a séance. The circle is open…" : undefined}
      onClick={handleClick}
    >
      <CandleGlyph />
      <span>{busy ? "The circle is open…" : again ? "Hold another séance" : "Hold a séance"}</span>
    </button>
  );
}
