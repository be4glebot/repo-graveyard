/**
 * Themed error state for the live graveyard routes (server component).
 *
 * Renders inside `ThemedShell` (which already provides the `<main>`), keyed by
 * `LoadError["kind"]`:
 *   - `not-found` / `invalid-username` -> not-found copy, "Try again" (/) and
 *     "Tour the Haunted Estate" (/estate).
 *   - `rate-limited` -> locked copy; the countdown shows only when
 *     `resetInMinutes` is defined.
 *   - `server-error` -> its own copy with a `ReloadButton`.
 * The switch is exhaustive; a new `LoadError` variant fails to compile.
 * Copy comes from `edgeCopy`; no hex colors.
 *
 * Requirements: 7.1-7.5, 7.7-7.9
 */

import type { LoadError } from "@/lib/github";
import { edgeCopy } from "@/lib/edge-states";
import ReloadButton from "@/components/ui/ReloadButton";
import ThemedButton from "@/components/ui/ThemedButton";

import ThemedShell from "./ThemedShell";

export interface SceneErrorStateProps {
  kind: LoadError["kind"];
  /** Whole minutes until the rate limit resets, when known. */
  resetInMinutes?: number;
}

const HEADING_CLASS =
  "m-0 font-heading text-[17px] font-bold uppercase tracking-[2px] text-scene-fg";
const BODY_CLASS =
  "m-0 max-w-[340px] font-narrative text-[17px] italic leading-[1.45] text-scene-fg-muted";

function TourAction() {
  return (
    <ThemedButton variant="crimson" href="/estate">
      Tour the Haunted Estate
    </ThemedButton>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-2">{children}</div>;
}

function renderPanel(kind: LoadError["kind"], resetInMinutes?: number) {
  switch (kind) {
    case "not-found":
    case "invalid-username": {
      const copy = edgeCopy("not-found");
      return (
        <>
          <h1 className={HEADING_CLASS}>{copy.heading}</h1>
          <p className={BODY_CLASS}>{copy.body}</p>
          <Actions>
            <ThemedButton href="/">Try again</ThemedButton>
            <TourAction />
          </Actions>
        </>
      );
    }
    case "rate-limited": {
      const copy = edgeCopy("rate-limited");
      const minuteWord = resetInMinutes === 1 ? "minute" : "minutes";
      return (
        <>
          <h1 className={HEADING_CLASS}>{copy.heading}</h1>
          <p className={BODY_CLASS}>{copy.body}</p>
          {resetInMinutes !== undefined && (
            <p className={BODY_CLASS}>
              The gates reopen in{" "}
              <strong className="font-normal not-italic text-crimson-200">
                {resetInMinutes} {minuteWord}
              </strong>
              .
            </p>
          )}
          <Actions>
            <TourAction />
          </Actions>
        </>
      );
    }
    case "server-error": {
      const copy = edgeCopy("server-error");
      return (
        <>
          <h1 className={HEADING_CLASS}>{copy.heading}</h1>
          <p className={BODY_CLASS}>{copy.body}</p>
          <Actions>
            <ReloadButton />
            <TourAction />
          </Actions>
        </>
      );
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export default function SceneErrorState({
  kind,
  resetInMinutes,
}: SceneErrorStateProps) {
  return (
    <ThemedShell>
      <section
        role="alert"
        className="flex w-full max-w-[380px] flex-col items-center gap-3 rounded-md border border-crimson-900 bg-night-sky-mid p-6 text-center"
      >
        {renderPanel(kind, resetInMinutes)}
      </section>
    </ThemedShell>
  );
}
