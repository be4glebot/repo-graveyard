/**
 * DOM tests for the graveyard loading page and the app-level 404 page.
 * (The HTTP 404 status itself cannot be asserted in a DOM test.)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 9.8
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import GraveyardLoading from "@/components/scene/GraveyardLoading";
import NotFound from "@/app/not-found";
import { LOADING_GENERIC, edgeCopy } from "@/lib/edge-states";

afterEach(() => {
  cleanup();
  mockPathname = "/";
});

describe("GraveyardLoading", () => {
  it("shows the generic line when no username is available", () => {
    mockPathname = "/";
    render(<GraveyardLoading />);
    expect(screen.getByRole("status").textContent).toBe(LOADING_GENERIC);
  });

  it("shows the username once the pathname is known", () => {
    mockPathname = "/g/octocat";
    render(<GraveyardLoading />);
    expect(screen.getByRole("status").textContent).toBe(
      "Digging up octocat's graveyard…",
    );
  });

  it("has role=status, no spinner and no progressbar", () => {
    mockPathname = "/g/octocat";
    const { container } = render(<GraveyardLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("renders markup-like usernames as literal text", () => {
    mockPathname = `/g/${encodeURIComponent("<img src=x onerror=alert(1)>")}`;
    const { container } = render(<GraveyardLoading />);
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Digging up <img src=x onerror=alert(1)>'s graveyard…",
    );
  });

  it("truncates long usernames to 39 characters plus an ellipsis", () => {
    const long = "a".repeat(60);
    mockPathname = `/g/${long}`;
    render(<GraveyardLoading />);
    expect(screen.getByRole("status").textContent).toBe(
      `Digging up ${"a".repeat(39)}…'s graveyard…`,
    );
  });

  it("renders the shell and both fog layers", () => {
    render(<GraveyardLoading />);
    expect(screen.getByTestId("themed-shell")).toBeTruthy();
    expect(screen.getByTestId("shell-fog-far")).toBeTruthy();
    expect(screen.getByTestId("shell-fog-near")).toBeTruthy();
  });
});

describe("app not-found page", () => {
  it("renders the themed copy", () => {
    render(<NotFound />);
    const copy = edgeCopy("app-not-found");
    expect(
      screen.getByRole("heading", { level: 1, name: copy.heading }),
    ).toBeTruthy();
    expect(screen.getByText(copy.body)).toBeTruthy();
    expect(screen.getByTestId("themed-shell")).toBeTruthy();
  });

  it("has both links with the right hrefs and labels", () => {
    render(<NotFound />);
    const gate = screen.getByRole("link", { name: "Return to the gate" });
    const estate = screen.getByRole("link", { name: "Tour the Haunted Estate" });
    expect(gate.getAttribute("href")).toBe("/");
    expect(estate.getAttribute("href")).toBe("/estate");
  });

  it("makes both links reachable by Tab", async () => {
    const user = userEvent.setup();
    render(<NotFound />);
    const gate = screen.getByRole("link", { name: "Return to the gate" });
    const estate = screen.getByRole("link", { name: "Tour the Haunted Estate" });
    const seen = new Set<Element | null>();
    for (let i = 0; i < 5; i++) {
      await user.tab();
      seen.add(document.activeElement);
    }
    expect(seen.has(gate)).toBe(true);
    expect(seen.has(estate)).toBe(true);
  });
});
