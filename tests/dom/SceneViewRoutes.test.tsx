/**
 * End-to-end integration tests for the three wired routes (task 14.2).
 *
 * The feature exposes the estate map / place model through three Next.js server
 * pages that are all thin: each loads data, reads `renderedAt` once, and renders
 * the client `SceneView` shell with a `mode` / `at` / `initialRepo` combination.
 *
 *   - `/g/[username]`          → mode "live",  no `at`, no `initialRepo`
 *   - `/g/[username]?at=…`     → mode "live",  `at` set
 *   - `/g/[username]/[repo]`   → mode "live",  `initialRepo` set (+ optional `at`)
 *   - `/estate`                → mode "estate" (bundled sample estate)
 *
 * Rather than render the async server components (which need Next's request
 * scope and the data loaders), these tests drive `SceneView` directly with the
 * exact prop combinations each route produces, and assert the end-to-end
 * map/place behavior each route is responsible for:
 *
 *   - `/g/[username]` shows the estate map and no place (Req 1.1, 10.1);
 *   - `?at=<place>` opens that place on the first paint (Req 10.2);
 *   - `/g/[username]/[repo]` opens the place holding the matching row with the
 *     creature selected, case-insensitively (Req 11.1), and a valid `?at=`
 *     overrides that place while the deep-linked creature stays selected
 *     (Req 11.2);
 *   - `/estate` behaves identically for the bundled estate — map by default,
 *     `?at=` opens a place — and shows the estate footer plaque chrome (Req 1.1,
 *     10.1, 10.2);
 *   - the Lights-on register is reachable from both the map and a place and
 *     lists every repository across all four places (Req 14.1).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (attributes, querySelector), matching `tests/dom/SceneView.test.tsx`.
 * The Header calls `useRouter` from `next/navigation`, which has no provider
 * under jsdom, so it is mocked to a no-op `push`, exactly as the sibling tests.
 *
 * `fireEvent.click` drives the toggles (rather than `userEvent`) to avoid the
 * real-timer slowness noted in the sibling scene tests; entering a place plays a
 * travel transition, but `onEnterPlace` calls `setView` synchronously, so the
 * place view is present immediately after the click — the test settles the
 * travel timer with a `keydown` (the transition's documented skip) so no timer
 * leaks past the test.
 *
 * Requirements: 1.1, 10.1, 10.2, 11.1, 14.1
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Hoisted spy so the `next/navigation` mock can close over it; the Header's
// visit form calls `useRouter().push`, which would otherwise throw under jsdom.
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { ThemeProvider } from "@/components/scene/ThemeProvider";
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
 * A fixture spanning all four places so every route has a map to show and a
 * place to open:
 *   - `fresh-ghost`  → ghost  → sky   (pushed 1 day ago)
 *   - `old-zombie`   → zombie → gate  (quiet ~300 days, no finished signals)
 *   - `Older-Zombie` → zombie → gate  (quiet ~320 days)
 *   - `Done-Project` → coffin → crypt (archived + a release → finished; mixed
 *                      case on purpose so the case-insensitive deep link can be
 *                      exercised against it)
 * `ground` stays empty, which is a valid place state (it still renders on the
 * map, quieter, per Req 1.6).
 */
const REPOS: RepoFacts[] = [
  makeRepo({ name: "fresh-ghost", pushedAt: daysAgo(1) }),
  makeRepo({ name: "old-zombie", pushedAt: daysAgo(300) }),
  makeRepo({ name: "Older-Zombie", pushedAt: daysAgo(320) }),
  makeRepo({
    name: "Done-Project",
    pushedAt: daysAgo(400),
    isArchived: true,
    releaseCount: 1,
  }),
];

/** The server's initial classified rows, computed exactly as every page wires it. */
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

/**
 * Renders `SceneView` with the props the LIVE pages (`/g/[username]` and
 * `/g/[username]/[repo]`) produce. `at` is the raw `?at=` query the page
 * forwards; `initialRepo` is the deep-link `[repo]` segment.
 */
function renderLive(options: { at?: string; initialRepo?: string } = {}) {
  return render(
    <ThemeProvider>
      <SceneView
        rows={initialRows()}
        repos={REPOS}
        truncated={false}
        username="octocat"
        renderedAt={NOW}
        mode="live"
        initialRepo={options.initialRepo}
        at={options.at}
      />
    </ThemeProvider>,
  );
}

/**
 * Renders `SceneView` with the props the `/estate` page produces: estate mode,
 * a null username, and the in-memory `estateOverrides` (empty here — the
 * fixture repos carry no override). The same REPOS back the estate so the two
 * routes are compared on identical data, isolating the mode difference.
 */
function renderEstate(options: { at?: string } = {}) {
  return render(
    <ThemeProvider>
      <SceneView
        rows={initialRows()}
        repos={REPOS}
        truncated={false}
        username={null}
        renderedAt={NOW}
        mode="estate"
        estateOverrides={{}}
        at={options.at}
      />
    </ThemeProvider>,
  );
}

/**
 * Settles the travel transition started by a place entry. Entering a place no
 * longer switches the view synchronously — the transition keeps the source view
 * mounted and switches to the destination at the CUT. The overlay is skippable
 * by any key press (jumping to the arrived state), so firing a `keydown` here
 * both reaches the destination AND drains the timers so none leak past the test.
 */
function settleTravel(): void {
  if (screen.queryByTestId("travel-transition") === null) {
    return;
  }
  act(() => {
    fireEvent.keyDown(window, { key: "Escape" });
  });
}

/** Grabs the currently-rendered "Lights on" switch in the header. */
function lightsOnSwitch(): HTMLButtonElement {
  return screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;
}

beforeEach(() => {
  // Start every test from a clean, query-less URL so the client-only
  // pushState a place entry performs is unambiguous. jsdom defaults to
  // http://localhost/.
  window.history.replaceState(null, "", "/g/octocat");
});

afterEach(() => {
  cleanup();
  push.mockReset();
  window.history.replaceState(null, "", "/g/octocat");
  vi.restoreAllMocks();
});

describe("route: /g/[username] (live map)", () => {
  it("shows the estate map and no place when no ?at= is present (1.1, 10.1)", () => {
    renderLive();

    // The default view is the estate map; no place view is mounted.
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByTestId("place-view")).toBeNull();

    // The scene host reports the map view and the lights-off scene surface.
    const host = screen.getByTestId("scene-view");
    expect(host.getAttribute("data-view")).toBe("map");
    expect(host.getAttribute("data-theme")).toBe("night");
  });

  it("opens the place named by ?at= on the first paint (10.2)", () => {
    // `/g/octocat?at=gate` → the gate place view is shown directly, with no map.
    renderLive({ at: "gate" });

    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );
    expect(screen.queryByTestId("estate-map")).toBeNull();
    expect(screen.getByTestId("scene-view").getAttribute("data-view")).toBe("gate");
  });

  it("resolves an invalid ?at= to the map (10.2)", () => {
    // An unknown place silently resolves to the map (no place view).
    renderLive({ at: "basement" });

    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByTestId("place-view")).toBeNull();
  });

  it("enters a place from the map via a place link, playing travel (1.1, 10.2)", () => {
    renderLive();

    // Activate the gate place link on the map. Entering a place starts the
    // inward travel; the destination (gate) view mounts at the CUT, so skip the
    // transition first (its documented keydown skip) to reach the arrived state.
    fireEvent.click(screen.getByTestId("estate-place-gate"));
    settleTravel();

    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );
    // The client-only pushState carries the place in `?at=` (no server re-run).
    expect(
      new URLSearchParams(window.location.search).get("at"),
    ).toBe("gate");

    settleTravel();
  });
});

describe("route: /g/[username]/[repo] (deep link)", () => {
  it("opens the place holding the repo with the creature selected, case-insensitively (11.1)", () => {
    // `Done-Project` is a coffin → crypt; the deep link arrives uppercased to
    // prove the match is case-insensitive. With no `?at=`, the view resolves to
    // the place that holds the row (crypt) with the creature pre-selected.
    renderLive({ initialRepo: "DONE-PROJECT" });

    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "crypt",
    );
    expect(creatureButton("Done-Project").getAttribute("aria-pressed")).toBe("true");
  });

  it("lets a valid ?at= override the deep-linked place while the creature stays selected (11.2)", () => {
    // `?at=sky` is a valid place, so it wins over the crypt that holds
    // `Done-Project`; but the deep-linked creature is still the selected one.
    renderLive({ initialRepo: "Done-Project", at: "sky" });

    // The view is the sky place (the `?at=` override), not the crypt.
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "sky",
    );
    expect(screen.getByTestId("scene-view").getAttribute("data-view")).toBe("sky");

    // The deep-linked creature remains the single selection even though its
    // place is not the one shown: selecting the sky's own creature is a
    // separate action the visitor has not taken.
    expect(creatureButton("fresh-ghost").getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the map with nothing selected when the repo matches no row (11.1)", () => {
    // A `[repo]` segment that matches no repository leaves the view on the map
    // with no creature selected (unchanged deep-link fallback).
    renderLive({ initialRepo: "no-such-repo" });

    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByTestId("place-view")).toBeNull();
  });
});

describe("route: /estate (bundled estate)", () => {
  it("shows the map by default with the estate footer plaque chrome (1.1, 10.1)", () => {
    renderEstate();

    // Same default as the live route: the estate map, no place.
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByTestId("place-view")).toBeNull();

    // Estate chrome: the map carries the estate mode and the footer shows the
    // sample-estate brass plaque (absent on the live routes).
    expect(screen.getByTestId("estate-map").getAttribute("data-mode")).toBe(
      "estate",
    );
    expect(screen.queryByTestId("scene-footer-plaque")).not.toBeNull();
  });

  it("opens the place named by ?at= just like the live route (10.2)", () => {
    renderEstate({ at: "gate" });

    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );
    expect(screen.queryByTestId("estate-map")).toBeNull();
  });

  it("enters a place from the map via a place link (10.2)", () => {
    renderEstate();

    fireEvent.click(screen.getByTestId("estate-place-crypt"));
    // The destination mounts at the cut; skip the travel to reach it.
    settleTravel();

    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "crypt",
    );
  });
});

describe("daytime theme and the list view reachable from map and place (14.1)", () => {
  it("keeps the map in day and opens the list dialog with every repository across all four places", () => {
    renderLive();

    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    // Lights on is the same scene in daylight: the map stays mounted.
    fireEvent.click(lightsOnSwitch());
    expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("day");
    expect(screen.queryByTestId("estate-map")).not.toBeNull();

    // "View as list" opens the register table over the scene, one row per
    // repository across all four places (Req 14.1).
    fireEvent.click(screen.getByTestId("view-list-button"));
    const table = within(screen.getByRole("dialog")).getByRole("table");
    for (const repo of REPOS) {
      expect(within(table).getByText(repo.name)).not.toBeNull();
    }

    // Lights off: night again, map still there.
    fireEvent.click(lightsOnSwitch());
    expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("night");
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
  });

  it("opens the list from inside a place and lists every repository", () => {
    renderLive({ at: "gate" });
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );

    fireEvent.click(lightsOnSwitch());

    // The place stays mounted in day.
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "gate",
    );

    fireEvent.click(screen.getByTestId("view-list-button"));
    const table = within(screen.getByRole("dialog")).getByRole("table");
    for (const repo of REPOS) {
      expect(within(table).getByText(repo.name)).not.toBeNull();
    }
  });

  it("reaches the list from the estate route too (14.1)", () => {
    renderEstate();

    fireEvent.click(screen.getByTestId("view-list-button"));

    const table = within(screen.getByRole("dialog")).getByRole("table");
    for (const repo of REPOS) {
      expect(within(table).getByText(repo.name)).not.toBeNull();
    }
  });
});
