/**
 * DOM tests for the séance flow inside the detail panel (ritual, skip paths,
 * reduced motion, focus, copy, Veil/Weak/Silent states). `fetch` is stubbed and
 * fails the test on any URL other than /api/seance; the real API is never hit.
 * Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 1.4-1.8, 8.5-8.8, 9.1-9.9, 10.1, 10.9, 10.10, 10.12-10.14,
 * 16.5, 16.6, 16.9, 16.10, 18.2, 18.4, 18.6, 18.9, 20.4, 20.5, 20.14
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import DetailPanel, { type DetailPanelProps } from "@/components/detail/DetailPanel";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";
import type { SeanceResult } from "@/lib/seance-schema";
import { buildTranscriptText } from "@/lib/seance-transcript";

const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function daysAgo(days: number): string {
  return new Date(NOW_MS - days * LIFECYCLE_CONFIG.msPerDay).toISOString();
}

const FACTS: RepoFacts = {
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

const RESULT: SeanceResult = {
  voice:
    "The login page was where I stopped. The callback never finished redirecting.",
  causeOfDeath: "A half-built callback stalled it.",
  unfinishedBusiness: [
    {
      title: "Finish the callback",
      detail: "The redirect still loops back.",
      evidence: "commit abc1234 in auth.ts",
    },
    {
      title: "Merge the settings branch",
      detail: "It holds the real work.",
      evidence: "branch feature/settings",
    },
  ],
  verdict: "revive",
  verdictReason: "The work is nearly there.",
};

const HEADING = /AI · from the facts above/;

function stubMedia({ reduced = false }: { reduced?: boolean } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => {
    let matches = false;
    if (query.includes("min-width: 768px")) matches = true;
    else if (query.includes("prefers-reduced-motion")) matches = reduced;
    else if (query.includes("hover: hover")) matches = true;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
}

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
const okReply = () => reply(200, { kind: "ok", result: RESULT });

const unexpectedUrls: string[] = [];
let signals: AbortSignal[] = [];

/** Stubs fetch; any URL other than /api/seance is recorded and rejected. */
function stubFetch(handler: () => unknown) {
  const fn = vi.fn(async (input: unknown, init?: RequestInit) => {
    if (String(input) !== "/api/seance") {
      unexpectedUrls.push(String(input));
      throw new Error(`Unexpected fetch ${String(input)}`);
    }
    if (init?.signal) signals.push(init.signal);
    return handler();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const neverResolves = () => new Promise<never>(() => {});

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

function renderPanel(overrides: Partial<DetailPanelProps> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <DetailPanel
      row={ROW}
      owner="octocat"
      classification={{ state: "zombie", decayLevel: 0 }}
      facts={FACTS}
      renderedAt={NOW}
      isFixture={false}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...utils, onClose };
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const ritual = () => document.querySelector<HTMLElement>("[data-seance-ritual]");
const holdButton = () =>
  screen.getByRole("button", { name: /Hold a séance/ }) as HTMLButtonElement;
const hold = () => fireEvent.click(holdButton());
const stateEl = (s: string) =>
  document.querySelector<HTMLElement>(`[data-seance-state="${s}"]`);
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  unexpectedUrls.length = 0;
  signals = [];
  stubMedia();
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  expect(unexpectedUrls).toEqual([]);
  cleanup();
  document.body.removeAttribute("style");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ritual flow (1.x, 10.1, 10.9, 18.4)", () => {
  it("shows the ritual, disables the control with aria-disabled, sends one request", async () => {
    const fetchFn = stubFetch(neverResolves);
    renderPanel();
    expect(ritual()).toBeNull();
    expect(holdButton().getAttribute("aria-disabled")).toBeNull();

    hold();
    await flush(0);
    expect(ritual()).not.toBeNull();
    expect(holdButton().getAttribute("aria-disabled")).toBe("true");
    expect(holdButton().hasAttribute("disabled")).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    fireEvent.click(holdButton());
    fireEvent.click(holdButton());
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("whispers and decor are aria-hidden; Skip is the only exposed control", async () => {
    stubFetch(neverResolves);
    renderPanel();
    hold();
    await flush(0);
    const whisper = document.querySelector("[data-ritual-whisper]")!;
    expect(whisper.getAttribute("aria-hidden")).toBe("true");
    const exposed = Array.from(ritual()!.querySelectorAll("button, a, [tabindex]"));
    expect(exposed.length).toBe(1);
    expect(norm(exposed[0].textContent)).toBe("Skip");
  });

  it("holds the ritual for the 2 s floor, then reveals, unmounts it and focuses the heading", async () => {
    stubFetch(() => okReply());
    renderPanel();
    hold();
    await flush(1500);
    expect(ritual()).not.toBeNull();
    expect(screen.queryByRole("heading", { name: HEADING })).toBeNull();

    await flush(600);
    expect(ritual()).toBeNull();
    const heading = screen.getByRole("heading", { name: HEADING });
    expect(document.activeElement).toBe(heading);
    expect(dialog()).not.toBeNull();
  });
});

describe("skipping the ritual (10.10, 10.12)", () => {
  it("skips by clicking the ritual area", async () => {
    stubFetch(() => okReply());
    const { onClose } = renderPanel();
    hold();
    await flush(0);
    expect(ritual()).not.toBeNull(); // result is in, floor not reached
    fireEvent.click(ritual()!);
    await flush(0);
    expect(ritual()).toBeNull();
    expect(screen.getByRole("heading", { name: HEADING })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("skips by the Skip control", async () => {
    stubFetch(() => okReply());
    const { onClose } = renderPanel();
    hold();
    await flush(0);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await flush(0);
    expect(ritual()).toBeNull();
    expect(screen.getByRole("heading", { name: HEADING })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("skips by Escape without closing the panel", async () => {
    stubFetch(() => okReply());
    const { onClose } = renderPanel();
    hold();
    await flush(0);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await flush(0);
    expect(ritual()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });
});

describe("reduced motion (10.13, 10.14)", () => {
  it("uses the fade-only ritual and settles immediately once the result arrives", async () => {
    stubMedia({ reduced: true });
    stubFetch(() => okReply());
    renderPanel();
    hold();
    expect(ritual()!.getAttribute("data-reduced")).toBe("true");
    expect(document.querySelector("[data-ritual-whisper]")).toBeNull();
    expect(document.querySelector("[data-ritual-candle]")).toBeNull();

    await flush(0); // no 2 s floor
    expect(ritual()).toBeNull();
    expect(document.querySelector('[data-state="settled"]')).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: HEADING }));
  });
});

describe("settled result (18.6, 16.x)", () => {
  async function settled() {
    stubMedia({ reduced: true });
    stubFetch(() => okReply());
    const utils = renderPanel();
    hold();
    await flush(0);
    return utils;
  }

  it("has the full transcript as plain text and announces it once, outside the transcript", async () => {
    await settled();
    const transcript = document.querySelector("[data-seance-transcript]")!;
    expect(norm(transcript.textContent)).toBe(RESULT.voice);
    const announces = document.querySelectorAll("[data-seance-announce]");
    expect(announces.length).toBe(1);
    expect(norm(announces[0].textContent)).toBe(RESULT.voice);
    expect(transcript.contains(announces[0])).toBe(false);
  });

  it("copies buildTranscriptText and announces success", async () => {
    await settled();
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));
    await flush(50);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(buildTranscriptText(RESULT));
    const status = document.querySelectorAll("[data-seance-copy-status]");
    expect(status.length).toBe(1);
    expect(norm(status[0].textContent)).toBe("Transcript copied.");
  });

  it("announces the failure message when the clipboard rejects", async () => {
    await settled();
    stubClipboard(async () => {
      throw new Error("denied");
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));
    await flush(50);
    const status = document.querySelector("[data-seance-copy-status]")!;
    expect(norm(status.textContent)).toBe("Could not copy. Select the text instead.");
    // The button stays usable for another attempt.
    expect(
      screen.getByRole("button", { name: "Copy transcript" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("Escape closes the panel once nothing is running", async () => {
    const { onClose } = await settled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Veil and Weak states (8.5-8.8, 9.x)", () => {
  it.each([
    ["veil", "The veil is too thin tonight. Return after midnight."],
    ["weak", "The ghost is too weak to speak"],
  ])("%s renders its in-voice message with no retry and a usable panel", async (kind, copy) => {
    const fetchFn = stubFetch(() => reply(200, { kind }));
    const { onClose } = renderPanel();
    hold();
    await flush(0);

    const el = stateEl(kind)!;
    expect(el).not.toBeNull();
    expect(norm(el.textContent)).toContain(copy);
    expect(ritual()).toBeNull();
    const link = el.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/estate");
    expect(norm(link.textContent)).toBe("Tour the estate");
    expect(el.querySelector("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /candle|retry|try again/i })).toBeNull();
    if (kind === "weak") expect(el.textContent!.toLowerCase()).not.toContain("verdict");
    expect(el.closest('[role="alert"]')).toBeNull();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close record" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Silent fallback (9.x)", () => {
  it("shows the copy and Light another candle; clicking makes exactly one new request", async () => {
    const fetchFn = stubFetch(() => reply(200, { kind: "silent" }));
    renderPanel();
    hold();
    await flush(0);
    const el = stateEl("silent")!;
    expect(norm(el.textContent)).toContain("The spirits are silent tonight. The candle gutters out.");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: HEADING }));
    expect(fetchFn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Light another candle" }));
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(stateEl("silent")).not.toBeNull(); // the retry also answered silent
  });

  it("retry is blocked while a request is in flight", async () => {
    const fetchFn = stubFetch(() => reply(200, { kind: "silent" }));
    renderPanel();
    hold();
    await flush(0);
    fetchFn.mockImplementation(async () => neverResolves());
    fireEvent.click(screen.getByRole("button", { name: "Light another candle" }));
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(ritual()).not.toBeNull();
    expect(holdButton().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(holdButton());
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["non-200", () => reply(500, {})],
    ["bad body", () => reply(200, { nope: true })],
  ])("%s shows Silent", async (_label, handler) => {
    stubFetch(handler);
    renderPanel();
    hold();
    await flush(0);
    expect(stateEl("silent")).not.toBeNull();
  });

  it("a 30 s timeout shows Silent and aborts the request", async () => {
    stubFetch(neverResolves);
    renderPanel();
    hold();
    await flush(29_000);
    expect(stateEl("silent")).toBeNull();
    await flush(1000);
    expect(stateEl("silent")).not.toBeNull();
    expect(signals[0].aborted).toBe(true);
  });
});

describe("lifecycle", () => {
  it("Escape with nothing running closes the panel", () => {
    stubFetch(neverResolves);
    const { onClose } = renderPanel();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closing the panel cancels the in-flight request", async () => {
    stubFetch(neverResolves);
    const { unmount } = renderPanel();
    hold();
    await flush(0);
    expect(signals[0].aborted).toBe(false);
    unmount();
    expect(signals[0].aborted).toBe(true);
  });

  it("reopening starts idle with no ritual or results", async () => {
    stubFetch(() => okReply());
    const first = renderPanel();
    hold();
    await flush(2500);
    expect(screen.getByRole("heading", { name: HEADING })).toBeTruthy();
    first.unmount();

    renderPanel();
    expect(ritual()).toBeNull();
    expect(screen.queryByRole("heading", { name: HEADING })).toBeNull();
    expect(holdButton().getAttribute("aria-disabled")).toBeNull();
  });
});
