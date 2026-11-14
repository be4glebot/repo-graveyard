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
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { GetBadgeDialog } from "@/components/badge/GetBadgeDialog";
import { useHeaderHeightVar } from "@/components/scene/useHeaderHeightVar";
import { SceneLegend } from "@/components/scene/Footer";
import ListDialog from "@/components/scene/ListDialog";
import SummaryLine from "@/components/ui/SummaryLine";
import Toggle from "@/components/ui/Toggle";
import { useIsCompact } from "@/components/ui/useIsCompact";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { SummaryCounts } from "@/lib/scene-view";
import { USERNAME_MAX_LENGTH, validateUsernameInput } from "@/lib/username";

/** Which scene the header sits above; drives the "Haunted Estate" badge. */
export type HeaderMode = "live" | "estate";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const badgeAvailable = mode !== "estate" && username !== "";
  const badgeButtonRef = useRef<HTMLButtonElement>(null);
  const badgeMenuItemRef = useRef<HTMLButtonElement>(null);
  const badgeOpenerRef = useRef<HTMLElement | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const listAvailable = rows !== undefined;
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const listMenuItemRef = useRef<HTMLButtonElement>(null);
  const listOpenerRef = useRef<HTMLElement | null>(null);

  const inputId = useId();
  const errorId = useId();
  const panelId = useId();

  const compact = useIsCompact();

  // Widening from compact to desktop closes the menu (Req 4.10). Tracked as a
  // transition (not the raw value) so environments without matchMedia still
  // allow the menu to open.
  const [prevCompact, setPrevCompact] = useState(compact);
  if (prevCompact !== compact) {
    setPrevCompact(compact);
    if (!compact) setMenuOpen(false);
  }

  // Measure the site-header wrapper (the header's parent) and publish its
  // height as `--site-header-h` on the scene root while compact (Req 4.12).
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerElRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = headerElRef.current;
    wrapperRef.current = el?.parentElement ?? el;
    rootRef.current = el?.closest<HTMLElement>("#scene-root") ?? null;
  }, []);
  useHeaderHeightVar(wrapperRef, compact, rootRef, { always: true });

  // If the layout flips while the dialog is open, the original opener is gone;
  // re-point the opener at whichever control exists now (fallback: Menu button).
  useEffect(() => {
    if (!badgeOpen) return;
    const current = badgeOpenerRef.current;
    if (current && current.isConnected) return;
    badgeOpenerRef.current =
      (compact ? badgeMenuItemRef.current : badgeButtonRef.current) ??
      menuButtonRef.current;
  }, [badgeOpen, compact]);

  useEffect(() => {
    if (!listOpen) return;
    const current = listOpenerRef.current;
    if (current && current.isConnected) return;
    listOpenerRef.current =
      (compact ? listMenuItemRef.current : listButtonRef.current) ??
      menuButtonRef.current;
  }, [listOpen, compact]);

  // Return focus to the opener once the list dialog has closed (Req 5.7).
  const wasListOpenRef = useRef(false);
  useEffect(() => {
    if (wasListOpenRef.current && !listOpen) {
      const opener = listOpenerRef.current;
      (opener && opener.isConnected ? opener : menuButtonRef.current)?.focus();
    }
    wasListOpenRef.current = listOpen;
  }, [listOpen]);

  function openList(opener: HTMLElement | null) {
    listOpenerRef.current = opener ?? menuButtonRef.current;
    setListOpen(true);
  }

  const badgeClasses =
    "day-chrome-btn pointer-events-auto min-h-11 rounded-md border border-candle-400 px-3 py-2 font-ui text-sm text-scene-fg " +
    "transition-colors hover:bg-candle-400/20 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky";

  function openBadge(opener: HTMLElement | null) {
    badgeOpenerRef.current = opener ?? menuButtonRef.current;
    setBadgeOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Empty/invalid submits stay on the current scene, keep the typed text and
    // keep the menu open (Req 7.6, 4.9).
    const check = validateUsernameInput(value);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    // Valid submit navigates to that username's scene (Req 7.5) and closes the
    // menu (Req 4.8).
    setError(null);
    setMenuOpen(false);
    router.push(`/g/${encodeURIComponent(check.username)}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
  }

  const hasError = error !== null;

  return (
    <header
      ref={headerElRef}
      data-testid="scene-header"
      onKeyDown={handleKeyDown}
      className={[
        "flex items-start justify-between gap-4 font-ui text-scene-fg",
        // Below 768px: one column (row + menu panel), never wrapping the row.
        "max-[767px]:flex-col max-[767px]:items-stretch max-[767px]:gap-2",
        // On short viewports (<900px tall) the chrome condenses so the controls
        // always stay within the header's own box and never overlap the scene
        // content beneath it, down to a 360px-wide viewport (Req 1.3). The
        // header wraps to a column and each cluster is allowed to wrap, so the
        // return/lights/sound controls reflow instead of spilling.
        "[@media(max-height:899px)]:flex-col [@media(max-height:899px)]:items-stretch [@media(max-height:899px)]:gap-2",
      ].join(" ")}
    >
      {/* Row wrapper: below 768px a single non-wrapping row (left cluster +
          Menu button); at 768px and up it is `contents`, so the desktop flex
          layout is exactly as before. */}
      <div className="flex min-w-0 items-start gap-2 max-[767px]:w-full max-[767px]:flex-nowrap min-[768px]:contents">
        {/* LEFT cluster: wordmark + username badge on one row, summary beneath. */}
        <div className="flex min-w-0 flex-col gap-2 max-[767px]:flex-1">
          <div className="flex flex-wrap items-center gap-3 max-[767px]:gap-x-2 max-[767px]:gap-y-1">
            <h1
              className="site-wordmark shrink-0 whitespace-nowrap font-wordmark text-3xl leading-none text-crimson-400"
              style={{ textShadow: "0 0 12px var(--color-crimson-glow)" }}
            >
              Repo Graveyard
            </h1>
            {mode === "estate" ? (
              <span className="shrink-0 whitespace-nowrap rounded-full border border-crimson-400 px-2 py-0.5 font-ui text-xs uppercase tracking-wide text-crimson-200">
                Haunted Estate
              </span>
            ) : null}
            {username ? (
              <span
                data-testid="header-username-badge"
                className="day-chrome-btn min-w-0 truncate rounded-full border border-scene-fg-faint bg-night-sky/60 px-3 py-0.5 font-heading text-xs font-bold uppercase tracking-[2px] text-scene-fg"
              >
                {username}
              </span>
            ) : null}
          </div>

          <SummaryLine rows={rows} counts={counts} />
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={panelId}
          onClick={() => setMenuOpen((open) => !open)}
          className={
            "day-chrome-btn pointer-events-auto min-h-11 min-w-11 shrink-0 rounded-md border border-candle-400 px-3 " +
            "font-ui text-sm text-scene-fg transition-colors hover:bg-candle-400/20 min-[768px]:hidden " +
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 " +
            "focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky"
          }
        >
          Menu
        </button>
      </div>

      {/* RIGHT cluster / Menu panel: a compact visit box + the two toggles on
          ONE row. Below 768px it is hidden until the Menu opens (CSS-driven, so
          no hydration flash); at 768px and up it is always shown inline. The
          validation message sits below the row (still role="alert"). */}
      <div
        id={panelId}
        className={[
          "day-chrome-menu flex-col items-end gap-1 [@media(max-height:899px)]:items-start",
          "max-[767px]:items-stretch max-[767px]:rounded-md max-[767px]:bg-night-sky/90 max-[767px]:p-3",
          menuOpen ? "flex" : "max-[767px]:hidden min-[768px]:flex",
        ].join(" ")}
      >
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
              title="Type any GitHub username to see their graveyard"
              className={
                "day-chrome-btn w-44 md:w-24 lg:w-44 rounded-md border border-scene-fg-faint bg-night-sky/60 px-3 py-2 " +
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
            hint="Lights on shows the same world in daylight. Lights off brings the night back."
          />
          <Toggle
            label="Sound"
            pressed={soundOn}
            onChange={onSoundChange}
            hint="Ambient sound and effects. Off by default."
          />
          {listAvailable && !compact ? (
            <button
              ref={listButtonRef}
              type="button"
              data-testid="view-list-button"
              onClick={(e) => openList(e.currentTarget)}
              className={badgeClasses}
            >
              View as list
            </button>
          ) : null}
          {badgeAvailable && !compact ? (
            <button
              ref={badgeButtonRef}
              type="button"
              data-testid="get-badge-button"
              title="Put a small live picture of your graveyard in your GitHub README"
              onClick={(e) => openBadge(e.currentTarget)}
              className={badgeClasses}
            >
              Share your graveyard
            </button>
          ) : null}
        </div>

        {listAvailable && compact ? (
          <button
            ref={listMenuItemRef}
            type="button"
            data-testid="view-list-menu-item"
            onClick={(e) => openList(e.currentTarget)}
            className={badgeClasses + " mt-1 w-full"}
          >
            View as list
          </button>
        ) : null}

        {badgeAvailable && compact ? (
          <button
            ref={badgeMenuItemRef}
            type="button"
            data-testid="get-badge-menu-item"
            title="Put a small live picture of your graveyard in your GitHub README"
            onClick={(e) => openBadge(e.currentTarget)}
            className={badgeClasses + " mt-1 w-full"}
          >
            Share your graveyard
          </button>
        ) : null}

        {hasError ? (
          <p id={errorId} role="alert" className="font-ui text-sm text-crimson-200">
            {error}
          </p>
        ) : null}

        {/* Compact only: the lifecycle legend moves here from the footer so
            the bottom bar holds just the pager. */}
        <SceneLegend
          testId="menu-legend"
          className="pointer-events-auto mt-1 min-[768px]:hidden"
        />
      </div>
      {listAvailable ? (
        <ListDialog
          open={listOpen}
          onClose={() => setListOpen(false)}
          rows={rows}
          username={username}
        />
      ) : null}
      {badgeOpen ? (
        <GetBadgeDialog
          owner={username}
          openerRef={badgeOpenerRef}
          onClose={() => setBadgeOpen(false)}
        />
      ) : null}
    </header>
  );
}
