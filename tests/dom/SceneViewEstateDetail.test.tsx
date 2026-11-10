/**
 * DOM test on the `/estate` data path: fixture creatures inside a place show
 * the "Sample repository" note (panel + hover card) and render no external
 * links. Data flows exactly as `app/estate/page.tsx` does it:
 * estateSchema.parse(fixture) -> resolveEstate -> buildRows -> SceneView.
 * Plain DOM assertions (no jest-dom).
 *
 * Requirements: 12.2, 12.3, 12.4, 12.5
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import SceneView from "@/components/scene/SceneView";
import { hoverCardId } from "@/components/detail/HoverCardLayer";
import estateJson from "@/data/estate.json";
import { resolveEstate } from "@/lib/estate";
import { estateSchema } from "@/lib/estate-schema";
import { orderForPlace, placeOf } from "@/lib/estate-view";
import { buildRows } from "@/lib/graveyard-view";
import { creatureAccessibleName } from "@/lib/scene-view";

const NOW = "2024-06-01T00:00:00.000Z";

const fixture = estateSchema.parse(estateJson);
const { repos, overrides } = resolveEstate(fixture, NOW);
const rows = buildRows(repos, overrides, NOW);

// Pick the first creature of the first place that has any.
const place = placeOf(rows[0]);
const target = orderForPlace(
  place,
  rows.filter((r) => placeOf(r) === place),
)[0];

function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("hover: hover"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderEstate() {
  return render(
    <SceneView
      rows={rows}
      repos={repos}
      truncated={false}
      username={null}
      renderedAt={NOW}
      mode="estate"
      estateOverrides={overrides}
      at={place}
    />,
  );
}

const creature = () =>
  screen.getByRole("button", {
    name: creatureAccessibleName(target),
  }) as HTMLButtonElement;

beforeEach(() => {
  window.history.replaceState(null, "", "/estate");
  stubMedia();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 100,
    right: 200,
    bottom: 200,
    width: 100,
    height: 100,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  push.mockReset();
  document.body.removeAttribute("style");
  window.history.replaceState(null, "", "/estate");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("estate fixture creatures show no external links (12.2-12.5)", () => {
  it("panel shows 'Sample repository' and no external links", () => {
    renderEstate();
    fireEvent.click(creature());

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("Sample repository");
    expect(dialog!.querySelector('a[target="_blank"]')).toBeNull();
    expect(dialog!.querySelector("a[href]")).toBeNull();
  });

  it("hover card (pointer dwell) shows 'Sample repository' and no GitHub link", () => {
    vi.useFakeTimers();
    renderEstate();
    fireEvent.pointerEnter(creature());
    act(() => void vi.advanceTimersByTime(250));

    const card = document.getElementById(hoverCardId(target.name));
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("Sample repository");
    expect(card!.querySelector("a")).toBeNull();
  });

  it("hover card (keyboard focus) shows 'Sample repository' and no GitHub link", () => {
    vi.useFakeTimers();
    renderEstate();
    act(() => creature().focus());
    act(() => void vi.advanceTimersByTime(100));

    const card = document.getElementById(hoverCardId(target.name));
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("Sample repository");
    expect(card!.querySelector("a")).toBeNull();
  });
});
