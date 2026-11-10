/**
 * DOM tests for the detail panel polish: fonts, tokens and structure only
 * (no pixel tests). Render helpers are copied from DetailPanel.test.tsx.
 *
 * Requirements: 17.2-17.9
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DetailPanel, { type DetailPanelProps } from "@/components/detail/DetailPanel";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function daysAgo(days: number): string {
  return new Date(NOW_MS - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

function makeFacts(overrides: Partial<RepoFacts> & { name: string }): RepoFacts {
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

function makeRow(overrides: Partial<RepoRow> = {}): RepoRow {
  return {
    name: "crypt-keeper",
    description: "Keeps the crypt.",
    url: "https://github.com/octocat/crypt-keeper",
    homepageUrl: null,
    primaryLanguage: { name: "Rust", color: "#dea584" },
    stargazerCount: 42,
    forkCount: 7,
    openIssueCount: 3,
    topics: ["alpha", "beta"],
    pushedAt: daysAgo(300),
    createdAt: daysAgo(900),
    isArchived: false,
    isFork: false,
    ...overrides,
  };
}

function stubMedia({ width = 1280, reduced = false } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => {
    let matches = false;
    if (query.includes("min-width: 768px")) matches = width >= 768;
    else if (query.includes("prefers-reduced-motion")) matches = reduced;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const manualRoots: HTMLElement[] = [];

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  stubMedia();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  manualRoots.splice(0).forEach((r) => r.remove());
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountRoot(): HTMLElement {
  const root = document.createElement("div");
  root.id = "scene-root";
  const b = document.createElement("button");
  b.textContent = "opener";
  root.appendChild(b);
  document.body.appendChild(root);
  manualRoots.push(root);
  return root;
}

const SEANCE_FIXTURE = {
  voice:
    "I am still warm, and I think you can feel it. The sidebar toggle was nearly right when you left me. Pick up the toggle and I will do the rest of the remembering.",
  causeOfDeath: "Not dead at all, just waiting for someone to finish tidying the sidebar.",
  unfinishedBusiness: [
    {
      title: "Finish the sidebar toggle",
      detail: "The last thing we touched together was the toggle, and it still feels half sorted.",
      evidence: "last commit: tidy up the sidebar toggle",
    },
  ],
  verdict: "finish",
  verdictReason: "I am close to done and the remaining work is small.",
};

function panelProps(overrides: Partial<DetailPanelProps> = {}): DetailPanelProps {
  return {
    row: makeRow(),
    owner: "octocat",
    classification: { state: "zombie", decayLevel: 0 },
    facts: makeFacts({ name: "crypt-keeper", pushedAt: daysAgo(300) }),
    renderedAt: NOW,
    isFixture: false,
    onClose: vi.fn(),
    sceneRootId: "scene-root",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<DetailPanelProps> = {}) {
  const root = mountRoot();
  const props = panelProps(overrides);
  const utils = render(<DetailPanel {...props} />);
  return { ...utils, props, root };
}

const AI_LABEL = "AI · from the facts above";

describe("fonts by role (17.2)", () => {
  it("headings use font-heading, facts font-fact, narrative font-narrative", () => {
    renderPanel();
    const d = dialog()!;
    expect(d.querySelector("h2")!.className).toContain("font-heading");
    const factsHeading = Array.from(d.querySelectorAll("h3")).find(
      (h) => h.textContent === "From GitHub",
    )!;
    expect(factsHeading.className).toContain("font-heading");
    expect(d.querySelector("dl")!.className).toContain("font-fact");
    const narrative = Array.from(d.querySelectorAll("p")).find((p) =>
      (p.textContent ?? "").includes("no signs it was finished"),
    )!;
    expect(narrative.className).toContain("font-narrative");
  });

  it("uses no font-display anywhere in the panel", () => {
    renderPanel();
    const withDisplay = Array.from(dialog()!.querySelectorAll("*")).filter((el) =>
      /font-display|--font-display/.test(el.getAttribute("class") ?? ""),
    );
    expect(withDisplay).toHaveLength(0);
    for (const file of ["DetailPanel.tsx", "Portrait.tsx"]) {
      expect(readFileSync(join(process.cwd(), "components/detail", file), "utf8")).not.toContain(
        "font-display",
      );
    }
  });
});

describe("section structure (17.3, 17.4)", () => {
  it("facts section precedes Actions and the AI region; AI label only after a séance", async () => {
    const user = userEvent.setup();
    stubMedia({ reduced: true });
    renderPanel({ isFixture: true, seanceFixture: SEANCE_FIXTURE });
    const d = dialog()!;

    expect(d.textContent).not.toContain(AI_LABEL);

    const facts = d.querySelector<HTMLElement>('section[aria-label="From GitHub"]')!;
    const actions = d.querySelector<HTMLElement>('section[aria-label="Actions"]')!;
    const region = d.querySelector<HTMLElement>("[data-seance-region]")!;
    const before = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(facts, actions)).toBe(true);
    expect(before(facts, region)).toBe(true);
    expect(facts.querySelector("h3")!.textContent).toBe("From GitHub");

    await user.click(screen.getByRole("button", { name: /Hold a séance/ }));
    await waitFor(() => expect(region.textContent).toContain(AI_LABEL));

    expect(facts.textContent).not.toContain(AI_LABEL);
    expect(actions.textContent).not.toContain(AI_LABEL);
    const aiHeadings = Array.from(d.querySelectorAll("h3")).filter(
      (h) => h.textContent === AI_LABEL,
    );
    expect(aiHeadings).toHaveLength(1);
    expect(region.contains(aiHeadings[0])).toBe(true);
  });
});

describe("portrait (17.1 structure)", () => {
  it("renders an aria-hidden portrait", () => {
    renderPanel();
    const portrait = screen.getByTestId("detail-portrait");
    expect(portrait.getAttribute("aria-hidden")).toBe("true");
    expect(dialog()!.contains(portrait)).toBe(true);
  });
});

describe("design tokens only (17.5, 17.9)", () => {
  const sources = ["DetailPanel.tsx", "Portrait.tsx"].map((f) => [
    f,
    readFileSync(join(process.cwd(), "components/detail", f), "utf8"),
  ]);

  it.each(sources)("%s has no hex/rgb/hsl colour literals", (_f, src) => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\b(rgba?|hsla?)\s*\(/i);
  });

  it.each(sources)("%s adds no horizontal scroll classes", (_f, src) => {
    expect(src).not.toMatch(/overflow-x/);
  });

  it("dialog scrolls vertically only", () => {
    renderPanel();
    const cls = dialog()!.className;
    expect(cls).toContain("overflow-y-auto");
    expect(cls).not.toContain("overflow-x");
  });
});

describe("dialog behavior preserved (17.6-17.8)", () => {
  it("exposes dialog semantics, inerts background, locks scroll, focuses inside", () => {
    const { root } = renderPanel();
    const d = dialog()!;
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.getAttribute("aria-labelledby")).toBeTruthy();
    expect(root.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab and Shift+Tab", async () => {
    const user = userEvent.setup();
    renderPanel();
    const close = screen.getByRole("button", { name: "Close record" });
    const items = dialog()!.querySelectorAll<HTMLElement>("a[href], button");
    const last = items[items.length - 1];
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it("Escape closes when idle, then cleanup restores inert, scroll and focus", async () => {
    const root = mountRoot();
    const opener = root.querySelector("button")!;
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<DetailPanel {...panelProps({ onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(root.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
  });
});
