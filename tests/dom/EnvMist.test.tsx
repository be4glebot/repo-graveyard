/**
 * DOM test for `EnvMist` (task 5.7).
 * Requirements: 8.13, 12.12, 15.9, 19.4
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import EnvMist from "@/components/world/EnvMist";

afterEach(() => cleanup());

const CSS = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function token(name: string): number {
  const m = CSS.match(new RegExp(`--world-mist-${name}:\\s*([0-9.]+)`));
  if (!m) throw new Error(`missing token ${name}`);
  return Number(m[1]);
}

describe("EnvMist", () => {
  it("renders the mist test ids and never the Data_Fog ids", () => {
    const { queryByTestId } = render(
      <>
        <EnvMist place="ground" layer="far" />
        <EnvMist place="ground" layer="near" />
      </>,
    );
    expect(queryByTestId("place-mist-far")).not.toBeNull();
    expect(queryByTestId("place-mist-near")).not.toBeNull();
    expect(queryByTestId("scene-fog")).toBeNull();
    expect(queryByTestId("scene-fog-near")).toBeNull();
  });

  it("is one non-tiled fog-wisps crop in a decor clip, transparent backdrop", () => {
    const { getByTestId } = render(<EnvMist place="sky" layer="far" />);
    const root = getByTestId("place-mist-far");
    const img = getByTestId("place-mist-far-image");
    expect(root.hasAttribute("data-decor-clip")).toBe(true);
    expect(root.getAttribute("data-place")).toBe("sky");
    expect(root.style.backgroundColor).toBe("");
    expect(img.style.backgroundImage).toContain("/art/fog-wisps.webp");
    expect(img.style.backgroundRepeat).toBe("no-repeat");
  });

  it("takes opacity from the fixed place token, within the caps", () => {
    const { getByTestId } = render(<EnvMist place="crypt" layer="far" />);
    expect(getByTestId("place-mist-far-image").style.opacity).toBe(
      "var(--env-mist-opacity, 0)",
    );
    expect(token("sky")).toBeLessThanOrEqual(0.25);
    expect(token("ground")).toBeLessThanOrEqual(0.25);
    expect(token("crypt")).toBeLessThanOrEqual(0.2);
    expect(CSS).toMatch(/\[data-place="crypt"\]\s*\{\s*--env-mist-opacity:\s*var\(--world-mist-crypt\)/);
  });

  it("sways under motion and is static under reduced motion", () => {
    const moving = render(<EnvMist place="ground" layer="far" />);
    expect(moving.getByTestId("place-mist-far-image").classList.contains("env-mist")).toBe(true);
    cleanup();
    const nearMoving = render(<EnvMist place="ground" layer="near" />);
    expect(nearMoving.getByTestId("place-mist-near-image").classList.contains("env-mist-near")).toBe(true);
    cleanup();

    const still = render(
      <>
        <EnvMist place="ground" layer="far" reducedMotion />
        <EnvMist place="ground" layer="near" reducedMotion />
      </>,
    );
    expect(still.getByTestId("place-mist-far-image").classList.contains("env-mist")).toBe(false);
    expect(still.getByTestId("place-mist-near-image").classList.contains("env-mist-near")).toBe(false);
  });

  it("feathered mist fades all four sides and keeps the plate's aspect (uniform scale)", () => {
    const { getByTestId } = render(<EnvMist place="ground" layer="far" feather width={2400} />);
    const root = getByTestId("place-mist-far");
    const mask = root.style.maskImage || root.style.webkitMaskImage;
    // One elliptical mask that reaches transparent at the middle of every side.
    expect(mask).toContain("radial-gradient(closest-side");
    expect(mask).toMatch(/transparent 100%\)$/);
    // The box extends past its container on both sides.
    expect(root.style.left).toBe("-12%");
    expect(root.style.right).toBe("-12%");
    // background-size keeps 1536:1024 (no non-uniform stretch).
    const img = getByTestId("place-mist-far-image");
    const [bw, bh] = img.style.backgroundSize.split(" ").map((v) => parseFloat(v));
    expect(bw / bh).toBeCloseTo(1536 / 1024, 3);
    // Overscan: the layer is wider than the box plus the +-2 percent sway.
    expect(parseFloat(img.style.width)).toBeGreaterThan(2400 * 0.96);
  });

  it("sizes the layer from viewportW so a zoomed-out stage is covered edge to edge", () => {
    const wide = render(<EnvMist place="ground" layer="far" viewportW={5120} />);
    expect(parseFloat(wide.getByTestId("place-mist-far-image").style.width)).toBeGreaterThanOrEqual(5120);
    cleanup();
    const normal = render(<EnvMist place="ground" layer="far" viewportW={1440} />);
    expect(parseFloat(normal.getByTestId("place-mist-far-image").style.width)).toBe(2048);
  });

  it("default (sky, crypt) mist keeps the linear edge mask", () => {
    const { getByTestId } = render(<EnvMist place="sky" layer="far" />);
    const mask = getByTestId("place-mist-far").style.maskImage;
    expect(mask).toContain("linear-gradient");
    expect(mask).not.toContain("radial-gradient");
  });});
