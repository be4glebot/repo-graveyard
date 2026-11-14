// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import Sun from "@/components/scene/Sun";

describe("Sun", () => {
  it("renders the day sun image path and falls back to the CSS sun on error", () => {
    const { container } = render(<Sun />);
    const wrapper = container.firstElementChild as HTMLElement;
    const img = container.querySelector("img") as HTMLImageElement;
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain("/art/day/sun.webp");
    fireEvent.error(img);
    expect(wrapper.getAttribute("data-sun-source")).toBe("drawn");
    expect(container.querySelector("img")).toBeNull();
    expect(wrapper.style.backgroundImage).toContain("--color-day-sun-core");
  });
});
