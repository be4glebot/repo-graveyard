/**
 * Sample estate page (server component), Next.js App Router static route.
 *
 * Route: `/estate`. A self-contained sample graveyard rendered from the bundled
 * fixture (`data/estate.json`) — it issues NO GitHub call and NO network
 * request. The only data source is `loadEstate`, which reads + validates the
 * bundled asset; this module deliberately never imports `loadGraveyard`.
 *
 * It mirrors the live `/g/[username]` server-page pattern exactly so the two
 * routes stay structurally identical:
 *   - All request-time work lives inside a `<Suspense>`-wrapped async child
 *     (`EstateContent`), isolating the data load into its own streaming
 *     boundary so the shell can paint immediately.
 *   - `renderedAt` is read exactly once, inside the dynamic scope, after
 *     `await connection()` opts this subtree into dynamic rendering (so the
 *     unstable clock read is allowed under Cache Components). That single
 *     server-captured instant is threaded into `SceneView` as `now`, keeping
 *     the client's first paint classified against the same moment and hydration
 *     stable (Req 12.1).
 *
 * On a failed load we render the full-page `EstateErrorState`, which replaces
 * the scene entirely rather than showing an inline banner (Req 12.8). On
 * success we resolve the fixture against `renderedAt` via `resolveEstate`,
 * compute the initial rows with `buildRows`, and hand everything to `SceneView`
 * in `estate` mode with the in-memory `estateOverrides`. The estate carries no
 * truncation, so `truncated` is always `false`, and the owner `username` is
 * `null` on `/estate` per the design flow — the scene header handles a null
 * username (Req 12.3).
 *
 * Requirements: 12.1, 12.3, 12.8
 */

import { Suspense } from "react";
import { connection } from "next/server";

import EstateErrorState from "@/components/scene/EstateErrorState";
import SceneView from "@/components/scene/SceneView";
import { loadEstate } from "@/lib/estate-loader";
import { resolveEstate } from "@/lib/estate";
import { buildRows } from "@/lib/graveyard-view";

import type { Metadata } from "next";

/** The estate has no owner, so it reads as the sample graveyard (visual fix 2C). */
export const metadata: Metadata = {
  title: { absolute: "Repo Graveyard — Sample Estate" },
};

/**
 * Async child that performs all request-time work inside the Suspense
 * boundary: it captures the single `renderedAt` timestamp, loads the bundled
 * estate fixture, and renders either the full-page error state or the scene.
 */
interface EstatePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function EstateContent({ searchParams }: EstatePageProps) {
  // Read `?at=` only here, during the initial server render; after hydration
  // SceneView owns the view and this value is never read again (Req 10.4).
  const { at: atParam } = await searchParams;
  const at = Array.isArray(atParam) ? atParam[0] : atParam;

  // Capture the render instant exactly once. `connection()` opts this subtree
  // into dynamic rendering so the unstable clock read is allowed, matching the
  // live route's clock discipline.
  await connection();
  const renderedAt = new Date().toISOString();

  const result = await loadEstate();

  if (!result.ok) {
    // Full-page state that replaces the scene entirely (Req 12.8).
    return <EstateErrorState />;
  }

  // Resolve the fixture's "days ago" offsets into absolute dates against the
  // single captured instant, then classify the initial rows with the in-memory
  // overrides (SceneView recomputes override-aware rows during render too).
  const { repos, overrides } = resolveEstate(result.value, renderedAt);
  const rows = buildRows(repos, overrides, renderedAt);

  // Pre-written séances keyed by repo name (unvalidated; the client validates
  // against the séance result schema at use). Estate only — live pages never
  // receive this, so estate.json stays out of their bundle.
  const seanceFixtures: Record<string, unknown> = {};
  for (const repo of result.value.repos) {
    if (repo.seanceResult !== undefined) seanceFixtures[repo.name] = repo.seanceResult;
  }

  return (
    <SceneView
      seanceFixtures={seanceFixtures}
      rows={rows}
      repos={repos}
      truncated={false}
      username={null}
      renderedAt={renderedAt}
      mode="estate"
      estateOverrides={overrides}
      at={at}
    />
  );
}

export default function EstatePage({ searchParams }: EstatePageProps) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <EstateContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
