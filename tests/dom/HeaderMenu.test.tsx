/**
 * DOM tests for the compact-header Menu_Disclosure and `useHeaderHeightVar`.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.12, 9.6
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import Header from "@/components/ui/Header";
import {
  HEADER_HEIGHT_VAR,
  useHeaderHeightVar,
} from "@/components/scene/useHeaderHeightVar";

const COMPACT_QUERY = "(max-width: 767px)";

/** Controllable matchMedia: flips `compact` and notifies subscribers. */
function stubCompactMedia(initialCompact: boolean) {
  let compact = initialCompact;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === COMPACT_QUERY ? compact : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      compact = next;
      act(() => listeners.forEach((cb) => cb()));
    },
  };
}

function renderHeader() {
  return render(
    <Header
      counts={{ souls: 1, ghost: 1, risen: 0, zombie: 0, tombstone: 0, coffin: 0 }}
      username="octocat"
      lightsOn={false}
      onLightsOnChange={() => {}}
      soundOn={false}
      onSoundChange={() => {}}
    />,
  );
}

const menuButton = () => screen.getByRole("button", { name: "Menu" });
const panel = () =>
  document.getElementById(menuButton().getAttribute("aria-controls")!)!;
const input = () => screen.getByPlaceholderText("Visit another graveyard");

beforeEach(() => {
  stubCompactMedia(true);
});

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR);
});

describe("Menu_Disclosure (4.2-4.10)", () => {
  it("starts closed with aria-expanded=false and aria-controls pointing at the panel (4.4, 4.5)", () => {
    renderHeader();
    const button = menuButton();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const id = button.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
  });

  it("toggles open and closed on click (4.5, 4.6)", () => {
    renderHeader();
    fireEvent.click(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the lifecycle legend inside the menu panel, compact-only (own testid)", () => {
    renderHeader();
    const legend = screen.getByTestId("menu-legend");
    expect(panel().contains(legend)).toBe(true);
    expect(legend.className).toContain("min-[768px]:hidden");
    expect(legend.querySelectorAll("[data-legend-place]").length).toBe(4);
  });

  it("hides the footer legend below 768px but keeps its testid", async () => {
    const { default: Footer } = await import("@/components/scene/Footer");
    render(<Footer mode="live" />);
    const legend = screen.getByTestId("scene-footer-legend");
    expect(legend.className).toContain("max-[767px]:hidden");
  });

  it("has a 44px touch target (4.2)", () => {
    renderHeader();
    expect(menuButton().className).toContain("min-h-11");
    expect(menuButton().className).toContain("min-w-11");
  });

  it("holds the visit form, Lights and Sound controls inside the panel only (4.3)", () => {
    renderHeader();
    const p = panel();
    expect(p.contains(input())).toBe(true);
    expect(p.contains(screen.getByRole("button", { name: "Visit" }))).toBe(true);
    const toggles = screen.getAllByTestId("styled-toggle");
    expect(toggles).toHaveLength(2);
    for (const t of toggles) expect(p.contains(t)).toBe(true);
    expect(p.contains(menuButton())).toBe(false);
  });

  it("Escape closes the panel and focuses the Menu button (4.7)", () => {
    renderHeader();
    fireEvent.click(menuButton());
    input().focus();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menuButton());
  });

  it("a valid submit navigates and closes the panel (4.8)", () => {
    renderHeader();
    fireEvent.click(menuButton());
    fireEvent.change(input(), { target: { value: "torvalds" } });
    fireEvent.submit(input().closest("form")!);
    expect(push).toHaveBeenCalledWith("/g/torvalds");
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("a rejected submit keeps the panel open and the text (4.9)", () => {
    renderHeader();
    fireEvent.click(menuButton());
    fireEvent.change(input(), { target: { value: "not valid!" } });
    fireEvent.submit(input().closest("form")!);
    expect(push).not.toHaveBeenCalled();
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    expect((input() as HTMLInputElement).value).toBe("not valid!");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("widening from compact to wide closes an open panel (4.10)", () => {
    const media = stubCompactMedia(true);
    renderHeader();
    fireEvent.click(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    media.set(false);
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("useHeaderHeightVar (4.12, 9.6)", () => {
  type RO = {
    cb: ResizeObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let observers: RO[];

  beforeEach(() => {
    observers = [];
    class StubRO {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      constructor(cb: ResizeObserverCallback) {
        observers.push({ cb, observe: this.observe, disconnect: this.disconnect });
      }
    }
    vi.stubGlobal("ResizeObserver", StubRO);
  });

  function makeHeader(height: number) {
    const el = document.createElement("header");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      height,
    } as DOMRect);
    return el;
  }

  it("writes the measured height on the root while compact and updates on resize", () => {
    const root = document.createElement("div");
    const header = makeHeader(100.2);
    renderHook(() =>
      useHeaderHeightVar({ current: header }, true, { current: root }),
    );
    expect(root.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("101px");
    expect(observers[0].observe).toHaveBeenCalledWith(header);

    act(() =>
      observers[0].cb(
        [{ borderBoxSize: [{ blockSize: 180, inlineSize: 300 }] }] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      ),
    );
    expect(root.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("180px");
  });

  it("removes the variable when not compact and on unmount", () => {
    const root = document.createElement("div");
    const header = makeHeader(90);
    const { rerender, unmount } = renderHook(
      ({ compact }) =>
        useHeaderHeightVar({ current: header }, compact, { current: root }),
      { initialProps: { compact: true } },
    );
    expect(root.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("90px");
    rerender({ compact: false });
    expect(root.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("");
    rerender({ compact: true });
    expect(root.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("90px");
    unmount();
    expect(root.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("");
    expect(observers.at(-1)!.disconnect).toHaveBeenCalled();
  });

  it("falls back to the document element when no root ref is given", () => {
    const header = makeHeader(64);
    renderHook(() => useHeaderHeightVar({ current: header }, true));
    expect(document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe("64px");
  });
});
