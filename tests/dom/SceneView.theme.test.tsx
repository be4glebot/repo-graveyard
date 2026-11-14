/**
 * DOM test for the Lights On theme attribute and state on `SceneView`.
 *
 * Toggling Lights On sets `data-theme="day"` on `#scene-root` and back to
 * "night"; the scene root stays the same DOM node; a fresh mount starts as
 * "night"; the theme is in-memory only (no localStorage writes).
 *
 * Requirements: 2.1, 2.2, 2.7, 2.8, 2.9
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
    createdAt: new Date(Date.parse(NOW) - 400 * DAY_MS).toISOString(),
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

const REPOS: RepoFacts[] = [makeRepo("fresh-ghost", 1), makeRepo("old-zombie", 300)];

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
      />
    </ThemeProvider>,
  );
}

const sceneRoot = () => document.getElementById("scene-root") as HTMLElement;
const lightsSwitch = () =>
  screen.getAllByRole("switch", { name: /lights on/i })[0] as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SceneView theme", () => {
  it("toggles data-theme between night and day on the same #scene-root node (2.1, 2.2, 2.7)", async () => {
    const user = userEvent.setup();
    renderScene();

    const root = sceneRoot();
    expect(root.getAttribute("data-theme")).toBe("night");

    await user.click(lightsSwitch());
    expect(sceneRoot().getAttribute("data-theme")).toBe("day");
    expect(sceneRoot()).toBe(root);

    await user.click(lightsSwitch());
    expect(sceneRoot().getAttribute("data-theme")).toBe("night");
    expect(sceneRoot()).toBe(root);
  });

  it("starts a fresh mount as night even after a previous mount was day (2.8)", async () => {
    const user = userEvent.setup();
    const first = renderScene();
    await user.click(lightsSwitch());
    expect(sceneRoot().getAttribute("data-theme")).toBe("day");
    first.unmount();

    renderScene();
    expect(sceneRoot().getAttribute("data-theme")).toBe("night");
  });

  it("never calls localStorage.setItem when toggling (2.9)", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderScene();

    await user.click(lightsSwitch());
    await user.click(lightsSwitch());

    expect(setItem).not.toHaveBeenCalled();
  });
});
