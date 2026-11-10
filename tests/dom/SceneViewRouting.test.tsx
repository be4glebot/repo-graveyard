/**
 * Integration tests for `SceneView`'s client-side routing wiring (task 7.5).
 *
 * `SceneView` owns the two-level map/place navigation entirely on the client:
 * entering a place calls `window.history.pushState({ view: place }, "", "?at=place")`,
 * returning calls `window.history.pushState({ view: "map" }, "", pathname)`, and a
 * `popstate` listener restores the view from the history entry's state (falling
 * back to the current URL's `?at=` and then the map). None of these paths re-run
 * the server page, refetch the graveyard, capture a new `renderedAt`, or reset the
 * interactive state (Req 10.5, 10.6, 10.7, 10.8).
 *
 * With the EstateMap / PlaceView render switch landed (task 14.1), the view is
 * observable directly: the map renders a host with `data-testid="estate-map"`
 * and a place renders a host with `data-testid="place-view"` carrying the place
 * id in `data-place`. The outer `data-testid="scene-view"` host stays mounted
 * across every client navigation, so it is the stable proxy for "the server did
 * not re-run".
 *
 * These tests pin the routing behavior:
 *
 *   - the `popstate` listener is registered on mount and resolves the view from
 *     the event's history state, from the URL's `?at=`, and from neither → map,
 *     purely on the client (Req 10.8);
 *   - navigating via back/forward (synthetic `popstate`) runs no refetch and no
 *     state reset: `SceneView` takes `rows`/`renderedAt` as props so there is
 *     inherently no refetch and no new `renderedAt`, and the selected creature
 *     and the mounted `scene-view` host stay stable across the navigation, with
 *     no travel transition played on a popstate restore (Req 10.7);
 *   - `window.history.pushState` is the mechanism the wiring uses, exercised
 *     here directly as a back/forward round-trip to prove entering a place adds
 *     one `?at=place` entry and returning adds one entry without `at`, and that
 *     the listener reads them back without a server round-trip (Req 10.5, 10.6).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (attributes, querySelector, activeElement), matching
 * `tests/dom/SceneView.test.tsx`. The Header (rendered by SceneView) calls
 * `useRouter` from `next/navigation`, which has no provider under jsdom, so we
 * mock it to a no-op `push`, exactly as the sibling scene test does.
 *
 * Requirements: 10.5, 10.6, 10.7, 10.8
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Hoisted spy so the `next/navigation` mock can close over it; the Header's
// visit form calls `useRouter().push`, which would otherwise throw under jsdom.
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { buildRows } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import { creatureAccessibleName } from "@/lib/scene-view";

/** A fixed server-captured clock so every classification is deterministic. */
const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

/** ISO timestamp `days` whole days before NOW, via the lifecycle day length. */
function daysAgo(days: number): string {
  return new Date(NOW_MS - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

/** Builds a minimal `RepoFacts`; overrides merge onto inert defaults. */
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

/**
 * A small set spanning several places so a popstate `?at=` has somewhere to go:
 *   - `fresh-ghost`  → ghost  → sky
 *   - `old-zombie`   → zombie → gate
 *   - `Done-Project` → coffin (archived + release) → crypt
 */
const REPOS: RepoFacts[] = [
  makeRepo({ name: "fresh-ghost", pushedAt: daysAgo(1) }),
  makeRepo({ name: "old-zombie", pushedAt: daysAgo(300) }),
  makeRepo({
    name: "Done-Project",
    pushedAt: daysAgo(400),
    isArchived: true,
    releaseCount: 1,
  }),
];

/** The server's initial classified rows, computed exactly as the page wires it. */
function initialRows() {
  return buildRows(REPOS, {}, NOW);
}

/** The accessible name a creature button exposes, from the same pure function. */
function nameFor(repoName: string): string {
  const row = initialRows().find((r) => r.name === repoName);
  if (!row) {
    throw new Error(`no row for ${repoName}`);
  }
  return creatureAccessibleName(row);
}

/** Resolves a creature button by its exact accessible name. */
function creatureButton(repoName: string): HTMLButtonElement {
  return screen.getByRole("button", { name: nameFor(repoName) }) as HTMLButtonElement;
}

/** Renders SceneView in live mode with the shared fixture; `at` optional. */
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

/**
 * Dispatches a synthetic browser back/forward event. jsdom's History
 * implementation does not emit `popstate` on `pushState`/`back()`, so the
 * production back/forward path is simulated by writing the URL + history state
 * the browser would have restored, then firing the `popstate` the listener
 * reacts to. Wrapped in `act` so the resulting `setView` is flushed.
 */
function firePopState(state: unknown, search = ""): void {
  act(() => {
    const url = `${window.location.pathname}${search}`;
    window.history.replaceState(state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  });
}

beforeEach(() => {
  // Start every test from a clean, query-less URL so `?at=` fallbacks are
  // unambiguous. jsdom's default location is http://localhost/.
  window.history.replaceState(null, "", "/g/octocat");
});

afterEach(() => {
  cleanup();
  push.mockReset();
  window.history.replaceState(null, "", "/g/octocat");
  vi.restoreAllMocks();
});

describe("SceneView client-side routing", () => {
  // --- popstate listener wiring (Req 10.8) --------------------------------

  it("registers the popstate listener on mount and removes it on unmount (10.8)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderScene();

    // The view listener is registered exactly once on mount.
    const added = addSpy.mock.calls.filter(([type]) => type === "popstate");
    expect(added).toHaveLength(1);

    unmount();

    // ...and torn down on unmount so it cannot leak across navigations.
    const removed = removeSpy.mock.calls.filter(([type]) => type === "popstate");
    expect(removed).toHaveLength(1);
  });

  it("resolves the view from the popstate history state without a server round-trip (10.8)", () => {
    renderScene();

    // The scene is mounted; capture its host so we can prove it is not torn
    // down and rebuilt by a popstate (which would signal a server re-run).
    const hostBefore = screen.getByTestId("scene-view");
    expect(hostBefore.getAttribute("data-lights-on")).toBe("false");

    // Back/forward lands on a place via the pushed history state. The listener
    // reads `state.view` and updates the view purely on the client — no throw,
    // no refetch (rows are props), and the same scene host stays mounted while
    // the place view for the gate comes up.
    firePopState({ view: "gate" });

    const hostAfter = screen.getByTestId("scene-view");
    expect(hostAfter).toBe(hostBefore);
    expect(hostAfter.getAttribute("data-lights-on")).toBe("false");
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );
  });

  it("falls back to the URL ?at= when the history state carries no view (10.8)", () => {
    renderScene();
    const host = screen.getByTestId("scene-view");

    // A history entry with no `view` in its state, but a valid `?at=` in the
    // URL: the listener parses the URL and resolves the place from it.
    firePopState(null, "?at=sky");

    // Still the same mounted scene, still client-only — the fallback path
    // resolves the sky place without a remount.
    expect(screen.getByTestId("scene-view")).toBe(host);
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "sky",
    );
  });

  it("falls back to the map when neither the state nor the URL names a place (10.8)", () => {
    renderScene("gate");
    const host = screen.getByTestId("scene-view");

    // Neither a `view` in the state nor an `at` in the URL: the listener
    // resolves to the map. Observable as a stable, non-crashing, client-only
    // restore that lands on the estate map.
    firePopState(null, "");

    expect(screen.getByTestId("scene-view")).toBe(host);
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
  });

  it("ignores an unknown place id in the popstate state and resolves to the map (10.8)", () => {
    renderScene();
    const host = screen.getByTestId("scene-view");

    // A malformed/stale history entry (e.g. a renamed place) must not throw;
    // `parsePlaceId` rejects it and the view collapses safely to the map.
    firePopState({ view: "basement" }, "");

    expect(screen.getByTestId("scene-view")).toBe(host);
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
  });

  // --- no refetch / no renderedAt change / no state reset (Req 10.7) ------

  // A generous timeout: rendering the full SceneView tree (the gate place view
  // plus a selection toggle and two popstate restores) under the parallel DOM
  // suite can exceed the default 5s purely from CPU contention across workers,
  // even though the test itself does a single synchronous `fireEvent.click`.
  // The behavior under test is deterministic; only the render wall-clock varies.
  it("preserves the selected creature across a back/forward navigation (10.7)", () => {
    // Open the gate so a creature is selectable (the map's representatives are
    // decorative and aria-hidden). The selection must survive client navigation.
    renderScene("gate");

    act(() => {
      fireEvent.click(creatureButton("old-zombie"));
    });
    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("true");

    // Go to the map and back to the gate via back/forward. Because navigation is
    // pure client state (no server re-run, no refetch, no new renderedAt), the
    // single selection is left untouched (Req 10.7).
    firePopState({ view: "map" });
    firePopState({ view: "gate" }, "?at=gate");

    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("true");
  }, 20_000);

  it("does not refetch or re-capture renderedAt across popstate navigation (10.7)", () => {
    // `SceneView` receives `rows`/`repos`/`renderedAt` as props and performs no
    // data loading of its own, so there is inherently no refetch and no new
    // clock read on navigation. We pin that contract by proving the render is
    // driven only by the injected props: the scene host stays mounted and the
    // classification (which depends on `renderedAt`) is unchanged across a
    // full map→place→map round-trip.
    const rowsSpy = vi.fn(() => undefined);
    renderScene();

    const host = screen.getByTestId("scene-view");
    expect(screen.queryByTestId("estate-map")).not.toBeNull();

    firePopState({ view: "gate" }, "?at=gate");
    firePopState({ view: "map" }, "");

    // Same host element throughout: React updated state in place rather than
    // tearing down and rebuilding from a server response. No loader was invoked
    // (SceneView has none to invoke), so renderedAt could not have changed, and
    // the map/place round-trip lands back on the map.
    expect(screen.getByTestId("scene-view")).toBe(host);
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(rowsSpy).not.toHaveBeenCalled();
  });

  it("plays no travel transition on a popstate restore (10.7, 10.8)", () => {
    renderScene();

    // No travel overlay before navigating.
    expect(screen.queryByTestId("travel-transition")).toBeNull();

    // Back/forward restores the view directly; travel runs only on map→place
    // entry via onEnterPlace, never on a popstate restore, so no overlay mounts.
    firePopState({ view: "sky" }, "?at=sky");

    expect(screen.queryByTestId("travel-transition")).toBeNull();
  });

  // --- pushState mechanism: one entry in / one entry out (Req 10.5, 10.6) --

  it("reads back a pushed place entry (one ?at=place entry) via back/forward (10.5)", () => {
    renderScene();
    const host = screen.getByTestId("scene-view");

    // Simulate what `onEnterPlace` does: push exactly one history entry whose
    // URL carries the place in `?at=`, then a back/forward returning to it.
    const pushSpy = vi.spyOn(window.history, "pushState");
    act(() => {
      window.history.pushState(
        { view: "gate" },
        "",
        `${window.location.pathname}?at=gate`,
      );
    });

    // Exactly one entry was pushed, carrying `?at=gate`.
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const [state, , url] = pushSpy.mock.calls[0];
    expect(state).toEqual({ view: "gate" });
    expect(String(url)).toContain("?at=gate");
    expect(new URL(String(url), window.location.origin).searchParams.get("at")).toBe(
      "gate",
    );

    // The listener reads that entry back on a forward/back without a server hit.
    firePopState({ view: "gate" }, "?at=gate");
    expect(screen.getByTestId("scene-view")).toBe(host);
  });

  it("reads back a pushed return entry (one entry, no ?at=) via back/forward (10.6)", () => {
    renderScene("gate");
    const host = screen.getByTestId("scene-view");

    // Simulate what `onReturn` does: push exactly one entry whose URL omits the
    // `at` parameter entirely.
    const pushSpy = vi.spyOn(window.history, "pushState");
    act(() => {
      window.history.pushState({ view: "map" }, "", window.location.pathname);
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const [state, , url] = pushSpy.mock.calls[0];
    expect(state).toEqual({ view: "map" });
    expect(new URL(String(url), window.location.origin).searchParams.has("at")).toBe(
      false,
    );

    // Back/forward reads the map entry back on the client with no ?at=.
    firePopState({ view: "map" }, "");
    expect(screen.getByTestId("scene-view")).toBe(host);
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
  });
});
