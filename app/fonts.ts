import {
  UnifrakturMaguntia,
  Cinzel,
  IM_Fell_English,
  Inter,
  JetBrains_Mono,
  Fraunces,
} from "next/font/google";

/**
 * The five self-hosted scene faces (Req 7.1, 8.2, 14.2). Each is loaded through
 * `next/font/google` with `display: "swap"` so text never goes invisible while
 * the face downloads, and each exposes a role-named CSS variable that
 * `app/globals.css` wires into its `@theme` font tokens:
 *
 *   --font-wordmark    UnifrakturMaguntia  → the "Repo Graveyard" wordmark
 *   --font-heading     Cinzel              → headings and labels
 *   --font-narrative   IM Fell English     → narrative copy and whispers
 *   --font-ui          Inter               → general UI chrome
 *   --font-fact        JetBrains Mono      → facts, numbers, repo names
 *
 * Loading via `next/font` self-hosts the files and reserves metrics up front,
 * so there is no layout shift and no third-party font request at runtime.
 */

export const fontWordmark = UnifrakturMaguntia({
  variable: "--font-wordmark",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const fontHeading = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const fontNarrative = IM_Fell_English({
  variable: "--font-narrative",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const fontUi = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

export const fontFact = JetBrains_Mono({
  variable: "--font-fact",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Day display face: a soft storybook serif that replaces the blackletter
 * wordmark when Lights on is active (--font-day-display).
 */
export const fontDayDisplay = Fraunces({
  variable: "--font-day-display",
  subsets: ["latin"],
  display: "swap",
});

/** All scene font CSS-variable classes, space-joined for the <html> className. */
export const sceneFontVariables = [
  fontDayDisplay.variable,
  fontWordmark.variable,
  fontHeading.variable,
  fontNarrative.variable,
  fontUi.variable,
  fontFact.variable,
].join(" ");
