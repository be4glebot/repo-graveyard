"use client";

/**
 * "Hold a séance" control. Native button on the existing `.btn2` iron plaque.
 * While a séance is running or shown it uses `aria-disabled="true"` (never the
 * `disabled` attribute) so it stays focusable, and clicks are ignored.
 *
 * Requirements: 1.1, 1.2, 1.3, 18.4, 18.5
 */

import type { MouseEvent } from "react";

export interface SeanceControlProps {
  /** True while a séance is running or its result is shown. */
  busy: boolean;
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

export function SeanceControl({ busy, onActivate }: SeanceControlProps) {
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
      className="btn2 seance-focus"
      aria-disabled={busy ? "true" : undefined}
      onClick={handleClick}
    >
      <CandleGlyph />
      <span>Hold a séance</span>
    </button>
  );
}
