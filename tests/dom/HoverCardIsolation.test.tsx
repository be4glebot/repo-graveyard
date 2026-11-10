/**
 * Hover-card isolation (task 9.6).
 *
 * Opening or closing a Hover_Card must not re-render the creature layer. The
 * concrete `Ghost` component is replaced with a render-counting stand-in; the
 * provider, `DepthScatter`, and `HoverCardLayer` are the real ones. The count
 * must be unchanged across a focus-open and blur-close, while the card itself
 * does appear and disappear (so the test is not vacuous).
 *
 * Plain DOM assertions (no jest-dom).
 *
 * **Validates: Requirements 2.13**
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const counter = vi.hoisted(() => ({ renders: 0 }));

vi.mock("@/components/creatures/Ghost", () => ({
  default: function MockGhost(props: {
    row: { name: string };
    onFocusStart?: (name: string, anchor: HTMLElement) => void;
    onBlurEnd?: (name: string) => void;
    hoverCardId?: string;
  }) {
    counter.renders += 1;
    return (
      <button
        type="button"
        data-testid="mock-ghost"
        aria-describedby={props.hoverCardId}
        onFocus={(e) => props.onFocusStart?.(props.row.name, e.currentTarget)}
        onBlur={() => props.onBlurEnd?.(props.row.name)}
      >
        {props.row.name}
      </button>
    );
  },
}));

import DepthScatter from "@/components/scene/DepthScatter";
import HoverCardLayer, { hoverCardId } from "@/components/detail/HoverCardLayer";
import { HoverCardProvider } from "@/components/detail/HoverCardProvider";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { RepoRow } from "@/lib/repoRow";

const NAME = "ghost-a";

const row: GraveyardRow = {
  name: NAME,
  url: `https://github.com/octocat/${NAME}`,
  state: "ghost",
  daysQuiet: 3,
  decayLevel: 0,
};

const repoRow: RepoRow = {
  name: NAME,
  description: "A quiet little ghost.",
  url: row.url,
  homepageUrl: null,
  primaryLanguage: { name: "TypeScript", color: "#3178c6" },
  stargazerCount: 7,
  forkCount: 0,
  openIssueCount: 0,
  topics: [],
  pushedAt: "2025-05-01T00:00:00Z",
  createdAt: "2020-01-01T00:00:00Z",
  isArchived: false,
  isFork: false,
};

const originalRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  counter.renders = 0;
  // jsdom has no layout; give anchors an on-screen rect so the card stays open.
  Element.prototype.getBoundingClientRect = function () {
    return {
      left: 100,
      top: 100,
      right: 160,
      bottom: 160,
      width: 60,
      height: 60,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  cleanup();
});

describe("Hover card isolation (Req 2.13)", () => {
  it("does not re-render the creature layer when a card opens or closes", () => {
    const rowsByName = new Map([[NAME, repoRow]]);
    const classificationsByName = new Map([
      [NAME, { state: "ghost" as const, decayLevel: 0 }],
    ]);

    render(
      <HoverCardProvider>
        <DepthScatter
          place="sky"
          plot={[row]}
          selectedName={null}
          onSelect={() => {}}
          reducedMotion={true}
        />
        <HoverCardLayer
          rowsByName={rowsByName}
          owner="octocat"
          classificationsByName={classificationsByName}
          renderedAt="2025-06-01T00:00:00Z"
          isFixture={false}
        />
      </HoverCardProvider>,
    );

    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="mock-ghost"]',
    );
    expect(button).not.toBeNull();
    const before = counter.renders;
    expect(before).toBeGreaterThan(0);
    expect(document.getElementById(hoverCardId(NAME))).toBeNull();

    // Open (keyboard focus opens immediately).
    act(() => {
      button!.focus();
    });
    expect(document.getElementById(hoverCardId(NAME))).not.toBeNull();
    expect(counter.renders).toBe(before);

    // Close.
    act(() => {
      button!.blur();
    });
    expect(document.getElementById(hoverCardId(NAME))).toBeNull();
    expect(counter.renders).toBe(before);
  });
});
