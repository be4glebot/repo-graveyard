/**
 * App-level 404 (server component). Renders inside `ThemedShell`, which
 * already provides the `<main>`. Copy comes from `edgeCopy("app-not-found")`.
 * Tokens only; no hex colors.
 *
 * Requirements: 8.7, 8.8, 8.9
 */

import ThemedShell from "@/components/scene/ThemedShell";
import ThemedButton from "@/components/ui/ThemedButton";
import { edgeCopy } from "@/lib/edge-states";

export default function NotFound() {
  const copy = edgeCopy("app-not-found");
  return (
    <ThemedShell>
      <section className="flex w-full max-w-[380px] flex-col items-center gap-3 rounded-md border border-crimson-900 bg-night-sky-mid p-6 text-center">
        <h1 className="m-0 font-heading text-[17px] font-bold uppercase tracking-[2px] text-scene-fg">
          {copy.heading}
        </h1>
        <p className="m-0 max-w-[340px] font-narrative text-[17px] italic leading-[1.45] text-scene-fg-muted">
          {copy.body}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <ThemedButton href="/">Return to the gate</ThemedButton>
          <ThemedButton variant="crimson" href="/estate">
            Tour the Haunted Estate
          </ThemedButton>
        </div>
      </section>
    </ThemedShell>
  );
}
