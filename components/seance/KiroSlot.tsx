/**
 * Slot after the Verdict_Card. Empty (no children, no text) unless the séance
 * verdict is `revive` and the caller supplied the facts and announcer, in
 * which case it holds the "Revive in Kiro" button (Req 15.10, Spec 6 Req 1).
 */
import type { ReviveFacts } from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";
import { ReviveInKiro } from "./ReviveInKiro";

export interface KiroSlotProps {
  result?: SeanceResult;
  facts?: ReviveFacts;
  onAnnounce?: (message: string) => void;
}

export function KiroSlot({ result, facts, onAnnounce }: KiroSlotProps = {}) {
  if (result?.verdict === "revive" && facts && onAnnounce) {
    return (
      <div data-slot="revive-in-kiro">
        <ReviveInKiro result={result} facts={facts} onAnnounce={onAnnounce} />
      </div>
    );
  }
  return <div data-slot="revive-in-kiro"></div>;
}
