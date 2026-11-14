"use client";

/**
 * Small (?) help control: a disclosure button that reveals a short plain-words
 * explanation. Keyboard reachable (a native button), Enter/Space toggle it,
 * Escape closes it and returns focus to the button, clicking elsewhere closes
 * it. While open the root carries `data-helptip-open="true"` so a surrounding
 * modal can let Escape close the tip first instead of closing itself.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface HelpTipProps {
  /** Accessible name of the button, e.g. "What is this?". */
  label?: string;
  /** The explanation shown when open. */
  children: ReactNode;
  /** Which edge of the button the popover lines up with. */
  align?: "start" | "end";
  /** Extra classes for the wrapper. */
  className?: string;
  /** Show the label next to the (?) and open the text in the flow (no overlay). */
  inline?: boolean;
  /** Test id on the button. */
  testId?: string;
}

export default function HelpTip({
  label = "What is this?",
  children,
  align = "start",
  className = "",
  inline = false,
  testId = "help-tip",
}: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      data-helptip-open={open ? "true" : undefined}
      className={
        inline
          ? `pointer-events-auto flex flex-wrap items-center gap-2 ${className}`
          : `pointer-events-auto relative inline-flex ${className}`
      }
    >
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={"seance-focus inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border border-iron-500 bg-night-900 font-ui text-xs font-bold text-moon-100 hover:border-candle-400 motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 " + (inline ? "min-h-8 rounded-full px-2" : "size-6 rounded-full")}
      >
        <span aria-hidden="true">?</span>
        {inline ? <span>{label}</span> : null}
      </button>
      <span
        id={panelId}
        role="note"
        hidden={!open}
        data-testid={`${testId}-panel`}
        className={
          (inline ? "basis-full " : "absolute top-full z-[90] mt-2 w-64 max-w-[80vw] ") + "rounded-sm border border-iron-500 bg-night-900 p-3 text-left font-ui text-xs font-normal normal-case leading-snug tracking-normal text-moon-100 shadow-lg " +
          (inline ? "" : align === "end" ? "right-0" : "left-0")
        }
      >
        {children}
      </span>
    </span>
  );
}
