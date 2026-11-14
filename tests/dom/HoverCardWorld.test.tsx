/**
 * Hover card inside an explorable world: the card follows its anchor while the
 * World_Scroller scrolls (capture-phase scroll listener on window, one frame
 * later) and closes when the anchor leaves the screen. `HoverCardLayer` is
 * used unchanged. The creature tag never changes the button's box.
 *
 * Requirements: 5.8, 10.3, 10.4, 11.10, 12.8
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HoverCardLayer, hoverCardId } from "@/components/detail/HoverCardLayer";
import { HoverCardProvider } from "@/components/detail/HoverCardProvider";
import WorldPlaceView from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { RepoRow } from "@/lib/repoRow";

const CARD_W = 200;
const CARD_H = 100;

const rows: GraveyardRow[] = Array.from({ length: 4 }, (_, i) => ({
  name: `sky-repo-${i}`,
  url: `https://github.com/octocat/sky-repo-${i}`,
  state: "ghost",
  daysQuiet: 10 + i,
  decayLevel: i % 4,
}));
const NAME = rows[0].name;

const repoRows = new Map<string, RepoRow>(
  rows.map((r) => [
    r.name,
    {
      name: r.name,
      description: "A repo",
      url: r.url,
      homepageUrl: null,
      primaryLanguage: null,
      stargazerCount: 1,
      forkCount: 0,
      openIssueCount: 0,
      topics: [],
      pushedAt: "2024-01-01T00:00:00Z",
      createdAt: "2023-01-01T00:00:00Z",
      isArchived: false,
      isFork: false,
    },
  ]),
);
const classifications = new Map(
  rows.map((r) => [r.name, { state: "ghost" as const, decayLevel: r.decayLevel }]),
);

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
let rect: Rect;
let rafQueue: FrameRequestCallback[];

const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

function flushRaf(): void {
  act(() => {
    for (let pass = 0; pass < 3; pass++) {
      const q = rafQueue;
      rafQueue = [];
      q.forEach((cb) => cb(0));
    }
  });
}

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(window, "requestAnimationFrame", {
    value: globalThis.requestAnimationFrame,
    configurable: true,
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    value: globalThis.cancelAnimationFrame,
    configurable: true,
  });
  vi.stubGlobal("matchMedia", ((query: string) => ({
    matches: query === "(hover: hover) and (pointer: fine)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia);
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => CARD_W,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => CARD_H,
  });
  Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
});

function openCard(anchorRect: Rect): HTMLButtonElement {
  rect = anchorRect;
  render(
    <HoverCardProvider>
      <WorldPlaceView
        place="sky"
        rows={rows}
        activeFilter="all"
        plotIndex={0}
        selectedName={null}
        onFilterChange={() => {}}
        onPlotChange={() => {}}
        onSelect={() => {}}
        onReturn={() => {}}
      />
      <HoverCardLayer
        rowsByName={repoRows}
        owner="octocat"
        classificationsByName={classifications}
        renderedAt="2024-06-01T00:00:00Z"
        isFixture={false}
      />
    </HoverCardProvider>,
  );
  const button = screen
    .getAllByTestId("scatter-creature")
    .find((li) => li.getAttribute("data-name") === NAME)!
    .querySelector("button")!;
  button.getBoundingClientRect = () =>
    ({ ...rect, x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top, toJSON() {} }) as DOMRect;
  act(() => button.focus());
  flushRaf();
  return button;
}

function card(): HTMLElement | null {
  return document.getElementById(hoverCardId(NAME));
}

describe("HoverCardLayer inside a world", () => {
  it("opens below the focused creature", () => {
    openCard({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(card()).not.toBeNull();
    expect(parseInt(card()!.style.top, 10)).toBe(352);
  });

  it("repositions one frame after the World_Scroller scrolls", () => {
    openCard({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(parseInt(card()!.style.top, 10)).toBe(352);

    // Anchor moves down with the scroll: below no longer fits, so it flips above.
    rect = { left: 400, top: 650, right: 440, bottom: 690 };
    act(() => {
      fireEvent.scroll(screen.getByTestId("world-scroller"));
    });
    // Not applied until the next frame.
    expect(parseInt(card()!.style.top, 10)).toBe(352);
    flushRaf();
    expect(parseInt(card()!.style.top, 10)).toBe(650 - 12 - CARD_H);
  });

  it("closes after the World_Scroller scrolls the anchor off screen", () => {
    openCard({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(card()).not.toBeNull();

    rect = { left: 400, top: -200, right: 440, bottom: -160 };
    act(() => {
      fireEvent.scroll(screen.getByTestId("world-scroller"));
    });
    flushRaf();
    expect(card()).toBeNull();
  });

  it("stays open when a scroll leaves the anchor on screen", () => {
    openCard({ left: 400, top: 300, right: 440, bottom: 340 });
    act(() => {
      fireEvent.scroll(screen.getByTestId("world-scroller"));
    });
    flushRaf();
    expect(card()).not.toBeNull();
  });
});

describe("CreatureTag inside a world creature", () => {
  it("is mounted in the button as an absolute, aria-hidden overlay that adds no flow box", () => {
    const button = openCard({ left: 400, top: 300, right: 440, bottom: 340 });
    const before = button.getBoundingClientRect();
    const tag = button.querySelector<HTMLElement>("[data-testid='scatter-plaque']")!;
    expect(tag).not.toBeNull();
    expect(tag.getAttribute("aria-hidden")).toBe("true");
    expect(tag.className.split(/\s+/)).toContain("absolute");

    // Removing the tag leaves the anchor rect (the one the card follows) as is.
    tag.remove();
    const after = button.getBoundingClientRect();
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    expect(after.left).toBe(before.left);
    expect(after.top).toBe(before.top);
  });
});
