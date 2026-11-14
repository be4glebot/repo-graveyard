/**
 * DOM test for `CropLayer` (task 5.7).
 * Requirements: 3.4, 16.7, 19.1, 19.3, 19.4
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import CropLayer from "@/components/world/CropLayer";
import { PLATE_SIZE, computeCrop } from "@/lib/world-art";

afterEach(() => cleanup());

const PROPS = {
  plate: "place-sky" as const,
  element: { w: 1960, h: 1200 },
  focal: { fx: 0.75, fy: 0.14 },
  anchor: { ax: 0.75, ay: 0.22 },
  "data-testid": "crop",
};

describe("CropLayer", () => {
  it("is a clipped, hidden, inert decor wrapper on the night-sky fill", () => {
    const { getByTestId } = render(<CropLayer {...PROPS} />);
    const root = getByTestId("crop");
    expect(root.hasAttribute("data-decor-clip")).toBe(true);
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.hasAttribute("inert")).toBe(true);
    expect(root.className).toContain("overflow-clip");
    expect(root.style.backgroundColor).toBe("var(--color-night-sky)");
    expect(root.querySelector("button, a, input, [tabindex]")).toBeNull();
  });

  it("uses one uniform scale from computeCrop and never repeats", () => {
    const { getByTestId } = render(<CropLayer {...PROPS} />);
    const img = getByTestId("crop-image");
    const crop = computeCrop({
      plate: PLATE_SIZE["place-sky"],
      element: PROPS.element,
      focal: PROPS.focal,
      anchor: PROPS.anchor,
      flip: { h: false, v: false },
    });
    expect(img.style.backgroundImage).toContain("/art/place-sky.webp");
    expect(img.style.backgroundRepeat).toBe("no-repeat");
    expect(img.style.backgroundSize).toBe(
      `${crop.plate.w * crop.scale}px ${crop.plate.h * crop.scale}px`,
    );
    expect(img.style.backgroundPosition).toBe(
      `${-crop.rect.x * crop.scale}px ${-crop.rect.y * crop.scale}px`,
    );
  });

  it("flips with a transform only when asked", () => {
    const { getByTestId } = render(
      <CropLayer {...PROPS} flip={{ h: true, v: false }} />,
    );
    expect(getByTestId("crop-image").style.transform).toBe("scale(-1, 1)");
  });

  it("hides only the image on error and keeps the wrapper fill", () => {
    const { getByTestId } = render(<CropLayer {...PROPS} />);
    fireEvent.error(getByTestId("crop-probe"));
    const root = getByTestId("crop");
    const img = getByTestId("crop-image");
    expect(img.style.backgroundImage).toBe("none");
    expect(img.getAttribute("data-crop-failed")).toBe("true");
    expect(root.style.backgroundColor).toBe("var(--color-night-sky)");
    expect(root.hasAttribute("data-decor-clip")).toBe(true);
  });
});
