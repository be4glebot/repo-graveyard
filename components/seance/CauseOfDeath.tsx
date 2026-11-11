/**
 * The cause line: an engraved sentence in Cinzel capitals (CSS handles the
 * uppercase and inset shadow) under a small per-state heading. Plain text only.
 * The heading is a sibling of the cause paragraph so `[data-seance-cause]`
 * text stays exactly the model's sentence.
 *
 * Requirements: 13.5, 14.1, 14.2, 11.13
 */

export interface CauseOfDeathProps {
  causeOfDeath: string;
  /** Visible heading for the creature state, e.g. "What keeps me here". */
  heading?: string;
}

export default function CauseOfDeath({ causeOfDeath, heading }: CauseOfDeathProps) {
  if (!causeOfDeath) return null;
  return (
    <>
      {heading ? (
        <p
          data-seance-cause-heading=""
          className="font-heading m-0 mb-1 text-[11px] uppercase tracking-[2px] text-moon-300"
        >
          {heading}
        </p>
      ) : null}
      <p data-seance-cause="" className="cause-engraved m-0">
        {causeOfDeath}
      </p>
    </>
  );
}