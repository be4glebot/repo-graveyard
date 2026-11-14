/**
 * Themed shell (server component) shared by edge states, loading and the app
 * 404: painted backdrop, fog, a header with the wordmark linking to "/", and a
 * centred content slot. Colors come from theme tokens only.
 *
 * Requirements: 1.1, 7.1, 8.4
 */

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";
import ShellBackdrop, { type ShellBackdropImage } from "./ShellBackdrop";
import ShellFog from "./ShellFog";

export interface ThemedShellProps {
  children: ReactNode;
  image?: ShellBackdropImage;
  priority?: boolean;
}

export default function ThemedShell({
  children,
  image = "place-gate",
  priority = false,
}: ThemedShellProps) {
  const { theme } = useTheme();
  return (
    <div
      data-testid="themed-shell"
      data-theme={theme}
      className="relative flex min-h-dvh flex-col overflow-hidden bg-night-sky text-scene-fg"
    >
      <ShellBackdrop image={image} priority={priority} />
      <ShellFog />
      <header className="relative z-10 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="site-wordmark inline-flex min-h-11 items-center font-wordmark text-3xl leading-none text-crimson-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky"
          style={{ textShadow: "0 0 12px var(--color-crimson-glow)" }}
        >
          Repo Graveyard
        </Link>
      </header>
      <main
        data-testid="themed-shell-content"
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12 text-center"
      >
        {children}
      </main>
    </div>
  );
}
