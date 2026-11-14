// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockTheme: "day" | "night" = "day";
vi.mock("@/components/scene/ThemeProvider", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: () => {} }),
}));

import ShellBackdrop from "@/components/scene/ShellBackdrop";

afterEach(cleanup);

describe("ShellBackdrop in day", () => {
  it("uses the day palette for the gate plate (no night art)", () => {
    mockTheme = "day";
    render(<ShellBackdrop image="place-gate" />);
    expect(screen.getByTestId("day-palette")).toBeTruthy();
    expect(screen.getByTestId("shell-backdrop").querySelector("img")).toBeNull();
  });

  it("keeps the night plate at night", () => {
    mockTheme = "night";
    render(<ShellBackdrop image="place-gate" />);
    expect(screen.queryByTestId("day-palette")).toBeNull();
    expect(screen.getByTestId("shell-backdrop").querySelector("img")).not.toBeNull();
  });
});
