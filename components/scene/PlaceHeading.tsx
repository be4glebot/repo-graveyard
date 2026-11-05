"use client";

/**
 * Place heading (client component) — the in-place title and focus target.
 *
 * Renders a place's Cinzel display name as the primary heading of a
 * `PlaceView`, plus the IM Fell italic count line produced by `plaqueCopy`. The
 * heading is a `tabIndex={-1}` programmatic focus target: it is not reachable
 * by the Tab key on its own, but `PlaceView` moves keyboard focus here on
 * arrival (and the travel transition does on `done`) so screen-reader and
 * keyboard users land on the place's name and can read the plot (design:
 * "Accessibility — focus on arrival").
 *
 * The heading forwards its ref so the parent can call `.focus()` without
 * reaching into the DOM.
 *
 * Requirements: 5.1 (heading of the place view), 9.3/13.5 (focus target on arrival)
 */

import { forwardRef } from "react";

export interface PlaceHeadingProps {
  /** The place's Cinzel display name, e.g. "Beyond the Gate". */
  name: string;
  /** The IM Fell italic count line from `plaqueCopy`. */
  copy: string;
}

/**
 * The focusable heading. `tabIndex={-1}` keeps it out of the Tab order while
 * allowing programmatic `.focus()`; a candle focus ring marks it when focused
 * (it is only ever focused programmatically on arrival).
 */
const PlaceHeading = forwardRef<HTMLDivElement, PlaceHeadingProps>(
  function PlaceHeading({ name, copy }, ref) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        data-testid="place-heading"
        className={[
          "text-center outline-none",
          "focus-visible:ring-2 focus-visible:ring-candle-400",
        ].join(" ")}
      >
        <h1
          className="m-0 font-heading text-3xl font-bold uppercase tracking-[5px] text-scene-fg"
          style={{ textShadow: "0 1px 6px var(--color-night-sky)" }}
        >
          {name}
        </h1>
        <p className="m-0 mt-1 font-narrative text-lg italic text-scene-fg-muted">
          {copy}
        </p>
      </div>
    );
  },
);

export default PlaceHeading;
