/**
 * Tests for `useDiscovery`.
 *
 * Requirements: 7.7, 14.4, 14.5
 */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";

import { useDiscovery } from "@/components/world/useDiscovery";

interface FakeObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Set<Element>;
  disconnect: Mock<() => void>;
}

const observers: FakeObserver[] = [];

function installObserver() {
  observers.length = 0;
  class FakeIO {
    fake: FakeObserver;
    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.fake = { callback: cb, options, observed: new Set(), disconnect: vi.fn() };
      observers.push(this.fake);
    }
    observe(el: Element) {
      this.fake.observed.add(el);
    }
    unobserve(el: Element) {
      this.fake.observed.delete(el);
    }
    disconnect() {
      this.fake.disconnect();
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
}

function Harness({ reduced = false }: { reduced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDiscovery(ref, { reduced });
  return (
    <div ref={ref} data-testid="scroller">
      <ol>
        <li data-testid="a" data-reveal="">
          a
        </li>
        <li data-testid="b">b</li>
      </ol>
      <div data-testid="plain" data-reveal="">
        plain
      </div>
    </div>
  );
}

function entry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
  return { target, isIntersecting } as IntersectionObserverEntry;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useDiscovery", () => {
  it("creates one observer rooted at the scroller", () => {
    installObserver();
    const { getByTestId } = render(<Harness />);
    expect(observers).toHaveLength(1);
    expect(observers[0].options?.root).toBe(getByTestId("scroller"));
  });

  it("reveals once and toggles data-offscreen on list items", () => {
    installObserver();
    const { getByTestId } = render(<Harness />);
    const o = observers[0];
    const a = getByTestId("a");
    const b = getByTestId("b");
    const plain = getByTestId("plain");

    act(() => o.callback([entry(a, false), entry(b, false), entry(plain, false)], {} as IntersectionObserver));
    expect(a.getAttribute("data-offscreen")).toBe("true");
    expect(b.getAttribute("data-offscreen")).toBe("true");
    expect(a.hasAttribute("data-revealed")).toBe(false);

    act(() => o.callback([entry(a, true), entry(plain, true)], {} as IntersectionObserver));
    expect(a.getAttribute("data-offscreen")).toBe("false");
    expect(a.getAttribute("data-revealed")).toBe("true");
    expect(plain.getAttribute("data-revealed")).toBe("true");
    expect(o.observed.has(plain)).toBe(false);

    // Leaving and re-entering keeps the reveal and toggles offscreen again.
    act(() => o.callback([entry(a, false)], {} as IntersectionObserver));
    expect(a.getAttribute("data-offscreen")).toBe("true");
    expect(a.getAttribute("data-revealed")).toBe("true");
    act(() => o.callback([entry(a, true)], {} as IntersectionObserver));
    expect(a.getAttribute("data-offscreen")).toBe("false");
  });

  it("presets reveals and creates no observer under reduced motion", () => {
    installObserver();
    const { getByTestId } = render(<Harness reduced />);
    expect(observers).toHaveLength(0);
    expect(getByTestId("a").getAttribute("data-revealed")).toBe("true");
    expect(getByTestId("plain").getAttribute("data-revealed")).toBe("true");
  });

  it("presets reveals when IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { getByTestId } = render(<Harness />);
    expect(getByTestId("a").getAttribute("data-revealed")).toBe("true");
    expect(getByTestId("plain").getAttribute("data-revealed")).toBe("true");
  });

  it("disconnects on unmount", () => {
    installObserver();
    const { unmount } = render(<Harness />);
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
});
