/**
 * DOM test for hover card positioning (HoverCardLayer + HoverCardProvider).
 *
 * `@testing-library/jest-dom` is not installed, so plain DOM assertions are used.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import {
  HoverCardLayer,
  computeCardPosition,
} from "@/components/detail/HoverCardLayer";
import {
  HoverCardProvider,
  useHoverCardActions,
} from "@/components/detail/HoverCardProvider";
import { PARALLAX_FRAME_EVENT } from "@/components/scene/useParallax";
import type { RepoRow } from "@/lib/repoRow";

const CARD_W = 200;
const CARD_H = 100;
const NAME = "dusty-repo";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const row: RepoRow = {
  name: NAME,
  description: "A repo",
  url: "https://github.com/o/dusty-repo",
  homepageUrl: null,
  primaryLanguage: null,
  stargazerCount: 1,
  forkCount: 0,
  openIssueCount: 0,
  topics: [],
  pushedAt: "2020-01-01T00:00:00Z",
  createdAt: "2019-01-01T00:00:00Z",
  isArchived: false,
  isFork: false,
};

const rowsByName = new Map([[NAME, row]]);
const classificationsByName = new Map([
  [NAME, { state: "ghost" as const, decayLevel: 1 }],
]);

function Trigger() {
  const actions = useHoverCardActions();
  return (
    <button
      data-testid="anchor"
      onClick={(e) => actions.onFocus(NAME, e.currentTarget)}
    >
      anchor
    </button>
  );
}

let rect: Rect;
let rafQueue: FrameRequestCallback[];
const originalOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetWidth",
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);

function setViewport(w: number, h: number) {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
}

function flushRaf() {
  act(() => {
    const q = rafQueue;
    rafQueue = [];
    q.forEach((cb) => cb(0));
  });
}

function open(anchorRect: Rect) {
  rect = anchorRect;
  const utils = render(
    <HoverCardProvider>
      <Trigger />
      <HoverCardLayer
        rowsByName={rowsByName}
        owner="o"
        classificationsByName={classificationsByName}
        renderedAt="2024-01-01T00:00:00Z"
        isFixture={false}
      />
    </HoverCardProvider>,
  );
  const anchor = utils.getByTestId("anchor");
  anchor.getBoundingClientRect = () =>
    ({ ...rect, x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top, toJSON() {} }) as DOMRect;
  fireEvent.click(anchor);
  return utils;
}

function card(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`#hover-card-${NAME.replace(/-/g, "-")}`);
}

function pos() {
  const el = card()!;
  return { left: parseInt(el.style.left, 10), top: parseInt(el.style.top, 10) };
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
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => CARD_W,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => CARD_H,
  });
  setViewport(1000, 800);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  }
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  }
});

describe("computeCardPosition", () => {
  const a = { left: 400, top: 300, right: 440, bottom: 340 };

  it("places below the anchor with a 12px gap when it fits (4.1)", () => {
    expect(computeCardPosition(a, CARD_W, CARD_H, 1000, 800)).toEqual({
      left: 320,
      top: 352,
    });
  });

  it("flips above when below does not fit (4.2)", () => {
    const low = { left: 400, top: 650, right: 440, bottom: 690 };
    expect(computeCardPosition(low, CARD_W, CARD_H, 1000, 800)).toEqual({
      left: 320,
      top: 650 - 12 - CARD_H,
    });
  });

  it("flips to the right when neither below nor above fits (4.2)", () => {
    const tight = { left: 100, top: 50, right: 140, bottom: 90 };
    const p = computeCardPosition(tight, CARD_W, CARD_H, 1000, 150);
    expect(p.left).toBe(152);
  });

  it("flips to the left when right does not fit either (4.2)", () => {
    const tight = { left: 900, top: 50, right: 940, bottom: 90 };
    const p = computeCardPosition(tight, CARD_W, CARD_H, 1000, 150);
    expect(p.left).toBe(900 - 12 - CARD_W);
  });

  it("clamps into the viewport with an 8px margin when nothing fits (4.3)", () => {
    const tiny = { left: 50, top: 50, right: 90, bottom: 90 };
    const p = computeCardPosition(tiny, CARD_W, CARD_H, 150, 150);
    expect(p.left).toBe(8);
    expect(p.top).toBe(42);
  });
});

describe("HoverCardLayer positioning (DOM)", () => {
  it("anchors within 12px below the anchor (4.1)", () => {
    open({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(card()).not.toBeNull();
    const p = pos();
    expect(p.top - 340).toBe(12);
    expect(p.left).toBe(320);
  });

  it("flips above to stay in the viewport with the 8px margin (4.2)", () => {
    open({ left: 400, top: 650, right: 440, bottom: 690 });
    const p = pos();
    expect(p.top).toBe(650 - 12 - CARD_H);
    expect(p.top + CARD_H).toBeLessThanOrEqual(800 - 8);
  });

  it("flips right, then left (4.2)", () => {
    setViewport(1000, 150);
    open({ left: 100, top: 50, right: 140, bottom: 90 });
    expect(pos().left).toBe(152);
    cleanup();
    open({ left: 900, top: 50, right: 940, bottom: 90 });
    expect(pos().left).toBe(900 - 12 - CARD_W);
  });

  it("clamps when nothing fits (4.3)", () => {
    setViewport(150, 150);
    open({ left: 50, top: 50, right: 90, bottom: 90 });
    expect(pos()).toEqual({ left: 8, top: 42 });
  });

  it("renders above the lantern and fog via z-[60] (4.4)", () => {
    open({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(card()!.className.split(/\s+/)).toContain("z-[60]");
  });

  it.each([
    ["scroll", () => fireEvent.scroll(window)],
    ["resize", () => fireEvent(window, new Event("resize"))],
    [
      "parallax frame",
      () => window.dispatchEvent(new CustomEvent(PARALLAX_FRAME_EVENT)),
    ],
  ])("re-anchors within 12px when the anchor moves on %s", (_label, trigger) => {
    open({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(pos().top).toBe(352);

    // Move the anchor down so it must flip above.
    rect = { left: 400, top: 650, right: 440, bottom: 690 };
    act(() => {
      trigger();
    });
    flushRaf();
    expect(pos().top).toBe(650 - 12 - CARD_H);
    expect(650 - (pos().top + CARD_H)).toBe(12);
  });

  it("closes when the anchor moves fully off-screen", () => {
    open({ left: 400, top: 300, right: 440, bottom: 340 });
    expect(card()).not.toBeNull();

    rect = { left: 400, top: -200, right: 440, bottom: -160 };
    act(() => {
      window.dispatchEvent(new CustomEvent(PARALLAX_FRAME_EVENT));
    });
    flushRaf();
    expect(card()).toBeNull();
  });
});
