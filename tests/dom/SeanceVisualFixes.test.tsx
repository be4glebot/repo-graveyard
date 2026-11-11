/**
 * Visual-pass fixes seen in the browser: scrolling the ritual and the
 * transcript into view, the portrait in the ritual (no solid disc), bigger
 * candles, "Hold another séance", no visible decay label, quoted evidence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Portrait from "@/components/detail/Portrait";
import { SeanceButton, SeanceProvider, SeanceRegion } from "@/components/seance/SeanceRegion";
import { selectDecayProfile } from "@/lib/seance-decay";
import { creatureImage } from "@/lib/scene-view";

const RESULT = {
  voice: "The last thing you did was tidy my sidebar toggle. I still hear it click in the dark.",
  causeOfDeath: "A half-tidied toggle keeps me here.",
  unfinishedBusiness: [
    { title: "The callback", detail: "The redirect still loops.", evidence: "(wired up yet." },
    { title: "The toggle", detail: "The toggle is still half tidied.", evidence: "open issues: 0" },
  ],
  verdict: "revive",
  verdictReason: "Worth continuing: finish the toggle first.",
};

let scroll: ReturnType<typeof vi.fn>;
let resolveFetch: ((b: unknown) => void) | null = null;

function stubFetch(mode: "pending" | "instant", body: unknown = { kind: "ok", result: RESULT }) {
  const fn = vi.fn(() =>
    mode === "instant"
      ? Promise.resolve({ ok: true, json: async () => body })
      : new Promise((resolve) => {
          resolveFetch = (b) => resolve({ ok: true, json: async () => b });
        }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function mount(reduced = false) {
  return render(
    <SeanceProvider owner="ada" repo="crypt-keeper" reduced={reduced}>
      <section aria-label="Actions">
        <SeanceButton />
      </section>
      <SeanceRegion owner="ada" repo="crypt-keeper" state="ghost" decayLevel={1} reduced={reduced} />
    </SeanceProvider>,
  );
}

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const button = () =>
  screen.getByRole("button", { name: /Hold (a|another) séance|circle is open/ }) as HTMLButtonElement;
const ritual = () => document.querySelector<HTMLElement>("[data-seance-ritual]");
const heading = () => screen.queryByRole("heading", { name: /AI · from the facts above/ });

beforeEach(() => {
  vi.useFakeTimers();
  resolveFetch = null;
  scroll = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: scroll,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

describe("scrolling", () => {
  it("scrolls the ritual into view (block start, smooth) when a séance starts, once", async () => {
    stubFetch("pending");
    mount();
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(button());
    await flush(0);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
    const target = scroll.mock.contexts[0] as HTMLElement;
    expect(target.hasAttribute("data-ritual-layer")).toBe(true);
    expect(target.className).toContain("seance-scroll-target");
    expect(target.contains(ritual())).toBe(true);

    await flush(10_000);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("scrolls the transcript's top into view when the result reveals", async () => {
    stubFetch("instant");
    mount();
    fireEvent.click(button());
    await flush(0);
    expect(scroll).toHaveBeenCalledTimes(1);
    await flush(2100);
    expect(heading()).not.toBeNull();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll).toHaveBeenLastCalledWith({ block: "start", behavior: "smooth" });
    const target = scroll.mock.contexts[1] as HTMLElement;
    expect(target).toBe(heading());
    expect(target.className).toContain("seance-scroll-target");
    expect(document.querySelector("[data-seance-transcript]")).not.toBeNull();
  });

  it("uses behavior auto under reduced motion", async () => {
    stubFetch("instant");
    mount(true);
    fireEvent.click(button());
    await flush(0);
    await flush(100);
    expect(scroll).toHaveBeenCalledTimes(2);
    for (const call of scroll.mock.calls) {
      expect(call[0]).toEqual({ block: "start", behavior: "auto" });
    }
  });

  it("does not move focus when the séance starts", async () => {
    stubFetch("pending");
    mount();
    const b = button();
    b.focus();
    fireEvent.click(b);
    await flush(0);
    expect(document.activeElement).toBe(b);
  });

  it("still moves focus to the heading on reveal, as already specified", async () => {
    stubFetch("instant");
    mount();
    fireEvent.click(button());
    await flush(2100);
    expect(document.activeElement).toBe(heading());
  });

  it("scrolls again when another séance is held", async () => {
    stubFetch("instant");
    mount(true);
    fireEvent.click(button());
    await flush(100);
    expect(scroll).toHaveBeenCalledTimes(2);
    fireEvent.click(button());
    await flush(0);
    expect(scroll).toHaveBeenCalledTimes(3);
    expect((scroll.mock.contexts[2] as HTMLElement).hasAttribute("data-ritual-layer")).toBe(true);
  });
});

describe("the button after a result", () => {
  it("is disabled while running, then enabled as 'Hold another séance' once settled", async () => {
    const fetchFn = stubFetch("instant");
    mount();
    expect(button().textContent).toContain("Hold a séance");
    fireEvent.click(button());
    await flush(0);
    expect(button().getAttribute("aria-disabled")).toBe("true");
    await flush(2100);
    expect(heading()).not.toBeNull();
    expect(button().getAttribute("aria-disabled")).toBe("true");
    await flush(3000);
    const b = button();
    expect(b.getAttribute("aria-disabled")).toBeNull();
    expect(b.hasAttribute("disabled")).toBe(false);
    expect(b.textContent).toContain("Hold another séance");
    expect(screen.getByRole("button", { name: "Hold another séance" })).toBe(b);

    fireEvent.click(b);
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(ritual()).not.toBeNull();
    expect(heading()).toBeNull();
    expect(button().textContent).toContain("The circle is open…");
    expect(button().getAttribute("aria-disabled")).toBe("true");
  });

  it.each([
    ["silent", { kind: "silent" }],
    ["veil", { kind: "veil" }],
    ["weak", { kind: "weak" }],
  ])("re-enables after a %s result", async (_name, body) => {
    const fetchFn = stubFetch("instant", body);
    mount();
    fireEvent.click(button());
    await flush(100);
    const b = button();
    expect(b.getAttribute("aria-disabled")).toBeNull();
    expect(b.textContent).toContain("Hold another séance");
    fireEvent.click(b);
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(ritual()).not.toBeNull();
  });

  it("an extra click during a run does nothing", async () => {
    const fetchFn = stubFetch("pending");
    mount();
    fireEvent.click(button());
    fireEvent.click(button());
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("the ritual shows the creature, not a disc", () => {
  it("has the repo's portrait (the same art as the panel Portrait) and a halo at the centre", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(0);
    const r = ritual()!;
    const mine = r.querySelector<HTMLImageElement>("[data-ritual-portrait] img");
    expect(mine).not.toBeNull();
    expect(decodeURIComponent(mine!.getAttribute("src") ?? "")).toContain(
      `/art/${creatureImage("ghost", 1)}.webp`,
    );
    expect(r.querySelector("[data-ritual-portrait]")!.getAttribute("aria-hidden")).toBe("true");
    expect(r.querySelector("[data-ritual-portrait] .ritual-portrait")).not.toBeNull();
    expect(r.querySelector("[data-ritual-portrait] .ritual-halo")).not.toBeNull();

    const panel = render(<Portrait name="crypt-keeper" state="ghost" decayLevel={1} />);
    const theirs = panel.container.querySelector("img");
    expect(theirs!.getAttribute("src")).toBe(mine!.getAttribute("src"));
  });

  it("has no solid disc and no surge layer inside the ritual", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(0);
    const r = ritual()!;
    expect(r.querySelector(".ritual-surge-ghost, .ritual-surge-zombie")).toBeNull();
    expect(r.querySelector("[data-ritual-creature]")).toBeNull();
    expect(r.querySelector('[class*="bg-candle-300"], [class*="rounded-full"]')).toBeNull();
  });

  it("also shows the portrait in reduced motion, with no movement", async () => {
    stubFetch("pending");
    mount(true);
    fireEvent.click(button());
    await flush(0);
    expect(ritual()!.querySelector("[data-ritual-portrait] img")).not.toBeNull();
    for (const el of ritual()!.querySelectorAll<HTMLElement>("[style]")) {
      expect(el.getAttribute("style")).not.toMatch(/transform|rotate|translate|scale/i);
    }
  });

  it("the five candles ring the portrait: staggered 240 ms, uneven heights, a glow each", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(0);
    const candles = [...ritual()!.querySelectorAll<HTMLElement>("[data-ritual-candle]")];
    expect(candles).toHaveLength(5);
    expect(candles.map((c) => c.style.transitionDelay)).toEqual([
      "0ms",
      "240ms",
      "480ms",
      "720ms",
      "960ms",
    ]);
    const heights = candles.map((c) =>
      c.querySelector<HTMLElement>(".ritual-lean")!.style.getPropertyValue("--wax-h"),
    );
    expect(new Set(heights).size).toBeGreaterThan(1);
    for (const c of candles) expect(c.querySelector(".ritual-glow")).not.toBeNull();
  });

  it("the exit layer keeps the portrait while it fades", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(3000);
    await act(async () => {
      resolveFetch!({ kind: "ok", result: RESULT });
    });
    await flush(0);
    const exit = document.querySelector("[data-seance-ritual-exit]")!;
    expect(exit.querySelector("[data-ritual-portrait] img")).not.toBeNull();
  });
});

describe("the result region", () => {
  it("shows no decay label, only the data-decay-profile attribute", async () => {
    stubFetch("instant");
    mount(true);
    fireEvent.click(button());
    await flush(100);
    const profile = selectDecayProfile("ghost", 1);
    expect(document.querySelector("[data-decay-label]")).toBeNull();
    const region = document.querySelector("[data-seance-region]")!;
    expect(region.textContent ?? "").not.toContain(profile.label);
    expect(document.querySelector(`[data-decay-profile="${profile.id}"]`)).not.toBeNull();
  });

  it("shows evidence trimmed and in quotation marks", async () => {
    stubFetch("instant");
    mount(true);
    fireEvent.click(button());
    await flush(100);
    const shown = [...document.querySelectorAll(".ledger-evidence")].map((e) => e.textContent);
    expect(shown).toEqual(["“wired up yet”", "“open issues: 0”"]);
  });

  it("renders the cause line without uppercase display styling classes", async () => {
    stubFetch("instant");
    mount(true);
    fireEvent.click(button());
    await flush(100);
    const cause = document.querySelector("[data-seance-cause]")!;
    expect(cause.textContent).toBe("A half-tidied toggle keeps me here.");
    expect(cause.className).toContain("cause-engraved");
    expect(cause.className).not.toMatch(/uppercase|font-heading/);
  });
});