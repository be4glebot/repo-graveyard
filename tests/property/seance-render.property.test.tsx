// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as fc from "fast-check";
import SpiritTranscript from "@/components/seance/SpiritTranscript";
import CauseOfDeath from "@/components/seance/CauseOfDeath";
import LedgerList from "@/components/seance/LedgerList";
import { VerdictCard } from "@/components/seance/VerdictCard";
import { VERDICTS, splitSentences } from "@/lib/seance-schema";

afterEach(cleanup);

// Hostile fragments: tags, script text, markdown links, URLs, entities.
const HOSTILE = [
  "<b>bold</b>",
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<a href=\"https://evil.example\">click</a>",
  "[click me](https://evil.example)",
  "![pic](https://evil.example/x.png)",
  "https://evil.example/path?q=1&r=2",
  "&lt;i&gt; &amp; &#60;u&#62;",
  "**strong** _em_ `code`",
  "<iframe src=x></iframe>",
];

const fragment = fc.oneof(
  fc.constantFrom(...HOSTILE),
  fc.string({ minLength: 1, maxLength: 12 }),
);

/** Non-empty, trimmed text built from hostile fragments. */
const text = fc
  .array(fragment, { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join(" ").trim())
  .filter((s) => s.length > 0);

/** Voice of one or more sentences, each ending in a full stop. */
const voice = fc
  .array(text, { minLength: 1, maxLength: 3 })
  .map((parts) => parts.map((p) => p.replace(/[.!?]+/g, "") + ".").join(" "))
  .filter((s) => splitSentences(s).length > 0);

const item = fc.record({ title: text, detail: text, evidence: text });

// Only the components' own markup may appear.
const OWN_TAGS = new Set(["DIV", "P", "SPAN", "OL", "LI", "SECTION", "SVG", "RECT"]);

function assertNoInjectedElements(root: HTMLElement) {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    expect(OWN_TAGS.has(el.tagName.toUpperCase())).toBe(true);
  }
  expect(root.querySelector("script,a,img,b,i,iframe,strong,em,code")).toBeNull();
}

describe("seance-render property tests", () => {
  // Feature: the-seance, Property 9: Seance_Result fields render as literal text
  // **Validates: Requirements 6.10, 11.13, 14.8, 15.5, 20.11**
  it("renders Seance_Result fields as literal text", () => {
    fc.assert(
      fc.property(
        voice,
        text,
        fc.array(item, { minLength: 1, maxLength: 5 }),
        fc.constantFrom(...VERDICTS),
        text,
        (v, cause, items, verdict, reason) => {
          const { container } = render(
            <div>
              <SpiritTranscript
                voice={v}
                repoName="demo"
                state="zombie"
                decayLevel={1}
                reduced={true}
              />
              <CauseOfDeath causeOfDeath={cause} />
              <LedgerList items={items} settled={true} />
              <VerdictCard result={{ verdict, verdictReason: reason }} />
            </div>,
          );
          assertNoInjectedElements(container);

          const transcript = container.querySelector(
            "[data-seance-transcript]",
          ) as HTMLElement;
          const tText = transcript.textContent ?? "";
          for (const s of splitSentences(v)) expect(tText).toContain(s);

          expect(
            container.querySelector("[data-seance-cause]")?.textContent,
          ).toBe(cause);

          const lis = Array.from(container.querySelectorAll("[data-ledger] > li"));
          expect(lis.length).toBe(items.length);
          lis.forEach((li, i) => {
            const t = li.textContent ?? "";
            expect(t).toContain(items[i].title);
            expect(t).toContain(items[i].detail);
            expect(t).toContain(items[i].evidence);
          });

          expect(
            container.querySelector("[data-verdict-card]")?.textContent,
          ).toContain(reason);
          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  });
});
