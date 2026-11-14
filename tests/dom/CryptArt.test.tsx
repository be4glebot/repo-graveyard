/**
 * DOM test for `CryptArt` (task 14.1).
 * Requirements: 9.2, 9.4, 9.6, 9.10, 18.2, 19.5, 19.7, 19.8
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import CryptArt, {
  CRYPT_DARKNESS_MAX,
  cryptSpecFor,
} from "@/components/world/CryptArt";
import { WORLD_ART } from "@/lib/world-art";
import { WORLD_EFFECTS } from "@/lib/world-effects";
import { computeWorldLayout } from "@/lib/world-layout";
import { ambientBrightness } from "@/lib/world-motion";

afterEach(() => cleanup());

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `repo-${i}`);
const layoutFor = (n: number, viewportW = 1280, viewportH = 800) =>
  computeWorldLayout({ place: "crypt", names: names(n), viewportW, viewportH });

describe("CryptArt", () => {
  it("renders one place-crypt Crop per Stratum", () => {
    for (const n of [0, 1, 4, 9, 20]) {
      const layout = layoutFor(n);
      const { getAllByTestId, unmount } = render(
        <CryptArt layout={layout} viewportW={1280} />,
      );
      expect(getAllByTestId("crypt-crop")).toHaveLength(layout.strata.length);
      getAllByTestId("crypt-crop-image").forEach((img) =>
        expect(img.getAttribute("data-crop-plate")).toBe("place-crypt"),
      );
      unmount();
    }
  });

  it("uses the table specs: chamber-2 flipped and cool, chamber-3 offset 25 percent", () => {
    const c2 = cryptSpecFor("chamber-2");
    expect(c2.flip.h).toBe(true);
    expect(c2.tint).toBe("cool");
    expect(c2.filter).toBe("brightness(0.85)");
    const c3 = cryptSpecFor("chamber-3");
    expect(Math.abs(c3.offset?.x ?? 0)).toBeGreaterThanOrEqual(0.25);
    expect(c3.filter).toBe("brightness(0.7)");
    expect(cryptSpecFor("chamber-1").tint).toBe("warm");
    expect(cryptSpecFor("entry")).toEqual(WORLD_ART.crypt[0]);
  });

  it("never gives two neighbouring chambers the same Crop", () => {
    const key = (id: string): string => {
      const s = cryptSpecFor(id);
      return `${s.flip.h}|${s.offset?.x ?? 0}|${s.tint ?? ""}`;
    };
    for (let n = 1; n < 9; n++) {
      expect(key(`chamber-${n}`)).not.toBe(key(`chamber-${n + 1}`));
    }
  });

  it("applies the Crop filters and tint washes through the layers", () => {
    const { getAllByTestId } = render(<CryptArt layout={layoutFor(12)} viewportW={1280} />);
    const strata = getAllByTestId("crypt-band").map((b) => b.getAttribute("data-stratum"));
    expect(strata).toEqual(["entry", "chamber-1", "chamber-2", "chamber-3"]);
    const tints = getAllByTestId("crypt-tint").map((t) => t.getAttribute("data-tint"));
    expect(tints).toEqual(["warm", "cool"]);
  });

  it("builds stair steps, an arch and stair/arch Blend_Zones from CSS gradients", () => {
    const layout = layoutFor(12);
    const { getByTestId, container } = render(<CryptArt layout={layout} viewportW={1280} />);
    expect(getByTestId("crypt-stairs").style.backgroundImage).toContain("repeating-linear-gradient");
    expect(getByTestId("crypt-arch").style.backgroundImage).toContain("radial-gradient");
    const zones = container.querySelectorAll("[data-blend-zone]");
    expect(zones.length).toBe(layout.blendZones.length);
    const kinds = Array.from(zones).map((z) => z.getAttribute("data-blend-zone"));
    expect(kinds).toContain("stairs");
    expect(kinds).toContain("arch");
  });

  it("tags torches, dust and darkness with registered effects; chain shadow is static", () => {
    const { container, getAllByTestId } = render(
      <CryptArt layout={layoutFor(12)} viewportW={1280} />,
    );
    const ids = new Set(
      Array.from(container.querySelectorAll("[data-effect]")).map((e) =>
        e.getAttribute("data-effect"),
      ),
    );
    for (const id of ids) expect(WORLD_EFFECTS.some((e) => e.id === id)).toBe(true);
    expect(ids).toEqual(new Set(["torch-flicker", "crypt-dust", "chamber-darkness"]));
    expect(getAllByTestId("crypt-torch").length).toBeGreaterThan(0);
    expect(getAllByTestId("crypt-chain-shadow").length).toBeGreaterThan(0);
    const ambient = Array.from(ids).filter(
      (id) => WORLD_EFFECTS.find((e) => e.id === id)?.ambient,
    );
    expect(ambient.length).toBeLessThanOrEqual(4);
  });

  it("renders dust at the crypt mist token and never the Data_Fog ids", () => {
    const { container, getAllByTestId, queryByTestId } = render(
      <CryptArt layout={layoutFor(12)} viewportW={1280} />,
    );
    getAllByTestId("place-mist-far").forEach((m) =>
      expect(m.getAttribute("data-place")).toBe("crypt"),
    );
    expect(container.querySelector('[data-testid="crypt-dust"]')?.getAttribute("data-place")).toBe("crypt");
    expect(queryByTestId("fog-far")).toBeNull();
    expect(queryByTestId("fog-near")).toBeNull();
  });

  it("drives the darkness overlay from --world-depth with a 0.2 maximum", () => {
    const layout = layoutFor(12);
    const { getByTestId } = render(<CryptArt layout={layout} viewportW={1280} />);
    const overlay = getByTestId("crypt-darkness");
    expect(overlay.className).toContain("crypt-darkness");
    expect(parseFloat(overlay.getAttribute("data-max-opacity") ?? "NaN")).toBeCloseTo(
      1 - ambientBrightness(1),
      10,
    );
    expect(CRYPT_DARKNESS_MAX).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(ambientBrightness(0)).toBe(1);
    expect(parseFloat(overlay.style.height)).toBe(layout.heightPx);
  });

  it("drops the torch flicker class under reduced motion", () => {
    const { container, rerender } = render(
      <CryptArt layout={layoutFor(12)} viewportW={1280} />,
    );
    expect(container.querySelector(".lantern-flicker")).not.toBeNull();
    rerender(<CryptArt layout={layoutFor(12)} viewportW={1280} reducedMotion />);
    expect(container.querySelector(".lantern-flicker")).toBeNull();
    expect(container.querySelector(".env-mist, .env-mist-near")).toBeNull();
  });

  it("marks every layer aria-hidden and inert, with nothing focusable", () => {
    const { container } = render(<CryptArt layout={layoutFor(12)} viewportW={1280} />);
    for (const id of ["crypt-band", "crypt-mid-band", "crypt-fg-band", "crypt-darkness"]) {
      container.querySelectorAll(`[data-testid="${id}"]`).forEach((el) => {
        expect(el.getAttribute("aria-hidden")).toBe("true");
        expect(el.hasAttribute("inert")).toBe(true);
      });
    }
    container.querySelectorAll("[data-blend-zone]").forEach((z) => {
      expect(z.getAttribute("aria-hidden")).toBe("true");
      expect(z.hasAttribute("inert")).toBe(true);
    });
    expect(container.querySelector("button, a, input, [tabindex]")).toBeNull();
  });

  it("never repeats a Plate: no repeat, and no two Crops are identical", () => {
    const { getAllByTestId } = render(<CryptArt layout={layoutFor(16)} viewportW={1280} />);
    const images = getAllByTestId("crypt-crop-image");
    const keys = new Set<string>();
    images.forEach((img) => {
      expect(img.style.backgroundRepeat).toBe("no-repeat");
      keys.add((img.style.transform ?? "") + "|" + img.style.backgroundPosition);
    });
    expect(keys.size).toBe(images.length);
  });
});
