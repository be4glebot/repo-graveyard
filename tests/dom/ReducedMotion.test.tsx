/**
 * Reduced-motion DOM tests for the landing gate scene, the shell fog and the
 * edge-state pages (task 11.3).
 *
 * `matchMedia` is stubbed so "(prefers-reduced-motion: reduce)" matches. jsdom
 * does not evaluate CSS, so the checks are on the rendered DOM: listeners that
 * get attached, class names that start motion, and inline animation /
 * transition / transform styles. A counter-check shows the parallax listener
 * IS attached when reduced motion is off, so the negative assertions are not
 * vacuous.
 *
 * Note: `ThemedShell` is a server component and cannot read the media query,
 * so it keeps the `.fog-wisps` classes in the DOM and relies on the
 * `@media (prefers-reduced-motion: reduce)` rule in `app/globals.css` to
 * pause them. A source assertion below pins that rule.
 *
 * Requirements: 1.6, 7.10, 9.3
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/g/octocat",
  useRouter: () => ({ push: vi.fn() }),
}));

import GateScene from "@/components/landing/GateScene";
import ShellFog from "@/components/scene/ShellFog";
import SceneErrorState from "@/components/scene/SceneErrorState";
import EmptyGraveyard from "@/components/scene/EmptyGraveyard";
import GraveyardLoading from "@/components/scene/GraveyardLoading";
import NotFound from "@/app/not-found";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_QUERY = "(hover: hover) and (pointer: fine)";

function stubMedia(reduce: boolean, fine = true): void {
  vi.stubGlobal(
    "matchMedia",
    ((query: string): MediaQueryList =>
      ({
        matches:
          (query === REDUCE_QUERY && reduce) || (query === FINE_QUERY && fine),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof matchMedia,
  );
}

/**
 * Record pointermove / mousemove listener registrations made by component
 * code. React delegates every native event to its root container (a direct
 * child of body in RTL), so registrations on the container, body, document and
 * window are ignored; only listeners on elements inside the tree count.
 */
function spyPointerListeners() {
  const calls: string[] = [];
  const original = EventTarget.prototype.addEventListener;
  vi.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(
    function (this: EventTarget, type: string, ...rest: unknown[]) {
      const insideTree =
        this instanceof HTMLElement &&
        this !== document.body &&
        this.parentElement !== document.body;
      if ((type === "pointermove" || type === "mousemove") && insideTree) {
        calls.push(type);
      }
      return (original as (...a: unknown[]) => void).call(this, type, ...rest);
    } as typeof original,
  );
  return calls;
}

/** Every class token in the rendered tree. */
function classTokens(container: HTMLElement): string[] {
  const out: string[] = [];
  container.querySelectorAll("[class]").forEach((el) => {
    const cls = el.getAttribute("class");
    if (cls) out.push(...cls.split(/\s+/).filter(Boolean));
  });
  return out;
}

/** Tokens that start motion: animate-*, transition*, or a non-zero duration. */
function motionTokens(container: HTMLElement): string[] {
  return classTokens(container).filter((t) => {
    const base = t.split(":").pop() ?? t;
    if (t.includes("motion-reduce:")) return false;
    if (base === "animate-none" || base === "duration-0") return false;
    return (
      /^animate-/.test(base) ||
      /^transition(-|$)/.test(base) ||
      /^duration-/.test(base)
    );
  });
}

/** Elements whose inline style starts an animation or transition. */
function inlineMotion(container: HTMLElement): string[] {
  const found: string[] = [];
  container.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const s = el.style;
    if (s.animationName && s.animationName !== "none") found.push("animation");
    const dur = s.transitionDuration;
    if (dur && !/^(0s|0ms)(,\s*(0s|0ms))*$/.test(dur)) found.push("transition");
  });
  return found;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GateScene under Reduced_Motion", () => {
  it("attaches no pointer listener", () => {
    stubMedia(true);
    const calls = spyPointerListeners();
    render(
      <GateScene>
        <p>content</p>
      </GateScene>,
    );
    expect(calls).toEqual([]);
  });

  it("adds no animation classes or layer transforms and leaves layers at rest", () => {
    stubMedia(true);
    const { container, getByTestId } = render(
      <GateScene>
        <p>content</p>
      </GateScene>,
    );
    expect(getByTestId("gate-scene").getAttribute("data-reduced-motion")).toBe("true");
    expect(motionTokens(container)).toEqual([]);
    expect(classTokens(container)).not.toContain("fog-wisps");
    expect(classTokens(container)).not.toContain("fog-wisps-thin");
    for (const id of ["gate-layer-back", "gate-layer-mid", "gate-layer-front"]) {
      expect(getByTestId(id).style.transform).toBe("");
    }
    expect(inlineMotion(container)).toEqual([]);
  });

  it("counter-check: without reduced motion the pointer listener is attached and layers are offset", () => {
    stubMedia(false);
    const calls = spyPointerListeners();
    const { container, getByTestId } = render(
      <GateScene>
        <p>content</p>
      </GateScene>,
    );
    expect(calls).toContain("pointermove");
    expect(getByTestId("gate-scene").getAttribute("data-reduced-motion")).toBe("false");
    expect(getByTestId("gate-layer-back").style.transform).toContain("translate3d");
    expect(classTokens(container)).toContain("fog-wisps");
  });
});

describe("ShellFog under Reduced_Motion", () => {
  it("renders both layers without drift classes", () => {
    stubMedia(true);
    const { container, getByTestId } = render(<ShellFog reducedMotion />);
    expect(getByTestId("shell-fog-far")).toBeTruthy();
    expect(getByTestId("shell-fog-near")).toBeTruthy();
    const tokens = classTokens(container);
    expect(tokens).not.toContain("fog-wisps");
    expect(tokens).not.toContain("fog-wisps-thin");
    expect(motionTokens(container)).toEqual([]);
    expect(inlineMotion(container)).toEqual([]);
  });

  it("counter-check: drifts by default", () => {
    stubMedia(false);
    const { container } = render(<ShellFog />);
    expect(classTokens(container)).toContain("fog-wisps");
    expect(classTokens(container)).toContain("fog-wisps-thin");
  });

  it("globals.css pauses the fog drift under prefers-reduced-motion", () => {
    const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.fog-wisps,\s*\.fog-wisps-thin\s*\{[^}]*animation-play-state:\s*paused/,
    );
  });
});

describe("edge-state components under Reduced_Motion", () => {
  const cases: Array<[string, () => React.JSX.Element]> = [
    ["SceneErrorState not-found", () => <SceneErrorState kind="not-found" />],
    ["SceneErrorState rate-limited", () => <SceneErrorState kind="rate-limited" resetInMinutes={5} />],
    ["SceneErrorState server-error", () => <SceneErrorState kind="server-error" />],
    ["EmptyGraveyard", () => <EmptyGraveyard username="octocat" />],
    ["GraveyardLoading", () => <GraveyardLoading />],
    ["app not-found", () => <NotFound />],
  ];

  it.each(cases)("%s has no animate-*, transition or non-zero duration", (_name, make) => {
    stubMedia(true);
    const { container } = render(make());
    expect(motionTokens(container)).toEqual([]);
    expect(inlineMotion(container)).toEqual([]);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it.each(cases)("%s attaches no pointer listener", (_name, make) => {
    stubMedia(true);
    const calls = spyPointerListeners();
    render(make());
    expect(calls).toEqual([]);
  });
});
