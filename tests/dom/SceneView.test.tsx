/**
 * Component / integration tests for the scene entry (`components/scene/SceneView`).
 *
 * `SceneView` is the stateful shell that owns scene interaction state and hands
 * derived view-model values to the presentational `Scene` (and, with the lights
 * on, `LightsOnTable`). These tests pin the interactive behavior that is not
 * covered by the pure view-model property tests:
 *
 *   - selecting a creature single-selects it and moves selection off the
 *     previous one (Req 9.6);
 *   - a deep-link `initialRepo` pre-selects the matching creature on the first
 *     paint, case-insensitively (Req 1.2);
 *   - the Lights-on toggle swaps the scene for the accessible register table
 *     and back (Req 10.6, and the readable register itself, Req 13.1 chrome);
 *   - the Sound toggle reflects its state without loading or playing any audio
 *     (Req 13.1, 13.2).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (aria-pressed/aria-checked attributes, querySelector), matching
 * the pattern in `tests/dom/Creature.test.tsx` and `tests/landing-form.test.tsx`.
 *
 * The Header (rendered inside `Scene`) calls `useRouter` from `next/navigation`,
 * which has no provider under jsdom, so we mock it to a no-op `push` exactly as
 * the landing-form test does. `next/image` works unmocked here (as it does in
 * `Creature.test.tsx`).
 *
 * Requirements: 1.2, 9.6, 10.6, 13.1, 13.2
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    ...overrides,
  };
}

/**
 * A small set of repositories spanning several lifecycle states so the scene
 * renders a handful of creatures to interact with:
 *   - `fresh-ghost`  → ghost (pushed 1 day ago; daysLeft 89, so NOT turning-soon)
 *   - `old-zombie`   → zombie (quiet ~300 days, no finished signals)
 *   - `Done-Project` → tombstone (archived + a release => finished)
 * `Done-Project` carries mixed case on purpose so the case-insensitive deep
 * link can be exercised against it.
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

/** Renders SceneView in live mode with the shared fixture; `initialRepo` optional. */
function renderScene(initialRepo?: string) {
  return render(
    <SceneView
      rows={initialRows()}
      repos={REPOS}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
      initialRepo={initialRepo}
    />,
  );
}

// A spy standing in for the Audio constructor, installed before each test so we
// can prove the sound toggle constructs no audio. It is deliberately NOT a real
// <audio>; constructing one through it would be the failure we are guarding
// against.
let audioSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  audioSpy = vi.fn();
  // Install a tripwire over the Audio constructor. The feature is sound-free,
  // so this must never be called; if a future change starts loading audio, the
  // assertions below will catch it.
  vi.stubGlobal("Audio", audioSpy);
});

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("SceneView", () => {
  it("single-selects a creature and moves selection off the previous one (9.6)", async () => {
    const user = userEvent.setup();
    renderScene();

    const ghost = creatureButton("fresh-ghost");
    const zombie = creatureButton("old-zombie");

    // Nothing is selected before any interaction.
    expect(ghost.getAttribute("aria-pressed")).toBe("false");
    expect(zombie.getAttribute("aria-pressed")).toBe("false");

    // Activating the ghost selects it.
    await user.click(ghost);
    expect(creatureButton("fresh-ghost").getAttribute("aria-pressed")).toBe("true");
    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("false");

    // Activating another creature moves the single selection; the ghost is no
    // longer pressed (Req 9.6 — single-select replaces the previous).
    await user.click(creatureButton("old-zombie"));
    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("true");
    expect(creatureButton("fresh-ghost").getAttribute("aria-pressed")).toBe("false");
  });

  it("deep-link initialRepo pre-selects the matching creature on first paint, case-insensitively (1.2)", () => {
    // The fixture repo is `Done-Project`; the deep link arrives uppercased to
    // prove the match is case-insensitive (Req 1.2).
    renderScene("DONE-PROJECT");

    // The matched creature is selected on the very first render — no click.
    expect(creatureButton("Done-Project").getAttribute("aria-pressed")).toBe("true");

    // The others stay unselected: exactly one creature is pre-selected.
    expect(creatureButton("fresh-ghost").getAttribute("aria-pressed")).toBe("false");
    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("false");
  });

  it("Lights-on toggle reveals the accessible register table and hides the scene, then toggles back (10.6)", async () => {
    const user = userEvent.setup();
    renderScene();

    // The scene is shown and the register is not, initially.
    expect(screen.queryByTestId("scene-root")).not.toBeNull();
    expect(screen.queryByTestId("lights-on-view")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();

    // There may be more than one "Lights on" switch on screen over the test's
    // life (the scene's header has one; the register's control bar has another),
    // so always grab the currently-rendered one.
    const lightsOn = () =>
      screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;

    await user.click(lightsOn());

    // The accessible register table is now shown and the scene is gone.
    expect(screen.queryByTestId("lights-on-view")).not.toBeNull();
    expect(screen.queryByRole("table")).not.toBeNull();
    expect(screen.queryByTestId("scene-root")).toBeNull();

    // The register carries its own Lights-on switch so the reader can return to
    // the scene with the same data (Req 10.6).
    await user.click(lightsOn());

    // Back to the scene, register gone.
    expect(screen.queryByTestId("scene-root")).not.toBeNull();
    expect(screen.queryByTestId("lights-on-view")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("Sound toggle reflects its state without loading or playing any audio (13.1, 13.2)", async () => {
    const user = userEvent.setup();
    renderScene();

    const sound = () =>
      screen.getAllByRole("switch", { name: /sound/i })[0] as HTMLButtonElement;

    // Off to begin with.
    expect(sound().getAttribute("aria-checked")).toBe("false");

    await user.click(sound());

    // The displayed state flips on (Req 13.1 — the toggle shows its state).
    expect(sound().getAttribute("aria-checked")).toBe("true");

    // ...but nothing audible is wired up: no <audio> element is in the DOM and
    // the Audio constructor was never invoked (Req 13.2 — sound is deferred).
    expect(document.querySelector("audio")).toBeNull();
    expect(audioSpy).not.toHaveBeenCalled();
  });
});
