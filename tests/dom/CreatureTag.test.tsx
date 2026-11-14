/**
 * Tests for `CreatureTag` / `CreatureShadow` mounted through `Creature`.
 *
 * Requirements: 18.7, 18.11, 10.3
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Creature from "@/components/creatures/Creature";
import CreatureShadow from "@/components/world/CreatureShadow";
import CreatureTag from "@/components/world/CreatureTag";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => cleanup());

const row: GraveyardRow = {
  name: "weather-app",
  url: "https://github.com/octocat/weather-app",
  state: "zombie",
  daysQuiet: 240,
  decayLevel: 1,
};

describe("CreatureTag inside Creature", () => {
  it("is a descendant of the button, aria-hidden, with the full name in title", () => {
    render(
      <Creature
        row={row}
        tag={<CreatureTag variant="stake" name={row.name} />}
      />,
    );
    const button = screen.getByRole("button");
    const tag = screen.getByTestId("scatter-plaque");
    expect(button.contains(tag)).toBe(true);
    expect(tag.getAttribute("aria-hidden")).toBe("true");
    expect(tag.getAttribute("title")).toBe(row.name);
    expect(tag.className).toContain("absolute");
    expect(tag.innerHTML).toContain("text-xs");
  });

  it("does not announce the name twice", () => {
    render(
      <Creature
        row={row}
        tag={<CreatureTag variant="grave-marker" name={row.name} />}
      />,
    );
    const button = screen.getByRole("button");
    expect(screen.getAllByRole("button", { name: /weather-app/ })).toHaveLength(1);
    // The accessible name is the aria-label alone; the tag text is hidden.
    expect(button.getAttribute("aria-label")).toContain("weather-app");
    expect(screen.queryByText(row.name)).not.toBeNull();
    expect(screen.getByTestId("scatter-plaque").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("leaves the button's box-affecting attributes unchanged", () => {
    const { container: a } = render(<Creature row={row} />);
    const bare = a.querySelector("button")!;
    const bareRect = bare.getBoundingClientRect();
    const bareClass = bare.className;
    cleanup();
    const { container: b } = render(
      <Creature
        row={row}
        tag={<CreatureTag variant="stake" name={row.name} subline="8 months" />}
        shadow={<CreatureShadow />}
      />,
    );
    const withTag = b.querySelector("button")!;
    const rect = withTag.getBoundingClientRect();
    expect(withTag.className).toBe(bareClass);
    expect(rect.width).toBe(bareRect.width);
    expect(rect.height).toBe(bareRect.height);
    expect(screen.getByTestId("creature-shadow").getAttribute("aria-hidden")).toBe("true");
  });

  it("clicking the tag activates the creature", async () => {
    const onSelect = vi.fn();
    render(
      <Creature
        row={row}
        onSelect={onSelect}
        tag={<CreatureTag variant="hanging" name={row.name} />}
      />,
    );
    await userEvent.click(screen.getByTestId("scatter-plaque"));
    expect(onSelect).toHaveBeenCalledWith(row.name);
  });

  it("mirror flips the art only, and output is unchanged without the new props", () => {
    const { container } = render(
      <Creature
        row={row}
        mirror
        tag={<CreatureTag variant="lantern" name={row.name} decayLevel={2} />}
      />,
    );
    const button = container.querySelector("button")!;
    expect(button.style.transform).toBe("");
    const flipped = button.querySelector("span[style*='scaleX(-1)']");
    expect(flipped).not.toBeNull();
    expect(flipped!.contains(screen.getByTestId("scatter-plaque"))).toBe(false);

    cleanup();
    const first = render(<Creature row={row} />).container.innerHTML;
    cleanup();
    const second = render(
      <Creature row={row} size={undefined} tag={undefined} shadow={undefined} mirror={undefined} />,
    ).container.innerHTML;
    expect(second).toBe(first);
  });

  it("size overrides the art box", () => {
    const { container } = render(<Creature row={row} size={64} />);
    expect(container.querySelector("img")!.getAttribute("width")).toBe("64");
  });
});
