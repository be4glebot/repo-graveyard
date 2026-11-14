/**
 * Gate drift and the `-4%` bleed (task 5.13).
 *
 * Requirements: 1.8, 5.7, 19.3
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import PlaceBackground from "@/components/scene/PlaceBackground";
import PlaceView from "@/components/scene/PlaceView";

afterEach(() => {
  cleanup();
});

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("gate PlaceBackground", () => {
  it("uses the -4% bleed on the gate and keeps -3% elsewhere", () => {
    const gate = render(<PlaceBackground place="gate" />);
    expect(
      (gate.getByTestId("place-background-bleed") as HTMLElement).style.inset,
    ).toBe("-4%");
    gate.unmount();
    for (const place of ["ground", "crypt"] as const) {
      const r = render(<PlaceBackground place={place} />);
      expect(
        (r.getByTestId("place-background-bleed") as HTMLElement).style.inset,
      ).toBe("-3%");
      expect(r.queryByTestId("place-background-drift")).toBeNull();
      r.unmount();
    }
  });

  it("wraps the gate bleed box in a camera-drift wrapper without focusables", () => {
    const { getByTestId } = render(<PlaceBackground place="gate" />);
    const drift = getByTestId("place-background-drift");
    expect(drift.classList.contains("camera-drift")).toBe(true);
    expect(drift.contains(getByTestId("place-background-bleed"))).toBe(true);
    expect(drift.querySelector("a, button, input, [tabindex]")).toBeNull();
  });

  it("turns camera-drift off under prefers-reduced-motion", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.camera-drift,[^}]*animation:\s*none/,
    );
  });

  it("renders the gate PlaceView with drift and no world-scroller", () => {
    const { container, getByTestId } = render(
      <PlaceView
        place="gate"
        rows={[]}
        activeFilter="all"
        plotIndex={0}
        selectedName={null}
        onFilterChange={() => {}}
        onPlotChange={() => {}}
        onSelect={() => {}}
        onReturn={() => {}}
      />,
    );
    expect(getByTestId("place-background-drift")).not.toBeNull();
    expect(container.querySelector('[data-testid="world-scroller"]')).toBeNull();
    expect(container.querySelector(".world-scroller")).toBeNull();
  });
});
