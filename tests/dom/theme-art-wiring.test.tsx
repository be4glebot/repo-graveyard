/**
 * Render check: CropLayer and a tombstone Creature use /art/day/... in day and
 * /art/... in night.
 * Requirements: 3.2, 3.6
 */
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import Creature from "@/components/creatures/Creature";
import { ThemeProvider, useTheme } from "@/components/scene/ThemeProvider";
import CropLayer from "@/components/world/CropLayer";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { Theme } from "@/lib/theme-art";

afterEach(() => cleanup());

const ROW: GraveyardRow = {
  name: "repo",
  url: "https://github.com/octocat/repo",
  state: "tombstone",
  daysQuiet: 400,
  decayLevel: 0,
};

function SetTheme({ theme }: { theme: Theme }) {
  const { setTheme } = useTheme();
  useEffect(() => setTheme(theme), [theme, setTheme]);
  return null;
}

const CROP = {
  plate: "place-ground" as const,
  element: { w: 1960, h: 1200 },
  focal: { fx: 0.5, fy: 0.5 },
  anchor: { ax: 0.5, ay: 0.5 },
  "data-testid": "crop",
};

function bg(el: HTMLElement): string {
  return decodeURIComponent(el.style.backgroundImage);
}

describe("CropLayer theme art", () => {
  it("uses /art/day/ in day", () => {
    const { getByTestId } = render(<CropLayer {...CROP} theme="day" />);
    expect(bg(getByTestId("crop-image"))).toContain("/art/day/place-ground.webp");
  });

  it("uses /art/ in night", () => {
    const { getByTestId } = render(<CropLayer {...CROP} theme="night" />);
    const src = bg(getByTestId("crop-image"));
    expect(src).toContain("/art/place-ground.webp");
    expect(src).not.toContain("/art/day/");
  });
});

describe("tombstone Creature theme art", () => {
  it("renders the day tombstone art in day", () => {
    render(
      <ThemeProvider>
        <SetTheme theme="day" />
        <Creature row={ROW} />
      </ThemeProvider>,
    );
    const src = decodeURIComponent(document.querySelector("img")?.getAttribute("src") ?? "");
    expect(src).toContain("/art/day/");
  });

  it("renders the night tombstone art in night", () => {
    render(
      <ThemeProvider>
        <Creature row={ROW} />
      </ThemeProvider>,
    );
    const src = decodeURIComponent(document.querySelector("img")?.getAttribute("src") ?? "");
    expect(src).toContain("/art/tomb-arch-fresh.webp");
    expect(src).not.toContain("/art/day/");
  });
});
