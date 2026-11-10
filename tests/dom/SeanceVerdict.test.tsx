/**
 * DOM tests for the séance verdict card and the empty Kiro slot.
 *
 * Requirements: 15.1-15.7, 15.9, 15.10, 20.16
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { VerdictCard } from "@/components/seance/VerdictCard";
import { KiroSlot } from "@/components/seance/KiroSlot";
import { VERDICT_COPY } from "@/lib/seance-transcript";
import type { Verdict } from "@/lib/seance-schema";

afterEach(cleanup);

const VERDICTS: Verdict[] = ["revive", "finish", "seal"];
const INTERACTIVE =
  "a, button, input, select, textarea, summary, [role='button'], [role='link'], [tabindex]";

function renderCard(verdict: Verdict, verdictReason: string) {
  return render(
    <div>
      <VerdictCard result={{ verdict, verdictReason }} />
      <KiroSlot />
    </div>,
  );
}

describe("VerdictCard", () => {
  it("uses the specified headline copy", () => {
    expect(VERDICT_COPY.revive.headline).toBe("It wants to live.");
    expect(VERDICT_COPY.finish.treatment).toBe("candlelit");
    expect(VERDICT_COPY.seal.treatment).toBe("crimson-chains");
  });

  for (const verdict of VERDICTS) {
    describe(`verdict "${verdict}"`, () => {
      const copy = VERDICT_COPY[verdict];

      it("prints headline, verdict word, and treatment marker", () => {
        const { container } = renderCard(verdict, "Because reasons.");
        const card = container.querySelector("[data-verdict-card]")!;
        expect(card).not.toBeNull();
        expect(card.getAttribute("data-treatment")).toBe(copy.treatment);
        expect(card.textContent).toContain(copy.headline);
        expect(card.textContent).toContain(`Verdict: ${copy.word}`);
      });

      it("renders a 300-character reason in full as plain text", () => {
        const reason = "x".repeat(299) + ".";
        expect(reason).toHaveLength(300);
        const { container } = renderCard(verdict, reason);
        const card = container.querySelector("[data-verdict-card]")!;
        expect(card.textContent).toContain(reason);
      });

      it("renders markup characters literally", () => {
        const reason = "<b>bold</b> **x** `code` [a](http://x) & <script>1</script>";
        const { container } = renderCard(verdict, reason);
        const card = container.querySelector("[data-verdict-card]")!;
        expect(card.textContent).toContain(reason);
        expect(card.querySelector("b, script, code, strong, a")).toBeNull();
      });

      it("contains no interactive controls", () => {
        const { container } = renderCard(verdict, "A reason.");
        const card = container.querySelector("[data-verdict-card]")!;
        expect(card.querySelectorAll(INTERACTIVE)).toHaveLength(0);
      });

      it("is followed directly by an empty Kiro slot", () => {
        const { container } = renderCard(verdict, "A reason.");
        const card = container.querySelector("[data-verdict-card]")!;
        const slot = card.nextElementSibling as HTMLElement;
        expect(slot.getAttribute("data-slot")).toBe("revive-in-kiro");
        expect(slot.childNodes).toHaveLength(0);
        expect(slot.textContent).toBe("");
      });
    });
  }

  it("has no motion-dependent behaviour in markup (static card)", () => {
    const { container } = renderCard("seal", "r");
    const card = container.querySelector("[data-verdict-card]")!;
    expect(card.querySelector("[style*='animation']")).toBeNull();
  });
});
