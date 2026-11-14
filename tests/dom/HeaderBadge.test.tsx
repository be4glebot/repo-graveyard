/**
 * DOM tests for the "Share your graveyard" entry points in Header.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.15, 10.8
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import Header, { type HeaderMode } from "@/components/ui/Header";

const COMPACT_QUERY = "(max-width: 767px)";

/** Stub matchMedia for a viewport width; only the compact query can match. */
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

function renderHeader(props: { username?: string; mode?: HeaderMode } = {}) {
  return render(
    <Header
      counts={{ souls: 1, ghost: 1, risen: 0, zombie: 0, tombstone: 0, coffin: 0 }}
      username={props.username ?? "octocat"}
      mode={props.mode}
      lightsOn={false}
      onLightsOnChange={() => {}}
      soundOn={false}
      onSoundChange={() => {}}
    />,
  );
}

const headerButton = () => screen.queryByTestId("get-badge-button");
const menuItem = () => screen.queryByTestId("get-badge-menu-item");
const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  stubWidth(1024);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Header badge entry point visibility (7.1, 7.2, 7.15)", () => {
  it("shows the header button and no Menu item at 1024 px", () => {
    stubWidth(1024);
    renderHeader();
    expect(headerButton()).not.toBeNull();
    expect(headerButton()!.textContent).toBe("Share your graveyard");
    expect(menuItem()).toBeNull();
  });

  it("shows the Menu item and no header button at 500 px", () => {
    stubWidth(500);
    renderHeader();
    expect(menuItem()).not.toBeNull();
    expect(menuItem()!.textContent).toBe("Share your graveyard");
    expect(headerButton()).toBeNull();
  });

  it.each([1024, 500])("renders nothing badge-related for the estate at %i px", (w) => {
    stubWidth(w);
    renderHeader({ mode: "estate" });
    expect(headerButton()).toBeNull();
    expect(menuItem()).toBeNull();
    expect(screen.queryByText("Share your graveyard")).toBeNull();
  });

  it.each([1024, 500])("renders nothing badge-related for an empty username at %i px", (w) => {
    stubWidth(w);
    renderHeader({ username: "" });
    expect(headerButton()).toBeNull();
    expect(menuItem()).toBeNull();
  });
});

describe("Header badge dialog opening and focus return (7.3, 7.4, 10.8)", () => {
  const cases = [
    { name: "header button", width: 1024, get: headerButton },
    { name: "Menu item", width: 500, get: menuItem },
  ];

  describe.each(cases)("$name", ({ width, get }) => {
    it.each([
      ["click", async (u: ReturnType<typeof userEvent.setup>, el: HTMLElement) => u.click(el)],
      ["Enter", async (u: ReturnType<typeof userEvent.setup>, el: HTMLElement) => {
        el.focus();
        await u.keyboard("{Enter}");
      }],
      ["Space", async (u: ReturnType<typeof userEvent.setup>, el: HTMLElement) => {
        el.focus();
        await u.keyboard(" ");
      }],
    ])("opens the dialog by %s and returns focus to the opener on close", async (_n, open) => {
      stubWidth(width);
      const user = userEvent.setup();
      renderHeader();
      const opener = get()!;

      expect(dialog()).toBeNull();
      await open(user, opener);
      expect(dialog()).not.toBeNull();

      await user.keyboard("{Escape}");
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(opener);
    });
  });

  it("does not close the Menu when the Menu item is activated", async () => {
    stubWidth(500);
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Menu" }).getAttribute("aria-expanded")).toBe("true");
    await user.click(menuItem()!);
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole("button", { name: "Menu" }).getAttribute("aria-expanded")).toBe("true");
  });
});
