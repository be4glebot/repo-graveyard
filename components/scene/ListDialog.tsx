"use client";

/**
 * "View as list" dialog: the warm-paper register table, shown over the scene
 * as an accessible modal. Controlled by the parent (Header), which keeps the
 * scene mounted behind it. Focus moves in on open, Tab wraps inside, Escape
 * closes, and focus restoration is left to the parent's opener ref.
 *
 * Requirements: 5.3, 5.5, 5.6
 */

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import type { GraveyardRow } from "@/lib/graveyard-view";
import LightsOnTable from "@/components/scene/LightsOnTable";
import { useTheme } from "@/components/scene/ThemeProvider";

export interface ListDialogProps {
  open: boolean;
  onClose: () => void;
  rows: GraveyardRow[];
  username?: string;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const CLOSE_CLASS =
  "seance-focus min-h-[44px] shrink-0 cursor-pointer rounded-sm border border-ink-400 bg-paper-100 px-3 py-2 font-heading text-[13px] uppercase tracking-[0.08em] text-ink-900 hover:bg-ink-tag-bg motion-safe:transition-colors";

function ListDialogBody({ onClose, rows, username }: Omit<ListDialogProps, "open">) {
  const { theme } = useTheme();
  const headingId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Inert the rest of the page and move focus in.
  useEffect(() => {
    const changed: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === rootRef.current || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      changed.push(child);
    }
    closeRef.current?.focus();
    return () => {
      for (const el of changed) el.removeAttribute("inert");
    };
  }, []);

  // Escape and Tab wrapping, captured on window.
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
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active !== null && root.contains(active);
      if (!inside) {
        e.preventDefault();
        e.stopPropagation();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        e.stopPropagation();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        e.stopPropagation();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      data-theme={theme}
      className="day-panel fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
    >
      <div
        aria-hidden="true"
        data-testid="list-backdrop"
        className="day-backdrop fixed inset-0 bg-night-950/80"
        onClick={() => onClose()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative my-auto max-h-[90vh] w-full max-w-[860px] overflow-y-auto rounded-sm border border-paper-border bg-paper-200 p-4 text-ink-900 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            className="m-0 font-heading text-[18px] uppercase tracking-[0.08em]"
          >
            Every project, all in one place
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose()}
            className={CLOSE_CLASS}
          >
            Close
          </button>
        </div>
        <div className="mt-4">
          <LightsOnTable rows={rows} username={username} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ListDialog({ open, ...rest }: ListDialogProps) {
  if (!open || typeof document === "undefined") return null;
  return <ListDialogBody {...rest} />;
}

export { ListDialog };
