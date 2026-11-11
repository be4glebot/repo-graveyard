"use client";

/**
 * Seance_Region: the AI section of the detail panel.
 *
 * Sharing `useSeance` (for task 12.1, DetailPanel)
 * ------------------------------------------------
 * The "Hold a séance" control lives in the Actions slot while the result view
 * lives here, so both need the same hook instance. The pair share it through
 * a small context:
 *
 *   <SeanceProvider owner repo fixture isFixture reduced>
 *     ...Actions section: <SeanceButton />            (reads the context)
 *     ...AI section:      <SeanceRegion repo state decayLevel reduced
 *                           owner onRitualChange escapeClaimRef />
 *   </SeanceProvider>
 *
 * `SeanceButton` renders `SeanceControl` wired to the shared hook. Use
 * `useSeanceContext()` for anything else (e.g. `close()` when the panel
 * closes or the repo changes; the provider also closes on unmount).
 * Remount the provider (key it by owner/repo) when the open repo changes.
 *
 * Escape claim: pass the panel's `escapeClaimRef`. The region sets
 * `ref.current` to a function that skips a running ritual or settles a running
 * reveal and returns true; otherwise it returns false and the panel closes.
 * A ritual that was already skipped (still awaiting a result) returns false so
 * Escape never traps the user.
 *
 * `onRitualChange(true|false)` fires as the ritual starts and ends so the
 * panel can set `data-ritual-dim` on facts/actions and the portrait surge.
 *
 * Requirements: 8.5, 8.6, 9.6, 10.9-10.11, 11.10, 15.1, 15.10, 18.1-18.3,
 * 18.6, 18.9
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useSeance, type UseSeance } from "./useSeance";
import { SeanceControl } from "./SeanceControl";
import { SilentFallback, VeilState, WeakGhostState } from "./SeanceStates";
import Ritual from "./Ritual";
import RitualExit from "./RitualExit";
import { useRitualStage } from "./useRitualStage";
import { useRitualExit } from "./useRitualExit";
import { ritualStageText } from "@/lib/seance-ritual";
import SpiritTranscript from "./SpiritTranscript";
import CauseOfDeath from "./CauseOfDeath";
import { causeHeading } from "@/lib/seance-schema";
import LedgerList from "./LedgerList";
import { VerdictCard } from "./VerdictCard";
import { KiroSlot } from "./KiroSlot";
import { CopyTranscriptButton } from "./CopyTranscriptButton";

/* ---- Shared hook context -------------------------------------------------- */

const SeanceContext = createContext<UseSeance | null>(null);

export function useSeanceContext(): UseSeance {
  const ctx = useContext(SeanceContext);
  if (!ctx) throw new Error("useSeanceContext requires a SeanceProvider");
  return ctx;
}

export interface SeanceProviderProps {
  owner: string;
  repo: string;
  fixture?: unknown;
  isFixture?: boolean;
  reduced: boolean;
  children: ReactNode;
}

export function SeanceProvider({
  owner,
  repo,
  fixture,
  isFixture,
  reduced,
  children,
}: SeanceProviderProps) {
  const seance = useSeance({ owner, repo, fixture, isFixture, reduced });
  return <SeanceContext.Provider value={seance}>{children}</SeanceContext.Provider>;
}

/** The "Hold a séance" control wired to the shared hook (Actions slot). */
export function SeanceButton() {
  const { state, start, again } = useSeanceContext();
  // Running: the ritual or the reveal. Once a result or a fallback is showing
  // the control is enabled again and offers another séance.
  const busy = state.phase === "ritual" || state.phase === "revealing";
  const done =
    state.phase === "settled" ||
    state.phase === "veil" ||
    state.phase === "weak" ||
    state.phase === "silent";
  return <SeanceControl busy={busy} again={done} onActivate={done ? again : start} />;
}

/* ---- Scrolling ------------------------------------------------------------ */

/** The fixed site header's height in px (`--site-header-h`), or 0 when unknown. */
function siteHeaderPx(): number {
  try {
    const root = document.documentElement;
    const raw = getComputedStyle(root).getPropertyValue("--site-header-h").trim();
    const m = /^(\d*\.?\d+)(rem|px)$/.exec(raw);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    if (m[2] === "px") return n;
    return n * (parseFloat(getComputedStyle(root).fontSize) || 16);
  } catch {
    return 0;
  }
}

/** Scrolls an element's top into view (the target's scroll-margin clears the header). */
function scrollToStart(el: HTMLElement | null, reduced: boolean): void {
  if (!el || typeof el.scrollIntoView !== "function") return;
  el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
}

/* ---- Region --------------------------------------------------------------- */

export interface SeanceRegionProps {
  owner: string;
  repo: string;
  /** Lifecycle state of the repo (ghost, risen, zombie, tombstone, coffin). */
  state: string;
  decayLevel?: number | null;
  reduced: boolean;
  /** Fires true when the ritual starts and false when it ends. */
  onRitualChange?: (active: boolean) => void;
  /** Filled with the Escape claim function while mounted. */
  escapeClaimRef?: MutableRefObject<(() => boolean) | null>;
}

/**
 * Sticky zero-height layer so the ritual covers the dialog's visible area
 * (the dialog is the scroll container). Height is measured once at start.
 */
function RitualLayer({
  children,
  onLaidOut,
}: {
  children: ReactNode;
  /** Called one frame after the layer mounts and its height is laid out. */
  onLaidOut?: (el: HTMLElement) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const laidOutRef = useRef(onLaidOut);
  useEffect(() => {
    laidOutRef.current = onLaidOut;
  });

  // Stable ref callback: schedules the callback after the layout commits.
  const setWrap = useCallback((node: HTMLDivElement | null) => {
    wrapRef.current = node;
    if (!node) return undefined;
    const id = requestAnimationFrame(() => laidOutRef.current?.(node));
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    const dialog = wrapRef.current?.closest('[role="dialog"]');
    // The fixed site header covers the top of the viewport, so the ritual
    // fills the visible area below it (the layer is scrolled to start there).
    setHeight(
      dialog instanceof HTMLElement
        ? Math.max(0, dialog.clientHeight - siteHeaderPx())
        : 0,
    );
  }, []);

  return (
    <div
      ref={setWrap}
      data-ritual-layer
      className="ritual-layer seance-scroll-target pointer-events-auto sticky z-10 h-0"
    >
      <div
        className="ritual-box absolute inset-x-0 top-0"
        style={{ height: height ? `${height}px` : "100%" }}
      >
        {children}
      </div>
    </div>
  );
}

export function SeanceRegion({
  owner,
  repo,
  state: creatureState,
  decayLevel,
  reduced,
  onRitualChange,
  escapeClaimRef,
}: SeanceRegionProps) {
  const { state, retry, skip, settle } = useSeanceContext();
  const { phase, result, attemptId } = state;

  // The ritual builds on a fixed clock while the request is in flight; the
  // exit (gutter or snuff) plays over the result as the ritual unmounts.
  const stage = useRitualStage(phase === "ritual", attemptId, state.skipped);
  const stageText = ritualStageText(stage, repo);
  const exit = useRitualExit(phase, reduced);

  // Scroll: the ritual into view when a séance starts, the transcript's top
  // into view when the result reveals. Once per attempt; focus is not moved.
  const scrolledFor = useRef({ ritual: 0, reveal: 0 });

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [copy, setCopy] = useState({ attemptId: 0, message: "" });

  // Latest values for the Escape claim.
  const skipped = state.skipped;
  const claimRef = useRef({ phase, skipped });
  const actionsRef = useRef({ skip, settle });
  useEffect(() => {
    claimRef.current = { phase, skipped };
    actionsRef.current = { skip, settle };
  }, [phase, skipped, skip, settle]);

  useEffect(() => {
    if (!escapeClaimRef) return undefined;
    escapeClaimRef.current = () => {
      const { phase: p, skipped: wasSkipped } = claimRef.current;
      if (p === "ritual" && !wasSkipped) {
        actionsRef.current.skip();
        return true;
      }
      if (p === "revealing") {
        actionsRef.current.settle();
        return true;
      }
      return false;
    };
    return () => {
      escapeClaimRef.current = null;
    };
  }, [escapeClaimRef]);

  // Tell the parent when the ritual is running.
  const onRitualChangeRef = useRef(onRitualChange);
  useEffect(() => {
    onRitualChangeRef.current = onRitualChange;
  }, [onRitualChange]);
  const ritualActive = phase === "ritual";
  useEffect(() => {
    onRitualChangeRef.current?.(ritualActive);
    return () => {
      if (ritualActive) onRitualChangeRef.current?.(false);
    };
  }, [ritualActive]);

  // Move focus to the heading once per attempt: as results render (< 100 ms)
  // or when the Silent_Fallback appears (< 500 ms). Scrolling is handled
  // separately (smooth, or instant under reduced motion), so focus does not jump.
  const focusedAttempt = useRef(0);
  useEffect(() => {
    if (phase !== "revealing" && phase !== "silent") return;
    if (focusedAttempt.current === attemptId) return;
    focusedAttempt.current = attemptId;
    headingRef.current?.focus({ preventScroll: true });
  }, [phase, attemptId]);

  useEffect(() => {
    if (phase !== "revealing" || scrolledFor.current.reveal === attemptId) return;
    scrolledFor.current.reveal = attemptId;
    scrollToStart(headingRef.current, reduced);
  }, [phase, attemptId, reduced]);

  // The copy status belongs to one attempt; a new attempt hides the old one.
  const announceCopy = useCallback(
    (message: string) => {
      // Clear first so repeating the same message is announced again.
      setCopy({ attemptId, message: "" });
      requestAnimationFrame(() => setCopy({ attemptId, message }));
    },
    [attemptId],
  );
  const copyMessage = copy.attemptId === attemptId ? copy.message : "";

  const hasContent =
    phase === "revealing" ||
    phase === "settled" ||
    phase === "veil" ||
    phase === "weak" ||
    phase === "silent";
  const showResult = (phase === "revealing" || phase === "settled") && result;
  const settled = phase === "settled";

  return (
    <>
      {phase === "ritual" ? (
        <RitualLayer
          onLaidOut={(el) => {
            if (scrolledFor.current.ritual === attemptId) return;
            scrolledFor.current.ritual = attemptId;
            scrollToStart(el, reduced);
          }}
        >
          <Ritual
            onSkip={skip}
            reduced={reduced}
            repo={repo}
            creature={creatureState}
            decayLevel={decayLevel}
            stage={stage}
            skipped={state.skipped}
          />
        </RitualLayer>
      ) : null}

      {exit ? (
        <RitualLayer>
          <RitualExit
            kind={exit}
            stage={stage}
            repo={repo}
            creature={creatureState}
            decayLevel={decayLevel}
          />
        </RitualLayer>
      ) : null}

      <div aria-live="polite" data-seance-region="">
        {/* Announced once per stage (the text only changes when the stage does). */}
        {phase === "ritual" && stageText ? (
          <p data-seance-stage="" className="sr-only">
            {stageText}
          </p>
        ) : null}

        {hasContent ? (
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="seance-scroll-target m-0 mb-2 font-heading text-[13px] uppercase tracking-[2px] text-moon-300"
          >
            AI · from the facts above
          </h3>
        ) : null}

        {showResult ? (
          <>
            <SpiritTranscript
              key={`${repo}:${result.voice}`}
              voice={result.voice}
              repoName={repo}
              state={creatureState}
              decayLevel={decayLevel ?? undefined}
              reduced={reduced}
              onSettled={settle}
              forceSettled={settled}
            />
            <div
              className={settled ? undefined : "sr-only"}
              data-cause-wrap=""
              data-hidden={settled ? "false" : "true"}
            >
              <CauseOfDeath
                causeOfDeath={result.causeOfDeath}
                heading={causeHeading(creatureState)}
              />
            </div>
            <LedgerList items={result.unfinishedBusiness} settled={settled} />
            <VerdictCard result={result} />
            <KiroSlot
              result={result}
              facts={{ owner, repo, state: creatureState }}
              onAnnounce={announceCopy}
            />
            {settled ? (
              <CopyTranscriptButton result={result} onAnnounce={announceCopy} />
            ) : null}
          </>
        ) : null}

        {phase === "veil" ? <VeilState /> : null}
        {phase === "weak" ? <WeakGhostState /> : null}
        {phase === "silent" ? <SilentFallback onRetry={retry} /> : null}

        {copyMessage ? (
          <p data-seance-copy-status="" className="sr-only">
            {copyMessage}
          </p>
        ) : null}
      </div>
    </>
  );
}
