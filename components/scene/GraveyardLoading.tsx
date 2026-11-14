/**
 * Themed loading state for /g/[username]. The shell and fog paint in the first
 * frame with the generic line; a Suspense-wrapped client child then reads the
 * pathname and swaps in the username. No spinner.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

"use client";

import { Suspense } from "react";
import ThemedShell from "./ThemedShell";
import GraveyardLoadingLabel from "./GraveyardLoadingLabel";
import { useTheme } from "./ThemeProvider";
import { LOADING_GENERIC } from "@/lib/edge-states";

const LOADING_DAY = "Walking the grounds…";

const LINE_CLASS =
  "max-w-full break-words font-narrative text-xl italic text-moon-100 sm:text-2xl";

export default function GraveyardLoading() {
  const { theme } = useTheme();
  return (
    <ThemedShell>
      <Suspense
        fallback={
          <p role="status" className={LINE_CLASS}>
            {theme === "day" ? LOADING_DAY : LOADING_GENERIC}
          </p>
        }
      >
        <GraveyardLoadingLabel className={LINE_CLASS} dayText={LOADING_DAY} />
      </Suspense>
    </ThemedShell>
  );
}
