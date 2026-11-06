/**
 * DOM test for the travel FADE wiring (visual fix r3 travel follow-up): the
 * `--travel-others-fade` / `--travel-chrome-fade` vars the `travel-stage`
 * writes must actually be CONSUMED by the scenes, so during forward travel the
 * non-destination places fade while the destination stays, and on arrival the
 * place chrome fades in.
 *
 * jsdom does not resolve `var()` or custom-property inheritance in
 * `getComputedStyle`, so this test verifies the wiring two ways that ARE
 * observable in jsdom:
 *   1. the numeric fade the `travel-stage` writes (`--travel-others-fade` /
 *      `--travel-chrome-fade`) is correct at the sampled times; and
 *   2. the consuming elements carry the inline `opacity: var(--travel-*-fade)`
 *      reference (non-target places / chrome), while the destination place does
 *      NOT fade. Together these prove the var is produced AND consumed.
 *
 * The travel clock is `setInterval` + `Date.now()`, so fake timers drive it.
 *
 * Requirements: 13.1?13.7 (travel), visual fix r3 travel follow-up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import SceneView from "@/components/scene/SceneView";
import { buildRows, type GraveyardRow } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);
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
    ...overrides,
  };
}
// A spread of states so every place is populated and reachable.
const REPOS: RepoFacts[] = [
  makeRepo({ name: "fresh-ghost", pushedAt: daysAgo(1) }),
  makeRepo({ name: "a-zombie", pushedAt: daysAgo(300) }),
  makeRepo({ name: "b-zombie", pushedAt: daysAgo(320) }),
  makeRepo({ name: "done", pushedAt: daysAgo(400), isArchived: true, releaseCount: 1 }),
];
function rows(): GraveyardRow[] {
  return buildRows(REPOS, {}, NOW);
}
function renderScene() {
  return render(
    <SceneView
      rows={rows()}
      repos={REPOS}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  // SceneView defaults `reducedMotion` to true on first paint and flips it from
  // `matchMedia("(prefers-reduced-motion: reduce)")` in a mount effect. Stub it
  // to NOT-reduced so the FULL motion path (with the fade vars) runs — the
  // reduced-motion crossfade has no `--travel-*-fade` to test. `pointer: fine`
  // is reported false so parallax stays inert in jsdom.
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
});
afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  push.mockReset();
});

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Read a numeric CSS custom property off an element's inline style. */
function readVar(el: HTMLElement, name: string): number {
  return Number(el.style.getPropertyValue(name));
}

describe("Travel fade wiring ? non-target places fade, destination stays, chrome fades in", () => {
  it("at ~500ms of forward travel the stage fade is < 0.5 and a non-target place consumes it while the destination does not", () => {
    renderScene();
    // Enter the SKY place; sky is the destination, the other three fade.
    fireEvent.click(screen.getByTestId("estate-place-sky"));

    advance(500);

    // (1) The stage has written a well-under-half others-fade by ~500ms (the
    //     fade reaches 0 by 600ms, so at 500ms it is ~0.17).
    const stage = screen.getByTestId("travel-stage");
    const othersFade = readVar(stage, "--travel-others-fade");
    expect(othersFade).toBeLessThan(0.5);

    // (2) A NON-target place consumes the var (its inline opacity references
    //     `--travel-others-fade`), so it actually fades ?
    const gate = screen.getByTestId("estate-place-gate");
    expect(gate.style.opacity).toContain("--travel-others-fade");

    // ? while the DESTINATION place does NOT fade (no var reference; it stays
    //     at its base opacity so the zoom reads as diving into it).
    const sky = screen.getByTestId("estate-place-sky");
    expect(sky.style.opacity).not.toContain("--travel-others-fade");

    // Settle the transition so no timer leaks.
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
  });

  it("on arrival the place chips consume --travel-chrome-fade (fading in), reaching full opacity at the end", () => {
    renderScene();
    fireEvent.click(screen.getByTestId("estate-place-gate"));

    // Advance past the cut into the destination half (~1800ms): the gate place
    // view is mounted and its chrome is fading in.
    advance(1800);

    const titleBlock = screen.getByTestId("place-title-block");
    // The chrome references the chrome-fade var (so it actually fades in).
    expect(titleBlock.style.opacity).toContain("--travel-chrome-fade");

    // The stage's chrome-fade is still below 1 mid-arrival (it completes at
    // 2200ms), confirming the chrome arrives LAST rather than snapping in.
    const stage = screen.getByTestId("travel-stage");
    expect(readVar(stage, "--travel-chrome-fade")).toBeLessThan(1);

    // At the end the chrome-fade var has reached exactly 1 (fully arrived)
    // before the overlay is removed, so there is no flash.
    advance(600); // cross 2200ms
    // The transition has ended; the committed place view is now rendered
    // directly (no stage). Its chrome no longer carries a fade var, so it is
    // fully opaque at rest.
    const settledTitle = screen.getByTestId("place-title-block");
    expect(settledTitle.style.opacity).not.toContain("--travel-chrome-fade");
  });
});
