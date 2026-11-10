/**
 * DOM tests for the hover card (HoverCardProvider + HoverCardLayer + HoverCard)
 * driven by real `Creature` buttons. Fake timers drive dwell / grace timing.
 * No jest-dom: plain DOM assertions only.
 *
 * Requirements: 2.1-2.12, 3.1-3.8, 10.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import Creature from "@/components/creatures/Creature";
import {
  HoverCardProvider,
  useHoverCardActions,
  type HoverCardActions,
} from "@/components/detail/HoverCardProvider";
import HoverCardLayer, { hoverCardId } from "@/components/detail/HoverCardLayer";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { RepoRow } from "@/lib/repoRow";

const RENDERED_AT = "2025-06-01T00:00:00.000Z";

function makeRepo(name: string, overrides: Partial<RepoRow> = {}): RepoRow {
  return {
    name,
    description: `About ${name}`,
    url: `https://github.com/octocat/${name}`,
    homepageUrl: null,
    primaryLanguage: { name: "TypeScript", color: "#3178c6" },
    stargazerCount: 42,
    forkCount: 1,
    openIssueCount: 0,
    topics: [],
    pushedAt: "2025-05-20T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    isArchived: false,
    isFork: false,
    ...overrides,
  };
}

function makeGraveyardRow(name: string): GraveyardRow {
  return {
    name,
    url: `https://github.com/octocat/${name}`,
    state: "ghost",
    daysQuiet: 12,
    decayLevel: 0,
  };
}

let actionsRef: HoverCardActions;

function Probe() {
  actionsRef = useHoverCardActions();
  return null;
}

function Creatures({ names }: { names: string[] }) {
  const a = useHoverCardActions();
  return (
    <>
      {names.map((n) => (
        <Creature
          key={n}
          row={makeGraveyardRow(n)}
          onHoverStart={a.onPointerEnter}
          onHoverEnd={a.onPointerLeave}
          onFocusStart={a.onFocus}
          onBlurEnd={a.onBlur}
          hoverCardId={hoverCardId(n)}
        />
      ))}
    </>
  );
}

function setup(
  opts: {
    repos?: RepoRow[];
    fine?: boolean;
    reduced?: boolean;
    isFixture?: boolean;
  } = {},
) {
  const repos = opts.repos ?? [makeRepo("alpha"), makeRepo("beta")];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("hover: hover")
      ? (opts.fine ?? true)
      : query.includes("prefers-reduced-motion")
        ? (opts.reduced ?? false)
        : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  const rowsByName = new Map(repos.map((r) => [r.name, r]));
  const classificationsByName = new Map(
    repos.map((r) => [r.name, { state: "ghost" as const, decayLevel: 0 }]),
  );
  const utils = render(
    <HoverCardProvider>
      <Probe />
      <Creatures names={repos.map((r) => r.name)} />
      <HoverCardLayer
        rowsByName={rowsByName}
        owner="octocat"
        classificationsByName={classificationsByName}
        renderedAt={RENDERED_AT}
        isFixture={opts.isFixture ?? false}
      />
    </HoverCardProvider>,
  );
  const btn = (n: string) =>
    utils.container.querySelector<HTMLButtonElement>(
      `button[aria-describedby="${hoverCardId(n)}"]`,
    )!;
  return { ...utils, btn };
}

const card = (n: string) => document.getElementById(hoverCardId(n));
const anyCard = () => document.querySelector('[id^="hover-card-"]');
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  // Anchor must be on-screen or the layer closes itself.
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pointer dwell and close timing", () => {
  it("opens after 250ms dwell, not before (2.1)", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(249);
    expect(anyCard()).toBeNull();
    advance(1);
    expect(card("alpha")).not.toBeNull();
  });

  it("cancels if the pointer leaves before the dwell (2.2)", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(100);
    fireEvent.pointerLeave(btn("alpha"));
    advance(1000);
    expect(anyCard()).toBeNull();
  });

  it("shows only one card at a time (2.4)", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(250);
    fireEvent.pointerEnter(btn("beta"));
    advance(250);
    expect(card("beta")).not.toBeNull();
    expect(card("alpha")).toBeNull();
    expect(document.querySelectorAll('[id^="hover-card-"]').length).toBe(1);
  });

  it("closes 150ms after the pointer leaves (2.6)", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(250);
    fireEvent.pointerLeave(btn("alpha"));
    advance(149);
    expect(card("alpha")).not.toBeNull();
    advance(1);
    expect(card("alpha")).toBeNull();
  });

  it("stays open when the pointer moves into the card (2.5)", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(250);
    fireEvent.pointerLeave(btn("alpha"));
    advance(100);
    fireEvent.pointerEnter(card("alpha")!);
    advance(1000);
    expect(card("alpha")).not.toBeNull();
    fireEvent.pointerLeave(card("alpha")!);
    advance(150);
    expect(card("alpha")).toBeNull();
  });

  it("never opens on pointer for coarse pointers (2.9)", () => {
    const { btn } = setup({ fine: false });
    fireEvent.pointerEnter(btn("alpha"));
    advance(1000);
    expect(anyCard()).toBeNull();
  });
});

describe("keyboard focus tooltip", () => {
  it("opens immediately as role=tooltip with aria-describedby and no focusable children (2.3)", () => {
    const { btn } = setup();
    act(() => btn("alpha").focus());
    const c = card("alpha")!;
    expect(c).not.toBeNull();
    expect(c.getAttribute("role")).toBe("tooltip");
    expect(btn("alpha").getAttribute("aria-describedby")).toBe(c.id);
    expect(
      c.querySelectorAll("a, button, input, select, textarea, [tabindex]").length,
    ).toBe(0);
  });

  it("closes on Escape (2.8)", () => {
    const { btn } = setup();
    act(() => btn("alpha").focus());
    expect(card("alpha")).not.toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(card("alpha")).toBeNull();
  });

  it("closes on blur (2.7)", () => {
    const { btn } = setup();
    act(() => btn("alpha").focus());
    act(() => btn("alpha").blur());
    expect(card("alpha")).toBeNull();
  });

  it("does not reopen on the focus-return after the panel closes (2.10)", () => {
    const { btn } = setup();
    act(() => actionsRef.suppressNextFocusOpen());
    act(() => btn("alpha").focus());
    expect(anyCard()).toBeNull();
    // Only the first focus is swallowed.
    act(() => btn("alpha").blur());
    act(() => btn("alpha").focus());
    expect(card("alpha")).not.toBeNull();
  });
});

describe("suppression and closeNow", () => {
  it("setSuppressed(true) closes an open card and blocks pointer and focus opens (2.11, 2.12)", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(250);
    expect(card("alpha")).not.toBeNull();
    act(() => actionsRef.setSuppressed(true));
    expect(anyCard()).toBeNull();

    fireEvent.pointerEnter(btn("beta"));
    advance(500);
    expect(anyCard()).toBeNull();
    act(() => btn("beta").focus());
    expect(anyCard()).toBeNull();

    act(() => btn("beta").blur());
    act(() => actionsRef.setSuppressed(false));
    fireEvent.pointerEnter(btn("beta"));
    advance(250);
    expect(card("beta")).not.toBeNull();
  });

  it("suppression arriving mid-dwell prevents the pending open", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(100);
    act(() => actionsRef.setSuppressed(true));
    advance(500);
    expect(anyCard()).toBeNull();
  });

  it("closeNow closes immediately", () => {
    const { btn } = setup();
    fireEvent.pointerEnter(btn("alpha"));
    advance(250);
    act(() => actionsRef.closeNow());
    expect(anyCard()).toBeNull();
  });
});

describe("content", () => {
  function open(repo: RepoRow, isFixture = false) {
    const utils = setup({ repos: [repo], isFixture });
    fireEvent.pointerEnter(utils.btn(repo.name));
    advance(250);
    return card(repo.name)!;
  }

  it("shows name, decay word, quiet phrase, description, language dot, stars and GitHub link (3.1-3.8)", () => {
    const c = open(makeRepo("alpha", { description: "A fine repo" }));
    const text = c.textContent ?? "";
    expect(text).toContain("alpha");
    expect(text).toContain("quiet for");
    expect(text).toContain("A fine repo");
    expect(text).toContain("TypeScript");
    expect(text).toContain("★ 42");
    const dot = c.querySelector<HTMLElement>('[data-testid="language-dot"]')!;
    expect(dot.style.backgroundColor).not.toBe("");
    const link = c.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://github.com/octocat/alpha");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders the description as plain text, not HTML (3.3)", () => {
    const c = open(makeRepo("alpha", { description: "<b>bold</b> <img src=x>" }));
    expect(c.textContent).toContain("<b>bold</b> <img src=x>");
    expect(c.querySelector("b")).toBeNull();
    expect(c.querySelector("img")).toBeNull();
  });

  it.each([null, "", "   "])(
    "shows 'No epitaph was written.' for description %j (3.4)",
    (description) => {
      const c = open(makeRepo("alpha", { description }));
      expect(c.textContent).toContain("No epitaph was written.");
    },
  );

  it("falls back to a color for languages without one and omits the language when null (3.5, 3.6)", () => {
    const c = open(
      makeRepo("alpha", { primaryLanguage: { name: "Brainfuck", color: null } }),
    );
    expect(c.textContent).toContain("Brainfuck");
    const dot = c.querySelector<HTMLElement>('[data-testid="language-dot"]')!;
    expect(dot).not.toBeNull();
    cleanup();
    const c2 = open(makeRepo("alpha", { primaryLanguage: null }));
    expect(c2.querySelector('[data-testid="language-dot"]')).toBeNull();
  });

  it("shows 'Sample repository' instead of the GitHub link for fixtures (12.4)", () => {
    const c = open(makeRepo("alpha"), true);
    expect(c.textContent).toContain("Sample repository");
    expect(c.querySelector("a")).toBeNull();
  });
});

describe("reduced motion (10.4)", () => {
  it("does not animate a positional slide when reduced motion is preferred", () => {
    const { btn } = setup({ reduced: true });
    act(() => btn("alpha").focus());
    const c = card("alpha")!;
    expect(c.style.transform).toBe("none");
    expect(c.style.transition).not.toContain("transform");
  });

  it("includes a transform transition otherwise", () => {
    const { btn } = setup({ reduced: false });
    act(() => btn("alpha").focus());
    expect(card("alpha")!.style.transition).toContain("transform");
  });
});
