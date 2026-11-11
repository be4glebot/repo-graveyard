/**
 * DOM tests for the themed edge states: `SceneErrorState` (not-found,
 * invalid-username, rate-limited, server-error) and `EmptyGraveyard`.
 *
 * Requirements: 7.2-7.6, 7.9, 9.8
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import SceneErrorState from "@/components/scene/SceneErrorState";
import EmptyGraveyard from "@/components/scene/EmptyGraveyard";
import { edgeCopy } from "@/lib/edge-states";

afterEach(() => {
  cleanup();
});

const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

function tourLink(container: HTMLElement) {
  return Array.from(container.querySelectorAll("a")).find(
    (a) => norm(a.textContent) === "Tour the Haunted Estate",
  );
}

function buttonLabels(container: HTMLElement) {
  return [
    ...Array.from(container.querySelectorAll("button")),
    ...Array.from(container.querySelectorAll("a")),
  ].map((el) => norm(el.textContent));
}

describe("SceneErrorState copy and links", () => {
  it.each(["not-found", "invalid-username"] as const)(
    "%s shows not-found copy, Try again to / and the estate tour",
    (kind) => {
      const { container } = render(<SceneErrorState kind={kind} />);
      const copy = edgeCopy("not-found");
      expect(container.querySelector("h1")!.textContent).toBe(copy.heading);
      expect(norm(container.textContent)).toContain(copy.body);

      const tryAgain = Array.from(container.querySelectorAll("a")).find(
        (a) => norm(a.textContent) === "Try again",
      );
      expect(tryAgain!.getAttribute("href")).toBe("/");
      expect(tourLink(container)!.getAttribute("href")).toBe("/estate");
    },
  );

  it("rate-limited shows locked copy and only the estate tour", () => {
    const { container } = render(<SceneErrorState kind="rate-limited" />);
    const copy = edgeCopy("rate-limited");
    expect(container.querySelector("h1")!.textContent).toBe(copy.heading);
    expect(norm(container.textContent)).toContain(copy.body);
    expect(tourLink(container)!.getAttribute("href")).toBe("/estate");
    expect(buttonLabels(container)).not.toContain("Try again");
  });

  it("server-error shows its own copy with a Try again button and the tour", () => {
    const { container } = render(<SceneErrorState kind="server-error" />);
    const copy = edgeCopy("server-error");
    expect(container.querySelector("h1")!.textContent).toBe(copy.heading);
    expect(norm(container.textContent)).toContain(copy.body);

    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => norm(b.textContent) === "Try again",
    );
    expect(button).toBeDefined();
    expect(tourLink(container)!.getAttribute("href")).toBe("/estate");
  });

  it("server-error copy differs from rate-limited copy", () => {
    const a = edgeCopy("server-error");
    const b = edgeCopy("rate-limited");
    expect(a.heading).not.toBe(b.heading);
    expect(a.body).not.toBe(b.body);

    const server = render(<SceneErrorState kind="server-error" />);
    const serverText = norm(server.container.textContent);
    cleanup();
    const limited = render(<SceneErrorState kind="rate-limited" />);
    const limitedText = norm(limited.container.textContent);
    expect(serverText).not.toBe(limitedText);
    expect(limitedText).not.toContain(a.heading);
  });
});

describe("SceneErrorState roles", () => {
  it.each(["not-found", "invalid-username", "rate-limited", "server-error"] as const)(
    "%s is announced with role=alert",
    (kind) => {
      const { container } = render(<SceneErrorState kind={kind} />);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.querySelector('[role="status"]')).toBeNull();
    },
  );
});

describe("SceneErrorState rate-limit countdown", () => {
  it("is absent when resetInMinutes is unknown", () => {
    const { container } = render(<SceneErrorState kind="rate-limited" />);
    expect(norm(container.textContent)).not.toContain("gates reopen");
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("shows whole minutes when known", () => {
    const { container } = render(
      <SceneErrorState kind="rate-limited" resetInMinutes={12} />,
    );
    expect(norm(container.textContent)).toContain("The gates reopen in 12 minutes.");
  });

  it("uses the singular for the minimum of 1 minute", () => {
    const { container } = render(
      <SceneErrorState kind="rate-limited" resetInMinutes={1} />,
    );
    expect(norm(container.textContent)).toContain("The gates reopen in 1 minute.");
  });

  it("does not show a countdown for other kinds", () => {
    const { container } = render(
      <SceneErrorState kind="server-error" resetInMinutes={5} />,
    );
    expect(norm(container.textContent)).not.toContain("gates reopen");
  });
});

describe("EmptyGraveyard", () => {
  it("renders the heading, the owner's name and the estate tour", () => {
    const { container } = render(<EmptyGraveyard username="octo-ghost" />);
    expect(container.querySelector("h1")!.textContent).toBe(
      "Nothing buried here yet.",
    );
    expect(norm(container.textContent)).toContain("octo-ghost");
    expect(tourLink(container)!.getAttribute("href")).toBe("/estate");
  });

  it("uses role=status rather than role=alert", () => {
    const { container } = render(<EmptyGraveyard username="octo-ghost" />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
