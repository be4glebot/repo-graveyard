/**
 * One verdict card per repo: the verdict in words, the headline and
 * data-treatment from VERDICT_COPY, and the full verdictReason as plain text.
 * A recommendation only: no controls, no state changes.
 *
 * Requirements: 15.1-15.9, 15.11, 15.12
 */

import { VERDICT_COPY } from "@/lib/seance-transcript";
import type { SeanceResult } from "@/lib/seance-schema";

export interface VerdictCardProps {
  result: Pick<SeanceResult, "verdict" | "verdictReason">;
}

/** Decorative chain links for the seal treatment (never the only signal). */
function Chains() {
  return (
    <svg
      viewBox="0 0 120 16"
      width="120"
      height="16"
      aria-hidden="true"
      focusable="false"
      className="mb-2 text-crimson-200"
    >
      {[0, 24, 48, 72, 96].map((x) => (
        <rect
          key={x}
          x={x + 2}
          y="3"
          width="20"
          height="10"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export function VerdictCard({ result }: VerdictCardProps) {
  const copy = VERDICT_COPY[result.verdict];
  if (!copy) return null;

  return (
    <section
      className="verdict-card"
      data-verdict-card
      data-treatment={copy.treatment}
    >
      {copy.treatment === "crimson-chains" ? <Chains /> : null}
      <p className="verdict-card-word m-0 text-[15px] font-bold">
        Verdict: {copy.word}
      </p>
      <p className="verdict-card-headline m-0 mt-1 font-narrative text-[17px] italic">
        {copy.headline}
      </p>
      <p className="m-0 mt-2 whitespace-pre-wrap break-words text-[15px] leading-[1.5] md:text-[16px]">
        {result.verdictReason}
      </p>
    </section>
  );
}
