// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HelpTip from "@/components/ui/HelpTip";
import { BadgeDialog } from "@/components/badge/BadgeDialog";
import Toggle from "@/components/ui/Toggle";

afterEach(cleanup);

describe("HelpTip", () => {
  it("is a collapsed, labelled disclosure button by default", () => {
    render(<HelpTip>Explained.</HelpTip>);
    const b = screen.getByRole("button", { name: "What is this?" });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.getByTestId("help-tip-panel").hasAttribute("hidden")).toBe(true);
  });

  it("opens on click and closes on Escape, returning focus to the button", () => {
    render(<HelpTip>Explained.</HelpTip>);
    const b = screen.getByRole("button", { name: "What is this?" });
    fireEvent.click(b);
    expect(b.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("help-tip-panel").hasAttribute("hidden")).toBe(false);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(b);
  });

  it("closes when pressing elsewhere", () => {
    render(<HelpTip>Explained.</HelpTip>);
    const b = screen.getByRole("button", { name: "What is this?" });
    fireEvent.click(b);
    fireEvent.pointerDown(document.body);
    expect(b.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Toggle hint", () => {
  it("exposes the hint as title and accessible description", () => {
    render(<Toggle label="Sound" pressed={false} onChange={() => {}} hint="Plays sounds." />);
    const s = screen.getByRole("switch", { name: "Sound" });
    expect(s.getAttribute("title")).toBe("Plays sounds.");
    const id = s.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)?.textContent).toBe("Plays sounds.");
  });
});

describe("share dialog wording and help", () => {
  it("explains the dialog, with plain labels and a help tip that Escape closes before the dialog", () => {
    let closed = 0;
    render(
      <BadgeDialog target={{ kind: "owner", owner: "ada" }} onClose={() => (closed += 1)} />,
    );
    expect(screen.getByRole("dialog", { name: "Share your graveyard" })).toBeTruthy();
    expect(screen.getByTestId("share-intro").textContent).toMatch(/README/);
    expect(screen.getByLabelText("Paste into your README (Markdown)")).toBeTruthy();
    expect(screen.getByLabelText("Or as HTML")).toBeTruthy();
    expect(document.body.textContent).toContain("crimson and ghost colours");
    expect(document.body.textContent).toContain("Neutral shield look");

    const tip = screen.getByTestId("share-help");
    fireEvent.click(tip);
    expect(tip.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(tip.getAttribute("aria-expanded")).toBe("false");
    expect(closed).toBe(0);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closed).toBe(1);
  });

  it("uses 'Share this repo' for a repo", () => {
    render(<BadgeDialog target={{ kind: "repo", owner: "ada", repo: "x" }} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Share this repo" })).toBeTruthy();
  });
});
