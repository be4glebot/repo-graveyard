/**
 * Deep-linked graveyard scene page (server component), Next.js App Router.
 *
 * Route: `/g/[username]/[repo]`. This is the same live graveyard scene as
 * `/g/[username]`, with one addition: the trailing `[repo]` path segment is
 * forwarded to `SceneView` as `initialRepo` so the matching creature is
 * pre-selected on first paint (Req 1.2). The matching is case-insensitive and
 * lives entirely in `SceneView`/`selectInitialCreature`; a segment that matches
 * no repository simply leaves nothing selected (Req 1.3), so this page performs
 * no validation of its own — it just forwards the decoded segment.
 *
 * It mirrors the base route's structure exactly: a `<Suspense>`-wrapped async
 * child does all request-time work (await params, `await connection()`, a
 * single `renderedAt` clock read, `loadGraveyard`), then renders either the
 * in-scene `SceneErrorState` or the interactive `SceneView` seeded with the
 * server's initial `buildRows` output. The single server-captured `renderedAt`
 * is threaded through so the client's first paint classifies against the same
 * instant and hydration stays stable.
 *
 * On a failed load we render `SceneErrorState` keyed by `result.error.kind`.
 * For a known rate-limit reset we derive `resetInMinutes` as the whole minutes
 * from `renderedAt` to `error.resetAt`; when the reset time is unknown the prop
 * is omitted and the error panel drops the countdown clause.
 *
 * Requirements: 1.2, 1.3
 */

import { Suspense } from "react";
import { connection } from "next/server";

import SceneView from "@/components/scene/SceneView";
import SceneErrorState from "@/components/scene/SceneErrorState";
import { loadGraveyard } from "@/lib/graveyard-loader";
import { buildRows } from "@/lib/graveyard-view";
import { resetInMinutes } from "@/lib/edge-states";

import type { Metadata } from "next";

/**
 * Per-user page title: "Repo Graveyard — {username}" (visual fix 2C). The deep
 * link names a repo, but the title stays keyed to the owner so it matches the
 * base route. Awaits `params` for the username.
 */
export async function generateMetadata({
  params,
}: GraveyardRepoPageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `Repo Graveyard — ${username}` };
}

interface GraveyardRepoPageProps {
  params: Promise<{ username: string; repo: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Async child that performs all request-time work inside the Suspense
 * boundary: awaits `params`, captures the single `renderedAt`, loads the
 * graveyard, and renders either the in-scene error state or the scene seeded
 * with the deep-linked repo.
 */
async function GraveyardRepoContent({
  params,
  searchParams,
}: GraveyardRepoPageProps) {
  // Next already URL-decodes dynamic segments, so `repo` is the plain name.
  const { username, repo } = await params;

  // Read `?at=` only here, during the initial server render; after hydration
  // SceneView owns the view and this value is never read again (Req 10.4). When
  // a valid `at` is present it takes precedence over the deep-linked repo
  // place (Req 11.2), which SceneView resolves.
  const { at: atParam } = await searchParams;
  const at = Array.isArray(atParam) ? atParam[0] : atParam;

  // Capture the render instant exactly once, after awaiting params so the read
  // sits in the dynamic request scope. `connection()` opts this subtree into
  // dynamic rendering so the unstable clock read is allowed under Cache
  // Components.
  await connection();
  const renderedAt = new Date().toISOString();

  const result = await loadGraveyard(username);

  if (!result.ok) {
    const { error } = result;
    const resetMinutes =
      error.kind === "rate-limited"
        ? resetInMinutes(error.resetAt, renderedAt)
        : undefined;
    return <SceneErrorState kind={error.kind} resetInMinutes={resetMinutes} />;
  }

  const { repos, truncated } = result.value;
  const rows = buildRows(repos, {}, renderedAt);

  return (
    <SceneView
      rows={rows}
      repos={repos}
      truncated={truncated}
      username={username}
      renderedAt={renderedAt}
      mode="live"
      initialRepo={repo}
      at={at}
    />
  );
}

export default function GraveyardRepoPage({
  params,
  searchParams,
}: GraveyardRepoPageProps) {
  return (
    <main className="min-h-dvh w-full">
      <Suspense fallback={<div className="min-h-dvh w-full bg-night-sky" />}>
        <GraveyardRepoContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
