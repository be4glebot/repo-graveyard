/**
 * Ledger of unfinished business: a real <ol>, one <li> per item, showing
 * title, detail, then evidence (font-fact, trimmed and in quotation marks for
 * display only). Held in the DOM but visually hidden
 * until the transcript has settled. Plain text only.
 *
 * Requirements: 14.3, 14.4, 14.5, 14.6, 14.8, 14.9
 */

import { displayEvidence } from "@/lib/seance-display";
import type { BusinessItem } from "@/lib/seance-schema";

export interface LedgerListProps {
  items: readonly BusinessItem[];
  settled: boolean;
}

export default function LedgerList({ items, settled }: LedgerListProps) {
  return (
    <ol
      className="ledger-list"
      data-ledger=""
      data-hidden={settled ? "false" : "true"}
    >
      {items.map((item, i) => (
        <li key={i} className="ledger-item">
          <span className="ledger-title">{item.title}</span>
          <span className="ledger-detail">{item.detail}</span>
          <span className="ledger-evidence font-fact">{displayEvidence(item.evidence)}</span>
        </li>
      ))}
    </ol>
  );
}
