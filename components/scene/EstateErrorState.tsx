/**
 * Full-page error state for the sample estate route (server component).
 *
 * The `/estate` route is a self-contained sample graveyard loaded from the
 * bundled fixture. When `loadEstate` fails (the fixture is missing,
 * unparseable, or schema-invalid), `EstateError` has a single `kind`
 * (`"invalid-estate"`), so there is nothing to key copy on — there is exactly
 * one viewer-facing outcome: the estate could not be summoned. Per the design
 * this renders a **full-page** state that replaces the scene entirely, never an
 * inline banner within a partial or empty graveyard (Req 12.8).
 *
 * The optional `detail` is a short, author-controlled diagnostic (no tokens, no
 * PII) surfaced by `loadEstate` for logs; it is never required to render the
 * user-facing message and is intentionally not shown to the viewer here.
 *
 * This component has no interactivity and reads no client-only APIs, so it is a
 * server presentational component and intentionally omits `"use client"`. It
 * renders deterministically (no clock, no client state), so server and client
 * HTML are identical. All colors come from `@theme` tokens — no hardcoded hex.
 *
 * Requirements: 12.8
 */

import Link from "next/link";

export interface EstateErrorStateProps {
  /**
   * Short diagnostic from `loadEstate` (for logs only). Accepted in the props
   * type so the route may type `error.detail`, but intentionally not read or
   * rendered — the user-facing copy is the same regardless of the cause, and
   * the detail must never reach the viewer.
   */
  detail?: string;
}

/**
 * Renders the full-page "the sample estate is unavailable" state. Fills the
 * viewport (replacing the scene), centers the message, and offers a way home so
 * the state is never a dead end. Presentation-only, no interactivity.
 *
 * Takes no parameters: `EstateError` has a single kind and its `detail` is
 * log-only, so there is nothing to vary the render on. The route calls
 * `<EstateErrorState />`; `EstateErrorStateProps` exists only to document the
 * (deliberately ignored) `detail`.
 */
export default function EstateErrorState() {
  return (
    <main
      className="flex min-h-full flex-col items-center justify-center bg-night-sky p-12"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% 20%, var(--color-night-sky-mid), var(--color-night-sky-bottom) 80%)",
      }}
    >
      <section
        role="alert"
        className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-md border border-crimson-900 bg-night-sky-mid p-8 text-center"
      >
        <h1 className="m-0 font-heading text-xl font-bold uppercase tracking-[2.5px] text-scene-fg">
          The estate could not be summoned
        </h1>
        <p className="m-0 max-w-[340px] font-narrative text-[17px] italic leading-[1.45] text-scene-fg-muted">
          The sample estate is resting beyond reach tonight. Try a GitHub
          username instead — every account has a graveyard.
        </p>
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded border border-crimson-500 bg-crimson-700 px-5 font-heading text-[13px] font-bold uppercase tracking-[1.5px] text-crimson-200 shadow-[0_0_22px_var(--color-crimson-glow)]"
        >
          Back to the gate
        </Link>
      </section>
    </main>
  );
}
