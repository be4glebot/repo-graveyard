"use client";

import type { RefObject } from "react";
import { BadgeDialog } from "./BadgeDialog";

export interface RepoBadgeDialogProps {
  owner: string;
  repo: string;
  onClose: () => void;
  openerRef?: RefObject<HTMLElement | null>;
}

/** Per-repo badge dialog for the detail panel. */
export function RepoBadgeDialog({
  owner,
  repo,
  onClose,
  openerRef,
}: RepoBadgeDialogProps) {
  return (
    <BadgeDialog
      target={{ kind: "repo", owner, repo }}
      onClose={onClose}
      openerRef={openerRef}
    />
  );
}
