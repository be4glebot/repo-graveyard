/**
 * Preservation DOM tests for the scene-layout-clickability bugfix (task 2).
 * Observed on UNFIXED code; they must pass before and after the fix.
 *
 *   - Return, filter chip and pager buttons fire their handlers (3.1)
 *   - widths < 768 yield data-layout="two-column", wider yield "scatter" (3.3)
 *   - the footer wrapper stays pointer-events-none (3.6)
 *
 * **Validates: Requirements 3.1, 3.3, 3.6**
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import PlaceView from "@/components/scene/PlaceView";
import SceneView from "@/components/scene/SceneView";
import { buildRows, type GraveyardRow } from "@/lib/graveyard-view";
import { PLOT_SIZE } from "@/lib/estate-view";
import type { RepoFacts } from "@/lib/lifecycle";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ghostRows(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `ghost-${i}`,
    url: `https://github.com/octocat/ghost-${i}`,
    state: "ghost" as const,
    daysQuiet: 1,
    decayLevel: 0,
  }));
}

function renderSky(count: number) {
  const h = {
    onFilterChange: vi.fn(),
    onPlotChange: vi.fn(),
    onSelect: vi.fn(),
    onReturn: vi.fn(),
  };
  render(
    <PlaceView
      place="sky"
      rows={ghostRows(count)}
      activeFilter="all"
      plotIndex={0}
      selectedName={null}
      onFilterChange={h.onFilterChange}
      onPlotChange={h.onPlotChange}
      onSelect={h.onSelect}
      onReturn={h.onReturn}
    />,
  );
  return h;
}

/** Stubs the measured scatter container size (jsdom has no layout). */
function stubClientSize(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(height);
}

describe("Preservation: chrome controls fire their handlers", () => {
  it("Return button calls onReturn", () => {
    const h = renderSky(3);
    fireEvent.click(screen.getByTestId("return-to-gate"));
    expect(h.onReturn).toHaveBeenCalledTimes(1);
  });

  it("filter chip calls onFilterChange with its filter", () => {
    const h = renderSky(3);
    fireEvent.click(screen.getByTestId("filter-chip-healthy"));
    expect(h.onFilterChange).toHaveBeenCalledWith("healthy");
  });

  it("pager buttons call onPlotChange with the adjacent plot index", () => {
    const h = renderSky(PLOT_SIZE + 1);
    fireEvent.click(screen.getByTestId("pager-deeper"));
    expect(h.onPlotChange).toHaveBeenCalledWith(1);
  });
});

/** Stubs matchMedia so the compact query matches iff width <= 767. */
function stubCompactMedia(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 767px)" ? width <= 767 : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe("Preservation: mobile layout branch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([360, 500, 767])("width %i renders data-layout=two-column", (w) => {
    stubClientSize(w, 700);
    stubCompactMedia(w);
    renderSky(5);
    expect(screen.getByTestId("depth-scatter").getAttribute("data-layout")).toBe("two-column");
  });

  it.each([768, 1280, 1440])("width %i renders data-layout=scatter", (w) => {
    stubClientSize(w, 800);
    stubCompactMedia(w);
    renderSky(5);
    expect(screen.getByTestId("depth-scatter").getAttribute("data-layout")).toBe("scatter");
  });
});

describe("Preservation: footer wrapper is non-interactive", () => {
  it("footer and its SceneView wrapper carry pointer-events-none", () => {
    const repos: RepoFacts[] = [
      {
        name: "fresh-ghost",
        description: null,
        url: "https://github.com/octocat/fresh-ghost",
        pushedAt: "2024-05-31T00:00:00.000Z",
        createdAt: "2023-01-01T00:00:00.000Z",
        isArchived: false,
        isFork: false,
        homepageUrl: null,
        stargazerCount: 0,
        primaryLanguage: null,
        openIssueCount: 0,
        releaseCount: 0,
        readmeBytes: null,
        lastCommitMessage: null,
        languageColor: null,
        forkCount: 0,
        topics: [],
      },
    ];
    const now = "2024-06-01T00:00:00.000Z";
    render(
      <SceneView
        rows={buildRows(repos, {}, now)}
        repos={repos}
        truncated={false}
        username="octocat"
        renderedAt={now}
        mode="live"
      />,
    );
    const footer = screen.getByTestId("scene-footer");
    expect(footer.className.split(/\s+/)).toContain("pointer-events-none");
    expect(footer.parentElement?.className.split(/\s+/)).toContain("pointer-events-none");
    expect(screen.getByTestId("scene-footer-legend")).not.toBeNull();
  });
});
