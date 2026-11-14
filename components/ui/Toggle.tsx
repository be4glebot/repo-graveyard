"use client";

/**
 * Accessible on/off toggle switch (client component).
 *
 * A single native `<button role="switch">` whose pressed state is reflected via
 * `aria-checked` (the ARIA state a switch uses). The control is fully keyboard
 * operable: it is
 * in the natural tab order, Enter and Space both toggle it, and Space's default
 * page-scroll is suppressed. A visible focus ring is drawn with the candle
 * focus token (Req 9.4) — never a hardcoded color.
 *
 * This component is intentionally "state-only": it renders and announces the
 * boolean it is given and calls `onChange(next)` when activated. It performs no
 * side effects of its own, so a caller may wire it to real behavior (the
 * Lights-on toggle) or leave it purely reflective (the deferred sound toggle,
 * Req 13.1, 13.2).
 *
 * The control wears the styled bordered-button treatment to match the painted
 * boards (Req 15.4): a bordered pill with a dark fill, the label in the
 * letter-spaced Cinzel face, and the on/off track + knob inside it. The border
 * and fill warm toward candle when the switch is on.
 *
 * Requirements: 7.7, 9.4, 13.1, 13.2, 15.4
 */

import { useId, type KeyboardEvent } from "react";

export interface ToggleProps {
  /** Current on/off state. */
  pressed: boolean;
  /** Called with the next state when the control is activated. */
  onChange: (next: boolean) => void;
  /** Accessible label describing what the toggle controls (e.g. "Lights on"). */
  label: string;
  /** Optional id for the control; auto-generated when omitted. */
  id?: string;
  /** Optional text shown for the on/off state; defaults to "On"/"Off". */
  onLabel?: string;
  offLabel?: string;
  /** Plain-words explanation, exposed as a tooltip and an accessible description. */
  hint?: string;
}

export default function Toggle({
  pressed,
  onChange,
  label,
  id,
  onLabel = "On",
  offLabel = "Off",
  hint,
}: ToggleProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;
  const controlId = id ?? generatedId;

  function toggle() {
    onChange(!pressed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Space would otherwise scroll the page; Enter has no default here but we
    // handle it uniformly so both keys flip the switch (native <button> already
    // fires click on Enter/Space, but handling the keys explicitly keeps the
    // behavior intentional and prevents Space's scroll).
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      toggle();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <button
      type="button"
      id={controlId}
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      aria-describedby={hint ? hintId : undefined}
      title={hint}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      data-testid="styled-toggle"
      className={
        "day-chrome-btn inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm " +
        "text-scene-fg transition-colors " +
        (pressed
          ? "border-candle-400 bg-candle-400/15"
          : "border-scene-fg-faint bg-night-sky/60 hover:bg-candle-400/10") +
        " focus:outline-none focus-visible:outline-none " +
        "focus-visible:ring-2 focus-visible:ring-candle-400 focus-visible:ring-offset-2 " +
        "focus-visible:ring-offset-night-sky"
      }
    >
      {/* Track + knob. The track tints toward candle when on, stays muted when
          off; the knob slides to the right when on. Pointer-events are left on
          the button so the whole control is one hit target. */}
      <span
        aria-hidden="true"
        className={
          "relative inline-flex h-5 w-9 flex-none items-center rounded-full " +
          "border transition-colors " +
          (pressed
            ? "border-candle-400 bg-candle-400/70"
            : "border-scene-fg-faint bg-scene-fg-faint/30")
        }
      >
        <span
          className={
            "inline-block h-3.5 w-3.5 transform rounded-full bg-scene-fg " +
            "shadow transition-transform " +
            (pressed ? "translate-x-4" : "translate-x-1")
          }
        />
      </span>
      <span className="font-heading text-xs font-bold uppercase tracking-[1.5px]">
        {label}
        <span className="ml-1 text-scene-fg-muted">
          {pressed ? onLabel : offLabel}
        </span>
      </span>
      {hint ? (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
