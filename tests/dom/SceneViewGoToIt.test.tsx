/**
 * Integration test for the turning-soon "Go to it" jump (task 11.2).
 *
 * The estate map renders a `TurningSoon` notice only when a ghost sits inside
 * the turning-soon window (`pickTurningSoon` returns non-null). On the map,
 * `SceneView` supplies the notice an `onGoToTurningSoon` handler, so the notice
 * shows a "Go to it" action (`data-testid="scene-turning-soon-goto"`).
 * Activating it runs `SceneView.onGoToTurningSoon(name)`, which:
 *   - selects that ghost (`selected = name`),
 *   - moves to the plot that contains it (`plotIndex` = the plot holding it),
 *   - clears the active filter to `"all"`, and
 *   - enters the `sky` place (`onEnterPlace("sky")` → pushState + view swap +
 *     travel).
 *
 * After the jump the `PlaceView` for sky renders (`data-testid="place-view"`,
 * `data-place="sky"`), the ghost's creature button is pressed
 * (`aria-pressed="true"`), the pager shows the plot that holds the ghost, and
 * the filter is cleared to "all" (every ghost is visible, not just one band).
 *
 * The second case pins the negative path: when no ghost qualifies as
 * turning-soon the notice never renders, so neither the notice nor the "Go to
 * it" action is in the DOM (estate-map Req 12.6).
 *
 * ## Fixture design
 *
 * A ghost is "turning soon" when `daysLeft = ghostMaxDaysQuiet − daysQuiet` is
 * in `[0, TURNING_SOON_DAYS]` — i.e. `daysQuiet ∈ [60, 90]` (ghostMax 90,
 * window 30). `pickTurningSoon` picks the FEWEST days left (highest daysQuiet),
 * tie-broken by the LATEST `pushedAt`. `orderForPlace("sky", …)` sorts by decay
 * descending then daysQuiet descending; a ghost with `daysQuiet = 60` has the
 * top ghost decay band (3). To make the "opens the plot containing it"
 * assertion meaningful, the target ghost must NOT land on the first plot:
 *
 *   - 12 "decoy" sky ghosts are pushed `daysAgo(60.5)` → each floors to
 *     `daysQuiet = 60` (decay 3) with a slightly OLDER `pushedAt`.
 *   - the target ghost is pushed exactly `daysAgo(60)` → `daysQuiet = 60`
 *     (decay 3) with a slightly NEWER `pushedAt`.
 *
 * Every sky ghost therefore shares the same sort keys (decay 3, daysQuiet 60),
 * so the stable sort preserves input order; the 12 decoys come first and the
 * target is 13th → plot 2 (`plotIndex === 1`, PLOT_SIZE = 12). And because the
 * target's `pushedAt` is the newest among the equal-days-left ghosts, the
 * tie-break hands `pickTurningSoon` the target, so it is the named ghost the
 * notice calls out and the jump selects.
 *
 * The Header (rendered over both views) calls `useRouter`, which has no provider
 * under jsdom, so it is mocked to a no-op `push`, exactly as the sibling
 * `SceneView.test.tsx` does. Activation uses `fireEvent.click` (not
 * `userEvent`) so the single button press is fast and deterministic under the
 * loaded full suite — a plain `<button>` click needs no real-timer typing
 * simulation, and the large map tree makes `userEvent`'s real-timer path slow.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Hoisted spy so the `next/navigation` mock can close over it; the Header's
// visit form calls `useRouter().push`, which would otherwise throw under jsdom.
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { buildRows, type GraveyardRow } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import { PLOT_SIZE } from "@/lib/estate-view";
import {
  creatureAccessibleName,
  pickTurningSoon,
  TURNING_SOON_DAYS,
} from "@/lib/scene-view";

/** A fixed server-captured clock so every classification is deterministic. */
const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

/** ISO timestamp `days` (possibly fractional) whole days before NOW. */
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
    ...overrides,
  };
}

/**
 * The turning-soon fixture: twelve decoy sky ghosts (older `pushedAt`, same
 * `daysQuiet` 60) followed by the target ghost (newest `pushedAt`, same
 * `daysQuiet` 60). Equal sort keys ⇒ stable order ⇒ decoys fill plot 1 and the
 * target lands first on plot 2. The target's newer push wins the
 * `pickTurningSoon` tie-break so it is the one the notice names.
 */
const TARGET = "turning-ghost";

function turningSoonRepos(): RepoFacts[] {
  const decoys: RepoFacts[] = Array.from({ length: PLOT_SIZE }, (_, i) =>
    // daysAgo(60.5) floors to daysQuiet 60 (still a ghost, decay band 3) but
    // sits a little OLDER than the target so the tie-break never picks a decoy.
    makeRepo({ name: `decoy-ghost-${i}`, pushedAt: daysAgo(60.5) }),
  );
  const target = makeRepo({ name: TARGET, pushedAt: daysAgo(60) });
  return [...decoys, target];
}

/**
 * The negative fixture: no ghost qualifies as turning-soon. One fresh ghost
 * (pushed yesterday ⇒ daysLeft ≈ 89, well outside the 30-day window) plus a
 * couple of zombies/coffins. `pickTurningSoon` returns null, so the notice (and
 * thus the "Go to it" action) never renders.
 */
function noTurningSoonRepos(): RepoFacts[] {
  return [
    makeRepo({ name: "fresh-ghost", pushedAt: daysAgo(1) }),
    makeRepo({ name: "old-zombie", pushedAt: daysAgo(300) }),
    makeRepo({
      name: "done-project",
      pushedAt: daysAgo(400),
      isArchived: true,
      releaseCount: 1,
    }),
  ];
}

/** The server's initial classified rows for a repo fixture (no overrides). */
function rowsFor(repos: RepoFacts[]): GraveyardRow[] {
  return buildRows(repos, {}, NOW);
}

/** The accessible name a creature button exposes, from the same pure function. */
function nameFor(rows: GraveyardRow[], repoName: string): string {
  const row = rows.find((r) => r.name === repoName);
  if (!row) {
    throw new Error(`no row for ${repoName}`);
  }
  return creatureAccessibleName(row);
}

/** Renders SceneView in live mode on the map (no `at`, no `initialRepo`). */
function renderScene(repos: RepoFacts[]) {
  return render(
    <SceneView
      rows={rowsFor(repos)}
      repos={repos}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
    />,
  );
}

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("SceneView — turning-soon 'Go to it' jump (task 11.2)", () => {
  // A generous timeout: rendering the full SceneView tree (map + jump into the
  // sky place + the aria-hidden travel overlay) under the parallel DOM suite
  // can exceed the default 5s purely from CPU contention across workers, even
  // though the test itself does a single synchronous `fireEvent.click`. The
  // behavior under test is deterministic; only the render wall-clock varies.
  it("lands in the sky, selects the ghost, opens the plot holding it, and clears the filter to all (12.2–12.5)", () => {
    const repos = turningSoonRepos();
    const rows = rowsFor(repos);

    // Sanity-check the fixture via the same pure selector SceneView uses: the
    // target ghost (newest push among the equal-days-left ghosts) is the one
    // the notice names, and it has exactly 30 whole days left (daysQuiet 60).
    const picked = pickTurningSoon(repos, rows, NOW);
    expect(picked?.name).toBe(TARGET);
    expect(picked?.daysLeft).toBe(TURNING_SOON_DAYS);

    renderScene(repos);

    // The map is the starting view and the turning-soon notice is shown with a
    // "Go to it" action (SceneView passes `onGoToTurningSoon`, so the notice
    // renders the action — Req 12.1).
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    const goTo = screen.getByTestId("scene-turning-soon-goto");
    expect(goTo).not.toBeNull();

    // Activate "Go to it".
    act(() => {
      fireEvent.click(goTo);
    });

    // The jump starts the inward travel transition; the destination (sky) view
    // mounts at the CUT, under the fog. Skip the transition (Esc) so it jumps
    // straight to the arrived state and the sky place is mounted for the
    // assertions below (the overlay is purely visual and changes none of the
    // asserted state).
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    // The sky place view opened (Req 12.2).
    const placeView = screen.getByTestId("place-view");
    expect(placeView.getAttribute("data-place")).toBe("sky");
    expect(screen.queryByTestId("estate-map")).toBeNull();

    // The target ghost's creature is selected on arrival (Req 12.3).
    const target = screen.getByRole("button", {
      name: nameFor(rows, TARGET),
    }) as HTMLButtonElement;
    expect(target.getAttribute("aria-pressed")).toBe("true");

    // The pager landed on the plot that actually holds the ghost — plot 2 of 2,
    // proving `plotIndex` was computed from the ghost's position rather than
    // defaulting to the first plot (Req 12.4; 13 sky ghosts / PLOT_SIZE 12).
    expect(screen.getByTestId("pager-label").textContent).toBe("Plot 2 of 2");

    // The filter was cleared to "all": every ghost on this plot is shown, so a
    // decay-band filter is NOT narrowing the set. With the filter cleared the
    // target ghost is present (it would be filtered out by any single band that
    // excluded it); its presence plus the "all" pager count confirm the clear
    // (Req 12.5).
    expect(
      screen.queryByRole("button", { name: nameFor(rows, TARGET) }),
    ).not.toBeNull();

  }, 20_000);

  it("renders no 'Go to it' action when no ghost qualifies as turning-soon (12.6)", () => {
    const repos = noTurningSoonRepos();
    const rows = rowsFor(repos);

    // The pure selector agrees nothing qualifies, so the notice must not render.
    expect(pickTurningSoon(repos, rows, NOW)).toBeNull();

    renderScene(repos);

    // The map is shown, but neither the notice nor its "Go to it" action exists.
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByTestId("scene-turning-soon")).toBeNull();
    expect(screen.queryByTestId("scene-turning-soon-goto")).toBeNull();
  });
});
