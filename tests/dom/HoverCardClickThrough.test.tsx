/**
 * Regression (task 20.4, defect 6): a hover card is a preview. A pointer click on
 * its body over another creature activates that creature; the card's link keeps
 * working; keyboard-origin clicks are ignored.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { forwardClickToCreatureBeneath } from "@/components/detail/HoverCardLayer";
import { shouldSwallowClick } from "@/components/world/useScrollGuard";

afterEach(() => {
  cleanup();
  // @ts-expect-error test cleanup of the jsdom stub
  delete document.elementsFromPoint;
});

function setup() {
  const onNeighbour = vi.fn();
  render(
    <div>
      <button aria-pressed={false} onClick={onNeighbour}>
        neighbour
      </button>
      <div data-testid="card" onClick={forwardClickToCreatureBeneath}>
        <p>preview text</p>
        <a href="#x">Open on GitHub</a>
      </div>
    </div>,
  );
  const neighbour = screen.getByText("neighbour");
  document.elementsFromPoint = () => [screen.getByTestId("card"), neighbour];
  return { onNeighbour };
}

describe("hover card click-through", () => {
  it("a mouse click on the card body activates the creature beneath", () => {
    const { onNeighbour } = setup();
    fireEvent.click(screen.getByText("preview text"), { detail: 1 });
    expect(onNeighbour).toHaveBeenCalledTimes(1);
  });

  it("a click on the card link does not forward", () => {
    const { onNeighbour } = setup();
    fireEvent.click(screen.getByText("Open on GitHub"), { detail: 1 });
    expect(onNeighbour).not.toHaveBeenCalled();
  });

  it("a keyboard-origin click is not forwarded", () => {
    const { onNeighbour } = setup();
    fireEvent.click(screen.getByText("preview text"), { detail: 0 });
    expect(onNeighbour).not.toHaveBeenCalled();
  });
});

describe("shouldSwallowClick", () => {
  const base = { pointerType: "mouse", moved: false, downAt: 1000, lastScroll: 990 };
  it("never swallows a mouse click on momentum alone", () => {
    expect(shouldSwallowClick(base)).toBe(false);
    expect(shouldSwallowClick({ ...base, pointerType: "pen" })).toBe(false);
    expect(shouldSwallowClick({ ...base, pointerType: "" })).toBe(false);
  });
  it("always swallows a real drag", () => {
    expect(shouldSwallowClick({ ...base, moved: true })).toBe(true);
    expect(shouldSwallowClick({ ...base, pointerType: "touch", moved: true, lastScroll: -Infinity })).toBe(true);
  });
  it("swallows touch only during momentum or a scroll during the touch", () => {
    const t = { ...base, pointerType: "touch" };
    expect(shouldSwallowClick(t)).toBe(true);
    expect(shouldSwallowClick({ ...t, lastScroll: 1050 })).toBe(true);
    expect(shouldSwallowClick({ ...t, lastScroll: 500 })).toBe(false);
    expect(shouldSwallowClick({ ...t, lastScroll: -Infinity })).toBe(false);
  });
});
