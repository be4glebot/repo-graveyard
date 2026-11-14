// @vitest-environment jsdom
/**
 * DOM tests: the turning-soon notice is a warm gold banner in day (no crimson)
 * and unchanged in night. Requirements: 2.5, 7.2
 */
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

import TurningSoon from "@/components/scene/TurningSoon";
import { ThemeProvider, useTheme } from "@/components/scene/ThemeProvider";
import type { Theme } from "@/lib/theme-art";

afterEach(() => cleanup());

function SetTheme({ theme, children }: { theme: Theme; children: ReactNode }) {
  const { setTheme } = useTheme();
  useEffect(() => setTheme(theme), [setTheme, theme]);
  return <>{children}</>;
}

function renderWith(theme: Theme, withGoTo = false) {
  render(
    <ThemeProvider>
      <SetTheme theme={theme}>
        <TurningSoon
          turningSoon={{ name: "api-server", daysLeft: 9 } as never}
          onGoTo={withGoTo ? () => {} : undefined}
        />
      </SetTheme>
    </ThemeProvider>,
  );
  return document.querySelector<HTMLElement>(
    '[data-testid="scene-turning-soon"]',
  )!;
}

describe("TurningSoon day banner", () => {
  it.each([false, true])("day shows gold copy and no crimson (goto=%s)", (g) => {
    const el = renderWith("day", g);
    expect(el.textContent).toContain("api-server needs a little care");
    expect(el.textContent).not.toContain("turns in");
    expect(el.className).toContain("turning-soon-day");
    expect(el.style.backgroundColor).toContain("--color-day-gold-bg");
    expect(el.style.borderColor).toContain("--color-day-gold-border");
    expect(el.style.color).toContain("--color-day-gold-ink");
    expect(el.outerHTML).not.toMatch(/crimson/);
  });

  it("night keeps the crimson notice and copy", () => {
    const el = renderWith("night");
    expect(el.textContent).toContain("api-server turns in 9 days");
    expect(el.className).not.toContain("turning-soon-day");
    expect(el.style.backgroundColor).toContain("--color-crimson-700");
  });

  it("gold tokens live in the day block above the séance block", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "app/globals.css"),
      "utf8",
    );
    const seance = css.indexOf("The Séance (Spec 4, task 11.1)");
    for (const t of ["gold-bg", "gold-border", "gold-ink"]) {
      const i = css.indexOf(`--color-day-${t}:`);
      expect(i).toBeGreaterThan(-1);
      expect(i).toBeLessThan(seance);
    }
  });
});
