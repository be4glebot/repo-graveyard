/**
 * The cause heading shown in the panel matches the creature state, for every
 * sample estate fixture. No network, no LLM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/llm", () => ({
  createLlmClient: vi.fn(() => {
    throw new Error("LLM must not be used on the estate");
  }),
}));

import DetailPanel from "@/components/detail/DetailPanel";
import estateJson from "@/data/estate.json";
import { resolveEstate } from "@/lib/estate";
import { estateSchema } from "@/lib/estate-schema";
import { buildRows } from "@/lib/graveyard-view";
import { buildRepoRows } from "@/lib/repoRow";
import { causeHeading } from "@/lib/seance-schema";

const NOW = "2024-06-01T00:00:00.000Z";
const estate = estateSchema.parse(estateJson);
const { repos, overrides } = resolveEstate(estate, NOW);
const rows = buildRows(repos, overrides, NOW);
const repoRows = buildRepoRows(repos);

function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 768px") || query.includes("hover: hover")
      ? true
      : query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  stubMedia();
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no fetch"); }));
});

afterEach(() => {
  cleanup();
  document.body.removeAttribute("style");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cause heading matches the state", () => {
  it("the estate covers every state", () => {
    expect(new Set(rows.map((r) => r.state))).toEqual(
      new Set(["ghost", "risen", "zombie", "tombstone", "coffin"]),
    );
  });

  it.each(estate.repos.map((r, i) => [r.name, i] as const))("%s", async (_n, i) => {
    render(
      <DetailPanel
        row={repoRows[i]}
        owner={estate.username}
        classification={{ state: rows[i].state, decayLevel: rows[i].decayLevel }}
        facts={repos[i]}
        renderedAt={NOW}
        isFixture={true}
        seanceFixture={estate.repos[i].seanceResult}
        onClose={vi.fn()}
        sceneRootId="scene-root"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Hold a séance/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    const heading = document.querySelector("[data-seance-cause-heading]");
    expect(heading?.textContent).toBe(causeHeading(rows[i].state));
    const cause = document.querySelector("[data-seance-cause]");
    expect(cause?.textContent).toBe((estate.repos[i].seanceResult as { causeOfDeath?: string } | undefined)?.causeOfDeath);
    expect(heading?.nextElementSibling).toBe(cause);
  });
});