/**
 * DOM tests for the painted Moon art (`components/scene/Moon.tsx`).
 *
 * Feature: polish-pass-2e. Requirements: 5.1, 5.2, 5.3, 5.4.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import fc from "fast-check";

import Moon from "@/components/scene/Moon";
import { moonTreatment } from "@/lib/scene-view";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => {
  cleanup();
});

type State = GraveyardRow["state"];
const STATES: State[] = ["ghost", "risen", "zombie", "tombstone", "coffin"];

/** Moon only reads `state`, so a minimal row cast is enough. */
function rowsOf(states: State[]): GraveyardRow[] {
  return states.map((state, i) => ({ name: `r${i}`, state }) as unknown as GraveyardRow);
}

const PALE = rowsOf(["ghost", "ghost", "zombie"]);
const BLOOD = rowsOf(["zombie", "zombie", "ghost"]);

function wrapper(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-moon-source]") as HTMLElement;
}

describe("Moon painted art", () => {
  it("renders the moon image in default mode", () => {
    const { container } = render(<Moon rows={PALE} />);
    const w = wrapper(container);
    expect(w.getAttribute("data-moon-source")).toBe("image");
    expect(container.querySelector("img")?.getAttribute("src")).toContain("moon");
  });

  it("renders the moon image with placement", () => {
    const { container } = render(
      <Moon rows={PALE} placement={{ cx: 100, cy: 50, diameter: 64 }} />,
    );
    expect(wrapper(container).getAttribute("data-moon-source")).toBe("image");
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("renders the moon image with fillParent", () => {
    const { container } = render(<Moon rows={PALE} fillParent />);
    expect(wrapper(container).getAttribute("data-moon-source")).toBe("image");
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("falls back to the drawn moon when the image errors", () => {
    const { container } = render(<Moon rows={PALE} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(wrapper(container).getAttribute("data-moon-source")).toBe("drawn");
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the glow box-shadow unchanged between sources", () => {
    const { container } = render(<Moon rows={PALE} />);
    const before = wrapper(container).style.boxShadow;
    expect(before).toContain("110px");
    expect(before).toContain("36px");
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(wrapper(container).style.boxShadow).toBe(before);
  });

  it("applies the blood-red treatment to both the image and the drawn moon", () => {
    const { container } = render(<Moon rows={BLOOD} />);
    expect(wrapper(container).getAttribute("data-moon-treatment")).toBe("blood-red");
    expect(container.querySelector("img")?.className).toContain("moon-blood");
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(wrapper(container).getAttribute("data-moon-source")).toBe("drawn");
    expect(wrapper(container).getAttribute("data-moon-treatment")).toBe("blood-red");
  });

  it("keeps the pale treatment without the blood class", () => {
    const { container } = render(<Moon rows={PALE} />);
    expect(wrapper(container).getAttribute("data-moon-treatment")).toBe("pale");
    expect(container.querySelector("img")?.className).not.toContain("moon-blood");
  });
});

describe("Feature: polish-pass-2e, Property 6: Bloodmoon treatment follows moonTreatment", () => {
  /** **Validates: Requirements 5.4** */
  it("treatment attribute and blood class match moonTreatment for any rows, in both sources", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...STATES), { maxLength: 30 }),
        fc.boolean(),
        (states, failImage) => {
          const rows = rowsOf(states);
          const expected = moonTreatment(rows);
          const { container, unmount } = render(<Moon rows={rows} />);
          try {
            const img = container.querySelector("img") as HTMLImageElement;
            if (failImage) fireEvent.error(img);
            const w = wrapper(container);
            expect(w.getAttribute("data-moon-treatment")).toBe(expected);
            if (!failImage) {
              expect(img.className.includes("moon-blood")).toBe(expected === "blood-red");
            }
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
