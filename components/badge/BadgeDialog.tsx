"use client";

/**
 * Shared badge dialog: live preview, haunted/flat toggle and copyable
 * Markdown and HTML snippets. The parent mounts it only while open, so all
 * state (style, "Copied", failures) resets on every open.
 *
 * Requirements: 7.3-7.14, 8.2-8.6, 9.1-9.9
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { BadgeStyle } from "@/lib/badge";
import { buildBadgeSnippets, type BadgeTarget } from "@/lib/badge-snippets";
import { resolveSiteUrl } from "@/lib/site-meta";

export const COPIED_MESSAGE = "Copied";
export const COPY_FAILED_MESSAGE = "Could not copy. Select the text instead.";
/** How long "Copied" stays visible. */
export const COPIED_RESET_MS = 2000;

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type SnippetKind = "markdown" | "html";

export interface BadgeDialogProps {
  target: BadgeTarget;
  onClose: () => void;
  openerRef?: RefObject<HTMLElement | null>;
}

const BUTTON_CLASS =
  "seance-focus min-h-[44px] shrink-0 cursor-pointer rounded-sm border border-iron-500 bg-night-900 px-3 py-2 font-heading text-[13px] uppercase tracking-[0.08em] text-moon-100 hover:bg-night-sky motion-safe:transition-colors";

const TEXTAREA_CLASS =
  "seance-focus w-full resize-y break-all rounded-sm border border-iron-500 bg-night-950 p-2 font-fact text-[13px] text-moon-100";

const STYLES: ReadonlyArray<{ value: BadgeStyle; label: string }> = [
  { value: "haunted", label: "Haunted" },
  { value: "flat", label: "Flat" },
];

export function BadgeDialog({ target, onClose, openerRef }: BadgeDialogProps) {
  const headingId = useId();
  const groupName = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const openerRefRef = useRef(openerRef);
  useEffect(() => {
    onCloseRef.current = onClose;
    openerRefRef.current = openerRef;
  }, [onClose, openerRef]);

  const [style, setStyle] = useState<BadgeStyle>("haunted");
  const [previewFailedUrl, setPreviewFailedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState<SnippetKind | null>(null);

  const [site] = useState(
    () => resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL).origin,
  );
  const snippets = buildBadgeSnippets(site, target, style);
  const previewFailed = previewFailedUrl === snippets.previewUrl;

  const isRepo = target.kind === "repo";
  const heading = isRepo ? "Badge for this repo" : "Get a badge";
  const subject = isRepo ? `${target.owner}/${target.repo}` : target.owner;

  // Modal setup: remember opener, inert the rest of the page, focus in.
  useEffect(() => {
    const opener =
      openerRefRef.current?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    const changed: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === rootRef.current || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      changed.push(child);
    }
    closeRef.current?.focus();

    return () => {
      for (const el of changed) el.removeAttribute("inert");
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      try {
        const target = openerRefRef.current?.current ?? opener;
        if (target?.isConnected) target.focus();
      } catch {
        /* focus is best effort */
      }
    };
  }, []);

  // Escape and edge Tab wrapping on window in the capture phase.
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

  const announce = useCallback((message: string) => {
    setStatus("");
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setStatus(message);
    });
  }, []);

  const copy = useCallback(
    async (kind: SnippetKind, text: string) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      try {
        await navigator.clipboard.writeText(text);
        setCopied(kind);
        announce(COPIED_MESSAGE);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setCopied(null);
          setStatus("");
        }, COPIED_RESET_MS);
      } catch {
        setCopied(null);
        announce(COPY_FAILED_MESSAGE);
      }
    },
    [announce],
  );

  if (typeof document === "undefined") return null;

  const snippetBlock = (
    kind: SnippetKind,
    label: string,
    value: string,
    rows: number,
  ) => (
    <div className="mt-4 flex flex-col gap-2">
      <label
        htmlFor={`${groupName}-${kind}`}
        className="font-heading text-[13px] uppercase tracking-[0.08em] text-moon-300"
      >
        {label}
      </label>
      <textarea
        id={`${groupName}-${kind}`}
        readOnly
        rows={rows}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={TEXTAREA_CLASS}
      />
      <button
        type="button"
        className={`${BUTTON_CLASS} self-start`}
        onClick={() => void copy(kind, value)}
      >
        {copied === kind ? "Copied" : `Copy ${label}`}
      </button>
    </div>
  );

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
    >
      <div
        aria-hidden="true"
        data-testid="badge-backdrop"
        className="fixed inset-0 bg-night-950/80"
        onClick={() => onClose()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative my-auto max-h-[90vh] w-full max-w-[560px] overflow-y-auto break-words rounded-sm border border-ghost-300 bg-night-800 p-4 text-moon-100 shadow-[0_0_24px_var(--color-glow-ghost)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            className="m-0 font-heading text-[18px] uppercase tracking-[0.08em]"
          >
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose()}
            className={BUTTON_CLASS}
          >
            Close
          </button>
        </div>

        <div
          data-testid="badge-preview"
          className="mt-4 flex min-h-[44px] items-center rounded-sm bg-night-950 p-3"
        >
          {previewFailed ? (
            <p className="m-0 text-[14px] text-moon-300">
              Preview unavailable for {subject}.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- SVG endpoint; next/image adds nothing
            <img
              key={snippets.previewUrl}
              src={snippets.previewUrl}
              alt={`Repo Graveyard badge for ${subject}`}
              height={20}
              onError={() => setPreviewFailedUrl(snippets.previewUrl)}
            />
          )}
        </div>

        <fieldset className="m-0 mt-4 flex flex-wrap items-center gap-4 border-0 p-0">
          <legend className="mb-1 p-0 font-heading text-[13px] uppercase tracking-[0.08em] text-moon-300">
            Style
          </legend>
          {STYLES.map((s) => (
            <label
              key={s.value}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[15px]"
            >
              <input
                type="radio"
                name={`${groupName}-style`}
                value={s.value}
                checked={style === s.value}
                onChange={() => setStyle(s.value)}
                className="seance-focus size-4 cursor-pointer accent-candle-400"
              />
              {s.label}
            </label>
          ))}
        </fieldset>

        {snippetBlock("markdown", "Markdown", snippets.markdown, 3)}
        {snippetBlock("html", "HTML", snippets.html, 4)}

        <p
          role="status"
          aria-live="polite"
          className="m-0 mt-3 min-h-[1.5em] text-[14px] text-moon-300"
        >
          {status}
        </p>
      </div>
    </div>,
    document.body,
  );
}
