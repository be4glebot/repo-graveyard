/**
 * The estate map's creature representatives are decorative: they are not wired
 * to the hover-card context, and the place button only navigates into the place
 * (no detail panel).
 *
 * Plain DOM assertions (`@testing-library/jest-dom` is not installed).
 *
 * **Validates: Requirements 10.1**
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { buildRows } from "@/lib/graveyard-view";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function daysAgo(days: number): string {
  return new Date(NOW_MS - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

function makeRepo(overrides: Partial<RepoFacts> & { name: string }): RepoFacts {
  return {
    description: "a repo",
    url: `https://github.com/octocat/${overrides.name}`,
    pushedAt: daysAgo(1),
    createdAt: daysAgo(400),
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 3,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: null,
    languageColor: null,
    forkCount: 0,
    topics: [],
    ...overrides,
  };
}

const REPOS: RepoFacts[] = [
  makeRepo({ name: "fresh-ghost", pushedAt: daysAgo(1) }),
  makeRepo({ name: "old-zombie", pushedAt: daysAgo(300) }),
];

function renderMap() {
  return render(
    <SceneView
      rows={buildRows(REPOS, {}, NOW)}
      repos={REPOS}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
    />,
  );
}

function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("hover: hover") || query.includes("pointer: fine"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  stubMatchMedia();
  window.history.replaceState(null, "", "/g/octocat");
});

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/g/octocat");
});

describe("estate map is non-interactive for creature details (10.1)", () => {
  it("opens no hover card when hovering or focusing a representative or place button", () => {
    renderMap();
    expect(screen.queryByTestId("estate-map")).not.toBeNull();

    const targets: HTMLElement[] = [
      screen.getByTestId("estate-place-sky"),
      screen.getByTestId("estate-place-sky-representatives"),
    ];
    const rep = screen
      .getByTestId("estate-place-sky-representatives")
      .firstElementChild as HTMLElement | null;
    if (rep) targets.push(rep);

    for (const el of targets) {
      act(() => {
        fireEvent.pointerEnter(el);
        fireEvent.pointerOver(el);
        fireEvent.mouseEnter(el);
        fireEvent.mouseOver(el);
        fireEvent.focus(el);
        fireEvent.focusIn(el);
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    }

    // Representatives carry no description link to a hover card.
    expect(
      screen
        .getByTestId("estate-place-sky-representatives")
        .querySelector("[aria-describedby]"),
    ).toBeNull();
  });

  it("activating the place button enters the place without opening a detail panel", () => {
    renderMap();
    const button = screen.getByTestId("estate-place-sky");

    act(() => {
      fireEvent.click(button);
    });

    // Travel starts; skip it to reach the arrived place view.
    if (screen.queryByTestId("travel-transition") !== null) {
      act(() => {
        fireEvent.keyDown(window, { key: "Escape" });
      });
    }
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "sky",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
