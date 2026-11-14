/**
 * DOM test for the validate-before-classify pipeline in `SceneView`.
 *
 * A `RepoFacts` set containing an invalid record (negative `forkCount`) must
 * render creatures only for validated names: the invalid repo has neither a
 * creature (in its place) nor a row (in the Lights-on register). The server
 * `rows` are deliberately built from the FULL set, including the invalid repo,
 * to prove SceneView itself filters before classification.
 *
 * Plain DOM assertions (no jest-dom), matching `SceneView.test.tsx`.
 *
 * Requirements: 1.8
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { buildRows } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import { creatureAccessibleName } from "@/lib/scene-view";

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
    languageColor: null,
    forkCount: 0,
    topics: [],
    ...overrides,
  };
}

// Both zombies land in the gate; `bad-zombie` is invalid (negative forkCount).
const REPOS: RepoFacts[] = [
  makeRepo({ name: "good-zombie", pushedAt: daysAgo(300) }),
  makeRepo({ name: "bad-zombie", pushedAt: daysAgo(310), forkCount: -1 }),
  makeRepo({ name: "other-zombie", pushedAt: daysAgo(320) }),
];

function renderScene(at?: string) {
  return render(
    <SceneView
      rows={buildRows(REPOS, {}, NOW)}
      repos={REPOS}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
      at={at}
    />,
  );
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  push.mockReset();
  warnSpy.mockRestore();
});

function nameFor(repoName: string): string {
  const row = buildRows(REPOS, {}, NOW).find((r) => r.name === repoName);
  if (!row) throw new Error(`no row for ${repoName}`);
  return creatureAccessibleName(row);
}

describe("SceneView pipeline — validation precedes classification (1.8)", () => {
  it("renders creatures only for validated names; the invalid repo has no creature", () => {
    renderScene("gate");

    expect(screen.queryByRole("button", { name: nameFor("good-zombie") })).not.toBeNull();
    expect(screen.queryByRole("button", { name: nameFor("other-zombie") })).not.toBeNull();
    expect(screen.queryByRole("button", { name: nameFor("bad-zombie") })).toBeNull();

    // No creature mentions the invalid repo at all.
    const place = screen.getByTestId("place-view");
    expect(place.textContent ?? "").not.toContain("bad-zombie");

    // The invalid record was skipped with a warning naming it.
    expect(
      warnSpy.mock.calls.some((call: unknown[]) =>
        call.some((arg) => String(arg).includes("bad-zombie")),
      ),
    ).toBe(true);
  });

  it("the invalid repo has no row in the View as list register", async () => {
    const user = userEvent.setup();
    renderScene("gate");

    await user.click(screen.getByTestId("view-list-button"));

    const register = screen.getByTestId("lights-on-view");
    const text = register.textContent ?? "";
    expect(within(register).getByRole("table")).not.toBeNull();
    expect(text).toContain("good-zombie");
    expect(text).toContain("other-zombie");
    expect(text).not.toContain("bad-zombie");
  });
});
