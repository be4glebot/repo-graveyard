/**
 * DOM tests for the `?repo=` deep-link controller wired into `SceneView`
 * (`useRepoDeepLink`). History API calls are spied; plain DOM assertions only.
 *
 * Requirements: 8.1-8.7
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
import { creatureAccessibleName } from "@/lib/scene-view";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const BASE = "/g/octocat";

function daysAgo(days: number): string {
  return new Date(NOW_MS - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

function makeRepo(overrides: Partial<RepoFacts> & { name: string }): RepoFacts {
  return {
    description: null,
    url: `https://github.com/octocat/${overrides.name}`,
    pushedAt: daysAgo(1),
    createdAt: daysAgo(400),
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
    ...overrides,
  };
}

// old-zombie lives at the gate.
const REPOS: RepoFacts[] = [
  makeRepo({ name: "fresh-ghost", pushedAt: daysAgo(1) }),
  makeRepo({ name: "old-zombie", pushedAt: daysAgo(300) }),
];

function initialRows() {
  return buildRows(REPOS, {}, NOW);
}

function creatureButton(repoName: string): HTMLButtonElement {
  const row = initialRows().find((r) => r.name === repoName);
  if (!row) throw new Error(`no row for ${repoName}`);
  return screen.getByRole("button", {
    name: creatureAccessibleName(row),
  }) as HTMLButtonElement;
}

function renderScene(at?: string) {
  return render(
    <SceneView
      rows={initialRows()}
      repos={REPOS}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
      at={at}
    />,
  );
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

/** Simulates a browser traversal: restore URL/state, then fire popstate. */
function firePopState(state: unknown, search = ""): void {
  act(() => {
    window.history.replaceState(state, "", `${BASE}${search}`);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  });
}

function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      query.includes("min-width: 768px") || query.includes("hover: hover"),
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
  window.history.replaceState(null, "", BASE);
  stubMedia();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  push.mockReset();
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", BASE);
});

function closeButton(): HTMLElement {
  return screen.getByRole("button", { name: "Close record" });
}

describe("?repo= deep link", () => {
  it("in-page open pushes ?repo= and preserves ?at= (8.1)", () => {
    window.history.replaceState(null, "", `${BASE}?at=gate`);
    renderScene("gate");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      fireEvent.click(creatureButton("old-zombie"));
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const url = new URL(String(pushSpy.mock.calls[0][2]), window.location.origin);
    expect(url.searchParams.get("repo")).toBe("old-zombie");
    expect(url.searchParams.get("at")).toBe("gate");
    expect(window.location.search).toContain("repo=old-zombie");
    expect(dialog()).not.toBeNull();
  });

  it("opens a case-insensitively matching ?repo= on load without pushing (8.2)", () => {
    window.history.replaceState(null, "", `${BASE}?at=gate&repo=OLD-ZOMBIE`);
    const pushSpy = vi.spyOn(window.history, "pushState");

    renderScene("gate");

    expect(dialog()).not.toBeNull();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("in-page close after a push calls history.back() (8.3)", () => {
    renderScene("gate");
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    act(() => {
      fireEvent.click(creatureButton("old-zombie"));
    });
    expect(dialog()).not.toBeNull();

    act(() => {
      fireEvent.click(closeButton());
    });

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("closing a loaded-URL open strips ?repo= via replaceState, keeping ?at= (8.4)", () => {
    window.history.replaceState(null, "", `${BASE}?at=gate&repo=old-zombie`);
    renderScene("gate");
    expect(dialog()).not.toBeNull();

    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    act(() => {
      fireEvent.click(closeButton());
    });

    expect(backSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const url = new URL(String(replaceSpy.mock.calls[0][2]), window.location.origin);
    expect(url.searchParams.has("repo")).toBe(false);
    expect(url.searchParams.get("at")).toBe("gate");
    expect(dialog()).toBeNull();
  });

  it("Back while open closes the panel and stays in the same place (8.5)", () => {
    renderScene("gate");
    act(() => {
      fireEvent.click(creatureButton("old-zombie"));
    });
    expect(dialog()).not.toBeNull();

    // Traversal to the entry behind the push: same place, no ?repo=.
    firePopState({ view: "gate" }, "?at=gate");

    expect(dialog()).toBeNull();
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );
  });

  it("a non-matching ?repo= leaves all panels closed (8.7)", () => {
    window.history.replaceState(null, "", `${BASE}?at=gate&repo=does-not-exist`);
    const pushSpy = vi.spyOn(window.history, "pushState");

    renderScene("gate");

    expect(dialog()).toBeNull();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("open/close is client-only: scene host stays mounted, no router push (8.6)", () => {
    renderScene("gate");
    const host = screen.getByTestId("scene-view");
    vi.spyOn(window.history, "back").mockImplementation(() => {});

    act(() => {
      fireEvent.click(creatureButton("old-zombie"));
    });
    act(() => {
      fireEvent.click(closeButton());
    });
    firePopState({ view: "gate" }, "?at=gate");

    // Same host element (no remount / server re-run) and no Next navigation;
    // rows/renderedAt are props so they cannot change without a new server render.
    expect(screen.getByTestId("scene-view")).toBe(host);
    expect(push).not.toHaveBeenCalled();
    expect(creatureButton("old-zombie")).toBeTruthy();
  });
});
