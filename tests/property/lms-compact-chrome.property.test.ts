import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  COMPACT_CHROME_FALLBACK_PX,
  layoutCompactChrome,
  rectsIntersect,
  type CompactChromeHeights,
} from "@/lib/estate-view";

// Feature: landing-mobile-states, Property 11: Compact chrome boxes are ordered and disjoint
// **Validates: Requirements 5.1, 5.4**

const F = COMPACT_CHROME_FALLBACK_PX;

// Heights no larger than the fallbacks (at least 1px so every box has area).
const heightsArb: fc.Arbitrary<CompactChromeHeights> = fc.record({
  header: fc.integer({ min: 1, max: F.header }),
  returnLink: fc.integer({ min: 1, max: F.returnLink }),
  titleBlock: fc.integer({ min: 1, max: F.titleBlock }),
  chips: fc.integer({ min: 1, max: F.chips }),
  bottomBar: fc.integer({ min: 1, max: F.bottomBar }),
});

describe("Property 11: Compact chrome boxes are ordered and disjoint", () => {
  it("top boxes are ordered, inside the viewport, and all pairs are disjoint", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 375, max: 767 }),
        fc.integer({ min: 667, max: 1024 }),
        heightsArb,
        (w, h, heights) => {
          const b = layoutCompactChrome(w, h, heights);
          const top = [b.header, b.returnLink, b.titleBlock, b.chips];

          // Order: header above return link above title above chips above bar.
          for (let i = 0; i < top.length - 1; i++) {
            expect(top[i].bottom).toBeLessThanOrEqual(top[i + 1].top);
          }
          expect(b.chips.bottom).toBeLessThanOrEqual(b.bottomBar.top);

          // Inside the viewport.
          for (const r of [...top, b.bottomBar]) {
            expect(r.top).toBeGreaterThanOrEqual(0);
            expect(r.bottom).toBeLessThanOrEqual(h);
            expect(r.left).toBeGreaterThanOrEqual(0);
            expect(r.right).toBeLessThanOrEqual(w);
          }

          // Every pair disjoint.
          const all = [...top, b.bottomBar];
          for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
              expect(rectsIntersect(all[i], all[j])).toBe(false);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
