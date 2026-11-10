"use client";

/**
 * Spirit transcript: the Smoke_Field and word-by-word reveal.
 *
 * - Full voice text is in the DOM from the first render (words are ordinary
 *   text nodes, only styled hidden), so it is selectable and in textContent.
 * - One `[data-sentence-index]` span per sentence (zero-based), one
 *   `aria-hidden` `.spirit-word` span per word.
 * - Word i fades in after i * 60 ms over 300 ms. A timer settles the field
 *   after the last word; click or Escape settles at once.
 * - Settled state inserts one visually hidden `<p data-seance-announce>`
 *   OUTSIDE `[data-seance-transcript]`.
 * - Reduced motion renders settled on the first render.
 * - All text is rendered as plain React text; no raw HTML injection.
 *
 * Requirements: 6.10, 11.1, 11.4, 11.5, 11.7, 11.8, 11.9, 11.11, 11.12,
 * 11.13, 11.14, 12.9, 12.10, 18.6, 18.7, 18.12
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flickerFor, selectDecayProfile } from "@/lib/seance-decay";
import { splitSentences } from "@/lib/seance-schema";

const WORD_STAGGER_MS = 60;
const WORD_FADE_MS = 300;

export interface SpiritTranscriptProps {
  voice: string;
  repoName: string;
  /** Lifecycle state of the repo (ghost, risen, zombie, tombstone, coffin). */
  state: unknown;
  decayLevel?: unknown;
  /** Reduced motion: render settled immediately. */
  reduced: boolean;
  onSettled?: () => void;
}

interface Flicker {
  /** Index of the character inside its word. */
  charInWord: number;
  durationMs: number;
}

/** Render one sentence's tokens; returns nodes and the number of words used. */
function renderSentence(
  sentence: string,
  repoName: string,
  sentenceIndex: number,
  firstWordIndex: number,
  allowFlicker: boolean,
  revealed: boolean,
): { nodes: ReactNode[]; words: number } {
  const tokens = sentence.split(/(\s+)/).filter((t) => t.length > 0);
  const flick = allowFlicker
    ? flickerFor(repoName, sentenceIndex, sentence.length)
    : null;

  // Resolve the flicker letter to (word token, char in word), skipping spaces.
  let flickerToken = -1;
  let flickerChar = 0;
  if (flick) {
    let offset = 0;
    let lastWordToken = -1;
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      const isSpace = /^\s+$/.test(tok);
      if (!isSpace) lastWordToken = t;
      if (!isSpace && flick.letterIndex < offset + tok.length) {
        flickerToken = t;
        flickerChar = Math.max(0, flick.letterIndex - offset);
        break;
      }
      if (isSpace && flick.letterIndex < offset + tok.length) {
        // Landed on whitespace: use the first character of the next word.
        for (let n = t + 1; n < tokens.length; n++) {
          if (!/^\s+$/.test(tokens[n])) {
            flickerToken = n;
            flickerChar = 0;
            break;
          }
        }
        break;
      }
      offset += tok.length;
    }
    if (flickerToken < 0 && lastWordToken >= 0) {
      flickerToken = lastWordToken;
      flickerChar = tokens[lastWordToken].length - 1;
    }
  }

  let wordIndex = firstWordIndex;
  const nodes: ReactNode[] = tokens.map((tok, t) => {
    if (/^\s+$/.test(tok)) return <Fragment key={t}>{tok}</Fragment>;
    const i = wordIndex++;
    const style: CSSProperties = { transitionDelay: `${i * WORD_STAGGER_MS}ms` };
    let content: ReactNode = tok;
    if (t === flickerToken && flick) {
      const info: Flicker = {
        charInWord: flickerChar,
        durationMs: flick.durationMs,
      };
      content = (
        <>
          {tok.slice(0, info.charInWord)}
          <span
            data-flicker=""
            data-flicker-ms={info.durationMs}
            data-word-index={i}
          >
            {tok.charAt(info.charInWord)}
          </span>
          {tok.slice(info.charInWord + 1)}
        </>
      );
    }
    return (
      <span
        key={t}
        className="spirit-word"
        aria-hidden="true"
        style={style}
        data-word-index={i}
        data-revealed={revealed ? "true" : "false"}
      >
        {content}
      </span>
    );
  });
  return { nodes, words: wordIndex - firstWordIndex };
}

export default function SpiritTranscript({
  voice,
  repoName,
  state,
  decayLevel,
  reduced,
  onSettled,
}: SpiritTranscriptProps) {
  const profile = selectDecayProfile(state, decayLevel);
  const [settled, setSettled] = useState<boolean>(reduced);
  const [revealed, setRevealed] = useState<boolean>(reduced);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const notifiedRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  const { sentences, wordCount } = useMemo(() => {
    const parts = splitSentences(voice ?? "");
    let words = 0;
    const rendered = parts.map((s, idx) => {
      const r = renderSentence(s, repoName, idx, words, !reduced, revealed);
      words += r.words;
      return r.nodes;
    });
    return { sentences: rendered, wordCount: words };
  }, [voice, repoName, reduced, revealed]);

  const settle = useCallback(() => setSettled(true), []);

  // Reduced motion arriving after mount settles at once.
  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled(true);
      setRevealed(true);
    }
  }, [reduced]);

  // Start the reveal on the next frame so the transition runs from hidden.
  useEffect(() => {
    if (settled) return;
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [settled]);

  // Settle timer and Escape.
  useEffect(() => {
    if (settled) return;
    const ms = Math.max(0, wordCount - 1) * WORD_STAGGER_MS + WORD_FADE_MS;
    const timer = setTimeout(settle, ms);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [settled, wordCount, settle]);

  // Notify once on settle.
  useEffect(() => {
    if (settled && !notifiedRef.current) {
      notifiedRef.current = true;
      onSettledRef.current?.();
    }
  }, [settled]);

  // Seeded single-letter flicker (<= 150 ms, once per line), as each word lands.
  useEffect(() => {
    if (settled || reduced) return;
    const root = rootRef.current;
    if (!root || typeof Element === "undefined" || !("animate" in Element.prototype)) {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    root.querySelectorAll<HTMLElement>("[data-flicker]").forEach((el) => {
      const i = Number(el.dataset.wordIndex ?? "0");
      const ms = Math.min(150, Number(el.dataset.flickerMs ?? "100"));
      timers.push(
        setTimeout(() => {
          el.animate({ opacity: [1, 0.2, 1] }, { duration: ms });
        }, i * WORD_STAGGER_MS + WORD_FADE_MS),
      );
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, reduced, voice, repoName]);

  if (sentences.length === 0) return null;

  const brightness = profile.brightness;
  const style = {
    "--smoke-fill": `var(${profile.smokeToken})`,
    "--smoke-alpha": `calc(var(--smoke-alpha-max) * ${brightness})`,
    "--glow-color": `var(${profile.glowToken})`,
  } as CSSProperties;

  return (
    <>
      <p
        data-decay-label=""
        className="m-0 mb-1 font-fact text-[13px] text-moon-300"
      >
        {profile.label}
      </p>
      <div
        ref={rootRef}
        className="smoke-field"
        data-state={settled ? "settled" : "revealing"}
        data-decay-profile={profile.id}
        style={style}
        onClick={settle}
      >
        <div className="smoke-field-ragged" aria-hidden="true" />
        <div data-seance-transcript="" className="smoke-field-text font-narrative">
          {sentences.map((nodes, idx) => (
            <Fragment key={idx}>
              {idx > 0 ? " " : null}
              <span data-sentence-index={idx}>{nodes}</span>
            </Fragment>
          ))}
        </div>
      </div>
      {settled ? (
        <p data-seance-announce="" className="sr-only">
          {voice}
        </p>
      ) : null}
    </>
  );
}
