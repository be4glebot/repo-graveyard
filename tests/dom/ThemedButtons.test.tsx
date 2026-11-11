/**
 * DOM tests for `ThemedButton` and `ReloadButton`.
 *
 * Requirements: 7.5, 7.8, 8.9
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import ThemedButton from "@/components/ui/ThemedButton";
import ReloadButton from "@/components/ui/ReloadButton";

afterEach(() => {
  cleanup();
});

describe("ThemedButton", () => {
  it("renders a link with href and label when href is given", () => {
    const { container } = render(
      <ThemedButton href="/estate">Tour the estate</ThemedButton>,
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("/estate");
    expect(a.textContent).toBe("Tour the estate");
  });

  it("has 44px touch target and candle focus ring classes", () => {
    const { container } = render(
      <ThemedButton href="/estate">Go</ThemedButton>,
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.classList.contains("min-h-11")).toBe(true);
    expect(a.classList.contains("min-w-11")).toBe(true);
    expect(a.className).toContain("focus-visible:ring-candle-400");
  });

  it("renders a type=button button without href and applies crimson variant", () => {
    const onClick = vi.fn();
    const { container } = render(
      <ThemedButton variant="crimson" onClick={onClick}>
        Press
      </ThemedButton>,
    );
    expect(container.querySelector("a")).toBeNull();
    const b = container.querySelector("button") as HTMLButtonElement;
    expect(b.getAttribute("type")).toBe("button");
    expect(b.className).toContain("min-h-11");
    expect(b.className).toContain("!bg-crimson-700");
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ReloadButton", () => {
  it('renders "Try again" and calls onReload on click', () => {
    const onReload = vi.fn();
    const { container } = render(<ReloadButton onReload={onReload} />);
    const b = container.querySelector("button") as HTMLButtonElement;
    expect(b.textContent).toBe("Try again");
    expect(onReload).not.toHaveBeenCalled();
    fireEvent.click(b);
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
