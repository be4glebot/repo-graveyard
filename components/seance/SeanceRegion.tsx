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
import SpiritTranscript from "./SpiritTranscript";
import CauseOfDeath from "./CauseOfDeath";
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
  const { state, start } = useSeanceContext();
  const busy =
    state.phase === "ritual" ||
    state.phase === "revealing" ||
    state.phase === "settled";
  return <SeanceControl busy={busy} onActivate={start} />;
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
function RitualLayer({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const dialog = wrapRef.current?.closest('[role="dialog"]');
    setHeight(dialog instanceof HTMLElement ? dialog.clientHeight : 0);
  }, []);

  return (
    <div
      ref={wrapRef}
      data-ritual-layer
      className="pointer-events-auto sticky top-0 z-10 h-0"
    >
      <div
        className="absolute inset-x-0 top-0"
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
  // or when the Silent_Fallback appears (< 500 ms).
  const focusedAttempt = useRef(0);
  useEffect(() => {
    if (phase !== "revealing" && phase !== "silent") return;
    if (focusedAttempt.current === attemptId) return;
    focusedAttempt.current = attemptId;
    headingRef.current?.focus();
  }, [phase, attemptId]);

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
        <RitualLayer>
          <Ritual
            onSkip={skip}
            reduced={reduced}
            seed={`${owner}/${repo}`}
            creature={creatureState}
          />
        </RitualLayer>
      ) : null}

      <div aria-live="polite" data-seance-region="">
        {hasContent ? (
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="m-0 mb-2 font-heading text-[13px] uppercase tracking-[2px] text-moon-300"
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
              <CauseOfDeath causeOfDeath={result.causeOfDeath} />
            </div>
            <LedgerList items={result.unfinishedBusiness} settled={settled} />
            <VerdictCard result={result} />
            <KiroSlot />
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
