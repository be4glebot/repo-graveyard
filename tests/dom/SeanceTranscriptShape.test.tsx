/**
 * DOM tests for SpiritTranscript (the-seance task 13.7): plain-text presence,
 * sentence/word structure, announce region, decay profile, settle triggers,
 * reduced motion, and the "no bubble, no tail" Smoke_Field shape.
 *
 * Validates: Requirements 11.1-11.14, 12.9, 12.10, 13.5, 13.6, 16.2, 18.6,
 * 18.7, 20.11, 20.14
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SpiritTranscript from "@/components/seance/SpiritTranscript";
import { selectDecayProfile } from "@/lib/seance-decay";

const VOICE =
  "You left me in the middle of the login page. The redirect was still broken. Start with the callback.";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

afterEach(cleanup);

function renderT(props: Partial<React.ComponentProps<typeof SpiritTranscript>> = {}) {
  return render(
    <SpiritTranscript
      voice={VOICE}
      repoName="weather-app"
      state="ghost"
      decayLevel={0}
      reduced={false}
      {...props}
    />,
  );
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

describe("SpiritTranscript DOM", () => {
  it("has the full voice text in the transcript from first render", () => {
    const { container } = renderT();
    const t = container.querySelector("[data-seance-transcript]")!;
    expect(norm(t.textContent)).toBe(norm(VOICE));
    // Words are still unrevealed on the first render, yet present as text.
    const words = container.querySelectorAll(".spirit-word");
    expect(words.length).toBeGreaterThan(0);
    expect(words[0].getAttribute("data-revealed")).toBe("false");
    expect(container.querySelector(".smoke-field")!.getAttribute("data-state")).toBe(
      "revealing",
    );
  });

  it("marks sentences zero-based and words aria-hidden", () => {
    const { container } = renderT();
    const s = [...container.querySelectorAll("[data-sentence-index]")];
    expect(s.map((e) => e.getAttribute("data-sentence-index"))).toEqual(["0", "1", "2"]);
    container.querySelectorAll(".spirit-word").forEach((w) => {
      expect(w.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("keeps sentence indices stable across settling", () => {
    const { container } = renderT();
    const before = [...container.querySelectorAll("[data-sentence-index]")].map((e) =>
      norm(e.textContent),
    );
    fireEvent.click(container.querySelector(".smoke-field")!);
    const after = [...container.querySelectorAll("[data-sentence-index]")].map((e) =>
      norm(e.textContent),
    );
    expect(after).toEqual(before);
  });

  it("sets data-decay-profile per state and decay level", () => {
    const cases: Array<[string, number | undefined]> = [
      ["ghost", 0],
      ["ghost", 1],
      ["ghost", 3],
      ["risen", undefined],
      ["zombie", 2],
      ["tombstone", undefined],
      ["coffin", undefined],
    ];
    for (const [state, level] of cases) {
      const { container, unmount } = renderT({ state, decayLevel: level });
      expect(container.querySelector(".smoke-field")!.getAttribute("data-decay-profile")).toBe(
        selectDecayProfile(state, level).id,
      );
      unmount();
    }
  });

  it("click settles: one announce node outside the transcript", () => {
    const { container } = renderT();
    expect(container.querySelector("[data-seance-announce]")).toBeNull();
    fireEvent.click(container.querySelector(".smoke-field")!);
    const field = container.querySelector(".smoke-field")!;
    expect(field.getAttribute("data-state")).toBe("settled");
    const announce = container.querySelectorAll("[data-seance-announce]");
    expect(announce.length).toBe(1);
    expect(announce[0].className).toContain("sr-only");
    expect(announce[0].closest("[data-seance-transcript]")).toBeNull();
    expect(norm(announce[0].textContent)).toBe(norm(VOICE));
    // Settled words are not hidden or blurred by CSS.
    expect(css).toMatch(
      /\[data-state="settled"\]\s*\.spirit-word\s*\{[^}]*opacity:\s*1[^}]*filter:\s*none/,
    );
  });

  it("Escape settles", () => {
    const { container } = renderT();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(container.querySelector(".smoke-field")!.getAttribute("data-state")).toBe(
      "settled",
    );
  });

  it("reduced motion renders settled on the first render", () => {
    const { container } = renderT({ reduced: true });
    expect(container.querySelector(".smoke-field")!.getAttribute("data-state")).toBe(
      "settled",
    );
    expect(container.querySelectorAll("[data-seance-announce]").length).toBe(1);
    expect(container.querySelector("[data-flicker]")).toBeNull();
  });

  it("renders nothing for an empty voice", () => {
    const { container } = renderT({ voice: "" });
    expect(container.innerHTML).toBe("");
  });
});

/** Extract a top-level rule body for an exact selector. */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.[\]]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : "";
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

describe("Smoke_Field shape (no bubble, no tail)", () => {
  it("has no border, zero radius and no background fill", () => {
    const body = ruleBody(".smoke-field");
    expect(body).not.toBe("");
    expect(body).toMatch(/border:\s*0\b/);
    expect(body).toMatch(/border-radius:\s*0\b/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).not.toMatch(/box-shadow|outline/);
  });

  it("has no ::before / ::after rule on .smoke-field", () => {
    expect(css).not.toMatch(/\.smoke-field[^{,]*::?(before|after)/);
  });

  it("uses only dark smoke fill tokens and no white or light fill", () => {
    const tokens = [...css.matchAll(/--color-smoke-[\w-]+:\s*(#[0-9a-fA-F]{6})/g)];
    expect(tokens.length).toBeGreaterThan(0);
    for (const [, hex] of tokens) expect(luminance(hex)).toBeLessThanOrEqual(0.2);

    const fieldRules = [
      ruleBody(".smoke-field"),
      ruleBody(".smoke-field-ragged"),
      ruleBody(".smoke-field-text"),
    ].join("\n");
    expect(fieldRules).not.toMatch(/#fff\b|#ffffff|\bwhite\b|rgba?\(\s*255,\s*255,\s*255/i);
    expect(ruleBody(".smoke-field-text")).not.toMatch(/background/);
  });

  it("renders no bubble element or tail in the DOM", () => {
    const { container } = renderT();
    const field = container.querySelector(".smoke-field")!;
    expect(field.querySelector("[class*='tail'],[class*='bubble'],svg")).toBeNull();
    expect(field.className).not.toMatch(/bubble|tail|rounded|border|bg-/);
  });
});
