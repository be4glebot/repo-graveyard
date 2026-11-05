/**
 * In-scene error state for the live graveyard routes (server component).
 *
 * When `loadGraveyard` fails, the route renders this panel *inside* the scene
 * frame — a darkened graveyard backdrop with the error panel resting on top —
 * rather than a bare page, so a failure still reads as "the world went quiet"
 * (design.md error-state section). It is keyed by `LoadError["kind"]` and maps
 * each variant onto one of the two panels whose copy and layout match
 * `docs/design-canvas/States.dc.html` exactly (States.dc.html is the source of
 * truth and supersedes the earlier draft copy):
 *
 *   - `not-found` and `invalid-username` → "No one by that name rests here",
 *     with a "Try again" action (back to the landing form) and a crimson
 *     "Tour the estate" action.
 *   - `rate-limited` and `server-error`/unreachable → "The gates are locked
 *     for now". When GitHub's reset time is known the countdown is rendered in
 *     `crimson-200`; when unknown (`resetInMinutes` omitted) that clause is
 *     dropped. A crimson "Tour the estate" action is shown.
 *
 * Every panel links to `/estate` so no error state is a dead end
 * (States.dc.html: "each one offers a way forward"). The copy mapping is an
 * exhaustive `switch` over `LoadError["kind"]`; the `default` branch assigns to
 * a `never`-typed binding, so adding a new `LoadError` variant without handling
 * it here is a compile-time error (Req 1.5, 1.6, 1.7).
 *
 * This component has no interactivity and reads no client-only APIs, so it is a
 * server presentational component and intentionally omits `"use client"`. It
 * renders deterministically (no clock, the countdown comes from the pre-computed
 * `resetInMinutes` prop), so server and client HTML are identical. All colors
 * come from `@theme` tokens — no hardcoded hex.
 *
 * Requirements: 1.5, 1.6, 1.7
 */

import Link from "next/link";

import type { LoadError } from "@/lib/github";

export interface SceneErrorStateProps {
  /**
   * The failure variant, mirroring `LoadError["kind"]`. The route passes
   * `error.kind` straight through; `invalid-username` is folded into the
   * not-found panel per the design.
   */
  kind: LoadError["kind"];
  /**
   * Whole minutes until GitHub's rate limit resets, when known (derived by the
   * route from the rate-limit reset headers surfaced on `LoadError`). Omitted
   * when the reset time is unknown, in which case the countdown clause is not
   * rendered. Only meaningful for the "gates are locked" panel.
   */
  resetInMinutes?: number;
}

/** Which of the two States.dc.html panels a `LoadError["kind"]` maps to. */
type PanelKind = "not-found" | "locked";

/**
 * Resolves a `LoadError["kind"]` to its panel. Exhaustive over
 * `LoadError["kind"]`; the `default` branch is unreachable and exists only to
 * enforce exhaustiveness at compile time (a new variant fails to type-check).
 */
function panelFor(kind: LoadError["kind"]): PanelKind {
  switch (kind) {
    case "not-found":
    case "invalid-username":
      // A malformed username never reaches GitHub; the viewer-facing outcome is
      // the same "no one by that name" result as a well-formed-but-absent login.
      return "not-found";
    case "rate-limited":
    case "server-error":
      // Rate-limit and unreachable/server failures share the "gates are locked"
      // panel; only the known-reset countdown distinguishes them visually.
      return "locked";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** The crimson "Tour the estate" action shared by every panel (no dead ends). */
function TourTheEstateAction() {
  return (
    <Link
      href="/estate"
      className="inline-flex h-11 items-center gap-2 rounded border border-crimson-500 bg-crimson-700 px-5 font-heading text-[13px] font-bold uppercase tracking-[1.5px] text-crimson-200 shadow-[0_0_22px_var(--color-crimson-glow)]"
    >
      Tour the estate
    </Link>
  );
}

/**
 * The "No one by that name rests here" panel (not-found / invalid-username).
 * Offers both a "Try again" action back to the landing form and the shared
 * "Tour the estate" action (States.dc.html).
 */
function NotFoundPanel() {
  return (
    <>
      <h2 className="m-0 font-heading text-[17px] font-bold uppercase tracking-[2px] text-scene-fg">
        No one by that name rests here
      </h2>
      <p className="m-0 max-w-[340px] font-narrative text-[17px] italic leading-[1.45] text-scene-fg-muted">
        We searched every plot, but found nothing. Check the spelling, or walk
        the Haunted Estate instead.
      </p>
      <div className="flex gap-2">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded border border-scene-fg-faint bg-night-sky px-4 font-ui text-sm font-medium text-scene-fg"
        >
          Try again
        </Link>
        <TourTheEstateAction />
      </div>
    </>
  );
}

/**
 * The "gates are locked for now" panel (rate-limited / server-error). Renders
 * the reset countdown in `crimson-200` only when `resetInMinutes` is known,
 * dropping the clause entirely when it is not (States.dc.html).
 */
function GatesLockedPanel({ resetInMinutes }: { resetInMinutes?: number }) {
  const hasReset = resetInMinutes !== undefined;
  const minuteWord = resetInMinutes === 1 ? "minute" : "minutes";

  return (
    <>
      <h2 className="m-0 font-heading text-[17px] font-bold uppercase tracking-[2px] text-scene-fg">
        The gates are locked for now
      </h2>
      <p className="m-0 max-w-[340px] font-narrative text-[17px] italic leading-[1.45] text-scene-fg-muted">
        GitHub needs the spirits to rest.{" "}
        {hasReset && (
          <>
            The gates reopen in{" "}
            <strong className="font-normal not-italic text-crimson-200">
              {resetInMinutes} {minuteWord}
            </strong>
            .{" "}
          </>
        )}
        The Haunted Estate is always open.
      </p>
      <TourTheEstateAction />
    </>
  );
}

/**
 * Renders the error panel for a failed graveyard load, inside the darkened
 * scene frame. Presentation-only, no interactivity.
 */
export default function SceneErrorState({
  kind,
  resetInMinutes,
}: SceneErrorStateProps) {
  const panel = panelFor(kind);

  return (
    <main
      className="flex min-h-full flex-col items-center justify-center bg-night-sky p-12"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% 20%, var(--color-night-sky-mid), var(--color-night-sky-bottom) 80%)",
      }}
    >
      <section
        role="alert"
        className="flex w-full max-w-[380px] flex-col items-center gap-3 rounded-md border border-crimson-900 bg-night-sky-mid p-6 text-center"
      >
        {panel === "not-found" ? (
          <NotFoundPanel />
        ) : (
          <GatesLockedPanel resetInMinutes={resetInMinutes} />
        )}
      </section>
    </main>
  );
}
