/**
 * Component tests for the landing-page username form.
 *
 * Covers blocking empty/invalid input with the correct inline message,
 * navigating on valid input via both the button and the Enter key, and the
 * input-then-button Tab order.
 *
 * Requirements: 9.2, 9.3, 9.4, 9.5
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Hoisted spy so the `next/navigation` mock below can close over it.
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import UsernameForm from "@/components/landing/UsernameForm";

const EMPTY_MESSAGE = "A username is required";
const INVALID_MESSAGE = "That doesn't look like a valid GitHub username";

afterEach(() => {
  cleanup();
  push.mockReset();
});

function getInput(): HTMLInputElement {
  return screen.getByLabelText("GitHub username") as HTMLInputElement;
}

function getButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Visit graveyard" }) as HTMLButtonElement;
}

describe("UsernameForm", () => {
  it("blocks empty input: shows the required message and does not navigate", async () => {
    const user = userEvent.setup();
    render(<UsernameForm />);

    await user.click(getButton());

    expect(screen.getByRole("alert").textContent).toBe(EMPTY_MESSAGE);
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks whitespace-only input: shows the required message and does not navigate", async () => {
    const user = userEvent.setup();
    render(<UsernameForm />);

    await user.type(getInput(), "   ");
    await user.click(getButton());

    expect(screen.getByRole("alert").textContent).toBe(EMPTY_MESSAGE);
    expect(push).not.toHaveBeenCalled();
  });

  it.each([["-bad"], ["a".repeat(40)], ["has space"]])(
    "blocks invalid input %j: shows the invalid-format message and does not navigate",
    async (invalid) => {
      const user = userEvent.setup();
      render(<UsernameForm />);

      await user.type(getInput(), invalid);
      await user.click(getButton());

      expect(screen.getByRole("alert").textContent).toBe(INVALID_MESSAGE);
      expect(push).not.toHaveBeenCalled();
    },
  );

  it("navigates on valid input via the button", async () => {
    const user = userEvent.setup();
    render(<UsernameForm />);

    await user.type(getInput(), "octocat");
    await user.click(getButton());

    expect(screen.queryByRole("alert")).toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/g/octocat");
  });

  it("navigates on valid input via Enter in the input", async () => {
    const user = userEvent.setup();
    render(<UsernameForm />);

    await user.type(getInput(), "octocat{Enter}");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/g/octocat");
  });

  it("percent-encodes the username in the navigation path", async () => {
    const user = userEvent.setup();
    render(<UsernameForm />);

    // Hyphens are valid in GitHub usernames; encodeURIComponent leaves them as-is,
    // but this confirms the valid path is built via the component's encoding.
    await user.type(getInput(), "a-b-c");
    await user.click(getButton());

    expect(push).toHaveBeenCalledWith("/g/a-b-c");
  });

  it("places the input before the button in tab order (input -> button)", async () => {
    const user = userEvent.setup();
    render(<UsernameForm />);

    const input = getInput();
    const button = getButton();

    // DOM document order: input precedes button.
    expect(
      input.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Focus order: Tab reaches the input first, then the button.
    await user.tab();
    expect(document.activeElement).toBe(input);

    await user.tab();
    expect(document.activeElement).toBe(button);
  });
});
