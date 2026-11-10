/**
 * Bug condition exploration (scene-layout-clickability, task 1, test (b)).
 *
 * jsdom has no layout engine, so this test stubs geometry:
 *   - the scatter box reports a 1392x900 client box (1440x900 viewport minus px-6),
 *   - creature rects are derived from each creature wrapper's inline feet
 *     position and its inner `scale(...)` transform (140px art box),
 *   - chrome wrappers get fixed rects (header height 112px),
 *   - `hitTest` mimics `elementFromPoint`: highest z-index among elements whose
 *     rect contains the point and whose effective pointer-events is not `none`
 *     (read from the `pointer-events-none` / `pointer-events-auto` classes,
 *     inherited from the nearest ancestor, since Tailwind CSS is not loaded).
 *
 * EXPECTED TO FAIL on unfixed code: the hit at a creature centre is a chrome
 * wrapper (`place-title-block` / `place-chrome`), not the creature.
 *
 * Limitation: chrome child controls (Return, chips, pager buttons) have no
 * stubbed rects, so only the wrapper rects are hit-tested.
 *
 * **Validates: Requirements 1.1, 2.1**
 */
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import PlaceView from "@/components/scene/PlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { CREATURE_BASE_SIZE } from "@/lib/estate-view";

const SCENE_W = 1392;
const SCENE_H = 900;
const SCENE_LEFT = 24; // px-6 inside the 1440 viewport
const HEADER_H = 112;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

let clientWidthDesc: PropertyDescriptor | undefined;
let clientHeightDesc: PropertyDescriptor | undefined;

beforeAll(() => {
  clientWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  clientHeightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === "depth-scatter" ? SCENE_W : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === "depth-scatter" ? SCENE_H : 0;
    },
  });
});

afterAll(() => {
  if (clientWidthDesc) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDesc);
  if (clientHeightDesc) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDesc);
});

afterEach(() => cleanup());

function ghosts(names: string[]): GraveyardRow[] {
  return names.map((name) => ({
    name,
    url: `https://github.com/octocat/${name}`,
    state: "ghost",
    daysQuiet: 5,
    decayLevel: 0,
  }));
}

/** Effective pointer-events: nearest ancestor-or-self carrying a pe class. */
function pointerEventsOf(el: Element, root: Element): "none" | "auto" {
  for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) {
    if (n.classList.contains("pointer-events-none")) return "none";
    if (n.classList.contains("pointer-events-auto")) return "auto";
  }
  return "auto";
}

function zOf(el: Element): number {
  for (const c of Array.from(el.classList)) {
    const m = /^z-(?:\[(\d+)\]|(\d+))$/.exec(c);
    if (m) return Number(m[1] ?? m[2]);
  }
  return 0;
}

/** Stubbed rect for the elements the test can place; null otherwise. */
function rectOf(el: Element): Box | null {
  const testid = el.getAttribute("data-testid");
  if (testid === "place-title-block") {
    return { left: 0, top: HEADER_H, right: 1440, bottom: HEADER_H + 150 };
  }
  if (testid === "place-chrome") {
    return { left: 0, top: HEADER_H, right: 160, bottom: HEADER_H + 80 };
  }
  if (el.className.toString().includes("bottom-16") && el.className.toString().includes("inset-x-0")) {
    return { left: 0, top: SCENE_H - 64 - 48, right: 1440, bottom: SCENE_H - 64 };
  }
  if (el.tagName === "BUTTON" && el.closest('[data-testid="scatter-creature"]')) {
    const wrapper = el.closest<HTMLElement>('[data-testid="scatter-creature"]')!;
    const inner = wrapper.querySelector<HTMLElement>(".pointer-events-auto");
    const scale = Number(/scale\(([\d.]+)\)/.exec(inner?.style.transform ?? "")?.[1] ?? 1);
    const h = CREATURE_BASE_SIZE * scale;
    const feetX = (parseFloat(wrapper.style.left) / 100) * SCENE_W + SCENE_LEFT;
    const feetY = (parseFloat(wrapper.style.top) / 100) * SCENE_H;
    return { left: feetX - h / 2, right: feetX + h / 2, top: feetY - h, bottom: feetY };
  }
  return null;
}

function hitTest(root: Element, x: number, y: number): Element | null {
  let best: { el: Element; z: number } | null = null;
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const r = rectOf(el);
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    if (pointerEventsOf(el, root) === "none") continue;
    // Creature buttons live in the z-20 band; chrome wrappers carry their own z.
    const z = el.tagName === "BUTTON" ? 20 : zOf(el);
    if (!best || z > best.z) best = { el, z };
  }
  return best?.el ?? null;
}

/** Renders sky with the given ghosts; returns a description of each creature the hit test misses. */
function missesFor(names: string[]): string[] {
  const { container, unmount } = render(
    <PlaceView
      place="sky"
      rows={ghosts(names)}
      activeFilter="all"
      plotIndex={0}
      selectedName={null}
      onFilterChange={vi.fn()}
      onPlotChange={vi.fn()}
      onSelect={vi.fn()}
      onReturn={vi.fn()}
    />,
  );
  const root = container.firstElementChild as Element;
  const wrappers = Array.from(
    root.querySelectorAll<HTMLElement>('[data-testid="scatter-creature"]'),
  );
  const misses: string[] = [];
  for (const w of wrappers) {
    const r = rectOf(w.querySelector("button")!)!;
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const hit = hitTest(root, cx, cy);
    const hitCreature = hit?.closest<HTMLElement>('[data-testid="scatter-creature"]');
    if (hitCreature?.dataset.name !== w.dataset.name) {
      misses.push(
        `${w.dataset.name} @ (${Math.round(cx)},${Math.round(cy)}) -> ${
          hit?.getAttribute("data-testid") ?? hit?.tagName ?? "nothing"
        }`,
      );
    }
  }
  unmount();
  return misses;
}

describe("Bug condition: creature hit test at 1440x900 (Restless Sky, 3 ghosts)", () => {
  it("(b) elementFromPoint at each creature centre returns that creature", () => {
    // Scoped to the concrete failing case plus a sweep of 3-ghost name sets
    // (creature jitter is seeded per name, so back-row heights vary).
    const nameSets = [
      ["repo-graveyard", "second-ghost", "third-ghost"],
      ["repo-graveyard", "dotfiles", "blog"],
      ["alpha", "beta", "gamma"],
      ["zeta", "eta", "theta"],
      ["a-repo", "b-repo", "c-repo"],
      ["one", "two", "three"],
    ];
    const misses = nameSets.flatMap((names) => missesFor(names));
    expect(misses).toEqual([]);
  });
});
