// @vitest-environment jsdom
/**
 * DOM tests: day chrome (header, toggle, pager, legend, summary line, dialogs)
 * carries the day token classes, no dark translucent background class sits on
 * bright art, and the CSS day rules exist. Night keeps its data-theme "night".
 * Requirements: 2.5, 7.1
 */
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import Header from "@/components/ui/Header";
import Pager from "@/components/scene/Pager";
import { SceneLegend } from "@/components/scene/Footer";
import ListDialog from "@/components/scene/ListDialog";
import { BadgeDialog } from "@/components/badge/BadgeDialog";
import { ThemeProvider, useTheme } from "@/components/scene/ThemeProvider";
import type { Theme } from "@/lib/theme-art";

afterEach(() => cleanup());

function SetTheme({ theme, children }: { theme: Theme; children: ReactNode }) {
  const { setTheme } = useTheme();
  useEffect(() => setTheme(theme), [setTheme, theme]);
  return <>{children}</>;
}

function renderWith(theme: Theme) {
  return render(
    <ThemeProvider>
      <SetTheme theme={theme}>
        <div data-theme={theme}>
          <Header mode="live" username="octo" rows={[]} lightsOn={theme === "day"} onLightsOnChange={() => {}} soundOn={false} onSoundChange={() => {}} />
          <Pager plotIndex={0} plotCount={3} onPlotChange={() => {}} />
          <SceneLegend testId="legend" />
        </div>
        <ListDialog open onClose={() => {}} rows={[]} username="octo" />
        <BadgeDialog
          onClose={() => {}}
          target={{ kind: "profile", owner: "octo" } as never}
        />
      </SetTheme>
    </ThemeProvider>,
  );
}

const DARK_TRANSLUCENT = /\bbg-(black|iron|stone|night-(800|900|950))[\w-]*\/\d+/;

describe("day chrome", () => {
  it("day: chrome carries day token classes, portals are day-scoped", () => {
    renderWith("day");
    const q = (s: string) => document.querySelector<HTMLElement>(s)!;
    expect(q('[data-testid="header-username-badge"]').className).toContain("day-chrome-btn");
    expect(q('[data-testid="styled-toggle"]').className).toContain("day-chrome-btn");
    expect(q('[data-testid="pager-nearer"]').className).toContain("fixture-rail");
    expect(q('[data-testid="pager-label"]').className).toContain("day-chrome-plate");
    expect(q('[data-testid="legend"]').className).toContain("day-chrome-plate");
    expect(q('[data-testid="scene-summary-line"]').className).toContain("day-chrome-plate");
    expect(q('[data-testid="list-backdrop"]').className).toContain("day-backdrop");
    const portals = document.querySelectorAll('.day-panel[data-theme="day"]');
    expect(portals.length).toBeGreaterThanOrEqual(2);
  });

  it("day: no dark translucent background class on chrome elements", () => {
    renderWith("day");
    const chrome = document.querySelectorAll<HTMLElement>(
      ".day-chrome-btn, .day-chrome-plate, .fixture-rail, .fixture-ledge",
    );
    expect(chrome.length).toBeGreaterThan(0);
    for (const el of chrome) {
      expect(el.className, el.outerHTML.slice(0, 80)).not.toMatch(DARK_TRANSLUCENT);
    }
  });

  it("night: portals keep data-theme night", () => {
    renderWith("night");
    expect(document.querySelector('.day-panel[data-theme="day"]')).toBeNull();
    expect(document.querySelector('.day-panel[data-theme="night"]')).not.toBeNull();
  });

  it("globals.css defines the day chrome rules scoped to data-theme day", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    for (const sel of [
      '[data-theme="day"] .day-chrome-btn',
      '[data-theme="day"] .day-chrome-plate',
      '[data-theme="day"] .fixture-rail',
      '[data-theme="day"] .day-panel',
      '[data-theme="day"] .day-backdrop',
    ]) {
      expect(css).toContain(sel);
    }
    expect(css).toContain("outline: 3px solid var(--color-day-candle-ring)");
  });
});
