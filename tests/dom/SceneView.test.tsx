/**
 * Component / integration tests for the scene entry (`components/scene/SceneView`).
 *
 * `SceneView` is the stateful shell that owns scene interaction state and hands
 * derived view-model values to the two navigation levels — the `EstateMap`
 * (default) and a `PlaceView` for a single place — plus the `LightsOnTable`
 * when the lights are on. These tests pin the interactive behavior that is not
 * covered by the pure view-model property tests:
 *
 *   - selecting a creature inside a place single-selects it and moves selection
 *     off the previous one (Req 9.6);
 *   - a deep-link `initialRepo` opens the place that holds the matching row and
 *     pre-selects that creature on the first paint, case-insensitively
 *     (Req 1.2, 11.1, 11.3);
 *   - the Lights-on toggle swaps the current view for the accessible register
 *     table and back (Req 10.6, 14.1);
 *   - the Sound toggle reflects its state without loading or playing any audio
 *     (Req 13.1, 13.2).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (aria-pressed/aria-checked attributes, querySelector), matching
 * the pattern in `tests/dom/Creature.test.tsx` and `tests/landing-form.test.tsx`.
 *
 * The Header (rendered by SceneView over both views) calls `useRouter` from
 * `next/navigation`, which has no provider under jsdom, so we mock it to a
 * no-op `push` exactly as the landing-form test does. `next/image` works
 * unmocked here (as it does in `Creature.test.tsx`).
 *
 * Creatures are only selectable inside a `PlaceView` (the map shows decorative,
 * `aria-hidden` representatives). Tests that exercise selection therefore render
 * straight into a place with `at`, or arrive via a deep link; no travel
 * transition plays on that initial resolution, so no timers need advancing.
 *
 * Requirements: 1.2, 9.6, 10.6, 13.1, 13.2, 14.1
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
 * A small set of repositories spanning several lifecycle states so each place
 * renders a handful of creatures to interact with:
 *   - `fresh-ghost`  → ghost  → sky   (pushed 1 day ago; NOT turning-soon)
 *   - `old-zombie`   → zombie → gate  (quiet ~300 days, no finished signals)
 *   - `Older-Zombie` → zombie → gate  (quiet ~320 days)
 *   - `Done-Project` → coffin → crypt (archived + a release => finished)
 * `old-zombie`/`Older-Zombie` share the gate so a single place view can hold two
 * selectable creatures. `Done-Project` carries mixed case on purpose so the
 * case-insensitive deep link can be exercised against it.
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

/**
 * Renders SceneView in live mode with the shared fixture. `initialRepo` is the
 * deep-link `[repo]` segment; `at` is the initial `?at=` place. Opening a place
 * on the initial resolution plays no travel, so tests need not advance timers.
 */
function renderScene(options: { initialRepo?: string; at?: string } = {}) {
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
  // Opening a panel pushes `?repo=` onto jsdom's shared history; reset the URL
  // so a later test's mount does not deep-link-open a stale panel.
  window.history.replaceState(null, "", "/");
});

describe("SceneView", () => {
  it("single-selects a creature inside a place and moves selection off the previous one (9.6)", async () => {
    const user = userEvent.setup();
    // The gate holds both zombies, so one place view shows two selectable
    // creatures. Opening a place on the initial resolution plays no travel.
    renderScene({ at: "gate" });

    const zombie = creatureButton("old-zombie");
    const olderZombie = creatureButton("Older-Zombie");

    // Nothing is selected before any interaction.
    expect(zombie.getAttribute("aria-pressed")).toBe("false");
    expect(olderZombie.getAttribute("aria-pressed")).toBe("false");

    // Activating one zombie selects it.
    await user.click(zombie);
    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("true");
    expect(creatureButton("Older-Zombie").getAttribute("aria-pressed")).toBe("false");

    // Activating another creature moves the single selection; the first is no
    // longer pressed (Req 9.6 — single-select replaces the previous).
    await user.click(creatureButton("Older-Zombie"));
    expect(creatureButton("Older-Zombie").getAttribute("aria-pressed")).toBe("true");
    expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("false");
  });

  it("deep-link initialRepo opens the holding place with the matching creature pre-selected, case-insensitively (1.2, 11.1)", () => {
    // The fixture repo is `Done-Project` (archived + a release → coffin →
    // crypt); the deep link arrives uppercased to prove the match is
    // case-insensitive (Req 1.2). With no `?at=`, the view resolves to the place
    // that holds the row (crypt) with the creature selected (Req 11.1/11.3).
    renderScene({ initialRepo: "DONE-PROJECT" });

    // The place view opened on the row's place.
    expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
      "crypt",
    );

    // The matched creature is selected on the very first render — no click.
    expect(creatureButton("Done-Project").getAttribute("aria-pressed")).toBe("true");
  });

  it("Lights-on toggle switches the scene to day and back; the list dialog holds the register table (10.6, 14.1)", async () => {
    const user = userEvent.setup();
    renderScene();

    // The estate map is shown and the register is not, initially.
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByTestId("lights-on-view")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();

    const lightsOn = () =>
      screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;

    await user.click(lightsOn());

    // Same scene in daylight: the map stays and no table appears by itself.
    expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("day");
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();

    // "View as list" opens the accessible register table.
    await user.click(screen.getByTestId("view-list-button"));
    expect(screen.queryByTestId("lights-on-view")).not.toBeNull();
    expect(screen.queryByRole("table")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("table")).toBeNull();

    await user.click(lightsOn());
    expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("night");
    expect(screen.queryByTestId("estate-map")).not.toBeNull();
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

  // --- Lights-on preserve/restore (estate-map Req 14.4, 14.5, 14.6) --------
  //
  // Toggling the lights on freezes the interactive state; toggling them back
  // off restores the exact prior view with a plain swap and no travel. These
  // tests exercise the invariant from inside a place: the selected creature and
  // the place view survive the on→off cycle, and the swap back is instant with
  // no travel transition overlay.
  describe("lights-on preserve/restore", () => {
    it("restores the selected creature and place after a lights on then off cycle, with no travel (14.4, 14.5, 14.6)", async () => {
      const user = userEvent.setup();
      // Start inside the gate so a creature can be selected and the prior view
      // (a place) is non-trivial.
      renderScene({ at: "gate" });

      const lightsOn = () =>
        screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;

      // Select a creature in the place; this is the state that must survive the
      // lights-on round trip (Req 14.4).
      await user.click(creatureButton("old-zombie"));
      expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("true");

      // Turn the lights on: the same place stays mounted, now in daylight.
      await user.click(lightsOn());
      expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("day");
      expect(screen.queryByTestId("place-view")).not.toBeNull();

      // Turn the lights back off: the same place view is still there...
      await user.click(lightsOn());
      expect(screen.queryByTestId("place-view")?.getAttribute("data-place")).toBe(
        "gate",
      );
      expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("night");

      // ...with the swap running NO travel transition (Req 14.6) — the overlay
      // is never mounted on a lights-off restore.
      expect(screen.queryByTestId("travel-transition")).toBeNull();

      // ...and the previously selected creature is still selected (Req 14.5):
      // the single selection was preserved across the whole cycle, and no other
      // creature became selected.
      expect(creatureButton("old-zombie").getAttribute("aria-pressed")).toBe("true");
      expect(creatureButton("Older-Zombie").getAttribute("aria-pressed")).toBe("false");
    });

    it("restores the no-selection map when nothing was selected before lights-on (14.5)", async () => {
      const user = userEvent.setup();
      renderScene();

      const lightsOn = () =>
        screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;

      // The map is the starting view with nothing selected.
      expect(screen.queryByTestId("estate-map")).not.toBeNull();

      // Lights on, then off again.
      await user.click(lightsOn());
      expect(screen.getByTestId("scene-view").getAttribute("data-theme")).toBe("day");
      await user.click(lightsOn());

      // Back on the map instantly with no travel: the empty selection is
      // preserved just as a non-empty one would be.
      expect(screen.queryByTestId("estate-map")).not.toBeNull();
      expect(screen.queryByTestId("travel-transition")).toBeNull();
    });
  });
});


describe("SceneView \u2014 place header sits below the site header, not over the stats (visual fix 2C)", () => {
  it("renders the site header and the place chrome as separate rows, with the place chrome offset below the site-header band", () => {
    // Open a place so both the site header (wordmark + stats + toggles) and the
    // place chrome (Return to the gate, title, chips) are mounted together.
    renderScene({ at: "gate" });

    const siteHeader = screen.getByTestId("site-header");
    const placeChrome = screen.getByTestId("place-chrome");
    const stats = screen.getByTestId("scene-header");
    const ret = screen.getByTestId("return-to-gate");

    // They are distinct elements \u2014 the place chrome is NOT the site header.
    expect(siteHeader).not.toBe(placeChrome);

    // The stats line lives inside the site-header band; the Return control lives
    // inside the place-chrome row. Neither contains the other, so they are
    // separate rows rather than one painted over the other.
    expect(siteHeader.contains(stats)).toBe(true);
    expect(placeChrome.contains(ret)).toBe(true);
    expect(siteHeader.contains(ret)).toBe(false);
    expect(placeChrome.contains(stats)).toBe(false);

    // The site header occupies the top band (top-0); the place chrome starts
    // BELOW it via the fixed --site-header-h token, so it never overlaps the
    // stats line.
    expect(siteHeader.className).toContain("top-0");
    expect(placeChrome.className).not.toContain("top-0");
    expect(placeChrome.style.top).toBe("var(--site-header-h)");
  });
});


describe("SceneView ? Return to the gate plays the reverse 'pulled out' travel (visual fix r3 #4)", () => {
  it("starts an outward travel transition toward the map when Return is activated", async () => {
    const user = userEvent.setup();
    renderScene({ at: "gate" });
    expect(screen.queryByTestId("place-view")).not.toBeNull();
    expect(screen.queryByTestId("travel-transition")).toBeNull();

    await user.click(screen.getByTestId("return-to-gate"));

    const overlay = screen.getByTestId("travel-transition");
    expect(overlay.getAttribute("data-direction")).toBe("out");
    expect(overlay.getAttribute("data-place")).toBe("gate");
  });

  it("plays the inward travel when a place is entered from the map", async () => {
    const user = userEvent.setup();
    renderScene();
    expect(screen.queryByTestId("estate-map")).not.toBeNull();

    await user.click(screen.getByTestId("estate-place-gate"));

    const overlay = screen.getByTestId("travel-transition");
    expect(overlay.getAttribute("data-direction")).toBe("in");
    expect(overlay.getAttribute("data-place")).toBe("gate");
  });
});
