/**
 * DOM tests for the instant night sky (`Backdrop` + `FadeArt`).
 *
 * Feature: polish-pass-2e. Requirements: 1.1, 1.2, 1.3, 1.4.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import Backdrop from "@/components/scene/Backdrop";
import FadeArt from "@/components/scene/FadeArt";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function bgFarImage(container: HTMLElement): HTMLImageElement {
  return container.querySelector(
    '[data-testid="backdrop-bg-far"] img',
  ) as HTMLImageElement;
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

describe("Backdrop first paint", () => {
  it("renders the night gradient in the initial markup, before any image loads", () => {
    const { container } = render(<Backdrop />);
    const gradient = container.querySelector(
      '[data-testid="backdrop-night-gradient"]',
    );
    expect(gradient).not.toBeNull();
    expect(gradient?.className).toContain("backdrop-night-gradient");
    // The gradient is the first child, beneath every painted plate.
    expect(container.firstElementChild?.firstElementChild).toBe(gradient);
  });

  it("keeps the bg-far image at opacity 0 until load, then fades it to 1", async () => {
    const { container } = render(<Backdrop />);
    const img = bgFarImage(container);
    expect(img).not.toBeNull();
    expect(img.style.opacity).toBe("0");
    expect(img.getAttribute("data-loaded")).toBe("false");

    fireEvent.load(img);
    await waitFor(() => expect(bgFarImage(container).style.opacity).toBe("1"));
    expect(bgFarImage(container).getAttribute("data-loaded")).toBe("true");
    expect(bgFarImage(container).style.transition).toContain("700ms");
  });

  it("drops the fade transition under prefers-reduced-motion", async () => {
    stubReducedMotion(true);
    const { container } = render(<Backdrop />);
    const img = bgFarImage(container);
    fireEvent.load(img);
    await waitFor(() => expect(bgFarImage(container).style.opacity).toBe("1"));
    const transition = bgFarImage(container).style.transition;
    expect(transition === "none" || transition === "").toBe(true);
    expect(transition).not.toContain("700ms");
  });

  it("marks the bg-far image as priority with sizes of 106vw", () => {
    const { container } = render(<Backdrop />);
    const img = bgFarImage(container);
    expect(img.getAttribute("sizes")).toBe("106vw");
    // `priority` disables lazy loading (and triggers the preload hint).
    expect(img.getAttribute("loading")).not.toBe("lazy");
  });

  it("leaves the gradient visible when the plate fails to load", () => {
    const { container } = render(<Backdrop />);
    fireEvent.error(bgFarImage(container));
    expect(bgFarImage(container)).toBeNull();
    expect(
      container.querySelector('[data-testid="backdrop-night-gradient"]'),
    ).not.toBeNull();
  });
});

describe("FadeArt", () => {
  it("lazy-loads non-priority art, unlike the priority bg-far plate", () => {
    const { container } = render(
      <div style={{ position: "relative" }}>
        <FadeArt src="/art/fog-wisps.webp" sizes="100vw" />
      </div>,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.style.opacity).toBe("0");
  });
});

describe("Fog wisps asset", () => {
  it("stays under 300 KB after the re-encode", () => {
    const file = path.join(process.cwd(), "public", "art", "fog-wisps.webp");
    expect(fs.statSync(file).size).toBeLessThan(300 * 1024);
  });
});
