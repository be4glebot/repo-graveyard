// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as fc from "fast-check";
import { displayEvidence } from "@/lib/seance-display";
import LedgerList from "@/components/seance/LedgerList";

afterEach(cleanup);

const text = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0);
const item = fc.record({ title: text, detail: text, evidence: text });

describe("seance-ledger property tests", () => {
  // Feature: the-seance, Property 10: Ledger numbering and item order
  // **Validates: Requirements 14.3, 14.5**
  it("renders a real ordered list, numbered 1..n, one li per item, title then detail then evidence", () => {
    fc.assert(
      fc.property(
        fc.array(item, { minLength: 2, maxLength: 5 }),
        fc.boolean(),
        (items, settled) => {
          const { container, unmount } = render(
            <LedgerList items={items} settled={settled} />,
          );
          const ol = container.querySelector("ol");
          expect(ol).not.toBeNull();
          expect(ol!.tagName).toBe("OL");
          // Native numbering must start at 1, ascend, and not be overridden.
          expect(ol!.hasAttribute("reversed")).toBe(false);
          expect(ol!.hasAttribute("start")).toBe(false);

          const lis = Array.from(ol!.children);
          expect(lis.length).toBe(items.length);
          lis.forEach((li, i) => {
            expect(li.tagName).toBe("LI");
            // No value override: position i+1 gives numbers 1..n with no gaps.
            expect(li.hasAttribute("value")).toBe(false);
            const spans = Array.from(li.children);
            expect(spans.length).toBe(3);
            expect(spans[0].textContent).toBe(items[i].title);
            expect(spans[1].textContent).toBe(items[i].detail);
            // Evidence is shown trimmed and in quotation marks (display only).
            expect(spans[2].textContent).toBe(displayEvidence(items[i].evidence));
            const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
            expect(spans[0].compareDocumentPosition(spans[1]) & FOLLOWING).toBeTruthy();
            expect(spans[1].compareDocumentPosition(spans[2]) & FOLLOWING).toBeTruthy();
          });
          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});
