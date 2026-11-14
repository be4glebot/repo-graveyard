/**
 * DOM test: scrolling never navigates; tap versus scroll guard (explorable-worlds task 5.5).
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 4.9, 13.3, 13.8, 13.9, 17.10.
 */
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorldScroller } from "@/components/world/WorldScroller";
import { useScrollForward } from "@/components/world/useScrollForward";

const layout = {
  strata: [{ id: "a", label: "A", top: 0, bottom: 1000, focal: { fx: 0.5, fy: 0.5 } }],
};

interface Handlers {
  onEnterPlace: () => void;
  onReturn: () => void;
  onSelect: () => void;
}

function makeHandlers(): Handlers {
  return { onEnterPlace: vi.fn(), onReturn: vi.fn(), onSelect: vi.fn() };
}

function Harness({ h }: { h: Handlers }) {
  return (
    <div>
      <button onClick={h.onReturn}>return</button>
      <WorldScroller place="sky" layout={layout} activeFilter="all" plotIndex={0}>
        <button onClick={h.onSelect}>creature</button>
        <button onClick={h.onEnterPlace}>enter</button>
      </WorldScroller>
    </div>
  );
}

function pointer(
  type: "pointerdown" | "pointermove" | "pointerup",
  el: Element,
  x: number,
  y: number,
  pointerType: "mouse" | "touch" = "mouse",
): void {
  const ev = new Event(type, { bubbles: true });
  Object.defineProperty(ev, "clientX", { value: x });
  Object.defineProperty(ev, "clientY", { value: y });
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  fireEvent(el, ev);
}

function expectNoCalls(h: Handlers): void {
  expect(h.onEnterPlace).not.toHaveBeenCalled();
  expect(h.onReturn).not.toHaveBeenCalled();
  expect(h.onSelect).not.toHaveBeenCalled();
}

afterEach(() => cleanup());

describe("world scrolling never navigates", () => {
  it("wheel, touchmove, scroll and Escape call no navigation handler", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const scroller = screen.getByTestId("world-scroller");
    fireEvent.wheel(scroller, { deltaY: 400 });
    fireEvent.touchMove(scroller);
    fireEvent.scroll(scroller);
    fireEvent.keyDown(scroller, { key: "Escape" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expectNoCalls(h);
  });

  it("a 9 px drag then click does not activate", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const btn = screen.getByText("creature");
    pointer("pointerdown", btn, 100, 100);
    pointer("pointermove", btn, 100, 109);
    pointer("pointerup", btn, 100, 109);
    fireEvent.click(btn, { detail: 1 });
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it("an 8 px tap activates once", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const btn = screen.getByText("creature");
    pointer("pointerdown", btn, 100, 100);
    pointer("pointermove", btn, 100, 108);
    pointer("pointerup", btn, 100, 108);
    fireEvent.click(btn, { detail: 1 });
    expect(h.onSelect).toHaveBeenCalledTimes(1);
  });

  // Task 20.4 (defect 6): this case used to assert that ANY pointer click within
  // 120 ms of a scroll was swallowed. That made a mouse click right after a wheel
  // scroll do nothing while Enter worked. A mouse wheel is not a drag (Req 4.3/4.4),
  // so mouse clicks are no longer swallowed by scroll momentum.
  it("a mouse click right after a scroll still activates", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const btn = screen.getByText("enter");
    fireEvent.scroll(screen.getByTestId("world-scroller"));
    pointer("pointerdown", btn, 100, 100);
    pointer("pointerup", btn, 100, 100);
    fireEvent.click(btn, { detail: 1 });
    expect(h.onEnterPlace).toHaveBeenCalledTimes(1);
  });

  it("a click with no seen pointerdown right after a scroll activates", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    fireEvent.scroll(screen.getByTestId("world-scroller"));
    fireEvent.click(screen.getByText("enter"), { detail: 1 });
    expect(h.onEnterPlace).toHaveBeenCalledTimes(1);
  });

  it("a touch tap during scroll momentum is suppressed", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const btn = screen.getByText("creature");
    fireEvent.scroll(screen.getByTestId("world-scroller"));
    pointer("pointerdown", btn, 100, 100, "touch");
    pointer("pointerup", btn, 100, 100, "touch");
    fireEvent.click(btn, { detail: 1 });
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it("a touch tap after the scroll has settled activates", () => {
    const h = makeHandlers();
    const nowSpy = vi.spyOn(performance, "now");
    try {
      nowSpy.mockReturnValue(1000);
      render(<Harness h={h} />);
      const btn = screen.getByText("creature");
      fireEvent.scroll(screen.getByTestId("world-scroller"));
      nowSpy.mockReturnValue(1500);
      pointer("pointerdown", btn, 100, 100, "touch");
      pointer("pointerup", btn, 100, 100, "touch");
      fireEvent.click(btn, { detail: 1 });
      expect(h.onSelect).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("a scroll that starts during a touch suppresses that touch's click", () => {
    const h = makeHandlers();
    const nowSpy = vi.spyOn(performance, "now");
    try {
      nowSpy.mockReturnValue(1000);
      render(<Harness h={h} />);
      const btn = screen.getByText("creature");
      pointer("pointerdown", btn, 100, 100, "touch");
      nowSpy.mockReturnValue(1300);
      fireEvent.scroll(screen.getByTestId("world-scroller"));
      pointer("pointerup", btn, 100, 100, "touch");
      fireEvent.click(btn, { detail: 1 });
      expect(h.onSelect).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("a 9 px touch drag is suppressed and an 8 px touch tap activates", () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const btn = screen.getByText("creature");
    pointer("pointerdown", btn, 100, 100, "touch");
    pointer("pointermove", btn, 100, 109, "touch");
    pointer("pointerup", btn, 100, 109, "touch");
    fireEvent.click(btn, { detail: 1 });
    expect(h.onSelect).not.toHaveBeenCalled();
    pointer("pointerdown", btn, 100, 100, "touch");
    pointer("pointermove", btn, 100, 108, "touch");
    pointer("pointerup", btn, 100, 108, "touch");
    fireEvent.click(btn, { detail: 1 });
    expect(h.onSelect).toHaveBeenCalledTimes(1);
  });

  it("keyboard Enter and Space activate once each, even right after a scroll", async () => {
    const h = makeHandlers();
    render(<Harness h={h} />);
    const user = userEvent.setup();
    const btn = screen.getByText("creature");
    fireEvent.scroll(screen.getByTestId("world-scroller"));
    btn.focus();
    await user.keyboard("{Enter}");
    expect(h.onSelect).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(h.onSelect).toHaveBeenCalledTimes(2);
  });
});

describe("chip-row forwarding", () => {
  function Chips({ scroller }: { scroller: { scrollBy: (o: ScrollToOptions) => void } }) {
    const rowRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef(scroller as unknown as HTMLElement);
    useScrollForward(rowRef, scrollerRef);
    return <div ref={rowRef} data-testid="chips" />;
  }

  it("forwards a vertical drag as scrollBy and ignores a horizontal one", () => {
    const scrollBy = vi.fn();
    render(<Chips scroller={{ scrollBy }} />);
    const row = screen.getByTestId("chips");
    pointer("pointerdown", row, 100, 100);
    pointer("pointermove", row, 140, 104);
    expect(scrollBy).not.toHaveBeenCalled();
    pointer("pointerup", row, 140, 104);
    pointer("pointerdown", row, 100, 100);
    pointer("pointermove", row, 100, 70);
    expect(scrollBy).toHaveBeenCalledWith({ top: 30 });
  });
});
