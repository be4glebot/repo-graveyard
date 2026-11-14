/**
 * DOM test for WorldScroller / useWorldScroll (explorable-worlds task 5.4).
 * Requirements: 3.1, 3.2, 3.5, 3.8, 3.9, 3.10, 5.3, 5.4, 5.9, 6.13, 12.1, 12.4, 14.6, 13.1.
 */
import { Profiler, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { WorldScroller } from "@/components/world/WorldScroller";

const layout = {
  strata: [
    { id: "a", label: "A", top: 0, bottom: 1000, focal: { fx: 0.5, fy: 0.5 } },
    { id: "b", label: "B", top: 1000, bottom: 2000, focal: { fx: 0.5, fy: 0.5 } },
  ],
};

type Props = Partial<React.ComponentProps<typeof WorldScroller>>;

let frames: Array<FrameRequestCallback | null> = [];
function flushFrame(): void {
  const queued = frames;
  frames = [];
  act(() => {
    for (const cb of queued) cb?.(0);
  });
}

function Harness(props: Props & { onRender?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { onRender, ...rest } = props;
  return (
    <Profiler id="w" onRender={() => onRender?.()}>
      <div ref={rootRef} data-testid="root">
        <WorldScroller
          place="sky"
          layout={layout}
          activeFilter="all"
          plotIndex={0}
          rootRef={rootRef}
          {...rest}
        >
          <div style={{ height: 2000 }} />
        </WorldScroller>
      </div>
    </Profiler>
  );
}

function sizes(el: HTMLElement): void {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: 2000 });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 1000 });
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = null;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WorldScroller", () => {
  it("renders a focusable named region with the scroll classes", () => {
    render(<Harness />);
    const el = screen.getByRole("region", { name: "The Restless Sky" });
    expect(el.getAttribute("tabindex")).toBe("0");
    for (const c of ["overflow-y-auto", "overflow-x-clip", "overscroll-contain", "touch-pan-y"]) {
      expect(el.classList.contains(c)).toBe(true);
    }
    expect(el.className).not.toContain("overflow-hidden");
    expect(el.scrollTop).toBe(0);
  });

  it("restores the offset within 1 px after the panel closes", () => {
    const { rerender } = render(<Harness />);
    const el = screen.getByTestId("world-scroller");
    el.scrollTop = 640;
    rerender(<Harness panelOpen />);
    el.scrollTop = 0;
    rerender(<Harness panelOpen={false} />);
    expect(Math.abs(el.scrollTop - 640)).toBeLessThanOrEqual(1);
  });

  it("resets to 0 on filter or plot change", () => {
    const { rerender } = render(<Harness />);
    const el = screen.getByTestId("world-scroller");
    el.scrollTop = 500;
    rerender(<Harness activeFilter="turning" />);
    expect(el.scrollTop).toBe(0);
    el.scrollTop = 500;
    rerender(<Harness activeFilter="turning" plotIndex={1} />);
    expect(el.scrollTop).toBe(0);
  });

  it("writes the CSS variables once per frame, with zero React renders per scroll", () => {
    const renders = vi.fn();
    render(<Harness onRender={renders} />);
    const el = screen.getByTestId("world-scroller");
    sizes(el);
    flushFrame();
    const root = screen.getByTestId("root");
    const spy = vi.spyOn(root.style, "setProperty");
    const rect = vi.spyOn(el, "getBoundingClientRect");
    const before = renders.mock.calls.length;

    for (const top of [100, 200, 500]) {
      el.scrollTop = top;
      fireEvent.scroll(el);
    }
    expect(frames.filter(Boolean)).toHaveLength(1);
    flushFrame();

    const scrollWrites = spy.mock.calls.filter(([n]) => n === "--world-scroll");
    const depthWrites = spy.mock.calls.filter(([n]) => n === "--world-depth");
    expect(scrollWrites).toEqual([["--world-scroll", "500"]]);
    expect(depthWrites).toEqual([["--world-depth", "0.5"]]);
    expect(renders.mock.calls.length).toBe(before);
    expect(rect).not.toHaveBeenCalled();
  });

  it("pauses writes while travel is active and resumes afterwards", () => {
    const { rerender } = render(<Harness travel={{ active: true }} />);
    const el = screen.getByTestId("world-scroller");
    sizes(el);
    const root = screen.getByTestId("root");
    flushFrame();
    expect(root.style.getPropertyValue("--world-scroll")).toBe("");
    el.scrollTop = 300;
    fireEvent.scroll(el);
    flushFrame();
    expect(root.style.getPropertyValue("--world-scroll")).toBe("");
    rerender(<Harness travel={{ active: false }} />);
    flushFrame();
    expect(root.style.getPropertyValue("--world-scroll")).toBe("300");
  });

  it("registers only passive listeners", () => {
    const add = vi.spyOn(HTMLElement.prototype, "addEventListener");
    render(<Harness />);
    const el = screen.getByTestId("world-scroller");
    // React itself registers its own scroll listener on the container; only the
    // listeners attached to the scroller element belong to this component.
    const calls = add.mock.calls.filter(
      ([type], i) => type === "scroll" && add.mock.contexts[i] === el,
    );
    expect(calls.length).toBe(1);
    for (const [, , opts] of calls) {
      expect(opts).toMatchObject({ passive: true });
    }
    expect(
      add.mock.calls.some(
        ([t], i) => (t === "wheel" || t === "touchmove") && add.mock.contexts[i] === el,
      ),
    ).toBe(false);
    add.mockRestore();
  });
});
