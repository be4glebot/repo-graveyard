"use client";

/**
 * Dev-only review harness. Renders the ORIGINAL `PlaceView` over deterministic
 * rows from `buildReviewRows`, inside the hover card provider and a night-sky
 * theme shell, so the capture tooling can screenshot any place and case.
 *
 * Requirements: 20.1, 20.2, 17.1
 */

import { useMemo, useState } from "react";

import { HoverCardProvider } from "@/components/detail/HoverCardProvider";
import PlaceView from "@/components/scene/PlaceView";
import type { PlaceFilter, PlaceId } from "@/lib/estate-view";
import { buildReviewRows, type ReviewCase } from "@/lib/review-cases";

export interface ReviewHarnessProps {
  place: PlaceId;
  reviewCase: ReviewCase;
  reduced: boolean;
}

export default function ReviewHarness({
  place,
  reviewCase,
  reduced,
}: ReviewHarnessProps) {
  const rows = useMemo(() => buildReviewRows(reviewCase), [reviewCase]);
  const [filter, setFilter] = useState<PlaceFilter>("all");
  const [plotIndex, setPlotIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <HoverCardProvider>
      <div
        id="scene-root"
        data-testid="review-shell"
        data-place={place}
        data-case={reviewCase}
        data-reduced={reduced ? "true" : "false"}
        className="relative min-h-dvh w-full"
        style={{ backgroundColor: "var(--color-night-sky)" }}
      >
        <PlaceView
          place={place}
          rows={rows}
          activeFilter={filter}
          plotIndex={plotIndex}
          selectedName={selected}
          onFilterChange={setFilter}
          onPlotChange={setPlotIndex}
          onSelect={setSelected}
          onReturn={() => {}}
          reducedMotion={reduced}
          theme="night"
        />
      </div>
    </HoverCardProvider>
  );
}
