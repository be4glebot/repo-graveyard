/**
 * DOM tests for the Revive in Kiro slot and button: when the button appears,
 * the empty slot for every other case, the button markup and keyboard
 * activation, and the absence of the button in the non-result séance phases.
 * Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 2.1, 2.4, 2.5, 2.6,
 * 2.9, 8.8
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DetailPanel from "@/components/detail/DetailPanel";
import { KiroSlot } from "@/components/seance/KiroSlot";
import { ReviveInKiro } from "@/components/seance/ReviveInKiro";
import { VerdictCard } from "@/components/seance/VerdictCard";
import estateJson from "@/data/estate.json";
import { resolveEstate } from "@/lib/estate";
import { estateSchema } from "@/lib/estate-schema";
import { buildRows } from "@/lib/graveyard-view";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import { buildRepoRows, type RepoRow } from "@/lib/repoRow";
import type { SeanceResult, Verdict } from "@/lib/seance-schema";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const daysAgo = (d: number) =>
  new Date(NOW_MS - d * LIFECYCLE_CONFIG.msPerDay).toISOString();

const estate = estateSchema.parse(estateJson);
const { repos: estateRepos, overrides } = resolveEstate(estate, NOW);
const estateRows = buildRows(estateRepos, overrides, NOW);
const estateRepoRows = buildRepoRows(estateRepos);

const RESULT: SeanceResult = {
  voice: "The login page was where I stopped. The callback never finished.",
  causeOfDeath: "A half-built callback stalled it.",
  unfinishedBusiness: [
    {
      title: "Finish the callback",
      detail: "The redirect still loops back.",
      evidence: "commit abc1234 in auth.ts",
    },
  ],
  verdict: "revive",
  verdictReason: "The work is nearly there.",
};

const verdictOf = (r: { seanceResult?: unknown }) =>
  (r.seanceResult as { verdict?: string } | undefined)?.verdict;

const withVerdict = (verdict: Verdict): SeanceResult => ({ ...RESULT, verdict });

const FACTS = { owner: "octocat", repo: "crypt-keeper", state: "zombie" };
const ESTATE_FACTS = { owner: "", repo: "lantern-notes", state: "zombie" };
const SLOT = '[data-slot="revive-in-kiro"]';
const BUTTON_NAME = /Revive in Kiro/;
const FOCUSABLE =
  'button:not([disabled]), a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

afterEach(cleanup);

function renderSlot(result: SeanceResult | undefined, facts = FACTS, announce = true) {
  return render(
    <div>
      {result ? <VerdictCard result={result} /> : null}
      <KiroSlot
        result={result}
        facts={facts}
        onAnnounce={announce ? () => {} : undefined}
      />
    </div>,
  );
}

function expectEmptySlot(container: HTMLElement) {
  const slots = container.querySelectorAll(SLOT);
  expect(slots).toHaveLength(1);
  expect(slots[0].childNodes).toHaveLength(0);
  expect(slots[0].textContent).toBe("");
  expect(screen.queryByRole("button", { name: BUTTON_NAME })).toBeNull();
}

describe("slot contents by verdict (1.1, 1.2, 1.3, 1.5, 1.6, 1.7)", () => {
  it("holds exactly one Revive_Button for a revive verdict, right after the Verdict_Card", () => {
    const { container } = renderSlot(RESULT);
    expect(screen.getAllByRole("button", { name: BUTTON_NAME })).toHaveLength(1);
    expect(container.querySelectorAll(SLOT)).toHaveLength(1);
    const card = container.querySelector("[data-verdict-card]")!;
    expect(card.nextElementSibling).toBe(container.querySelector(SLOT));
  });

  it.each(["finish", "seal"] as const)("is empty for a %s verdict", (verdict) => {
    const { container } = renderSlot(withVerdict(verdict));
    expectEmptySlot(container);
  });

  it("is empty for an absent result", () => {
    const { container } = renderSlot(undefined);
    expectEmptySlot(container);
  });

  it("is empty for an unknown verdict", () => {
    const { container } = renderSlot({
      ...RESULT,
      verdict: "maybe" as unknown as Verdict,
    });
    expectEmptySlot(container);
  });

  it("is empty without facts or an announcer", () => {
    const noAnnounce = renderSlot(RESULT, FACTS, false);
    expectEmptySlot(noAnnounce.container);
    cleanup();
    const { container } = render(<KiroSlot result={RESULT} />);
    expectEmptySlot(container);
  });

  const reviveFixtures = estate.repos.filter((r) => verdictOf(r) === "revive");
  const otherFixtures = estate.repos.filter((r) => verdictOf(r) !== "revive");

  it("has revive and non-revive estate fixtures to cover", () => {
    expect(reviveFixtures.length).toBeGreaterThan(0);
    expect(otherFixtures.length).toBeGreaterThan(0);
  });

  it.each(reviveFixtures.map((r) => [r.name, r] as const))(
    "estate fixture %s shows exactly one button",
    (_name, fixture) => {
      const { container } = renderSlot(fixture.seanceResult as SeanceResult, {
        ...ESTATE_FACTS,
        repo: fixture.name,
      });
      expect(screen.getAllByRole("button", { name: BUTTON_NAME })).toHaveLength(1);
      expect(container.querySelectorAll(SLOT)).toHaveLength(1);
    },
  );

  it.each(otherFixtures.map((r) => [r.name, r] as const))(
    "estate fixture %s leaves the slot empty",
    (_name, fixture) => {
      const { container } = renderSlot(fixture.seanceResult as SeanceResult, {
        ...ESTATE_FACTS,
        repo: fixture.name,
      });
      expectEmptySlot(container);
    },
  );
});

describe("button markup (2.1, 2.4, 2.5, 2.6, 2.9)", () => {
  it("is a native type=button with visible text and one aria-hidden svg, no img", () => {
    renderSlot(RESULT);
    const button = screen.getByRole("button", { name: BUTTON_NAME });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.textContent?.trim()).toBe("Revive in Kiro");
    const svgs = button.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0].getAttribute("aria-hidden")).toBe("true");
    expect(button.querySelector("img")).toBeNull();
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("is the first tab stop after the Verdict_Card", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">before</button>
        <VerdictCard result={RESULT} />
        <KiroSlot result={RESULT} facts={FACTS} onAnnounce={() => {}} />
        <button type="button">after</button>
      </div>,
    );
    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: BUTTON_NAME }),
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("%s activates once and opens one dialog", async (_label, keys) => {
    const user = userEvent.setup();
    render(<ReviveInKiro result={RESULT} facts={FACTS} onAnnounce={() => {}} />);
    screen.getByRole("button", { name: BUTTON_NAME }).focus();
    await user.keyboard(keys);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("has the same label and enabled state for estate and live data", () => {
    const describeButton = (facts: typeof FACTS) => {
      const { unmount } = render(
        <ReviveInKiro result={RESULT} facts={facts} onAnnounce={() => {}} />,
      );
      const b = screen.getByRole("button", { name: BUTTON_NAME });
      const out = [b.textContent, b.hasAttribute("disabled"), b.getAttribute("aria-disabled")];
      unmount();
      return out;
    };
    expect(describeButton(ESTATE_FACTS)).toEqual(describeButton(FACTS));
  });
});

/* ---- Séance phases inside the real panel (1.4, 8.8) ----------------------- */

const FACTS_REPO: RepoFacts = {
  name: "crypt-keeper",
  description: null,
  url: "https://github.com/octocat/crypt-keeper",
  pushedAt: daysAgo(300),
  createdAt: daysAgo(400),
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 0,
  primaryLanguage: null,
  openIssueCount: 0,
  releaseCount: 0,
  readmeBytes: null,
  lastCommitMessage: null,
  languageColor: null,
  forkCount: 0,
  topics: [],
};

const ROW: RepoRow = {
  name: "crypt-keeper",
  description: "Keeps the crypt.",
  url: "https://github.com/octocat/crypt-keeper",
  homepageUrl: null,
  primaryLanguage: null,
  stargazerCount: 0,
  forkCount: 0,
  openIssueCount: 0,
  topics: [],
  pushedAt: daysAgo(300),
  createdAt: daysAgo(900),
  isArchived: false,
  isFork: false,
};

function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      query.includes("min-width: 768px") || query.includes("hover: hover"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function stubFetch(handler: () => unknown) {
  const fn = vi.fn(async () => handler());
  vi.stubGlobal("fetch", fn);
  return fn;
}
const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function renderPanel(props: Record<string, unknown> = {}) {
  return render(
    <DetailPanel
      row={ROW}
      owner="octocat"
      classification={{ state: "zombie", decayLevel: 0 }}
      facts={FACTS_REPO}
      renderedAt={NOW}
      isFixture={false}
      onClose={() => {}}
      {...props}
    />,
  );
}

const hold = () =>
  fireEvent.click(screen.getByRole("button", { name: /Hold a séance/ }));
const reviveButtons = () => screen.queryAllByRole("button", { name: BUTTON_NAME });

describe("SeanceRegion phases", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    stubMedia();
    vi.useFakeTimers();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    document.body.removeAttribute("style");
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows no button before and during the ritual, then exactly one for a live revive", async () => {
    stubFetch(() => reply({ kind: "ok", result: RESULT }));
    renderPanel();
    expect(reviveButtons()).toHaveLength(0);
    hold();
    await flush(0);
    expect(document.querySelector("[data-seance-ritual]")).not.toBeNull();
    expect(reviveButtons()).toHaveLength(0);

    await flush(2600);
    expect(document.querySelector("[data-seance-ritual]")).toBeNull();
    expect(reviveButtons()).toHaveLength(1);
    expect(document.querySelectorAll(SLOT)).toHaveLength(1);
  });

  it.each(["veil", "weak", "silent"] as const)(
    "shows no button in the %s phase and leaves one empty slot or none",
    async (kind) => {
      stubFetch(() => reply({ kind }));
      renderPanel();
      hold();
      await flush(0);
      expect(document.querySelector(`[data-seance-state="${kind}"]`)).not.toBeNull();
      expect(reviveButtons()).toHaveLength(0);
      for (const slot of document.querySelectorAll(SLOT)) {
        expect(slot.childNodes).toHaveLength(0);
      }
    },
  );

  it.each(["finish", "seal"] as const)(
    "shows no button for a live %s result",
    async (verdict) => {
      stubFetch(() => reply({ kind: "ok", result: withVerdict(verdict) }));
      renderPanel();
      hold();
      await flush(2600);
      expect(document.querySelector("[data-verdict-card]")).not.toBeNull();
      expect(reviveButtons()).toHaveLength(0);
      expect(document.querySelectorAll(SLOT)).toHaveLength(1);
    },
  );

  it("places the button directly after the Verdict_Card in tab order and matches the estate", async () => {
    const index = estate.repos.findIndex((r) => verdictOf(r) === "revive");
    expect(index).toBeGreaterThanOrEqual(0);
    const fetchFn = stubFetch(() => {
      throw new Error("no fetch on the estate");
    });
    renderPanel({
      row: estateRepoRows[index],
      owner: "",
      classification: {
        state: estateRows[index].state,
        decayLevel: estateRows[index].decayLevel,
      },
      facts: estateRepos[index],
      isFixture: true,
      seanceFixture: estate.repos[index].seanceResult,
    });
    hold();
    await flush(3000);
    await flush(3000);

    const buttons = reviveButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent?.trim()).toBe("Revive in Kiro");
    expect(buttons[0].hasAttribute("disabled")).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();

    const card = document.querySelector("[data-verdict-card]")!;
    expect(card.nextElementSibling).toBe(document.querySelector(SLOT));
    const after = Array.from(
      document.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter(
      (el) =>
        !card.contains(el) &&
        card.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(after[0]).toBe(buttons[0]);
  });
});
