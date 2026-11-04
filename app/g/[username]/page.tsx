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
 * `GraveyardView` so the client's first paint classifies against the same
 * instant and hydration stays stable. Reading the clock after awaiting params
 * keeps the read inside the dynamic (request-time) scope rather than at module
 * scope or during static prerender. If `next build` flags the clock read as
 * needing an explicit dynamic opt-in, call `await connection()` from
 * `next/server` just before reading the clock to force this subtree to render
 * dynamically.
 *
 * On a failed load we render `LoadErrorMessage` with the `LoadError`; on
 * success we hand the raw facts, `truncated` flag, `username`, and `renderedAt`
 * to `GraveyardView`, which owns override-aware re-classification. The
 * truncation notice is driven entirely by the `truncated` flag flowing through
 * `GraveyardView` → `GraveyardList`.
 *
 * This module imports only `lib/graveyard-loader` (server) for data and the two
 * presentational components; it never imports `lib/overrides` directly (that is
 * a client-only concern owned by `GraveyardView`).
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.8, 8.9
 */

import { Suspense } from "react";
import { connection } from "next/server";

import GraveyardView from "@/components/graveyard/GraveyardView";
import LoadErrorMessage from "@/components/graveyard/LoadErrorMessage";
import { loadGraveyard } from "@/lib/graveyard-loader";

interface GraveyardPageProps {
  params: Promise<{ username: string }>;
}

/**
 * Async child that performs all request-time work inside the Suspense
 * boundary: it awaits `params`, captures the single `renderedAt` timestamp,
 * loads the graveyard, and renders either the error message or the view.
 */
async function GraveyardContent({ params }: GraveyardPageProps) {
  const { username } = await params;

  // Capture the render instant exactly once, after awaiting params so the read
  // sits in the dynamic request scope. `connection()` opts this subtree into
  // dynamic rendering so the unstable clock read is allowed under Cache
  // Components.
  await connection();
  const renderedAt = new Date().toISOString();

  const result = await loadGraveyard(username);

  if (!result.ok) {
    return <LoadErrorMessage error={result.error} />;
  }

  const { repos, truncated } = result.value;

  return (
    <GraveyardView
      repos={repos}
      truncated={truncated}
      username={username}
      renderedAt={renderedAt}
    />
  );
}

export default function GraveyardPage({ params }: GraveyardPageProps) {
  return (
    <main className="flex flex-1 flex-col bg-background px-6 py-16 font-sans text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Suspense fallback={<p className="text-base text-foreground/60">Loading the graveyard…</p>}>
          <GraveyardContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}
