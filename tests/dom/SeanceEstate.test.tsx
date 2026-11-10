/**
 * DOM tests for the séance on the sample estate: every fixture repo plays its
 * pre-written séance with 0 fetch calls and 0 LLM calls, using the same ritual
 * and transcript presentation as a live séance. A missing or schema-invalid
 * fixture shows the Silent_Fallback, still with 0 network calls, and the panel
 * stays open and usable. Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 2.1, 2.2, 2.7, 2.8, 2.9, 20.10
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Any LLM client creation fails the test.
const createLlmClient = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("LLM must not be used on the estate");
  }),
);
vi.mock("@/lib/llm", () => ({ createLlmClient }));

import DetailPanel, { type DetailPanelProps } from "@/components/detail/DetailPanel";
import estateJson from "@/data/estate.json";
import { resolveEstate } from "@/lib/estate";
import { estateSchema } from "@/lib/estate-schema";
import { buildRows } from "@/lib/graveyard-view";
import { buildRepoRows } from "@/lib/repoRow";
import { seanceResultSchema } from "@/lib/seance-schema";
import { VERDICT_COPY } from "@/lib/seance-transcript";

const NOW = "2024-06-01T00:00:00.000Z";

const estate = estateSchema.parse(estateJson);
const { repos, overrides } = resolveEstate(estate, NOW);
const rows = buildRows(repos, overrides, NOW);
const repoRows = buildRepoRows(repos);

const HEADING = /AI · from the facts above/;
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function stubMedia({ reduced = false }: { reduced?: boolean } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => {
    let matches = false;
    if (query.includes("min-width: 768px")) matches = true;
    else if (query.includes("prefers-reduced-motion")) matches = reduced;
    else if (query.includes("hover: hover")) matches = true;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
}

let fetchFn: ReturnType<typeof vi.fn>;

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function renderPanel(index: number, overridesProps: Partial<DetailPanelProps> = {}) {
  const onClose = vi.fn();
  const row = repoRows[index];
  const utils = render(
    <DetailPanel
      row={row}
      owner={estate.username}
      classification={{ state: rows[index].state, decayLevel: rows[index].decayLevel }}
      facts={repos[index]}
      renderedAt={NOW}
      isFixture={true}
      seanceFixture={estate.repos[index].seanceResult}
      onClose={onClose}
      {...overridesProps}
    />,
  );
  return { ...utils, onClose };
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const ritual = () => document.querySelector<HTMLElement>("[data-seance-ritual]");
const hold = () =>
  fireEvent.click(screen.getByRole("button", { name: /Hold a séance/ }));
const stateEl = (s: string) =>
  document.querySelector<HTMLElement>(`[data-seance-state="${s}"]`);

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  createLlmClient.mockClear();
  stubMedia();
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  fetchFn = vi.fn(async () => {
    throw new Error("fetch must not be called on the estate");
  });
  vi.stubGlobal("fetch", fetchFn);
});

afterEach(() => {
  expect(fetchFn).not.toHaveBeenCalled();
  expect(createLlmClient).not.toHaveBeenCalled();
  cleanup();
  document.body.removeAttribute("style");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("every estate fixture plays its pre-written séance (2.1, 2.2, 2.7, 20.10)", () => {
  it("covers every estate repo", () => {
    expect(estate.repos.length).toBeGreaterThan(0);
    expect(repoRows.length).toBe(estate.repos.length);
  });

  it.each(estate.repos.map((r, i) => [r.name, i] as const))(
    "%s: ritual then transcript and verdict card, no fetch, no LLM",
    async (_name, i) => {
      const parsed = seanceResultSchema.safeParse(estate.repos[i].seanceResult);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const result = parsed.data;

      const { onClose } = renderPanel(i);
      expect(ritual()).toBeNull();
      hold();
      await flush(0);
      // Same ritual as a live séance: held for the 2 s floor.
      expect(ritual()).not.toBeNull();
      expect(screen.queryByRole("heading", { name: HEADING })).toBeNull();

      await flush(2100);
      expect(ritual()).toBeNull();
      const heading = screen.getByRole("heading", { name: HEADING });
      expect(document.activeElement).toBe(heading);

      const transcript = document.querySelector("[data-seance-transcript]")!;
      expect(norm(transcript.textContent)).toBe(norm(result.voice));

      const cards = document.querySelectorAll("[data-verdict-card]");
      expect(cards.length).toBe(1);
      const copy = VERDICT_COPY[result.verdict];
      expect(cards[0].getAttribute("data-treatment")).toBe(copy.treatment);
      expect(norm(cards[0].textContent)).toContain(`Verdict: ${copy.word}`);
      expect(norm(cards[0].textContent)).toContain(norm(result.verdictReason));

      expect(dialog()).not.toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it("is ready within 500 ms of starting under reduced motion (2.8)", async () => {
    stubMedia({ reduced: true });
    renderPanel(0);
    hold();
    await flush(500);
    expect(ritual()).toBeNull();
    expect(screen.getByRole("heading", { name: HEADING })).toBeTruthy();
    expect(document.querySelector("[data-seance-transcript]")).not.toBeNull();
  });

  it("skipping the ritual works as on a live séance", async () => {
    const { onClose } = renderPanel(0);
    hold();
    await flush(0);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await flush(0);
    expect(ritual()).toBeNull();
    expect(screen.getByRole("heading", { name: HEADING })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("missing or invalid fixture shows the Silent_Fallback (2.9)", () => {
  const cases: [string, unknown][] = [
    ["missing", undefined],
    ["schema-invalid", { voice: 42, verdict: "nonsense" }],
    ["null", null],
  ];

  it.each(cases)("%s fixture: Silent, no network, panel stays open", async (_label, fixture) => {
    stubMedia({ reduced: true });
    const { onClose } = renderPanel(0, { seanceFixture: fixture });
    hold();
    await flush(500);

    const el = stateEl("silent")!;
    expect(el).not.toBeNull();
    expect(norm(el.textContent)).toContain(
      "The spirits are silent tonight. The candle gutters out.",
    );
    expect(document.querySelector("[data-verdict-card]")).toBeNull();
    expect(dialog()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // Retry stays on the fixture path (still no fetch) and the panel is usable.
    fireEvent.click(screen.getByRole("button", { name: "Light another candle" }));
    await flush(500);
    expect(stateEl("silent")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close record" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
