"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { MutableRefObject, RefObject } from "react";
import { createPortal } from "react-dom";
import type { LifecycleState } from "@/lib/lifecycle";
import type { RepoFacts } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";
import { decayWord } from "@/lib/repoDetails/decayWord";
import { explanationLine } from "@/lib/repoDetails/explanationLine";
import { buildGitHubUrl } from "@/lib/repoDetails/githubUrl";
import { homepageDomain, isValidHttpsHomepage } from "@/lib/repoDetails/homepage";
import { useIsCompact } from "@/components/ui/useIsCompact";
import ExternalLink from "./ExternalLink";
import Portrait from "./Portrait";
import {
  SeanceButton,
  SeanceProvider,
  SeanceRegion,
} from "@/components/seance/SeanceRegion";

export interface DetailPanelProps {
  /** Pre-written séance for a Haunted Estate repo; only passed when `isFixture`. */
  seanceFixture?: unknown;
  row: RepoRow | undefined;
  owner: string;
  classification: { state: LifecycleState; decayLevel: number | null };
  facts: RepoFacts;
  renderedAt: string;
  isFixture: boolean;
  revivedAt?: string | null;
  onClose: () => void;
  /** Returns the scene root that receives `inert` while the panel is open. */
  getInertTarget?: () => HTMLElement | null;
  /** Alternative to `getInertTarget`: id of the scene root element. */
  sceneRootId?: string;
  /** The element that opened the panel; defaults to `document.activeElement` at open. */
  openerRef?: RefObject<HTMLElement | null>;
  /** Persistent element to focus on close when the opener is gone. */
  getFallbackFocus?: () => HTMLElement | null;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

function useMedia(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia(query).matches
        : serverValue,
    () => serverValue,
  );
}

const subscribeNoop = () => () => {};

export default function DetailPanel(props: DetailPanelProps) {
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  // Lookup miss: render nothing, with no inert and no scroll lock.
  if (!props.row || !isClient) return null;
  return createPortal(<PanelModal {...props} row={props.row} />, document.body);
}

function PanelModal({
  row,
  owner,
  classification,
  facts,
  renderedAt,
  isFixture,
  revivedAt,
  onClose,
  getInertTarget,
  sceneRootId,
  openerRef,
  getFallbackFocus,
  seanceFixture,
}: DetailPanelProps & { row: RepoRow }) {
  const headingId = useId();
  // Filled by SeanceRegion; Escape asks it first (skip ritual / settle reveal).
  const escapeClaimRef = useRef<(() => boolean) | null>(null);
  const [ritual, setRitual] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [shown, setShown] = useState(false);
  // Compact (< MOBILE_BREAKPOINT): full-height sheet. Layout classes below use
  // max-[767px]/min-[768px]; this query only picks the slide direction.
  const compact = useIsCompact();
  const reduced = useMedia("(prefers-reduced-motion: reduce)", true);
  const openerRefHolder = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Inert background + scroll lock + focus management for the open lifetime.
  useEffect(() => {
    openerRefHolder.current =
      openerRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const target =
      getInertTarget?.() ??
      (sceneRootId ? document.getElementById(sceneRootId) : null);
    const hadInert = target?.hasAttribute("inert") ?? false;
    target?.setAttribute("inert", "");

    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `${-scrollY}px`;
    body.style.width = "100%";

    closeRef.current?.focus();
    const raf = requestAnimationFrame(() => setShown(true));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (escapeClaimRef.current?.()) return;
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      if (target && !hadInert) target.removeAttribute("inert");
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);

      const opener = openerRefHolder.current;
      const dest =
        opener && opener.isConnected ? opener : (getFallbackFocus?.() ?? null);
      try {
        (dest ?? document.body).focus({ preventScroll: true });
      } catch {
        // Focus restore is best effort; never throw during cleanup.
      }
    };
    // Open lifetime only: props captured at open are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duration = reduced ? "200ms" : "220ms";
  const hidden = reduced
    ? "none"
    : compact
      ? "translateY(100%)"
      : "translateX(100%)";

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        data-testid="detail-overlay"
        onClick={onClose}
        className="absolute inset-0 bg-night-sky"
        style={{
          opacity: shown ? 0.45 : 0,
          transition: `opacity ${duration} ease-out`,
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="absolute overflow-y-auto bg-night-800 text-moon-100 max-[767px]:inset-0 max-[767px]:h-dvh max-[767px]:w-full max-[767px]:overscroll-contain max-[767px]:rounded-none min-[768px]:right-0 min-[768px]:top-0 min-[768px]:h-full min-[768px]:w-[420px] min-[768px]:max-w-full"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? "none" : hidden,
          transition: reduced
            ? `opacity ${duration} ease-out`
            : `opacity ${duration} ease-out, transform ${duration} ease-out`,
        }}
      >
        <SeanceProvider
          key={`${owner}/${row.name}`}
          owner={owner}
          repo={row.name}
          fixture={seanceFixture}
          isFixture={isFixture}
          reduced={reduced}
        >
          {/* Header sits above the ritual layer (z-10) so Close stays usable. */}
          <div className="relative z-20 flex items-start justify-between gap-3 p-4 max-[767px]:sticky max-[767px]:top-0 max-[767px]:items-center max-[767px]:bg-night-800">
            <h2
              id={headingId}
              className="font-heading text-xl uppercase tracking-[2px]"
            >
              {row.name}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close record"
              className="cursor-pointer rounded-md max-[767px]:inline-flex max-[767px]:min-h-11 max-[767px]:min-w-11 max-[767px]:items-center max-[767px]:justify-center border border-candle-400 px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-candle-400"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <Portrait
            name={row.name}
            state={classification.state}
            decayLevel={classification.decayLevel}
            ritual={ritual}
          />
          <PanelContent
            row={row}
            owner={owner}
            classification={classification}
            facts={facts}
            renderedAt={renderedAt}
            isFixture={isFixture}
            revivedAt={revivedAt}
            ritual={ritual}
            reduced={reduced}
            onRitualChange={setRitual}
            escapeClaimRef={escapeClaimRef}
          />
        </SeanceProvider>
      </div>
    </div>
  );
}

/** Single fixed fallback for languages with no defined color. */
const FALLBACK_LANGUAGE_COLOR = "var(--color-scene-fg-faint)";

const PILL =
  "inline-block rounded-full border border-iron-border px-2.5 py-0.5 font-fact text-[11px] lowercase tracking-wide text-moon-100";

/** Section heading, matching the AI region heading and Seance.dc.html. */
const SECTION_HEADING =
  "m-0 mb-3 font-heading text-[13px] uppercase tracking-[2px] text-moon-300";

function count(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

/** "YYYY-MM-DD (3 years ago)" relative to renderedAt; total. */
function relativeDate(iso: string | null, renderedAt: string): string {
  const then = iso ? Date.parse(iso) : NaN;
  const now = Date.parse(renderedAt);
  if (Number.isNaN(then)) return "unknown";
  const date = new Date(then).toISOString().slice(0, 10);
  if (Number.isNaN(now)) return date;
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const ago =
    years > 0
      ? `${years} year${years === 1 ? "" : "s"} ago`
      : months > 0
        ? `${months} month${months === 1 ? "" : "s"} ago`
        : days > 0
          ? `${days} day${days === 1 ? "" : "s"} ago`
          : "today";
  return `${date} (${ago})`;
}

function PanelContent({
  row,
  owner,
  classification,
  facts,
  renderedAt,
  isFixture,
  revivedAt,
  ritual,
  reduced,
  onRitualChange,
  escapeClaimRef,
}: Pick<
  DetailPanelProps,
  "owner" | "classification" | "facts" | "renderedAt" | "isFixture" | "revivedAt"
> & {
  row: RepoRow;
  ritual: boolean;
  reduced: boolean;
  onRitualChange: (active: boolean) => void;
  escapeClaimRef: MutableRefObject<(() => boolean) | null>;
}) {
  const description =
    row.description !== null && row.description.trim() !== ""
      ? row.description
      : null;
  const language = row.primaryLanguage;
  const topics = row.topics.slice(0, 5);
  const explanation = explanationLine(
    {
      state: classification.state,
      decayLevel: classification.decayLevel,
      facts,
      revivedAt,
    },
    renderedAt,
  );
  const showHomepage = !isFixture && isValidHttpsHomepage(row.homepageUrl);
  const domain = showHomepage ? homepageDomain(row.homepageUrl) : null;

  return (
    <div className="px-4 pb-6">
      <div data-ritual-dim={ritual ? "" : undefined}>
        <p className="font-fact text-xs text-plaque-sub">{owner}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={PILL}>{classification.state}</span>
          <span className={PILL}>
            {decayWord(classification.state, classification.decayLevel)}
          </span>
          {row.isArchived && <span className={PILL}>Archived</span>}
          {row.isFork && <span className={PILL}>Fork</span>}
        </div>

        <p className="mt-4 font-narrative text-sm italic leading-snug">
          {explanation}
        </p>

        <p className="mt-4 text-sm leading-snug">
          {description ?? "No epitaph was written."}
        </p>

        {topics.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {topics.map((t, i) => (
              <li key={`${i}-${t}`} className={PILL}>
                {t}
              </li>
            ))}
          </ul>
        )}

        <section aria-label="From GitHub" className="mt-6">
          <h3 className={SECTION_HEADING}>From GitHub</h3>

          <dl className="grid grid-cols-3 gap-2 font-fact text-xs">
            <div>
              <dt className="text-plaque-sub">Stars</dt>
              <dd>{count(row.stargazerCount)}</dd>
            </div>
            <div>
              <dt className="text-plaque-sub">Forks</dt>
              <dd>{count(row.forkCount)}</dd>
            </div>
            <div>
              <dt className="text-plaque-sub">Open issues</dt>
              <dd>{count(row.openIssueCount)}</dd>
            </div>
          </dl>

          {language && (
            <p className="mt-3 inline-flex items-center gap-1.5 font-fact text-xs">
              <span
                aria-hidden="true"
                data-testid="language-dot"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: language.color ?? FALLBACK_LANGUAGE_COLOR }}
              />
              {language.name}
            </p>
          )}

          <p className="mt-3 font-fact text-xs text-plaque-sub">
            Created {relativeDate(row.createdAt, renderedAt)}
          </p>
          <p className="font-fact text-xs text-plaque-sub">
            Last push {relativeDate(row.pushedAt, renderedAt)}
          </p>

          <div className="mt-5 flex flex-col gap-2 text-sm">
            {isFixture ? (
              <p className="font-fact text-xs italic text-plaque-sub">
                Sample repository
              </p>
            ) : (
              <ExternalLink
                href={buildGitHubUrl(owner, row.name)}
                className="inline-block self-start rounded-md border border-candle-400 px-3 py-1.5 text-candle-400"
              >
                Open on GitHub
              </ExternalLink>
            )}
            {domain && row.homepageUrl && (
              <ExternalLink href={row.homepageUrl} className="self-start">
                {domain}
              </ExternalLink>
            )}
          </div>
        </section>

        <section
          aria-label="Actions"
          data-slot="actions"
          className="mt-6 flex flex-col gap-2"
        >
          <SeanceButton />
        </section>
      </div>

      <div className="mt-6">
        <SeanceRegion
          owner={owner}
          repo={row.name}
          state={classification.state}
          decayLevel={classification.decayLevel}
          reduced={reduced}
          onRitualChange={onRitualChange}
          escapeClaimRef={escapeClaimRef}
        />
      </div>
    </div>
  );
}