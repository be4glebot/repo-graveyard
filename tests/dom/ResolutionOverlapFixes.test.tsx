/**
 * Regression tests for the resolution overlap sweep fixes (task 25.3):
 * hub footer caps, short-viewport Hub board, depth marker fit, pager lifts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Footer from "@/components/scene/Footer";
import { markerFits } from "@/components/world/DepthMarker";
import DepthMarker from "@/components/world/DepthMarker";
import { HUB_MIN_BOARD_H_PX, PLACE_CARD_W_PX, hubFooterLimits } from "@/lib/estate-view";

const read = (p: string): string => readFileSync(join(process.cwd(), p), "utf8");

afterEach(cleanup);

describe("hubFooterLimits", () => {
  it("keeps the notice and legend beside the gate card (46% centre)", () => {
    const l = hubFooterLimits(16);
    const half = PLACE_CARD_W_PX / 2 + 16;
    expect(l.noticeMaxWidth).toBe(`calc(46% - ${half + 16}px)`);
    expect(l.legendMaxWidth).toBe(`calc(54% - ${half + 16}px)`);
  });
});

describe("Footer on the Hub", () => {
  it("caps the notice and the legend only when hub is set", () => {
    const { rerender } = render(<Footer mode="estate" hub />);
    expect(screen.getByTestId("scene-footer").getAttribute("data-hub")).toBe("true");
    expect(screen.getByTestId("scene-footer-plaque").className).toContain("md:max-w-[var(--hub-notice-max)]");
    expect(screen.getByTestId("scene-footer-legend").className).toContain("md:max-w-[var(--hub-legend-max)]");
    rerender(<Footer mode="estate" />);
    expect(screen.getByTestId("scene-footer").getAttribute("data-hub")).toBeNull();
    expect(screen.getByTestId("scene-footer-plaque").className).not.toContain("hub-notice-max");
    expect(screen.getByTestId("scene-footer-legend").className).not.toContain("hub-legend-max");
  });

  it("SceneView passes hub only on the map", () => {
    expect(read("components/scene/SceneView.tsx")).toContain('hub={view === "map"}');
  });
});

describe("short viewports", () => {
  it("the Hub board keeps a minimum height under 700px tall (class mirrors the constant)", () => {
    expect(HUB_MIN_BOARD_H_PX).toBe(700);
    expect(read("components/scene/EstateMap.tsx")).toContain(
      `md:[@media(max-height:699px)]:min-h-[${HUB_MIN_BOARD_H_PX}px]`,
    );
  });

  it("the gate scatter gives up its bottom slice on short desktop viewports", () => {
    expect(read("components/scene/GatePlaceView.tsx")).toContain("min-[1100px]:h-[calc(100%-max(0px,150px-18%))] min-[768px]:max-[1099px]:h-[calc(100%-max(0px,180px-17.6%))]");
  });

  it("the gate place keeps a 720px board and its compact pager stops being fixed on short viewports", () => {
    const src = read("components/scene/GatePlaceView.tsx");
    expect(src).toContain("[@media(max-height:719px)]:min-h-[720px]");
    expect(src).toContain("bottom-0 z-40 flex justify-center px-4 pt-2 [@media(max-height:719px)]:absolute");
  });

  it("the gate board is 780px between 768 and 1099px wide under 780px tall", () => {
    expect(read("components/scene/GatePlaceView.tsx")).toContain("min-[768px]:max-[1099px]:[@media(max-height:779px)]:min-h-[780px]");
  });

  it("both pagers lift above the wrapped legend between 768 and 1099px", () => {
    expect(read("components/scene/GatePlaceView.tsx")).toContain("min-[768px]:max-[1099px]:bottom-24");
    expect(read("components/world/WorldPlaceView.tsx")).toContain("min-[768px]:max-[1099px]:pb-[calc(6rem");
  });
});

describe("markerFits", () => {
  it("fits when the band is as tall as the marker, not when it is shorter or collapsed", () => {
    expect(markerFits(200, 200)).toBe(true);
    expect(markerFits(200, 150)).toBe(false);
    expect(markerFits(200, 0)).toBe(false);
    expect(markerFits(200, -40)).toBe(false);
  });

  it("an unmeasured marker (jsdom) counts as fitting", () => {
    expect(markerFits(0, 0)).toBe(true);
  });

  it("renders with data-fit=true when nothing is measured", () => {
    const strata = [0, 1].map((i) => ({
      id: `s${i}`,
      label: `Chamber ${i + 1} of 2`,
      top: i * 800,
      bottom: (i + 1) * 800,
      focal: { fx: 0.5, fy: 0.4 },
    }));
    render(
      <div>
        <DepthMarker strata={strata} lengthVh={2} current={0} />
      </div>,
    );
    expect(screen.getByTestId("depth-marker").getAttribute("data-fit")).toBe("true");
    expect(screen.getByTestId("depth-marker").className).toContain("data-[fit=false]:invisible");
  });
});
