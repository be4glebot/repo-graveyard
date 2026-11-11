/**
 * DOM tests for the landing page (task 4.4).
 *
 * Requirements: 1.2, 1.3, 1.8, 2.6, 2.7, 2.8, 2.9, 2.10, 9.5
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import Home from "@/app/page";

afterEach(() => cleanup());

describe("landing page", () => {
  it("renders the tagline and exactly one h1 'Repo Graveyard'", () => {
    const { container } = render(<Home />);
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Repo Graveyard");
    expect(
      screen.getByText("Every abandoned repo leaves something behind."),
    ).toBeTruthy();
  });

  it("renders three steps in document order with empty-alt images", () => {
    render(<Home />);
    const items = screen.getByTestId("how-it-works").querySelectorAll("li");
    expect(Array.from(items).map((li) => li.textContent?.trim())).toEqual([
      "Visit a graveyard",
      "Hold a séance",
      "Revive it in Kiro",
    ]);
    items.forEach((li) => {
      const img = li.querySelector("img");
      expect(img).not.toBeNull();
      expect(img!.getAttribute("alt")).toBe("");
    });
  });

  it("renders the footer link, label and disclosure", () => {
    render(<Home />);
    const footer = screen.getByTestId("landing-footer");
    expect(footer.textContent).toContain("Built with Kiro");
    expect(footer.textContent).toContain(
      "Art generated with ChatGPT; planning help from Claude",
    );
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/be4glebot/repo-graveyard",
    );
  });

  it("links the Estate button to /estate", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: "Tour the Haunted Estate" });
    expect(link.getAttribute("href")).toBe("/estate");
  });

  it("tabs through input, Open the gate, Estate link, footer link", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("GitHub username"));
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open the gate" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Tour the Haunted Estate" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "GitHub" }));
  });

  it("marks exactly one image as priority", () => {
    const { container } = render(<Home />);
    // next/image with `priority` drops `loading="lazy"` (and sets fetchpriority
    // in browsers); every non-priority image keeps `loading="lazy"`.
    const prioritized = Array.from(container.querySelectorAll("img")).filter(
      (img) => img.getAttribute("loading") !== "lazy",
    );
    expect(prioritized).toHaveLength(1);
    expect(
      prioritized[0].closest('[data-testid="shell-backdrop"]'),
    ).not.toBeNull();
  });

  it("keeps h1, tagline and form when the backdrop image errors", () => {
    const { container } = render(<Home />);
    const img = screen
      .getByTestId("shell-backdrop")
      .querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByTestId("shell-backdrop").querySelector("img")).toBeNull();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(
      screen.getByText("Every abandoned repo leaves something behind."),
    ).toBeTruthy();
    expect(screen.getByLabelText("GitHub username")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the gate" })).toBeTruthy();
  });
});
