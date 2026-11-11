/**
 * The building ritual and the primary control, rendered through the shared
 * SeanceProvider (no panel needed). Fake timers; fetch is stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SeanceButton, SeanceProvider, SeanceRegion } from "@/components/seance/SeanceRegion";

const RESULT = {
  voice: "The last thing you did was tidy my sidebar toggle. I still hear it click in the dark.",
  causeOfDeath: "A half-tidied toggle keeps me here.",
  unfinishedBusiness: [
    { title: "The toggle", detail: "The toggle is still half tidied.", evidence: "open issues: 0" },
  ],
  verdict: "revive",
  verdictReason: "Worth continuing: finish the toggle first.",
};

let resolveFetch: ((body: unknown) => void) | null = null;

function stubFetch(mode: "pending" | "instant", body: unknown = { kind: "ok", result: RESULT }) {
  const fn = vi.fn(() => {
    if (mode === "instant") {
      return Promise.resolve({ ok: true, json: async () => body });
    }
    return new Promise((resolve) => {
      resolveFetch = (b) => resolve({ ok: true, json: async () => b });
    });
  });
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
const button = () => screen.getByRole("button", { name: /Hold a séance/ }) as HTMLButtonElement;
const ritual = () => document.querySelector<HTMLElement>("[data-seance-ritual]");
const exitLayer = () => document.querySelector<HTMLElement>("[data-seance-ritual-exit]");
const stageEl = () => document.querySelector<HTMLElement>("[data-seance-stage]");
const heading = () => screen.queryByRole("heading", { name: /AI · from the facts above/ });

beforeEach(() => {
  vi.useFakeTimers();
  resolveFetch = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("primary control", () => {
  it("has an accessible name and is the primary style", () => {
    stubFetch("pending");
    mount();
    expect(button().className).toContain("seance-primary");
    expect(button().textContent).toContain("Hold a séance");
    expect(button().getAttribute("aria-disabled")).toBeNull();
  });

  it("is disabled during a run and reads 'The circle is open…'", async () => {
    const fetchFn = stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(0);
    const b = button(); // the accessible name still contains "Hold a séance"
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.hasAttribute("disabled")).toBe(false);
    expect(b.textContent).toContain("The circle is open…");
    expect(b.getAttribute("aria-label")).toContain("The circle is open…");
    expect(b.getAttribute("aria-label")).toContain("Hold a séance");
    fireEvent.click(b);
    fireEvent.click(b);
    await flush(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("the ritual builds on a fixed clock while the request is in flight", () => {
  it("moves through four stages at 0, 1.2, 2.5 and 4.5 s and then holds", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(0);

    const stage = () => ritual()!.getAttribute("data-ritual-stage");
    const smoke = () => document.querySelector('[data-ritual-smoke][data-on="true"]');
    const frost = () => document.querySelector('[data-ritual-frost][data-on="true"]');
    const leaning = () => document.querySelector('.ritual-lean[data-lean="true"]');
    const holding = () => document.querySelector('.ritual-flame[data-holding="true"]');

    // Stage 0: five candles, edges dim, no text, nothing else yet.
    expect(stage()).toBe("0");
    expect(document.querySelectorAll("[data-ritual-candle]")).toHaveLength(5);
    expect(smoke()).toBeNull();
    expect(frost()).toBeNull();
    expect(stageEl()).toBeNull();

    await flush(1199);
    expect(stage()).toBe("0");
    await flush(1);
    expect(stage()).toBe("1");
    expect(ritual()!.querySelector("[data-ritual-whisper]")!.textContent).toBe("Calling crypt-keeper back…");
    expect(smoke()).not.toBeNull();
    expect(frost()).toBeNull();

    await flush(1299);
    expect(stage()).toBe("1");
    await flush(1);
    expect(stage()).toBe("2");
    expect(ritual()!.querySelector("[data-ritual-whisper]")!.textContent).toBe("Reading its last words…");
    expect(frost()).not.toBeNull();
    expect(leaning()).not.toBeNull();
    expect(holding()).toBeNull();

    await flush(1999);
    expect(stage()).toBe("2");
    await flush(1);
    expect(stage()).toBe("3");
    expect(ritual()!.querySelector("[data-ritual-whisper]")!.textContent).toBe("Something is answering…");
    expect(holding()).not.toBeNull();

    // Held until the response arrives.
    await flush(20_000);
    expect(stage()).toBe("3");
    expect(ritual()).not.toBeNull();
    expect(heading()).toBeNull();
  });

  it("announces the stage text in the polite live region once per stage, not per frame", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(0);
    const region = document.querySelector("[data-seance-region]")!;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(stageEl()).toBeNull();

    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      const t = stageEl()?.textContent ?? "";
      if (t && seen[seen.length - 1] !== t) seen.push(t);
    });
    observer.observe(region, { childList: true, characterData: true, subtree: true });

    await flush(1200);
    expect(stageEl()!.textContent).toBe("Calling crypt-keeper back…");
    expect(region.contains(stageEl())).toBe(true);
    const node = stageEl();
    await flush(500); // many frames pass; the live text must not be touched
    expect(stageEl()).toBe(node);
    await flush(800);
    expect(stageEl()!.textContent).toBe("Reading its last words…");
    await flush(2000);
    expect(stageEl()!.textContent).toBe("Something is answering…");
    await flush(15_000);
    observer.disconnect();
    expect(seen).toEqual([
      "Calling crypt-keeper back…",
      "Reading its last words…",
      "Something is answering…",
    ]);
    // The visible smoke text and every decoration are hidden from assistive tech.
    expect(ritual()!.querySelector("[data-ritual-whisper]")!.getAttribute("aria-hidden")).toBe("true");
    for (const el of ritual()!.querySelectorAll("[data-ritual-candle], [data-ritual-frost], [data-ritual-smoke]")) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("skip", () => {
  it("jumps to the held final stage but cannot skip the wait", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(300);
    expect(ritual()!.getAttribute("data-ritual-stage")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await flush(0);
    expect(ritual()!.getAttribute("data-ritual-stage")).toBe("3");
    expect(ritual()!.getAttribute("data-instant")).toBe("true");
    expect(ritual()!.querySelector("[data-ritual-whisper]")!.textContent).toBe("Something is answering…");
    expect(stageEl()!.textContent).toBe("Something is answering…");
    expect(heading()).toBeNull(); // still waiting for the response

    await flush(10_000);
    expect(ritual()).not.toBeNull();

    await act(async () => {
      resolveFetch!({ kind: "ok", result: RESULT });
    });
    await flush(0);
    expect(ritual()).toBeNull();
    expect(heading()).not.toBeNull();
  });
});

describe("resolving", () => {
  it("never shows the transcript before 2 s, even when the response is instant", async () => {
    stubFetch("instant");
    mount();
    fireEvent.click(button());
    await flush(1900);
    expect(ritual()).not.toBeNull();
    expect(heading()).toBeNull();
    await flush(150);
    expect(ritual()).toBeNull();
    expect(heading()).not.toBeNull();
  });

  it("when the response arrives the flames gutter out together and the reveal starts", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(6000);
    expect(ritual()!.getAttribute("data-ritual-stage")).toBe("3");

    await act(async () => {
      resolveFetch!({ kind: "ok", result: RESULT });
    });
    await flush(0);
    expect(ritual()).toBeNull();
    expect(heading()).not.toBeNull();
    expect(document.querySelector("[data-seance-transcript]")).not.toBeNull();
    // The decorative exit layer: five lit flames, the last smoke text, aria-hidden.
    const exit = exitLayer()!;
    expect(exit.getAttribute("data-seance-ritual-exit")).toBe("resolved");
    expect(exit.getAttribute("aria-hidden")).toBe("true");
    expect(exit.querySelectorAll("[data-ritual-candle]")).toHaveLength(5);
    expect(exit.querySelector(".ritual-text")!.textContent).toBe("Something is answering…");
    await flush(700);
    expect(exitLayer()).toBeNull();
  });

  it("a silent result snuffs the candles one by one, recedes the frost and shows no transcript", async () => {
    stubFetch("pending");
    mount();
    fireEvent.click(button());
    await flush(6000);
    await act(async () => {
      resolveFetch!({ kind: "silent" });
    });
    await flush(0);
    expect(ritual()).toBeNull();
    expect(document.querySelector("[data-seance-transcript]")).toBeNull();
    const exit = exitLayer()!;
    expect(exit.getAttribute("data-seance-ritual-exit")).toBe("silent");
    const delays = [...exit.querySelectorAll<HTMLElement>("[data-ritual-candle]")].map((c) =>
      c.style.getPropertyValue("--snuff-delay"),
    );
    expect(delays).toEqual(["0ms", "180ms", "360ms", "540ms", "720ms"]);
    expect(exit.querySelectorAll('[data-ritual-frost][data-on="true"]').length).toBe(4);
    await flush(1500);
    expect(exitLayer()).toBeNull();
    expect(screen.getByText(/Light another candle/)).toBeTruthy();
  });

  it("closing before any result plays no exit", async () => {
    stubFetch("pending");
    const { unmount } = mount();
    fireEvent.click(button());
    await flush(500);
    unmount();
    expect(exitLayer()).toBeNull();
  });
});

describe("reduced motion", () => {
  it("shows the candles lit, no movement layers, and text that fades per stage", async () => {
    stubFetch("pending");
    mount(true);
    fireEvent.click(button());
    await flush(0);
    const r = ritual()!;
    expect(r.getAttribute("data-reduced")).toBe("true");
    expect(r.querySelectorAll('[data-ritual-candle][data-lit="true"]')).toHaveLength(5);

    const check = () => {
      expect(r.querySelector("[data-ritual-frost]")).toBeNull();
      expect(r.querySelector("[data-ritual-smoke]")).toBeNull();
      expect(r.querySelector("[data-ritual-creature]")).toBeNull();
      expect(r.querySelector("[data-lean]")).toBeNull();
      expect(r.querySelector("[data-holding]")).toBeNull();
      expect(r.querySelector('[class*="ritual-surge"]')).toBeNull();
      for (const el of r.querySelectorAll<HTMLElement>("[style]")) {
        expect(el.getAttribute("style")).not.toMatch(/transform|rotate|translate|scale/i);
      }
    };
    check();
    await flush(1200);
    expect(r.querySelector("[data-ritual-whisper]")!.textContent).toBe("Calling crypt-keeper back…");
    expect(r.querySelector("[data-ritual-whisper]")!.getAttribute("data-visible")).toBe("true");
    check();
    await flush(1300);
    expect(r.querySelector("[data-ritual-whisper]")!.textContent).toBe("Reading its last words…");
    await flush(2000);
    expect(r.querySelector("[data-ritual-whisper]")!.textContent).toBe("Something is answering…");
    check();
    expect(stageEl()!.textContent).toBe("Something is answering…");

    await act(async () => {
      resolveFetch!({ kind: "ok", result: RESULT });
    });
    await flush(0);
    expect(ritual()).toBeNull();
    expect(exitLayer()).toBeNull(); // no exit animation when motion is reduced
  });
});