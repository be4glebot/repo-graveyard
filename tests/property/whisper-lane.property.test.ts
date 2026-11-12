import fc from "fast-check";
import { describe, it } from "vitest";
import {
  estateChromeRects,
  rectsIntersect,
  whisperLane,
} from "@/lib/estate-view";

// Feature: polish-pass-2e, Property 2: Whisper never intersects chrome
// **Validates: Requirements 3.1, 3.2, 3.3**
describe("Feature: polish-pass-2e, Property 2: Whisper never intersects chrome", () => {
  it("lane clears all place cards, header and legend for any 768-1440 x 600-1200 viewport", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 768, max: 1440 }),
        fc.integer({ min: 600, max: 1200 }),
        (w, h) => {
          const lane = whisperLane(w, h);
          const { placeCards, header, legend } = estateChromeRects(w, h);
          return (
            placeCards.every((c) => !rectsIntersect(lane, c)) &&
            !rectsIntersect(lane, header) &&
            !rectsIntersect(lane, legend)
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
