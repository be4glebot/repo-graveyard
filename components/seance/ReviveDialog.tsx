"use client";

/**
 * Revive_Dialog: a portaled modal that hands the visitor a clone command,
 * a Kiro prompt and a REVIVAL.md download. Builders run only when an action
 * is activated. No network calls.
 *
 * Requirements: 3.1-3.16, 4.1-4.10
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BRIEF_FILE_NAME,
  ESTATE_DEMO_NOTICE,
  buildCloneCommand,
  buildKiroPrompt,
  buildReviveBrief,
  isEstateOwner,
  type ReviveFacts,
} from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";

export const COPIED_CLONE_MESSAGE = "Copied clone command";
export const COPIED_PROMPT_MESSAGE = "Copied Kiro prompt";
export const COPY_FAILED_MESSAGE = "Could not copy. Select the text instead.";
export const DOWNLOADED_MESSAGE = "Downloaded REVIVAL.md";
export const DOWNLOAD_FAILED_MESSAGE =
  "Could not download. Copy the Kiro prompt instead.";

/** Delay before an object URL is revoked (must stay under 10000 ms). */
const REVOKE_DELAY_MS = 1000;

const FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface ReviveDialogProps {
  result: SeanceResult;
  facts: ReviveFacts;
  onClose: () => void;
  onAnnounce?: (message: string) => void;
}

const ACTION_CLASS =
  "seance-focus min-h-[44px] w-full cursor-pointer break-words rounded-sm border border-ghost-300 bg-night-900 px-4 py-2 font-heading text-[13px] uppercase tracking-[0.08em] text-moon-100 hover:bg-night-sky sm:w-auto";

export function ReviveDialog({
  result,
  facts,
  onClose,
  onAnnounce,
}: ReviveDialogProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  const cloneCommand = buildCloneCommand(facts);
  const estate = isEstateOwner(facts.owner);

  // Initial focus and entry fade.
  useEffect(() => {
    closeRef.current?.focus();
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // Escape and Tab on window in the capture phase, ahead of DetailPanel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active !== null && root.contains(active);
      if (!inside) {
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        last.focus();
      } else if (!e.shiftKey && active === last) {
        first.focus();
      } else {
        const idx = items.indexOf(active);
        items[idx + (e.shiftKey ? -1 : 1)].focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const announce = useCallback(
    (message: string) => {
      setStatus("");
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setStatus(message);
      });
      onAnnounce?.(message);
    },
    [onAnnounce],
  );

  const copy = useCallback(
    async (build: () => string, okMessage: string) => {
      try {
        await navigator.clipboard.writeText(build());
        announce(okMessage);
      } catch {
        setCopyFailed(true);
        announce(COPY_FAILED_MESSAGE);
      }
    },
    [announce],
  );

  const download = useCallback(() => {
    let url: string | null = null;
    try {
      const blob = new Blob([buildReviveBrief(result, facts)], {
        type: "text/markdown;charset=utf-8",
      });
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = BRIEF_FILE_NAME;
      a.hidden = true;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        a.remove();
      }
      const created = url;
      setTimeout(() => URL.revokeObjectURL(created), REVOKE_DELAY_MS);
      announce(DOWNLOADED_MESSAGE);
    } catch {
      if (url !== null) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* nothing to release */
        }
      }
      announce(DOWNLOAD_FAILED_MESSAGE);
    }
  }, [result, facts, announce]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        data-testid="revive-backdrop"
        className="fixed inset-0 bg-night-950/80"
        onClick={() => onClose()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`relative my-auto max-h-[90vh] w-full max-w-[560px] overflow-y-auto break-words rounded-sm border border-ghost-300 bg-night-800 p-4 text-moon-100 shadow-[0_0_24px_var(--color-glow-ghost)] transition-opacity duration-200 sm:p-6 motion-safe:transition-[opacity,transform] motion-safe:duration-200 ${
          shown
            ? "opacity-100 motion-safe:translate-y-0"
            : "opacity-0 motion-safe:translate-y-2"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            className="m-0 font-heading text-[18px] uppercase tracking-[0.08em]"
          >
            Raise it in Kiro
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose()}
            className="seance-focus min-h-[44px] shrink-0 cursor-pointer rounded-sm border border-iron-500 bg-night-900 px-3 py-2 font-heading text-[13px] uppercase tracking-[0.08em] text-moon-100 hover:bg-night-sky"
          >
            Close
          </button>
        </div>

        <p className="m-0 mt-4 break-all rounded-sm bg-night-950 p-3 font-fact text-[13px] text-moon-100">
          {cloneCommand}
        </p>

        {estate ? (
          <p
            data-testid="estate-demo-note"
            className="m-0 mt-2 text-[14px] leading-[1.5] text-moon-300"
          >
            {ESTATE_DEMO_NOTICE}
          </p>
        ) : null}

        <ol className="m-0 mt-4 list-decimal pl-5 text-[15px] leading-[1.6]">
          <li>Clone the repo.</li>
          <li>Open the folder in Kiro.</li>
          <li>
            Paste the prompt into Kiro chat, with REVIVAL.md in the repo root.
          </li>
        </ol>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className={ACTION_CLASS}
            onClick={() => void copy(() => cloneCommand, COPIED_CLONE_MESSAGE)}
          >
            Copy clone command
          </button>
          <button
            type="button"
            className={ACTION_CLASS}
            onClick={() =>
              void copy(
                () => buildKiroPrompt(result, facts),
                COPIED_PROMPT_MESSAGE,
              )
            }
          >
            Copy Kiro prompt
          </button>
          <button type="button" className={ACTION_CLASS} onClick={download}>
            Download REVIVAL.md
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          data-revive-status
          className="m-0 mt-3 min-h-[1.5em] text-[14px] text-moon-300"
        >
          {status}
        </p>

        {copyFailed ? (
          <div className="mt-3 flex flex-col gap-3">
            <textarea
              readOnly
              aria-label="Clone command"
              rows={2}
              value={cloneCommand}
              className="seance-focus w-full resize-y break-all rounded-sm border border-iron-500 bg-night-950 p-2 font-fact text-[13px] text-moon-100"
            />
            <textarea
              readOnly
              aria-label="Kiro prompt"
              rows={8}
              value={buildKiroPrompt(result, facts)}
              className="seance-focus w-full resize-y rounded-sm border border-iron-500 bg-night-950 p-2 font-fact text-[13px] text-moon-100"
            />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
