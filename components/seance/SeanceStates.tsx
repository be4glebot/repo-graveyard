"use client";

/**
 * Non-result séance states, in candle and smoke language (no alert box, no
 * error icon, no role="alert"). Veil and Weak offer the Sample_Estate link and
 * no retry; Silent offers "Light another candle".
 *
 * Requirements: 1.4, 1.6, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.7, 9.9, 18.4, 18.5
 */

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

/** Dim candle with drifting smoke; decorative only. */
function GutteredCandle({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 40"
      width="24"
      height="40"
      aria-hidden="true"
      focusable="false"
      className="text-candle-tan"
    >
      <rect x="9" y="16" width="6" height="22" fill="currentColor" opacity="0.5" />
      {lit ? (
        <path
          d="M12 4 C16 10 17 13 12 16 C7 13 8 10 12 4 Z"
          fill="currentColor"
          className="text-candle-400"
          opacity="0.35"
        />
      ) : (
        <path
          d="M12 14 C9 10 15 8 12 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.4"
          className="ritual-smoke"
        />
      )}
    </svg>
  );
}

function TourTheEstateLink() {
  return (
    <Link
      href="/estate"
      className="seance-focus inline-flex h-11 items-center gap-2 rounded border border-crimson-500 bg-crimson-700 px-5 font-heading text-[13px] font-bold uppercase tracking-[1.5px] text-crimson-200"
    >
      Tour the estate
    </Link>
  );
}

function StatePanel({
  state,
  children,
}: {
  state: string;
  children: ReactNode;
}) {
  return (
    <div
      data-seance-state={state}
      className="flex flex-col items-center gap-3 px-4 py-5 text-center"
    >
      {children}
    </div>
  );
}

const BODY_CLASS =
  "m-0 max-w-[340px] font-narrative text-[17px] italic leading-[1.45] text-moon-300";

export function VeilState() {
  return (
    <StatePanel state="veil">
      <GutteredCandle lit={false} />
      <p className={BODY_CLASS}>
        The veil is too thin tonight. Return after midnight.
      </p>
      <TourTheEstateLink />
    </StatePanel>
  );
}

export function WeakGhostState() {
  return (
    <StatePanel state="weak">
      <GutteredCandle lit={false} />
      <h4 className="m-0 font-heading text-[17px] tracking-[2px] text-moon-100">
        The ghost is too weak to speak
      </h4>
      <p className={BODY_CLASS}>
        The séance is resting for tonight. Facts and the record still work;
        only the ghost&rsquo;s voice is quiet.
      </p>
      <TourTheEstateLink />
    </StatePanel>
  );
}

export interface SilentFallbackProps {
  onRetry: () => void;
  /** True while a retry is in flight. */
  retrying?: boolean;
}

export function SilentFallback({ onRetry, retrying = false }: SilentFallbackProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (retrying) {
      event.preventDefault();
      return;
    }
    onRetry();
  };

  return (
    <StatePanel state="silent">
      <GutteredCandle lit />
      <p className={BODY_CLASS}>
        The spirits are silent tonight. The candle gutters out.
      </p>
      <button
        type="button"
        className="btn2 seance-focus"
        aria-disabled={retrying ? "true" : undefined}
        onClick={handleClick}
      >
        Light another candle
      </button>
    </StatePanel>
  );
}
