"use client";

/**
 * "Copy transcript": writes the plain Transcript_Text to the clipboard and
 * announces the outcome through `onAnnounce` (the Seance_Region live region).
 * The button never disables, so a failed copy can be retried.
 *
 * Requirements: 16.5, 16.6, 16.9, 16.10
 */

import { buildTranscriptText } from "@/lib/seance-transcript";
import type { SeanceResult } from "@/lib/seance-schema";

export const COPY_SUCCESS_MESSAGE = "Transcript copied.";
export const COPY_FAILURE_MESSAGE = "Could not copy. Select the text instead.";

export interface CopyTranscriptButtonProps {
  result: SeanceResult;
  onAnnounce: (message: string) => void;
}

export function CopyTranscriptButton({
  result,
  onAnnounce,
}: CopyTranscriptButtonProps) {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(buildTranscriptText(result));
      onAnnounce(COPY_SUCCESS_MESSAGE);
    } catch {
      onAnnounce(COPY_FAILURE_MESSAGE);
    }
  };

  return (
    <button
      type="button"
      className="btn2 seance-focus"
      onClick={() => {
        void handleClick();
      }}
    >
      Copy transcript
    </button>
  );
}
