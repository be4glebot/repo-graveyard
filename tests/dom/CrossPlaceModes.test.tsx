/**
 * DOM tests: hover card (focus tooltip + fine-pointer dwell) and detail panel
 * (click) behave identically across sky, gate, ground and crypt, and across
 * lights off / on. With lights on, `SceneView` replaces the scene with the
 * readable table, so creature interactions are asserted with lights off; the
 * table view must hold no card/panel, and returning lights off restores
 * working creature interactions.
 *
 * Plain DOM assertions (no jest-dom), matching `SceneView*.test.tsx`.
 *
 * Requirements: 10.1, 10.2
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { hoverCardId } from "@/components/detail/HoverCardLayer";
import { buildRows } from "@/lib/graveyard-view";
import { placeOf, type PlaceId } from "@/lib/estate-view";
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
    description: "A repo worth remembering",
    url: `https://github.com/octocat/${overrides.name}`,
    pushedAt: daysAgo(1),
    createdAt: daysAgo(900),
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 3,
    primaryLanguage: "TypeScript",
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: null,
    languageColor: "#3178c6",
    forkCount: 1,
    topics: [],
    ...overrides,
  };
}

// One repo per place: ghost→sky, zombie→gate, tombstone→ground, coffin→crypt.
const FIXTURES: { place: PlaceId; repo: RepoFacts }[] = [
  { place: "sky", repo: makeRepo({ name: "ghost-repo", pushedAt: daysAgo(20) }) },
  { place: "gate", repo: makeRepo({ name: "zombie-repo", pushedAt: daysAgo(300) }) },
  {
    place: "ground",
    repo: makeRepo({
      name: "tombstone-repo",
      pushedAt: daysAgo(300),
      isArchived: true,
      releaseCount: 5,
      readmeBytes: 5000,
      homepageUrl: "https://example.com",
      stargazerCount: 100,
      lastCommitMessage: "v1.0 release",
    }),
  },
  {
    place: "crypt",
    repo: makeRepo({ name: "coffin-repo", pushedAt: daysAgo(300), isArchived: true }),
  },
];
const REPOS = FIXTURES.map((f) => f.repo);

function allRows() {
  return buildRows(REPOS, {}, NOW);
}

function rowFor(name: string) {
  const row = allRows().find((r) => r.name === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

function creature(name: string): HTMLButtonElement {
  return screen.getByRole("button", {
    name: creatureAccessibleName(rowFor(name)),
  }) as HTMLButtonElement;
}

function renderScene(at: PlaceId) {
  return render(
    <SceneView
      rows={allRows()}
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
const anyCard = () => document.querySelector('[id^="hover-card-"]');
const lightsSwitch = () =>
  screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", BASE);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 768px") || query.includes("hover: hover"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  // Anchors must be on-screen or the hover layer closes itself.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 100,
    right: 200,
    bottom: 200,
    width: 100,
    height: 100,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.useRealTimers();
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", BASE);
});

describe("fixtures map one repo to each place", () => {
  it.each(FIXTURES)("$repo.name lives in $place", ({ place, repo }) => {
    expect(placeOf(rowFor(repo.name))).toBe(place);
  });
});

describe("interactions are identical across places (lights off) — 10.1", () => {
  it.each(FIXTURES)("focus tooltip opens and closes in $place", ({ repo }) => {
    renderScene(FIXTURES.find((f) => f.repo === repo)!.place);
    const btn = creature(repo.name);

    act(() => btn.focus());
    const card = document.getElementById(hoverCardId(repo.name));
    expect(card).not.toBeNull();
    expect(card!.getAttribute("role")).toBe("tooltip");
    expect(btn.getAttribute("aria-describedby")).toBe(card!.id);
    expect(card!.textContent).toContain(repo.name);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(anyCard()).toBeNull();
  });

  it.each(FIXTURES)("fine-pointer dwell opens after 250ms in $place", ({ place, repo }) => {
    renderScene(place);
    const btn = creature(repo.name);

    fireEvent.pointerEnter(btn);
    advance(249);
    expect(anyCard()).toBeNull();
    advance(1);
    expect(document.getElementById(hoverCardId(repo.name))).not.toBeNull();

    fireEvent.pointerLeave(btn);
    advance(150);
    expect(anyCard()).toBeNull();
  });

  it.each(FIXTURES)("click opens and closes the detail panel in $place", ({ place, repo }) => {
    renderScene(place);

    act(() => {
      fireEvent.click(creature(repo.name));
    });
    const panel = dialog();
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute("aria-modal")).toBe("true");
    expect(panel!.textContent).toContain(repo.name);
    // Opening the panel starts no travel and changes no place.
    expect(push).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close record" }));
    });
    expect(dialog()).toBeNull();
  });
});

describe("lights on vs off — 10.2", () => {
  it.each(FIXTURES)(
    "lights on removes the card in $place; lights off restores working creatures",
    ({ place, repo }) => {
      renderScene(place);

      act(() => creature(repo.name).focus());
      expect(anyCard()).not.toBeNull();

      act(() => {
        fireEvent.click(lightsSwitch());
      });
      expect(screen.getByTestId("lights-on-view")).not.toBeNull();
      expect(anyCard()).toBeNull();
      expect(dialog()).toBeNull();
      expect(
        screen.queryByRole("button", { name: creatureAccessibleName(rowFor(repo.name)) }),
      ).toBeNull();

      act(() => {
        fireEvent.click(lightsSwitch());
      });
      expect(screen.queryByTestId("lights-on-view")).toBeNull();
      if (dialog()) fireEvent.keyDown(document.body, { key: "Escape" });
      advance(500);
      expect(anyCard()).toBeNull();

      // Interactions work again on the restored creature.
      act(() => creature(repo.name).focus());
      expect(document.getElementById(hoverCardId(repo.name))).not.toBeNull();
    },
  );

  it.each(FIXTURES)(
    "lights on leaves no detail panel open in $place; click works after restore",
    ({ place, repo }) => {
      renderScene(place);

      act(() => {
        fireEvent.click(creature(repo.name));
      });
      expect(dialog()).not.toBeNull();

      act(() => {
        fireEvent.click(lightsSwitch());
      });
      expect(screen.getByTestId("lights-on-view")).not.toBeNull();
      expect(dialog()).toBeNull();
      expect(anyCard()).toBeNull();

      act(() => {
        fireEvent.click(lightsSwitch());
      });
      if (dialog()) {
        act(() => {
          fireEvent.click(screen.getByRole("button", { name: "Close record" }));
        });
      }
      expect(dialog()).toBeNull();

      act(() => {
        fireEvent.click(creature(repo.name));
      });
      expect(dialog()).not.toBeNull();
      expect(dialog()!.textContent).toContain(repo.name);
    },
  );
});
