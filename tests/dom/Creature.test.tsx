/**
 * Component tests for the shared creature shell (`components/creatures/Creature`).
 *
 * The shell is the single place the scene's accessibility and interaction
 * contract lives, so these tests pin that contract: it paints the right art for
 * a sample of (state, decay) pairs (Req 4.1), exposes the accessible name from
 * `creatureAccessibleName` (Req 9.1/9.2), raises selection on click and on
 * keyboard activation (Enter/Space, Req 9.1/9.3), and carries a visible
 * candle-token focus affordance (Req 9.4).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks (src substring, className contains, document.activeElement),
 * matching the pattern in `tests/graveyard-ui.test.tsx` and
 * `tests/landing-form.test.tsx`.
 *
 * Requirements: 4.1, 9.1, 9.2, 9.3, 9.4
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Creature from "@/components/creatures/Creature";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { creatureAccessibleName, creatureImage } from "@/lib/scene-view";

afterEach(() => {
  cleanup();
});

/** Builds a minimal display row; overrides merge onto sensible defaults. */
function makeRow(overrides: Partial<GraveyardRow> = {}): GraveyardRow {
  return {
    name: "repo",
    url: "https://github.com/octocat/repo",
    state: "ghost",
    daysQuiet: 1,
    decayLevel: 0,
    ...overrides,
  };
}

/**
 * next/image rewrites `src` through its loader (percent-encoding the
 * `/art/...webp` path into a `/_next/image?url=...` URL), so we assert the
 * rendered src *contains* the art basename rather than matching the raw path.
 * The shell marks the image `aria-hidden` (decorative — the accessible name
 * lives on the button), so it exposes the "presentation" role rather than
 * "img"; we select the single `<img>` element directly by tag.
 */
function renderedImageSrc(): string {
  const img = document.querySelector("img");
  return img?.getAttribute("src") ?? "";
}

describe("Creature shell", () => {
  describe("renders the expected art for a sample of (state, decay) pairs (4.1)", () => {
    const cases: Array<{
      label: string;
      row: GraveyardRow;
      basename: string;
    }> = [
      {
        label: "ghost decay 2 → ghost-2",
        row: makeRow({ name: "g2", state: "ghost", decayLevel: 2 }),
        basename: "ghost-2",
      },
      {
        label: "zombie decay 4 → zombie-4",
        row: makeRow({ name: "z4", state: "zombie", decayLevel: 4 }),
        basename: "zombie-4",
      },
      {
        label: "risen → risen",
        row: makeRow({ name: "r", state: "risen", decayLevel: null }),
        basename: "risen",
      },
      {
        label: "tombstone → tomb-arch-fresh",
        row: makeRow({ name: "t", state: "tombstone", decayLevel: null }),
        basename: "tomb-arch-fresh",
      },
      {
        label: "coffin → coffin",
        row: makeRow({ name: "c", state: "coffin", decayLevel: null }),
        basename: "coffin",
      },
    ];

    for (const { label, row, basename } of cases) {
      it(label, () => {
        // The expected basename is taken from the same pure function the shell
        // uses, so the test tracks the view-model rather than hardcoding a
        // mapping the component could drift away from.
        expect(creatureImage(row.state, row.decayLevel)).toBe(basename);

        render(<Creature row={row} />);

        const src = renderedImageSrc();
        expect(src).toContain(basename);
        // The painted assets are `.webp` under /art.
        expect(src).toContain("webp");
      });
    }
  });

  it("exposes the accessible name from creatureAccessibleName (9.1, 9.2)", () => {
    // A zombie quiet long enough to read "abandoned N months" exercises the
    // full name/state/time composition.
    const row = makeRow({
      name: "weather-app",
      state: "zombie",
      daysQuiet: 240,
      decayLevel: 3,
    });
    const expectedName = creatureAccessibleName(row);

    render(<Creature row={row} />);

    // The button's accessible name must equal the composed string. Resolving
    // the button by that exact name is the assertion.
    const button = screen.getByRole("button", { name: expectedName });
    expect(button).not.toBeNull();
    expect(button.getAttribute("aria-label")).toBe(expectedName);
  });

  it("raises selection with row.name on click (9.1)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const row = makeRow({ name: "clicky-repo" });

    render(<Creature row={row} onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("clicky-repo");
  });

  it("raises selection on Enter key activation (9.1, 9.3)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const row = makeRow({ name: "enter-repo" });

    render(<Creature row={row} onSelect={onSelect} />);

    const button = screen.getByRole("button");
    button.focus();
    expect(document.activeElement).toBe(button);

    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("enter-repo");
  });

  it("raises selection on Space key activation (9.1, 9.3)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const row = makeRow({ name: "space-repo" });

    render(<Creature row={row} onSelect={onSelect} />);

    const button = screen.getByRole("button");
    button.focus();

    // Space must activate selection (and the shell prevents the default page
    // scroll); asserting selection fired is enough to pin the behavior.
    await user.keyboard("[Space]");

    expect(onSelect).toHaveBeenCalledWith("space-repo");
  });

  it("shows a visible focus affordance and is focusable (9.4)", () => {
    const row = makeRow({ name: "focus-repo" });

    render(<Creature row={row} />);

    const button = screen.getByRole("button");

    // It is a native, focusable button that actually takes focus.
    expect(button.tagName).toBe("BUTTON");
    button.focus();
    expect(document.activeElement).toBe(button);

    // The focus ring is painted with the candle token at >= 2px, continuously
    // visible while focused (Req 9.4). We assert the ring utility classes are
    // present on the button; the color is the candle token, never a hex.
    const className = button.getAttribute("class") ?? "";
    expect(className).toContain("focus-visible:ring-2");
    expect(className).toContain("var(--color-candle-400)");
  });
});
