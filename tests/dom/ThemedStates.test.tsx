/**
 * DOM tests for themed loading and travel states.
 * ThemeProvider always starts at night, so a helper calls setTheme after mount.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "",
  useRouter: () => ({ push: vi.fn() }),
}));

import GraveyardLoading from "@/components/scene/GraveyardLoading";
import { ThemeProvider, useTheme } from "@/components/scene/ThemeProvider";
import { TravelRunner } from "@/components/scene/TravelTransition";
import { LOADING_GENERIC } from "@/lib/edge-states";
import type { Theme } from "@/lib/theme-art";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Sets the theme after mount (the provider itself always starts at night). */
function SetThemeAfterMount({ theme }: { theme: Theme }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);
  return null;
}

function ToggleButton() {
  const { setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme("day")}>
      to-day
    </button>
  );
}

describe("themed loading", () => {
  it("renders the day string and data-theme=day when the theme is day", () => {
    render(
      <ThemeProvider>
        <SetThemeAfterMount theme="day" />
        <GraveyardLoading />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("themed-shell").getAttribute("data-theme")).toBe(
      "day",
    );
    expect(screen.getByRole("status").textContent).toBe("Walking the grounds…");
  });

  it("renders the night string and data-theme=night otherwise", () => {
    render(
      <ThemeProvider>
        <GraveyardLoading />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("themed-shell").getAttribute("data-theme")).toBe(
      "night",
    );
    expect(screen.getByRole("status").textContent).toBe(LOADING_GENERIC);
  });
});

describe("travel transition across a theme toggle", () => {
  function Runner({ onCut, onDone }: { onCut: () => void; onDone: () => void }) {
    const { theme } = useTheme();
    return (
      <TravelRunner
        place="gate"
        direction="in"
        reducedMotion={false}
        theme={theme}
        from={<div data-testid="src-view">source</div>}
        to={<div data-testid="dest-view">destination</div>}
        onCut={onCut}
        onDone={onDone}
      />
    );
  }

  it("stays mounted and keeps its progress when the theme flips mid-travel", () => {
    vi.useFakeTimers({ now: 0 });
    const onCut = vi.fn();
    const onDone = vi.fn();
    render(
      <ThemeProvider>
        <ToggleButton />
        <Runner onCut={onCut} onDone={onDone} />
      </ThemeProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(700);
    });
    const stage = screen.getByTestId("travel-stage");
    const before = stage.getAttribute("style");
    expect(screen.getByTestId("src-view")).not.toBeNull();

    fireEvent.click(screen.getByText("to-day"));

    expect(screen.getByTestId("travel-stage")).toBe(stage);
    expect(screen.getByTestId("travel-stage").getAttribute("style")).toBe(before);
    expect(screen.getByTestId("src-view")).not.toBeNull();
    expect(onCut).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    // The clock keeps running from where it was (cut at 1150ms), not from zero.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onCut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("dest-view")).not.toBeNull();
  });
});
