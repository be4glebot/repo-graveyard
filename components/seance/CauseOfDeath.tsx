/**
 * Cause of death: an engraved line in Cinzel capitals (CSS handles the
 * uppercase and inset shadow). Plain text only.
 *
 * Requirements: 13.5, 14.1, 14.2, 11.13
 */

export interface CauseOfDeathProps {
  causeOfDeath: string;
}

export default function CauseOfDeath({ causeOfDeath }: CauseOfDeathProps) {
  if (!causeOfDeath) return null;
  return (
    <p data-seance-cause="" className="cause-engraved m-0">
      {causeOfDeath}
    </p>
  );
}
