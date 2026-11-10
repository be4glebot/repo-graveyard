/**
 * DOM test for the shared `ExternalLink` (components/detail/ExternalLink.tsx).
 *
 * `@testing-library/jest-dom` is not installed, so plain DOM assertions are used.
 *
 * Requirements: 9.4, 9.5
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import ExternalLink from "@/components/detail/ExternalLink";

afterEach(() => {
  cleanup();
});

describe("ExternalLink", () => {
  it("opens in a new tab with noopener noreferrer (Req 9.4)", () => {
    const { container } = render(
      <ExternalLink href="https://github.com/o/r">Open on GitHub</ExternalLink>,
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("https://github.com/o/r");
    expect(a.getAttribute("target")).toBe("_blank");
    const rel = (a.getAttribute("rel") ?? "").split(/\s+/);
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });

  it("shows a hidden ↗ marker and an sr-only new-tab notice (Req 9.4)", () => {
    const { container } = render(
      <ExternalLink href="https://github.com/o/r">Link</ExternalLink>,
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    const marker = Array.from(a.querySelectorAll("span")).find((s) =>
      (s.textContent ?? "").includes("↗"),
    );
    expect(marker).toBeDefined();
    expect(marker!.getAttribute("aria-hidden")).toBe("true");

    const sr = a.querySelector("span.sr-only") as HTMLElement;
    expect(sr).not.toBeNull();
    expect(sr.textContent).toContain("(opens in a new tab)");
  });

  it("renders HTML-significant text literally with no injected markup (Req 9.5)", () => {
    const evil = '<img src=x onerror="alert(1)"><script>boom()</script>&amp;';
    const { container } = render(
      <ExternalLink href="https://github.com/o/r">{evil}</ExternalLink>,
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.textContent).toContain(evil);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    // Only the two marker spans exist as element children.
    expect(a.children.length).toBe(2);
  });
});
