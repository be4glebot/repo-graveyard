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
import HelpTip from "@/components/ui/HelpTip";
import { useTheme } from "@/components/scene/ThemeProvider";

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

const STYLES: ReadonlyArray<{
  value: BadgeStyle;
  label: string;
  accessibleName: string;
  hint: string;
}> = [
  {
    value: "haunted",
    label: "Spooky",
    accessibleName: "Spooky (Haunted style)",
    hint: "Dark crimson and ghost colours, matches this site.",
  },
  {
    value: "flat",
    label: "Plain",
    accessibleName: "Plain (Flat style)",
    hint: "Neutral shield look that blends with other README badges.",
  },
];

/** Live thumbnail of one style, with a skeleton while loading and text on error. */
function StyleThumb({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached image can finish before React attaches onLoad.
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setState("loaded");
  }, []);
  return (
    <>
      {state === "loading" && (
        <span
          data-testid="style-thumb-loading"
          className="text-[12px] text-moon-300 motion-safe:animate-pulse"
        >
          Loading preview…
        </span>
      )}
      {state === "failed" ? (
        <span data-testid="style-thumb-failed" className="text-[12px] text-moon-300">
          Preview unavailable ({name.toLowerCase()} badge)
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- SVG endpoint
        <img
          ref={imgRef}
          src={url}
          alt=""
          height={20}
          data-testid="style-thumb"
          className={state === "loading" ? "hidden" : undefined}
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
        />
      )}
    </>
  );
}

export function BadgeDialog({ target, onClose, openerRef }: BadgeDialogProps) {
  const { theme } = useTheme();
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
  const heading = isRepo ? "Share this repo" : "Share your graveyard";
  const intro = isRepo
    ? "Show this repo\u2019s state (ghost, zombie, tombstone or coffin) on GitHub: paste the snippet below into your README and it displays a small live picture. It updates itself."
    : "Show your graveyard on your GitHub profile: paste the snippet below into your README and it displays a small live picture of your repos. It updates itself.";
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
        // An open (?) tip closes first; it handles its own Escape.
        if (dialogRef.current?.querySelector('[data-helptip-open="true"]')) return;
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
    caption: string,
  ) => (
    <div className="mt-4 flex flex-col gap-2">
      <label
        htmlFor={`${groupName}-${kind}`}
        className="font-heading text-[13px] uppercase tracking-[0.08em] text-moon-300"
      >
        {caption}
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
      data-theme={theme}
      className="day-panel fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
    >
      <div
        aria-hidden="true"
        data-testid="badge-backdrop"
        className="day-backdrop fixed inset-0 bg-night-950/80"
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

        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="m-0 text-[14px] leading-snug text-moon-300" data-testid="share-intro">
            {intro}
          </p>
            <HelpTip
              inline
              testId="share-help"
            >
              A small image that shows {isRepo ? "this repo\u2019s" : "your repos\u2019"} state, drawn live
              from GitHub. Paste the snippet into a README and the picture appears there. Choose Spooky (crimson and ghost colours) or Plain (a neutral shield). Nothing on GitHub is changed; to remove it, delete the snippet.
            </HelpTip>

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

        <fieldset
          role="radiogroup"
          className="m-0 mt-4 min-w-0 border-0 p-0"
        >
          <legend className="mb-2 p-0 font-heading text-[13px] uppercase tracking-[0.08em] text-moon-300">
            Pick a look
          </legend>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            {STYLES.map((s) => {
              const selected = style === s.value;
              const previewUrl = buildBadgeSnippets(site, target, s.value).previewUrl;
              return (
                <label
                  key={s.value}
                  data-testid={`style-card-${s.value}`}
                  data-selected={selected ? "true" : "false"}
                  className={`relative flex min-h-[44px] cursor-pointer flex-col gap-2 rounded-sm border p-3 motion-safe:transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-candle-400 ${
                    selected
                      ? "border-candle-400 bg-night-900 shadow-[0_0_0_1px_var(--color-candle-400)]"
                      : "border-iron-500 bg-night-950 hover:bg-night-900"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${groupName}-style`}
                    value={s.value}
                    checked={selected}
                    onChange={() => setStyle(s.value)}
                    aria-label={s.accessibleName}
                    aria-describedby={`${groupName}-hint-${s.value}`}
                    className="seance-focus absolute inset-0 m-0 size-full cursor-pointer opacity-0"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-heading text-[14px] uppercase tracking-[0.08em] text-moon-100">
                      {s.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`text-[12px] ${selected ? "text-candle-400" : "text-moon-300"}`}
                    >
                      {selected ? "\u25CF Selected" : "\u25CB"}
                    </span>
                  </span>
                  <span className="flex min-h-[32px] items-center rounded-sm bg-night-950 p-2">
                    <StyleThumb key={previewUrl} url={previewUrl} name={s.label} />
                  </span>
                  <span
                    id={`${groupName}-hint-${s.value}`}
                    className="text-[13px] leading-snug text-moon-300"
                  >
                    {s.hint}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {snippetBlock("markdown", "Markdown", snippets.markdown, 3, "Paste into your README (Markdown)")}
        {snippetBlock("html", "HTML", snippets.html, 4, "Or as HTML")}

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
