/**
 * DOM tests for the repo detail panel. Mixes SceneView-level tests (opening,
 * hover-card hand-off, travel/filter isolation, inert scene root, focus return)
 * with direct `DetailPanel` tests (content, dialog semantics, layout, motion).
 * Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 5.1-5.8, 6.1-6.14, 7.1-7.8, 9.4, 9.5, 10.3
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import DetailPanel, { type DetailPanelProps } from "@/components/detail/DetailPanel";
import { hoverCardId } from "@/components/detail/HoverCardLayer";
import { buildRows } from "@/lib/graveyard-view";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";
import { creatureAccessibleName } from "@/lib/scene-view";

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
    homepageUrl: "https://crypt.example.com/docs?x=1",
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

interface MediaOpts {
  width?: number;
  reduced?: boolean;
  fine?: boolean;
}

function stubMedia({ width = 1280, reduced = false, fine = true }: MediaOpts = {}) {
  vi.stubGlobal("matchMedia", (query: string) => {
    let matches = false;
    if (query.includes("min-width: 768px")) matches = width >= 768;
    else if (query.includes("max-width: 767px")) matches = width <= 767;
    else if (query.includes("prefers-reduced-motion")) matches = reduced;
    else if (query.includes("hover: hover")) matches = fine;
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
const overlay = () => screen.queryByTestId("detail-overlay");
const sceneRoot = () => document.getElementById("scene-root");

beforeEach(() => {
  // Opening a panel pushes `?repo=`; reset so tests don't leak URL state.
  window.history.replaceState(null, "", "/");
  stubMedia();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
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

const manualRoots: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  manualRoots.splice(0).forEach((r) => r.remove());
  push.mockReset();
  document.body.removeAttribute("style");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// SceneView-level
// ---------------------------------------------------------------------------

const REPOS: RepoFacts[] = [
  makeFacts({
    name: "good-zombie",
    pushedAt: daysAgo(300),
    description: "<img src=x onerror=alert(1)><b>bold</b>",
  }),
  makeFacts({ name: "other-zombie", pushedAt: daysAgo(320) }),
];

function nameFor(repoName: string): string {
  const row = buildRows(REPOS, {}, NOW).find((r) => r.name === repoName);
  if (!row) throw new Error(`no row for ${repoName}`);
  return creatureAccessibleName(row);
}

function renderScene() {
  return render(
    <SceneView
      rows={buildRows(REPOS, {}, NOW)}
      repos={REPOS}
      truncated={false}
      username="octocat"
      renderedAt={NOW}
      mode="live"
      at="gate"
    />,
  );
}

const creature = (n: string) =>
  screen.getByRole("button", { name: nameFor(n) }) as HTMLButtonElement;

describe("SceneView opens the panel (5.1-5.8)", () => {
  it("opens on click (5.1) with dialog semantics (7.1)", async () => {
    const user = userEvent.setup();
    renderScene();
    expect(dialog()).toBeNull();
    await user.click(creature("good-zombie"));
    const d = dialog()!;
    expect(d).not.toBeNull();
    expect(d.getAttribute("aria-modal")).toBe("true");
    const labelId = d.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)!.textContent).toBe("good-zombie");
  });

  it("opens on Enter (5.1)", async () => {
    const user = userEvent.setup();
    renderScene();
    creature("good-zombie").focus();
    await user.keyboard("{Enter}");
    expect(dialog()).not.toBeNull();
  });

  it("opens on Space and suppresses page scroll (5.1, 5.2)", () => {
    renderScene();
    const notCancelled = fireEvent.keyDown(creature("good-zombie"), { key: " " });
    expect(notCancelled).toBe(false); // defaultPrevented
    expect(dialog()).not.toBeNull();
  });

  it("closes the same creature's hover card as the panel opens (5.3)", () => {
    vi.useFakeTimers();
    renderScene();
    const btn = creature("good-zombie");
    fireEvent.pointerEnter(btn);
    act(() => void vi.advanceTimersByTime(250));
    expect(document.getElementById(hoverCardId("good-zombie"))).not.toBeNull();
    fireEvent.click(btn);
    expect(dialog()).not.toBeNull();
    expect(document.getElementById(hoverCardId("good-zombie"))).toBeNull();
  });

  it("a coarse tap opens the panel directly, without a hover card (5.4)", () => {
    stubMedia({ fine: false });
    vi.useFakeTimers();
    renderScene();
    const btn = creature("good-zombie");
    fireEvent.pointerEnter(btn);
    act(() => void vi.advanceTimersByTime(1000));
    expect(document.querySelector('[id^="hover-card-"]')).toBeNull();
    fireEvent.click(btn);
    expect(dialog()).not.toBeNull();
  });

  it("does not start travel, change place, or change the filter (5.8)", async () => {
    const user = userEvent.setup();
    renderScene();
    const chipsBefore = screen.getByTestId("filter-chips").innerHTML;
    const placeBefore = screen.getByTestId("place-view").getAttribute("data-place");
    await user.click(creature("good-zombie"));
    expect(dialog()).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("place-view").getAttribute("data-place")).toBe(placeBefore);
    expect(screen.getByTestId("filter-chips").innerHTML).toBe(chipsBefore);
  });

  it("explains the real reason and renders description as plain text (6.3, 9.5)", async () => {
    const user = userEvent.setup();
    renderScene();
    await user.click(creature("good-zombie"));
    const d = dialog()!;
    expect(d.textContent).toContain("no signs it was finished");
    // The decorative portrait is the only image allowed (Spec 4); injected markup creates none.
    expect(d.querySelectorAll('img:not([data-testid="detail-portrait"] img)').length).toBe(0);
    expect(d.querySelector('[data-testid="detail-portrait"] img')).not.toBeNull();
    expect(d.querySelector("b")).toBeNull();
    expect(d.textContent).toContain("<img src=x onerror=alert(1)><b>bold</b>");
  });

  it("marks #scene-root inert while open, never the dialog or overlay (5.1)", async () => {
    const user = userEvent.setup();
    renderScene();
    expect(sceneRoot()!.hasAttribute("inert")).toBe(false);
    await user.click(creature("good-zombie"));
    expect(sceneRoot()!.hasAttribute("inert")).toBe(true);
    const d = dialog()!;
    expect(sceneRoot()!.contains(d)).toBe(false);
    expect(d.closest("[inert]")).toBeNull();
    expect(overlay()!.closest("[inert]")).toBeNull();
    // Focus is inside the (operable) dialog while the scene is inert.
    expect(d.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole("button", { name: "Close record" }));
    // In-page close goes through history.back(), which settles asynchronously.
    await waitFor(() => expect(dialog()).toBeNull());
    expect(sceneRoot()!.hasAttribute("inert")).toBe(false);
  });

  it("Escape closes and returns focus to the opening creature without a hover card (7.5, 7.6)", async () => {
    const user = userEvent.setup();
    renderScene();
    const btn = creature("good-zombie");
    await user.click(btn);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(btn);
    expect(document.querySelector('[id^="hover-card-"]')).toBeNull();
  });

  it("falls back to a persistent element when the opener is gone (7.7)", async () => {
    const user = userEvent.setup();
    renderScene();
    const btn = creature("good-zombie");
    await user.click(btn);
    const parent = btn.parentNode!;
    const next = btn.nextSibling;
    btn.remove(); // opener leaves the DOM while the panel is open
    await user.click(screen.getByRole("button", { name: "Close record" }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId("place-heading"));
    parent.insertBefore(btn, next); // restore so React can unmount cleanly
  });
});

// ---------------------------------------------------------------------------
// Direct DetailPanel
// ---------------------------------------------------------------------------

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

describe("DetailPanel layout (5.5-5.7)", () => {
  it("is a right-side drawer at >= 768px (5.5)", () => {
    stubMedia({ width: 1280 });
    renderPanel();
    expect(dialog()!.className).toContain("w-[420px]");
    expect(dialog()!.className).toContain("right-0");
  });

  it.each([375, 700])("is a full-height sheet at %ipx (6.1, 6.3)", (width) => {
    stubMedia({ width });
    renderPanel();
    const cls = dialog()!.className;
    for (const c of [
      "max-[767px]:inset-0",
      "max-[767px]:h-dvh",
      "max-[767px]:w-full",
      "max-[767px]:rounded-none",
      "max-[767px]:overscroll-contain",
    ]) {
      expect(cls).toContain(c);
    }
    expect(cls).not.toContain("max-h-[85vh]");
    expect(cls).toContain("overflow-y-auto");
  });

  it("keeps the 420px right panel classes at 768px (6.1)", () => {
    stubMedia({ width: 768 });
    renderPanel();
    const cls = dialog()!.className;
    expect(cls).toContain("min-[768px]:w-[420px]");
    expect(cls).toContain("min-[768px]:right-0");
    expect(dialog()!.style.transform).toContain("translateX");
  });

  it("slides up from the bottom in compact mode", () => {
    stubMedia({ width: 375 });
    renderPanel();
    expect(dialog()!.style.transform).toContain("translateY");
  });

  it("has a sticky opaque header and a 44px close target (6.3, 6.6)", () => {
    stubMedia({ width: 375 });
    renderPanel();
    const close = screen.getByRole("button", { name: "Close record" });
    const header = close.parentElement!;
    expect(header.className).toContain("max-[767px]:sticky");
    expect(header.className).toContain("max-[767px]:top-0");
    expect(header.className).toContain("max-[767px]:bg-night-800");
    expect(close.className).toContain("max-[767px]:min-h-11");
    expect(close.className).toContain("max-[767px]:min-w-11");
  });

  it("closing with a removed opener does not throw (6.7)", () => {
    const root = mountRoot();
    const opener = root.querySelector("button")!;
    opener.focus();
    const { unmount } = render(<DetailPanel {...panelProps()} />);
    opener.remove();
    expect(() => unmount()).not.toThrow();
  });

  it("dims the scene with a 35-50% overlay and closes on overlay click (5.7)", async () => {
    const { props } = renderPanel();
    await waitFor(() => expect(Number(overlay()!.style.opacity)).toBeGreaterThan(0));
    const opacity = Number(overlay()!.style.opacity);
    expect(opacity).toBeGreaterThanOrEqual(0.35);
    expect(opacity).toBeLessThanOrEqual(0.5);
    fireEvent.click(overlay()!);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DetailPanel content (6.1-6.14)", () => {
  it("shows name, owner, type + decay badges, and explanation (6.1-6.3)", () => {
    renderPanel();
    const d = dialog()!;
    expect(d.querySelector("h2")!.textContent).toBe("crypt-keeper");
    expect(d.textContent).toContain("octocat");
    expect(d.textContent).toContain("zombie");
    expect(d.textContent).toContain("no signs it was finished");
  });

  it("tombstone explanation names a real finished signal (6.3)", () => {
    renderPanel({
      classification: { state: "tombstone", decayLevel: null },
      facts: makeFacts({ name: "crypt-keeper", pushedAt: daysAgo(900), releaseCount: 3 }),
    });
    expect(dialog()!.textContent).toContain("3 releases");
  });

  it("shows description, topics, counts, language, dates (6.4, 6.6-6.9)", () => {
    renderPanel();
    const text = dialog()!.textContent!;
    expect(text).toContain("Keeps the crypt.");
    expect(text).toContain("alpha");
    expect(text).toContain("beta");
    expect(text).toMatch(/Stars\s*42/);
    expect(text).toMatch(/Forks\s*7/);
    expect(text).toMatch(/Open issues\s*3/);
    expect(text).toContain("Rust");
    expect(screen.getByTestId("language-dot").style.backgroundColor).not.toBe("");
    expect(text).toContain("Created");
    expect(text).toContain("Last push");
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("caps topics at five (6.6)", () => {
    renderPanel({ row: makeRow({ topics: ["a", "b", "c", "d", "e", "f", "g"] }) });
    expect(dialog()!.querySelectorAll("ul > li").length).toBe(5);
  });

  it.each([null, "", "   "])("shows 'No epitaph was written.' for %j (6.5)", (description) => {
    renderPanel({ row: makeRow({ description }) });
    expect(dialog()!.textContent).toContain("No epitaph was written.");
  });

  it("shows Archived and Fork badges only when applicable (6.10, 6.11)", () => {
    const { unmount } = renderPanel();
    expect(dialog()!.textContent).not.toContain("Archived");
    const none = Array.from(dialog()!.querySelectorAll("span")).map((s) => s.textContent);
    expect(none).not.toContain("Fork");
    unmount();
    manualRoots.splice(0).forEach((r) => r.remove());
    renderPanel({ row: makeRow({ isArchived: true, isFork: true }) });
    expect(dialog()!.textContent).toContain("Archived");
    const badges = Array.from(dialog()!.querySelectorAll("span")).map((s) => s.textContent);
    expect(badges).toContain("Fork");
    expect(badges).toContain("Archived");
  });

  it("GitHub and homepage links carry safe attributes and show only the domain (6.12, 6.13, 9.4)", () => {
    renderPanel();
    const links = Array.from(dialog()!.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.length).toBe(2);
    const gh = links.find((a) => a.textContent!.includes("Open on GitHub"))!;
    expect(gh.getAttribute("href")).toBe("https://github.com/octocat/crypt-keeper");
    const home = links.find((a) => a !== gh)!;
    expect(home.getAttribute("href")).toBe("https://crypt.example.com/docs?x=1");
    expect(home.textContent).toContain("crypt.example.com");
    expect(home.textContent).not.toContain("/docs");
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.getAttribute("rel")).toContain("noreferrer");
      expect(a.textContent).toContain("↗");
      expect(a.textContent).toContain("(opens in a new tab)");
    }
  });

  it.each(["http://crypt.example.com", "javascript:alert(1)", null])(
    "omits a non-https homepage %j entirely (6.13)",
    (homepageUrl) => {
      renderPanel({ row: makeRow({ homepageUrl }) });
      const links = dialog()!.querySelectorAll("a");
      expect(links.length).toBe(1);
      expect(links[0].textContent).toContain("Open on GitHub");
    },
  );

  it("renders an Actions landmark with exactly one control, Hold a séance (6.14)", () => {
    // Spec 3 -> Spec 4: the Actions slot now holds the séance control and nothing else.
    renderPanel();
    const actions = dialog()!.querySelector<HTMLElement>(
      'section[aria-label="Actions"][data-slot="actions"]',
    )!;
    expect(actions).not.toBeNull();
    const controls = actions.querySelectorAll("button, a, input, select, textarea, [tabindex]");
    expect(controls.length).toBe(1);
    expect(controls[0].tagName).toBe("BUTTON");
    expect((controls[0].textContent ?? "").replace(/\s+/g," ").trim()).toContain("Hold a séance");
    expect((actions.textContent ?? "").replace(/\s+/g," ").trim()).toBe((controls[0].textContent ?? "").replace(/\s+/g," ").trim());
  });

  it("renders HTML in the description literally (9.5)", () => {
    const html = "<script>alert(1)</script><a href='x'>pwn</a>";
    renderPanel({ row: makeRow({ description: html }) });
    expect(dialog()!.textContent).toContain(html);
    expect(dialog()!.querySelector("script")).toBeNull();
    expect(dialog()!.querySelectorAll("a").length).toBe(2); // GitHub + homepage only
  });
});

describe("DetailPanel dialog behavior (7.1-7.8)", () => {
  it("has dialog semantics (7.1)", () => {
    renderPanel();
    const d = dialog()!;
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(d.getAttribute("aria-labelledby")!)!.textContent).toBe(
      "crypt-keeper",
    );
  });

  it("moves focus into the dialog on open (7.2)", () => {
    renderPanel();
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close record" }));
  });

  it("traps Tab and Shift+Tab with wrap (7.3)", async () => {
    const user = userEvent.setup();
    renderPanel();
    const close = screen.getByRole("button", { name: "Close record" });
    const focusables = dialog()!.querySelectorAll<HTMLElement>("a[href], button");
    const last = focusables[focusables.length - 1];
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it("close control is named 'Close record' and closes (7.4, 7.5)", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Close record" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape closes (7.5)", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the opener on close (7.6)", () => {
    const root = mountRoot();
    const opener = root.querySelector("button")!;
    opener.focus();
    const { unmount } = render(<DetailPanel {...panelProps()} />);
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
  });

  it("falls back to a persistent element if the opener is gone (7.7)", () => {
    const root = mountRoot();
    const opener = root.querySelector("button")!;
    opener.focus();
    const fallback = document.createElement("h1");
    fallback.tabIndex = -1;
    document.body.appendChild(fallback);
    const { unmount } = render(
      <DetailPanel {...panelProps({ getFallbackFocus: () => fallback })} />,
    );
    opener.remove();
    unmount();
    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });

  it("close control uses a candle-400 focus ring (7.8)", () => {
    renderPanel();
    const cls = screen.getByRole("button", { name: "Close record" }).className;
    expect(cls).toContain("candle-400");
    expect(cls).toContain("focus-visible:ring-2");
  });
});

describe("DetailPanel motion (10.3)", () => {
  it("reduced motion fades in without sliding", async () => {
    stubMedia({ reduced: true });
    renderPanel();
    const d = dialog()!;
    expect(d.style.transform).toBe("none");
    expect(d.style.transition).not.toContain("transform");
    await waitFor(() => expect(d.style.opacity).toBe("1"));
    expect(d.style.transform).toBe("none");
    expect(d.style.transition).toMatch(/opacity 200ms/);
  });

  it("full motion slides in from the side", async () => {
    renderPanel();
    const d = dialog()!;
    expect(d.style.transform).toContain("translateX");
    expect(d.style.transition).toContain("transform");
    await waitFor(() => expect(d.style.transform).toBe("none"));
  });
});

describe("DetailPanel inert + scroll lock", () => {
  it("inerts the scene root while open and restores it on unmount", () => {
    const { root, unmount } = renderPanel();
    expect(root.hasAttribute("inert")).toBe(true);
    const d = dialog()!;
    expect(root.contains(d)).toBe(false);
    expect(d.closest("[inert]")).toBeNull();
    expect(overlay()!.closest("[inert]")).toBeNull();
    unmount();
    expect(root.hasAttribute("inert")).toBe(false);
  });

  it("locks page scroll while open and restores position on close", () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(240);
    const { unmount } = renderPanel();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-240px");
    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it("lookup miss renders nothing and applies no inert or scroll lock", () => {
    const { root } = renderPanel({ row: undefined });
    expect(dialog()).toBeNull();
    expect(overlay()).toBeNull();
    expect(root.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
  });
});
