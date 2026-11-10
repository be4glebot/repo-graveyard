/**
 * Component tests for the graveyard UI.
 *
 * Covers the presentational list (empty state, truncation notice, per-state
 * groups and row links), the error-message renderer (every `LoadError` kind,
 * including the rate-limit reset time), and the override-aware view
 * (re-classification after overrides load from client storage).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (textContent, queryByText, getAllByRole, document queries),
 * matching the pattern in `tests/landing-form.test.tsx`.
 *
 * Requirements: 8.2, 8.3, 8.4, 8.6, 8.7, 8.8, 8.9
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import type { RepoFacts } from "@/lib/lifecycle";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { TRUNCATION_NOTICE } from "@/lib/graveyard-view";

// ---------------------------------------------------------------------------
// Override store mock (used by GraveyardView). Hoisted so the module mock can
// close over it; each test sets its return value before rendering.
// ---------------------------------------------------------------------------
const readOverrides = vi.hoisted(() => vi.fn());

vi.mock("@/lib/overrides", () => ({
  readOverrides,
}));

import GraveyardList from "@/components/graveyard/GraveyardList";
import LoadErrorMessage from "@/components/graveyard/LoadErrorMessage";
import GraveyardView from "@/components/graveyard/GraveyardView";

afterEach(() => {
  cleanup();
  readOverrides.mockReset();
});

/** Builds a minimal display row; overrides merge onto sensible defaults. */
function makeRow(overrides: Partial<GraveyardRow> = {}): GraveyardRow {
  return {
    name: "repo",
    url: "https://github.com/octocat/repo",
    state: "ghost",
    daysQuiet: 1,
    decayLevel: 0,
    ...overrides,
  };
}

/** Builds minimal RepoFacts; overrides merge onto a non-archived default. */
function makeRepo(overrides: Partial<RepoFacts> = {}): RepoFacts {
  return {
    name: "repo-a",
    description: null,
    url: "https://github.com/octocat/repo-a",
    pushedAt: "2024-05-28T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
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

describe("GraveyardList", () => {
  it("renders the empty-state message when there are zero rows (8.2)", () => {
    render(<GraveyardList rows={[]} truncated={false} />);

    expect(screen.queryByText("No repositories were found.")).not.toBeNull();
  });

  it("renders the exact truncation notice when truncated is true (8.9)", () => {
    render(<GraveyardList rows={[]} truncated={true} />);

    expect(TRUNCATION_NOTICE).toBe("showing the 300 most recently pushed.");
    expect(
      screen.queryByText("showing the 300 most recently pushed."),
    ).not.toBeNull();
  });

  it("does not render the truncation notice when truncated is false (8.9)", () => {
    render(
      <GraveyardList rows={[makeRow()]} truncated={false} />,
    );

    expect(
      screen.queryByText("showing the 300 most recently pushed."),
    ).toBeNull();
  });

  it("renders the truncation notice alongside non-empty rows when truncated (8.9)", () => {
    render(<GraveyardList rows={[makeRow()]} truncated={true} />);

    expect(
      screen.queryByText("showing the 300 most recently pushed."),
    ).not.toBeNull();
  });

  it("renders a heading per non-empty state group and a link per row, omitting empty groups", () => {
    const rows: GraveyardRow[] = [
      makeRow({ name: "ghost-repo", url: "https://example.com/ghost", state: "ghost", decayLevel: 1 }),
      makeRow({ name: "zombie-repo", url: "https://example.com/zombie", state: "zombie", decayLevel: 2 }),
      makeRow({ name: "coffin-repo", url: "https://example.com/coffin", state: "coffin", decayLevel: null }),
    ];

    render(<GraveyardList rows={rows} truncated={false} />);

    // One heading for each of the three populated groups.
    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingText = headings.map((h) => h.textContent);
    expect(headingText).toEqual(["Ghosts", "Zombies", "Coffins"]);

    // Empty groups (Risen, Tombstones) produce no heading.
    expect(screen.queryByText("Risen")).toBeNull();
    expect(screen.queryByText("Tombstones")).toBeNull();

    // One link per row, pointing at each repo's URL.
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(3);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com/ghost",
      "https://example.com/zombie",
      "https://example.com/coffin",
    ]);
    expect(links.map((a) => a.textContent)).toEqual([
      "ghost-repo",
      "zombie-repo",
      "coffin-repo",
    ]);
  });
});

describe("LoadErrorMessage", () => {
  it("renders not-found copy (8.3)", () => {
    render(<LoadErrorMessage error={{ kind: "not-found" }} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("does not exist on GitHub");
  });

  it("renders invalid-username copy (8.8)", () => {
    render(<LoadErrorMessage error={{ kind: "invalid-username" }} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("valid GitHub username");
  });

  it("renders server-error copy (8.7)", () => {
    render(<LoadErrorMessage error={{ kind: "server-error" }} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(
      "repository data could not be loaded",
    );
  });

  it("renders rate-limited copy with the formatted reset time when resetAt is set (8.4)", () => {
    const resetAt = "2024-06-01T12:34:56.000Z";
    render(<LoadErrorMessage error={{ kind: "rate-limited", resetAt }} />);

    const alert = screen.getByRole("alert");
    // Unique rate-limit phrasing.
    expect(alert.textContent).toContain("rate limit has been reached");
    // The component formats the ISO timestamp as "YYYY-MM-DD HH:MM:SS UTC".
    expect(alert.textContent).toContain("2024-06-01 12:34:56 UTC");
    // Distinguishes from the no-reset variant.
    expect(alert.textContent).toContain("Try again after");
  });

  it("renders generic rate-limited wait copy when resetAt is null (8.4)", () => {
    render(<LoadErrorMessage error={{ kind: "rate-limited", resetAt: null }} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("rate limit has been reached");
    expect(alert.textContent).toContain("Please try again later.");
    // The generic variant carries no specific reset time.
    expect(alert.textContent).not.toContain("Try again after");
  });
});

describe("GraveyardView", () => {
  beforeEach(() => {
    // Default: no stored overrides (server-equivalent first paint).
    readOverrides.mockReturnValue({});
  });

  it("re-classifies a row after overrides load from storage (8.6)", async () => {
    // `repo-a` was pushed 4 days before renderedAt, so with no override it
    // classifies as a recent-push ghost. A stored `scrapped` override is a
    // terminal rule that forces it to a coffin, which is observable in the UI.
    const renderedAt = "2024-06-01T00:00:00.000Z";
    const repo = makeRepo();

    readOverrides.mockReturnValue({
      [repo.name]: { type: "scrapped", setAt: "2024-05-30T00:00:00.000Z" },
    });

    render(
      <GraveyardView
        repos={[repo]}
        truncated={false}
        username="octocat"
        renderedAt={renderedAt}
      />,
    );

    // After the mount effect reads the override and the view re-derives rows,
    // the repo is grouped under Coffins and its state label reads "coffin".
    await waitFor(() => {
      expect(screen.queryByText("Coffins")).not.toBeNull();
    });
    expect(screen.queryByText("coffin")).not.toBeNull();

    // The ghost grouping/label from the no-override classification is gone.
    expect(screen.queryByText("Ghosts")).toBeNull();
    expect(screen.queryByText("ghost")).toBeNull();

    // readOverrides was keyed by the owner username.
    expect(readOverrides).toHaveBeenCalledWith("octocat");
  });

  it("keeps the no-override classification when storage is empty (8.6)", () => {
    const renderedAt = "2024-06-01T00:00:00.000Z";
    const repo = makeRepo();

    render(
      <GraveyardView
        repos={[repo]}
        truncated={false}
        username="octocat"
        renderedAt={renderedAt}
      />,
    );

    // With no overrides the recent push stays a ghost.
    expect(screen.queryByText("Ghosts")).not.toBeNull();
    expect(screen.queryByText("ghost")).not.toBeNull();
    expect(screen.queryByText("Coffins")).toBeNull();
  });
});
