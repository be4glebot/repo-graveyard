/**
 * DOM test: toggling Lights On (and opening the "View as list" dialog) leaves
 * the scene's view, plot, filter, selected repo and scroll position untouched.
 *
 * Requirements: 2.6, 5.4, 9.1
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import SceneView from "@/components/scene/SceneView";
import { ThemeProvider } from "@/components/scene/ThemeProvider";
import { buildRows } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";

const NOW = "2024-06-01T00:00:00.000Z";
const DAY_MS = 86_400_000;

function makeRepo(name: string, daysQuiet: number): RepoFacts {
  return {
    name,
    description: null,
    url: `https://github.com/octocat/${name}`,
    pushedAt: new Date(Date.parse(NOW) - daysQuiet * DAY_MS).toISOString(),
    createdAt: new Date(Date.parse(NOW) - 600 * DAY_MS).toISOString(),
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
  };
}

// 14 fresh zombies (100-113 days quiet) => two gate plots of up to 12.
const REPOS: RepoFacts[] = Array.from({ length: 14 }, (_, i) =>
  makeRepo(`zombie-${String(i).padStart(2, "0")}`, 100 + i),
);

function renderScene() {
  return render(
    <ThemeProvider>
      <SceneView
        rows={buildRows(REPOS, {}, NOW)}
        repos={REPOS}
        truncated={false}
        username="octocat"
        renderedAt={NOW}
        mode="live"
        at="gate"
      />
    </ThemeProvider>,
  );
}

let scrollTop = 0;

function stubScroll() {
  scrollTop = 0;
  for (const el of [document.documentElement, document.body]) {
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });
  }
}

const sceneRoot = () => document.getElementById("scene-root") as HTMLElement;
const lightsSwitch = () =>
  screen.getAllByRole("switch", { name: /lights on/i, hidden: true })[0];

function snapshot() {
  const active = document.querySelector<HTMLElement>(
    '[data-testid^="filter-chip-"][data-active="true"]',
  );
  const selected = document.querySelector<HTMLElement>(
    '[data-testid="place-view"] button[data-selected="true"]',
  );
  return {
    view: sceneRoot().getAttribute("data-view"),
    plot: screen.getByTestId("pager-label").textContent,
    filter: active?.getAttribute("data-testid") ?? null,
    selected: selected?.getAttribute("aria-label") ?? null,
    scroll: document.documentElement.scrollTop,
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("Lights On preserves scene state", () => {
  it("keeps view, plot, filter, selected repo and scroll across the toggle and the list dialog (2.6, 5.4, 9.1)", async () => {
    stubScroll();
    renderScene();

    // Filter -> fresh, plot -> 2, select a creature on that plot.
    fireEvent.click(screen.getByTestId("filter-chip-fresh"));
    fireEvent.click(screen.getByTestId("pager-deeper"));
    const creature = document.querySelector<HTMLElement>(
      '[data-testid="place-view"] button[aria-label*="zombie"]',
    );
    expect(creature).not.toBeNull();
    fireEvent.click(creature!);

    // Close the detail panel (it makes the scene inert); selection persists.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    document.documentElement.scrollTop = 120;

    const before = snapshot();
    expect(before.view).toBe("gate");
    expect(before.plot).toBe("Plot 2 of 2");
    expect(before.filter).toBe("filter-chip-fresh");
    expect(before.selected).toContain("zombie");
    expect(before.scroll).toBe(120);

    // Lights on, then off.
    fireEvent.click(lightsSwitch());
    expect(sceneRoot().getAttribute("data-theme")).toBe("day");
    expect(snapshot()).toEqual(before);

    fireEvent.click(lightsSwitch());
    expect(sceneRoot().getAttribute("data-theme")).toBe("night");
    expect(snapshot()).toEqual(before);

    // Open and close the list dialog.
    fireEvent.click(screen.getByTestId("view-list-button"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(snapshot()).toEqual(before);
  });
});
