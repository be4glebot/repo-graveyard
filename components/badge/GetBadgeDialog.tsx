"use client";

import type { RefObject } from "react";
import { BadgeDialog } from "./BadgeDialog";

export interface GetBadgeDialogProps {
  owner: string;
  onClose: () => void;
  openerRef?: RefObject<HTMLElement | null>;
}

/** Summary badge dialog for the graveyard page. */
export function GetBadgeDialog({ owner, onClose, openerRef }: GetBadgeDialogProps) {
  return (
    <BadgeDialog
      target={{ kind: "owner", owner }}
      onClose={onClose}
      openerRef={openerRef}
    />
  );
}
