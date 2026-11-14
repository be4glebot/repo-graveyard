/**
 * Dev-only review harness route: `/dev/review?place=&case=&reduced=`.
 * Returns 404 in production. `searchParams` is a Promise in Next 16.
 *
 * Requirements: 20.1, 20.2, 17.1
 */

import { notFound } from "next/navigation";

import ReviewHarness from "@/components/dev/ReviewHarness";
import type { PlaceId } from "@/lib/estate-view";
import { REVIEW_CASES, type ReviewCase } from "@/lib/review-cases";

const PLACE_IDS: readonly PlaceId[] = ["sky", "gate", "ground", "crypt"];

interface ReviewPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const placeParam = first(params.place);
  const caseParam = first(params.case);

  const place = PLACE_IDS.find((p) => p === placeParam) ?? "sky";
  const reviewCase: ReviewCase =
    REVIEW_CASES.find((c) => c === caseParam) ?? "ghosts-3";
  const reduced = first(params.reduced) === "1" || first(params.reduced) === "true";

  return (
    <main className="flex flex-1 flex-col">
      <ReviewHarness place={place} reviewCase={reviewCase} reduced={reduced} />
    </main>
  );
}
