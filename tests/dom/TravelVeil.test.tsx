// @vitest-environment jsdom
// Task 24.1: the travel fog is a dark veil plus a dimmed wisp plate, never a
// bright white-grey flash; both follow the fog opacity so the cut stays hidden.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TravelFog } from "@/components/scene/TravelTransition";

afterEach(cleanup);

describe("TravelFog veil", () => {
  it("dims the wisps and adds a night veil that tracks the fog opacity", () => {
    render(<TravelFog fog={{ opacity: 0.6, scale: 1.8 }} reduced={false} direction="in" place="ground" />);
    const fog = screen.getByTestId("travel-fog");
    const veil = screen.getByTestId("travel-veil");
    expect(fog.style.filter).toMatch(/brightness\(0\.[0-9]+\)/);
    expect(veil.style.opacity).toBe("0.6");
    expect(fog.style.opacity).toBe("0.6");
    expect(veil.style.backgroundColor).toContain("--color-night-sky");
  });

  it("is fully opaque at the cut (opacity 1)", () => {
    render(<TravelFog fog={{ opacity: 1, scale: 2 }} reduced={false} direction="in" place="sky" />);
    expect(screen.getByTestId("travel-veil").style.opacity).toBe("1");
  });
});
