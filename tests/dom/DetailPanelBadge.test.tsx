/**
 * DOM tests for the "Share this repo" action in the detail panel.
 * Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 8.1, 8.2, 8.5, 8.7, 10.5, 10.8
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DetailPanel, { type DetailPanelProps } from "@/components/detail/DetailPanel";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function daysAgo(days: number): string {
  return new Date(NOW_MS - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

const FACTS: RepoFacts = {
  name: "crypt-keeper",
  description: null,
  url: "https://github.com/octocat/crypt-keeper",
  pushedAt: daysAgo(300),
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
};

const ROW: RepoRow = {
  name: "crypt-keeper",
  description: "Keeps the crypt.",
  url: "https://github.com/octocat/crypt-keeper",
  homepageUrl: null,
  primaryLanguage: null,
  stargazerCount: 0,
  forkCount: 0,
  openIssueCount: 0,
  topics: [],
  pushedAt: daysAgo(300),
  createdAt: daysAgo(900),
  isArchived: false,
  isFork: false,
};

function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 768px"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderPanel(overrides: Partial<DetailPanelProps> = {}) {
  const root = document.createElement("div");
  root.id = "scene-root";
  document.body.appendChild(root);
  const props: DetailPanelProps = {
    row: ROW,
    owner: "octocat",
    classification: { state: "zombie", decayLevel: 0 },
    facts: FACTS,
    renderedAt: NOW,
    isFixture: false,
    onClose: vi.fn(),
    sceneRootId: "scene-root",
    ...overrides,
  };
  const utils = render(<DetailPanel {...props} />);
  return { ...utils, props, root };
}

const badgeButton = () =>
  screen.queryByRole("button", { name: "Share this repo" }) as HTMLButtonElement | null;

const badgeDialog = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
    (d) => d.querySelector("h2")?.textContent === "Share this repo",
  ) ?? null;

const panelHeading = () =>
  Array.from(document.querySelectorAll("h2")).find((h) => h.textContent === "crypt-keeper");

beforeEach(() => {
  stubMedia();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  document.getElementById("scene-root")?.remove();
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DetailPanel 'Share this repo' action", () => {
  it("is present for a real repo (8.1)", () => {
    renderPanel();
    expect(badgeButton()).not.toBeNull();
  });

  it("is absent for a Haunted Estate sample repo (8.7)", () => {
    renderPanel({ isFixture: true });
    expect(badgeButton()).toBeNull();
    expect(document.body.textContent).not.toContain("Share this repo");
  });

  it("is smaller than the header 'Share your graveyard' button (8.1)", () => {
    renderPanel();
    const cls = badgeButton()!.className.split(/\s+/);
    expect(cls).toContain("h-9");
    expect(cls).toContain("text-xs");
    expect(cls).not.toContain("min-h-11");
    expect(cls).not.toContain("text-sm");

    const header = readFileSync(join(process.cwd(), "components/ui/Header.tsx"), "utf8");
    const m = header.match(/const badgeClasses =\s*"([^"]*)"/);
    expect(m).not.toBeNull();
    const headerCls = m![1].split(/\s+/);
    expect(headerCls).toContain("min-h-11");
    expect(headerCls).toContain("text-sm");
  });

  function expectDialogContent() {
    const d = badgeDialog()!;
    expect(d).not.toBeNull();
    expect(d.querySelector('[data-testid="badge-preview"] img')).not.toBeNull();
    expect(d.querySelectorAll('input[type="radio"]').length).toBe(2);
    const areas = Array.from(d.querySelectorAll("textarea")).map((t) => t.value);
    expect(areas.length).toBe(2);
    expect(areas.some((v) => v.startsWith("[![Repo Graveyard]"))).toBe(true);
    expect(areas.some((v) => v.includes("<a "))).toBe(true);
    for (const v of areas) expect(v).toContain("/api/badge/octocat/crypt-keeper");
  }

  it("opens on click (8.2)", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(badgeDialog()).toBeNull();
    await user.click(badgeButton()!);
    expectDialogContent();
  });

  it("opens on Enter (8.2)", async () => {
    const user = userEvent.setup();
    renderPanel();
    badgeButton()!.focus();
    await user.keyboard("{Enter}");
    expectDialogContent();
  });

  it("opens on Space (8.2)", async () => {
    const user = userEvent.setup();
    renderPanel();
    badgeButton()!.focus();
    await user.keyboard(" ");
    expectDialogContent();
  });

  it("changing style leaves the panel intact (8.5)", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.click(badgeButton()!);
    const d = badgeDialog()!;
    const img = () => d.querySelector<HTMLImageElement>("img")!.getAttribute("src")!;
    expect(img()).not.toContain("style=flat");

    await user.click(screen.getByRole("radio", { name: /Flat/ }));
    expect(img()).toContain("style=flat");
    for (const t of Array.from(d.querySelectorAll("textarea"))) {
      expect(t.value).toContain("?style=flat");
    }
    expect(panelHeading()).toBeDefined();
    expect(badgeDialog()).not.toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("Escape closes only the badge dialog and returns focus to the button (9.3)", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    const btn = badgeButton()!;
    await user.click(btn);
    expect(badgeDialog()).not.toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(badgeDialog()).toBeNull());
    expect(props.onClose).not.toHaveBeenCalled();
    expect(panelHeading()).toBeDefined();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(btn);
  });
});
