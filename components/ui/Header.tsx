"use client";

/**
 * Scene header / chrome (client component).
 *
 * Renders, in one strip:
 * - the "Repo Graveyard" wordmark in UnifrakturMaguntia with the crimson glow
 *   (Req 7.1);
 * - a "Haunted Estate" status badge when `mode === "estate"` (Req 7.2);
 * - the `SummaryLine` built from the graveyard rows (Req 7.3, 7.4);
 * - a visit `<input>` accepting a 1–39 char GitHub username that navigates to
 *   that username's scene on a non-empty submit (Req 7.5) and shows a
 *   "username is required" validation message on an empty/whitespace submit
 *   (Req 7.6); and
 * - the Lights-on and Sound toggles, each showing its on/off state (Req 7.7).
 *
 * The toggle boolean state lives in the parent (`SceneView`); this component is
 * presentational over that state. The Lights-on toggle is wired to its handler.
 * The Sound toggle is STATE-ONLY: it reflects `soundOn` and calls
 * `onSoundChange`, but this component — and the whole feature — loads, decodes,
 * and plays no audio; sound is deferred (Req 13.1, 13.2).
 *
 * This is a client component because the visit input and the toggles are
 * interactive. It hardcodes no hex; all color and type come from `@theme`
 * tokens.
 *
 * Chrome treatment to match the painted boards (Req 15): the wordmark keeps the
 * blackletter `font-wordmark` face (Req 15.1); the username renders in a
 * bordered Cinzel badge/pill — uppercase, letter-spaced — in place of the old
 * plain muted span (Req 15.2); the `SummaryLine` carries its own letter-spaced
 * Cinzel treatment (Req 15.3); and the Lights-on and Sound toggles use the
 * styled bordered `Toggle` treatment (Req 15.4).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 9.4, 13.1, 13.2, 15.1, 15.2, 15.3, 15.4
 */

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import SummaryLine from "@/components/ui/SummaryLine";
import Toggle from "@/components/ui/Toggle";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { SummaryCounts } from "@/lib/scene-view";
import { isValidUsername, USERNAME_MAX_LENGTH } from "@/lib/username";

/** Which scene the header sits above; drives the "Haunted Estate" badge. */
export type HeaderMode = "live" | "estate";

const EMPTY_MESSAGE = "A username is required";
const INVALID_MESSAGE = "That doesn't look like a valid GitHub username";

export interface HeaderProps {
  /** Rows to summarize; ignored when `counts` is provided. */
  rows?: GraveyardRow[];
  /** Precomputed summary counts; takes precedence over `rows`. */
  counts?: SummaryCounts;
  /** The graveyard owner's username (shown as context). */
  username: string;
  /** Scene mode; "estate" renders the "Haunted Estate" badge (Req 7.2). */
  mode?: HeaderMode;

  /** Lights-on toggle state and handler (wired to real behavior). */
  lightsOn: boolean;
  onLightsOnChange: (next: boolean) => void;

  /** Sound toggle state and handler (state-only; sound is deferred). */
  soundOn: boolean;
  onSoundChange: (next: boolean) => void;
}

export default function Header({
  rows,
  counts,
  username,
  mode = "live",
  lightsOn,
  onLightsOnChange,
  soundOn,
  onSoundChange,
}: HeaderProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();

    // Empty or whitespace-only submit stays on the current scene and shows the
    // "required" validation message (Req 7.6).
    if (next.length === 0) {
      setError(EMPTY_MESSAGE);
      return;
    }
    if (!isValidUsername(next)) {
      setError(INVALID_MESSAGE);
      return;
    }

    // Non-empty, valid submit navigates to that username's scene (Req 7.5).
    setError(null);
    router.push(`/g/${encodeURIComponent(next)}`);
  }

  const hasError = error !== null;

  return (
    <header
      data-testid="scene-header"
      className={[
        "flex items-start justify-between gap-4 font-ui text-scene-fg",
        // On short viewports (<900px tall) the chrome condenses so the controls
        // always stay within the header's own box and never overlap the scene
        // content beneath it, down to a 360px-wide viewport (Req 1.3). The
        // header wraps to a column and each cluster is allowed to wrap, so the
        // return/lights/sound controls reflow instead of spilling.
        "[@media(max-height:899px)]:flex-col [@media(max-height:899px)]:items-stretch [@media(max-height:899px)]:gap-2",
      ].join(" ")}
    >
      {/* LEFT cluster: wordmark + username badge on one row, summary beneath. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="font-wordmark text-3xl leading-none text-crimson-400"
            style={{ textShadow: "0 0 12px var(--color-crimson-glow)" }}
          >
            Repo Graveyard
          </h1>
          {mode === "estate" ? (
            <span className="rounded-full border border-crimson-400 px-2 py-0.5 font-ui text-xs uppercase tracking-wide text-crimson-200">
              Haunted Estate
            </span>
          ) : null}
          {username ? (
            <span
              data-testid="header-username-badge"
              className="rounded-full border border-scene-fg-faint bg-night-sky/60 px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-[2px] text-scene-fg"
            >
              {username}
            </span>
          ) : null}
        </div>

        <SummaryLine rows={rows} counts={counts} />
      </div>

      {/* RIGHT cluster: a compact visit box + the two toggles on ONE row. The
          validation message sits below the row (still role="alert"), so it
          never widens the control strip. */}
      <div className="flex flex-col items-end gap-1 [@media(max-height:899px)]:items-start">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 [@media(max-height:899px)]:justify-start">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex items-center gap-2"
          >
            <label htmlFor={inputId} className="sr-only">
              Visit another graveyard
            </label>
            <input
              id={inputId}
              name="visit-username"
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={USERNAME_MAX_LENGTH}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : undefined}
              placeholder="Visit another graveyard"
              className={
                "w-44 rounded-md border border-scene-fg-faint bg-night-sky/60 px-3 py-2 " +
                "font-fact text-sm text-scene-fg placeholder:text-scene-fg-faint " +
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 " +
                "focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky"
              }
            />
            <button
              type="submit"
              className={
                "rounded-md border border-candle-400 px-3 py-2 font-ui text-sm text-scene-fg " +
                "transition-colors hover:bg-candle-400/20 " +
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 " +
                "focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky"
              }
            >
              Visit
            </button>
          </form>

          <Toggle
            label="Lights on"
            pressed={lightsOn}
            onChange={onLightsOnChange}
          />
          <Toggle label="Sound" pressed={soundOn} onChange={onSoundChange} />
        </div>

        {hasError ? (
          <p id={errorId} role="alert" className="font-ui text-sm text-crimson-200">
            {error}
          </p>
        ) : null}
      </div>
    </header>
  );
}
