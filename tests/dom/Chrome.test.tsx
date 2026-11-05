/**
 * Component tests for the scene chrome fixes (task 13.2).
 *
 * Pins the painted-board treatment and the count-correct wording that the
 * chrome fix introduced across `Header`, `SummaryLine`, and `Footer`:
 *
 *   - the owner username renders in a bordered Cinzel badge/pill (Req 15.2),
 *     the summary line carries the letter-spaced Cinzel treatment (Req 15.3),
 *     and the Lights-on / Sound controls use the styled bordered toggle
 *     (Req 15.4);
 *   - every summary segment is singular/plural correct: a count of exactly 1
 *     renders the singular noun ("1 ghost", "1 soul"), and a count of 0 or 2+
 *     renders the plural ("0 ghosts", "2 ghosts") — per segment (Req 15.5,
 *     15.6, 15.7);
 *   - the footer legend groups the five lifecycle states under their four
 *     places, with the gate holding both zombie and risen (Req 15.8).
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks, matching `tests/dom/SceneView.test.tsx` and
 * `tests/landing-form.test.tsx`. `Header` calls `useRouter` from
 * `next/navigation`, which has no provider under jsdom, so it is mocked to a
 * no-op `push` exactly as those tests do.
 *
 * Requirements: 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Hoisted spy so the `next/navigation` mock can close over it; the Header's
// visit form calls `useRouter().push`, which would otherwise throw under jsdom.
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import Header from "@/components/ui/Header";
import SummaryLine from "@/components/ui/SummaryLine";
import Footer from "@/components/scene/Footer";
import { PLACE_ORDER, PLACES } from "@/lib/estate-view";
import type { SummaryCounts } from "@/lib/scene-view";

afterEach(() => {
  cleanup();
  push.mockReset();
});

/** Builds a `SummaryCounts` from per-state overrides; `souls` sums the states. */
function counts(overrides: Partial<Omit<SummaryCounts, "souls">>): SummaryCounts {
  const ghost = overrides.ghost ?? 0;
  const risen = overrides.risen ?? 0;
  const zombie = overrides.zombie ?? 0;
  const tombstone = overrides.tombstone ?? 0;
  const coffin = overrides.coffin ?? 0;
  return {
    souls: ghost + risen + zombie + tombstone + coffin,
    ghost,
    risen,
    zombie,
    tombstone,
    coffin,
  };
}

/** Renders a Header with inert, controllable props; counts drive the summary. */
function renderHeader(summary: SummaryCounts, username = "octocat") {
  return render(
    <Header
      counts={summary}
      username={username}
      mode="live"
      lightsOn={false}
      onLightsOnChange={() => {}}
      soundOn={false}
      onSoundChange={() => {}}
    />,
  );
}

describe("Header chrome (15.2, 15.3, 15.4)", () => {
  it("renders the owner username in a bordered Cinzel badge/pill (15.2)", () => {
    renderHeader(counts({ ghost: 1 }), "octocat");

    const badge = screen.getByTestId("header-username-badge");
    // The owner's name lives inside the pill.
    expect(badge.textContent).toBe("octocat");
    // Bordered pill: rounded-full + a border + the letter-spaced Cinzel
    // (heading/uppercase) treatment, replacing the old plain muted span.
    const cls = badge.className;
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("border");
    expect(cls).toContain("font-heading");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("tracking-[2px]");
  });

  it("renders the summary line in the letter-spaced Cinzel treatment (15.3)", () => {
    renderHeader(counts({ ghost: 1 }));

    const summary = screen.getByTestId("scene-summary-line");
    const cls = summary.className;
    expect(cls).toContain("font-heading");
    expect(cls).toContain("uppercase");
    // Letter-spaced: a tracking utility is applied.
    expect(cls).toContain("tracking-[2px]");
  });

  it("renders the Lights-on and Sound controls as styled bordered toggles (15.4)", () => {
    renderHeader(counts({ ghost: 1 }));

    const toggles = screen.getAllByTestId("styled-toggle");
    // Exactly the two chrome toggles: Lights on + Sound.
    expect(toggles).toHaveLength(2);

    const labels = toggles.map((t) => t.getAttribute("aria-label"));
    expect(labels).toContain("Lights on");
    expect(labels).toContain("Sound");

    // Both wear the bordered-pill treatment (rounded-full + a border).
    for (const toggle of toggles) {
      expect(toggle.getAttribute("role")).toBe("switch");
      expect(toggle.className).toContain("rounded-full");
      expect(toggle.className).toContain("border");
    }
  });
});

describe("SummaryLine pluralization per segment (15.5, 15.6, 15.7)", () => {
  // Each per-state segment and the exact singular/plural noun forms it uses.
  // The count-invariant phrases ("risen", "at rest", "sealed") read the same at
  // every count, so their singular and plural forms are identical.
  const cases: ReadonlyArray<{
    key: keyof Omit<SummaryCounts, "souls">;
    singular: string;
    plural: string;
  }> = [
    { key: "ghost", singular: "ghost", plural: "ghosts" },
    { key: "risen", singular: "risen", plural: "risen" },
    { key: "zombie", singular: "zombie", plural: "zombies" },
    { key: "tombstone", singular: "at rest", plural: "at rest" },
    { key: "coffin", singular: "sealed", plural: "sealed" },
  ];

  /**
   * The full summary-line text for a given set of counts. Reads from this
   * render's own container (not the global screen) so a test may render several
   * summaries without the queries colliding.
   */
  function summaryText(summary: SummaryCounts): string {
    const { container } = render(<SummaryLine counts={summary} />);
    const line = container.querySelector(
      '[data-testid="scene-summary-line"]',
    ) as HTMLElement;
    // Collapse the inter-span whitespace the DOM introduces so segment text
    // like "1 ghost" / "2 ghosts" compares cleanly.
    return line.textContent!.replace(/\s+/g, " ").trim();
  }

  it.each(cases)(
    "renders the singular noun for $key at count 1 (15.6)",
    ({ key, singular, plural }) => {
      const text = summaryText(counts({ [key]: 1 }));
      // "1 <singular>" is present...
      expect(text).toContain(`1 ${singular}`);
      // ...and never the plural "1 <plural>" for a distinct plural form.
      if (plural !== singular) {
        expect(text).not.toContain(`1 ${plural}`);
      }
    },
  );

  it.each(cases)(
    "renders the plural noun for $key at count 0 (15.5, 15.7)",
    ({ key, singular, plural }) => {
      const text = summaryText(counts({ [key]: 0 }));
      expect(text).toContain(`0 ${plural}`);
      if (plural !== singular) {
        expect(text).not.toContain(`0 ${singular} `);
      }
    },
  );

  it.each(cases)(
    "renders the plural noun for $key at count 2 (15.5, 15.7)",
    ({ key, singular, plural }) => {
      const text = summaryText(counts({ [key]: 2 }));
      expect(text).toContain(`2 ${plural}`);
      if (plural !== singular) {
        expect(text).not.toContain(`2 ${singular} `);
      }
    },
  );

  it("pluralizes the souls total: 1 soul (singular) vs 0 / 2 souls (plural)", () => {
    expect(summaryText(counts({ ghost: 1 }))).toContain("1 soul ");
    expect(summaryText(counts({}))).toContain("0 souls");
    expect(summaryText(counts({ ghost: 2 }))).toContain("2 souls");
  });

  it("pluralizes each segment independently within one line", () => {
    // One ghost (singular), two zombies (plural), zero coffins (plural) all at
    // once: each segment picks its own noun form.
    const text = summaryText(counts({ ghost: 1, zombie: 2, coffin: 0 }));
    expect(text).toContain("1 ghost");
    expect(text).not.toContain("1 ghosts");
    expect(text).toContain("2 zombies");
    expect(text).toContain("0 sealed");
  });
});

describe("Footer legend grouping (15.8)", () => {
  it("groups the five lifecycle states under their four places", () => {
    render(<Footer mode="live" />);

    const legend = screen.getByTestId("scene-footer-legend");

    // One group per place, in display order (sky, gate, ground, crypt).
    const placeGroups = legend.querySelectorAll("[data-legend-place]");
    expect(placeGroups).toHaveLength(PLACE_ORDER.length);
    expect(
      Array.from(placeGroups).map((el) => el.getAttribute("data-legend-place")),
    ).toEqual(PLACE_ORDER);

    // Every one of the five states appears exactly once across all groups.
    const stateEls = legend.querySelectorAll("[data-legend-state]");
    const allStates = Array.from(stateEls).map((el) =>
      el.getAttribute("data-legend-state"),
    );
    expect([...allStates].sort()).toEqual(
      ["coffin", "ghost", "risen", "tombstone", "zombie"].sort(),
    );

    // Each place group lists exactly the states PLACES says it holds, in order.
    for (const placeId of PLACE_ORDER) {
      const group = legend.querySelector(
        `[data-legend-place="${placeId}"]`,
      ) as HTMLElement;
      expect(group).not.toBeNull();
      // Resolve the member states directly from the group's own markup.
      const members = Array.from(
        group.querySelectorAll("[data-legend-state]"),
      ).map((el) => el.getAttribute("data-legend-state"));
      expect(members).toEqual(PLACES[placeId].states);
    }
  });

  it("holds both zombie and risen under the gate", () => {
    render(<Footer mode="live" />);

    const gate = screen
      .getByTestId("scene-footer-legend")
      .querySelector('[data-legend-place="gate"]') as HTMLElement;
    expect(gate).not.toBeNull();

    const gateStates = Array.from(
      gate.querySelectorAll("[data-legend-state]"),
    ).map((el) => el.getAttribute("data-legend-state"));
    expect(gateStates).toContain("zombie");
    expect(gateStates).toContain("risen");

    // The three single-state places each list exactly one state.
    for (const placeId of ["sky", "ground", "crypt"] as const) {
      const group = screen
        .getByTestId("scene-footer-legend")
        .querySelector(`[data-legend-place="${placeId}"]`) as HTMLElement;
      const states = group.querySelectorAll("[data-legend-state]");
      expect(states).toHaveLength(1);
    }
  });
});
