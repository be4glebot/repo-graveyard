/**
 * Graveyard page (server component), Next.js App Router dynamic route.
 *
 * Route: `/g/[username]`. In Next 16 the `params` prop is a `Promise`, so the
 * username is only available after `await`. The awaiting happens inside a
 * `<Suspense>`-wrapped async child (`GraveyardContent`) rather than in the page
 * export itself: this isolates the request-time work (awaiting params, reading
 * the clock, loading data) into its own streaming boundary, so the surrounding
 * shell can render immediately while the data loads.
 *
 * Clock discipline (Req 8.6): `renderedAt` is read exactly once, and only AFTER
 * `await params`. A single server-captured timestamp is threaded into
 * `SceneView` (as `now`) and used to build the initial, no-override rows, so
 * the client's first paint classifies against the same instant and hydration
 * stays stable. Reading the clock after awaiting params keeps the read inside
 * the dynamic (request-time) scope rather than at module scope or during static
 * prerender. `await connection()` forces this subtree to render dynamically so
 * the unstable clock read is allowed under Cache Components.
 *
 * On a failed load we render `SceneErrorState` inside the darkened scene frame,
 * keyed by `LoadError["kind"]` — never a partial scene (Req 1.5). For the
 * `rate-limited` case we derive `resetInMinutes` from the error's `resetAt`
 * relative to `renderedAt` (whole minutes until reset, floored at 0) when a
 * reset time is known, and omit it otherwise so the countdown clause is dropped.
 *
 * On success we build the initial classified rows with no overrides
 * (`buildRows(repos, {}, renderedAt)`) to satisfy `SceneViewProps.rows`, then
 * hand the raw facts, `truncated` flag, `username`, and `renderedAt` to
 * `SceneView` in `live` mode, which owns override-aware re-classification and
 * all interactive scene state.
 *
 * The scene is full-bleed, so this page's wrapper lets the scene fill the
 * viewport rather than centering a narrow column (the old list layout).
 *
 * Requirements: 1.1, 1.4, 1.5, 8.6
 */

import { Suspense } from "react";
import { connection } from "next/server";

import SceneView from "@/components/scene/SceneView";
import SceneErrorState from "@/components/scene/SceneErrorState";
import { loadGraveyard } from "@/lib/graveyard-loader";
import { buildRows } from "@/lib/graveyard-view";

interface GraveyardPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Derives whole minutes until a rate-limit reset relative to the render instant.
 * Returns `undefined` when the reset time is unknown or unparseable, so the
 * caller omits `resetInMinutes` entirely. Never returns a negative number: a
 * reset already in the past floors to 0.
 */
function resetInMinutesFrom(
  resetAt: string | null,
  renderedAt: string,
): number | undefined {
  if (resetAt === null) {
    return undefined;
  }
  const resetMs = Date.parse(resetAt);
  const nowMs = Date.parse(renderedAt);
  if (Number.isNaN(resetMs) || Number.isNaN(nowMs)) {
    return undefined;
  }
  return Math.max(0, Math.floor((resetMs - nowMs) / 60_000));
}

/**
 * Async child that performs all request-time work inside the Suspense
 * boundary: it awaits `params`, captures the single `renderedAt` timestamp,
 * loads the graveyard, and renders either the in-scene error state or the
 * live scene.
 */
async function GraveyardContent({ params, searchParams }: GraveyardPageProps) {
  const { username } = await params;

  // Read `?at=` only here, during the initial server render; after hydration
  // SceneView owns the view and this value is never read again (Req 10.4).
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
    const resetInMinutes =
      error.kind === "rate-limited"
        ? resetInMinutesFrom(error.resetAt, renderedAt)
        : undefined;
    return <SceneErrorState kind={error.kind} resetInMinutes={resetInMinutes} />;
  }

  const { repos, truncated } = result.value;

  // Initial, no-override rows classified against the single server clock; these
  // satisfy SceneViewProps.rows and make the first paint hydration-stable.
  // SceneView recomputes override-aware rows during render.
  const rows = buildRows(repos, {}, renderedAt);

  return (
    <SceneView
      rows={rows}
      repos={repos}
      truncated={truncated}
      username={username}
      renderedAt={renderedAt}
      mode="live"
      at={at}
    />
  );
}

export default function GraveyardPage({ params, searchParams }: GraveyardPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
          <p className="text-base text-foreground/60">Loading the graveyard…</p>
        </main>
      }
    >
      <GraveyardContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
