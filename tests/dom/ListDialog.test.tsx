/**
 * DOM tests for the "View as list" dialog opened from the Header.
 *
 * Requirements: 5.3, 5.5, 5.6, 5.7, 9.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import Header from "@/components/ui/Header";
import type { GraveyardRow } from "@/lib/graveyard-view";

const COMPACT_QUERY = "(max-width: 767px)";

function stubWidth(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === COMPACT_QUERY ? width <= 767 : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const ROWS: GraveyardRow[] = [
  { name: "drifting", url: "https://github.com/octocat/drifting", state: "ghost", daysQuiet: 3, decayLevel: 0 },
  { name: "shipped", url: "https://github.com/octocat/shipped", state: "tombstone", daysQuiet: 120, decayLevel: null },
];

function renderHeader() {
  return render(
    <Header
      rows={ROWS}
      username="octocat"
      lightsOn={false}
      onLightsOnChange={() => {}}
      soundOn={false}
      onSoundChange={() => {}}
    />,
  );
}

const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  stubWidth(1024);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("View as list dialog", () => {
  it("opens from the desktop button with a name and the register table (5.3, 9.4)", () => {
    renderHeader();
    expect(dialog()).toBeNull();
    fireEvent.click(screen.getByTestId("view-list-button"));
    const d = screen.getByRole("dialog");
    expect(d.getAttribute("aria-modal")).toBe("true");
    const labelId = d.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)!.textContent?.trim()).toBeTruthy();
    expect(within(d).getByRole("table")).toBeTruthy();
    expect(within(d).getByText("drifting")).toBeTruthy();
  });

  it("opens from the Menu item in compact layout (5.3)", () => {
    stubWidth(500);
    renderHeader();
    fireEvent.click(screen.getByTestId("view-list-menu-item"));
    expect(within(screen.getByRole("dialog")).getByRole("table")).toBeTruthy();
  });

  it("moves focus in and keeps Tab inside (5.5)", () => {
    renderHeader();
    fireEvent.click(screen.getByTestId("view-list-button"));
    const d = screen.getByRole("dialog");
    expect(d.contains(document.activeElement)).toBe(true);

    const items = Array.from(
      d.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])'),
    );
    const first = items[0];
    const last = items[items.length - 1];

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("Escape closes it and focus returns to the opener (5.6, 5.7)", () => {
    renderHeader();
    const opener = screen.getByTestId("view-list-button");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("the Close button closes it and focus returns to the opener (5.6, 5.7)", () => {
    renderHeader();
    const opener = screen.getByTestId("view-list-button");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the Menu item when opened from the Menu (5.7)", () => {
    stubWidth(500);
    renderHeader();
    const opener = screen.getByTestId("view-list-menu-item");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
