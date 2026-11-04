"use client";

/**
 * Override-aware graveyard view (client component).
 *
 * Owns the re-classification that depends on per-device overrides. Overrides
 * live in `localStorage` (via `lib/overrides.ts`), which is only available in
 * the browser, so this component is `"use client"`.
 *
 * Hydration strategy: the initial render MUST match the server-rendered HTML.
 * The server has no access to `localStorage`, so it classifies with no
 * overrides. We therefore compute the first set of rows with an empty override
 * map and the server-captured `renderedAt` timestamp, producing identical
 * markup on both sides and avoiding a hydration mismatch. A mount `useEffect`
 * reads the stored overrides (client-only) into state; the displayed rows are
 * then derived during render from those overrides against the same
 * `renderedAt`, so the second paint reflects the user's overrides. Deriving the
 * rows during render (rather than writing them from the effect) keeps the
 * reclassification a pure function of the loaded overrides and avoids a
 * cascading render.
 *
 * Importing `lib/overrides` here is intentional and allowed: that module is
 * client-only, and this is a client component. The `no-restricted-imports`
 * rule only blocks server modules from importing it.
 *
 * Requirements: 8.6
 */

import { useEffect, useState } from "react";

import GraveyardList from "@/components/graveyard/GraveyardList";
import { buildRows } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";
import { readOverrides, type OverrideMap } from "@/lib/overrides";

export interface GraveyardViewProps {
  /** Raw repository facts, in pushed-at-descending order, from the loader. */
  repos: RepoFacts[];
  /** Whether the owner's repositories were capped at the 300-repo limit. */
  truncated: boolean;
  /** The graveyard owner's username; keys the override store. */
  username: string;
  /** ISO 8601 timestamp captured once on the server, threaded into `classify`. */
  renderedAt: string;
}

export default function GraveyardView({
  repos,
  truncated,
  username,
  renderedAt,
}: GraveyardViewProps) {
  // Start with an empty override map so the client's first paint matches the
  // server HTML exactly (the server has no localStorage). The mount effect
  // below swaps in the stored overrides, if any.
  const [overrides, setOverrides] = useState<OverrideMap>({});

  useEffect(() => {
    const stored = readOverrides(username);
    if (Object.keys(stored).length > 0) {
      // localStorage is unavailable during server render and first paint, so
      // reading it (an external system) and committing the result must happen
      // in a mount effect to keep hydration stable. This one-shot setState is
      // the intended pattern here, not a cascading-render smell.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverrides(stored);
    }
  }, [username]);

  // Derive the displayed rows during render. With the initial empty map this
  // reproduces the server output; after the effect loads overrides it yields
  // the override-aware classification.
  const rows = buildRows(repos, overrides, renderedAt);

  return <GraveyardList rows={rows} truncated={truncated} />;
}
