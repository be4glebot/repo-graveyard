// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import * as fc from "fast-check";
import SpiritTranscript from "@/components/seance/SpiritTranscript";
import { splitSentences } from "@/lib/seance-schema";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const word = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/);
const gap = fc.constantFrom(" ", "  ", "\n", " \t ");

/** One sentence: 1-6 words, varied whitespace, one closing full stop. */
const sentence = fc
  .tuple(
    fc.array(word, { minLength: 1, maxLength: 6 }),
    fc.array(gap, { minLength: 6, maxLength: 6 }),
  )
  .map(([words, gaps]) =>
    words.reduce((acc, w, i) => (i === 0 ? w : acc + gaps[i] + w), "") + ".",
  );

/** Valid voice: 2-4 sentences. */
const voice = fc
  .array(sentence, { minLength: 2, maxLength: 4 })
  .map((parts) => parts.join(" "));

function snapshot(container: HTMLElement) {
  const root = container.querySelector("[data-seance-transcript]") as HTMLElement;
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-sentence-index]"));
  return {
    root,
    indexes: els.map((e) => e.getAttribute("data-sentence-index")),
    texts: els.map((e) => norm(e.textContent ?? "")),
  };
}

describe("seance transcript DOM property tests", () => {
  // Feature: the-seance, Property 11: Sentence elements are indexed and the full text is present
  // **Validates: Requirements 11.12, 16.2**
  it.each([false, true])(
    "indexes sentences and holds the full text from the first render (reduced=%s)",
    (reduced) => {
      fc.assert(
        fc.property(voice, (v) => {
          const expected = splitSentences(v).map(norm);
          const props = {
            voice: v,
            repoName: "demo-repo",
            state: "zombie",
            decayLevel: 1,
            reduced,
          };
          const { container, rerender } = render(<SpiritTranscript {...props} />);

          // First render: zero-based, unique indexes; full text present.
          const first = snapshot(container);
          const want = expected.map((_, i) => String(i));
          expect(first.indexes).toEqual(want);
          expect(new Set(first.indexes).size).toBe(first.indexes.length);
          expect(first.texts).toEqual(expected);
          expect(norm(first.root.textContent ?? "")).toBe(norm(v));

          // Re-render with a copy of the same props: unchanged.
          rerender(<SpiritTranscript {...props} />);
          const again = snapshot(container);
          expect(again.indexes).toEqual(first.indexes);
          expect(again.texts).toEqual(first.texts);

          // Let the reveal run and settle: still unchanged.
          act(() => {
            vi.advanceTimersByTime(10_000);
          });
          expect(
            container.querySelector("[data-state]")?.getAttribute("data-state"),
          ).toBe("settled");
          const settled = snapshot(container);
          expect(settled.indexes).toEqual(first.indexes);
          expect(settled.texts).toEqual(first.texts);
          expect(norm(settled.root.textContent ?? "")).toBe(norm(v));

          cleanup();
        }),
        { numRuns: 100 },
      );
    },
  );
});
