"use client";

/**
 * Return-to-the-gate control (client component).
 *
 * The control in a `PlaceView` that leaves the place and returns to the estate
 * map. It is a native `<button>`, so it is keyboard-focusable and activatable
 * by pointer click and by the Enter and Space keys (the browser fires `click`
 * for both on a button); Space's default page-scroll is suppressed so the view
 * swaps cleanly. On activation it invokes `onReturn`, which `SceneView` wires to
 * set the view back to the map and move focus to the originating place link
 * (Req 9.1, 9.2, 9.3).
 *
 * Styling is the mock's bordered `.btn` treatment, all from `@theme` tokens.
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { useCallback, type KeyboardEvent } from "react";

export interface ReturnToGateProps {
  /** Raised when the control is activated (click / Enter / Space). */
  onReturn: () => void;
}

export default function ReturnToGate({ onReturn }: ReturnToGateProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      // A native button already fires click on Enter/Space; handling the keys
      // explicitly keeps activation consistent and stops Space from scrolling
      // the page out from under the view swap (Req 9.2).
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "Spacebar"
      ) {
        event.preventDefault();
        onReturn();
      }
    },
    [onReturn],
  );

  return (
    <button
      type="button"
      data-testid="return-to-gate"
      onClick={onReturn}
      onKeyDown={handleKeyDown}
      className={[
        // Bevelled iron plaque button from the boards (.btn2): the base class
        // owns the box, Cinzel uppercase label, border, and background (Req
        // 7.1). The utilities below carry only interaction state (cursor,
        // hover, focus ring, transition).
        "btn2 pointer-events-auto cursor-pointer transition-colors hover:bg-candle-400/10",
        "outline-none focus-visible:ring-2 focus-visible:ring-candle-400",
      ].join(" ")}
    >
      ← Return to the gate
    </button>
  );
}
