"use client";

/**
 * Revive_Button and open state for the Revive_Dialog. Shown for a `revive`
 * verdict; closing the dialog returns focus to the button.
 *
 * Requirements: 2.1-2.9, 3.5
 */

import { useCallback, useRef, useState } from "react";
import type { ReviveFacts } from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";
import { ReviveDialog } from "./ReviveDialog";

export interface ReviveInKiroProps {
  result: SeanceResult;
  facts: ReviveFacts;
  onAnnounce?: (message: string) => void;
}

export function ReviveInKiro({ result, facts, onAnnounce }: ReviveInKiroProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="seance-focus inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm border border-ghost-300 bg-night-800 px-4 py-2 font-heading text-[13px] uppercase tracking-[0.08em] text-moon-100 shadow-[0_0_18px_var(--color-glow-ghost)] hover:bg-night-sky motion-safe:transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.2 1.5.8 2.5 1.8 3C10.5 8 11 5 12 2z" />
        </svg>
        <span>Revive in Kiro</span>
      </button>
      {open ? (
        <ReviveDialog
          result={result}
          facts={facts}
          onClose={handleClose}
          onAnnounce={onAnnounce}
        />
      ) : null}
    </>
  );
}
