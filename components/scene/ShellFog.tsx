/**
 * Two-layer fog for the themed shell. Set dressing only: opacity is fixed and
 * deliberately does not encode zombie count. Reuses the `.fog-wisps` and
 * `.fog-wisps-thin` drift classes; under reduced motion the classes are
 * omitted so nothing drifts.
 *
 * Requirements: 1.8, 7.10
 */
"use client";

import { useTheme } from "@/components/scene/ThemeProvider";
import { themeArt, type Theme } from "@/lib/theme-art";

/** Fixed opacities for the far and near layers. */
const FAR_OPACITY = 0.3;
const NEAR_OPACITY = 0.12;

const FADE_MASK = "linear-gradient(to top, black 60%, transparent)";

export interface ShellFogProps {
  reducedMotion?: boolean;
}

function Layer({
  theme,
  testId,
  art,
  height,
  opacity,
  driftClass,
}: {
  theme: Theme;
  testId: string;
  art: string;
  height: string;
  opacity: number;
  driftClass: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
      style={{
        height,
        opacity,
        mixBlendMode: "screen",
        maskImage: FADE_MASK,
        WebkitMaskImage: FADE_MASK,
      }}
    >
      <div
        className={`absolute inset-y-0 left-0 w-[200%] ${driftClass}`}
        style={{
          backgroundImage: `url(${themeArt(theme, `/art/${art}.webp`)})`,
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
        }}
      />
    </div>
  );
}

export default function ShellFog({ reducedMotion = false }: ShellFogProps) {
  const { theme } = useTheme();
  // Daytime has no fog.
  if (theme === "day") {
    return null;
  }
  return (
    <>
      <Layer
        theme={theme}
        testId="shell-fog-far"
        art="fog-wisps"
        height="55%"
        opacity={FAR_OPACITY}
        driftClass={reducedMotion ? "" : "fog-wisps"}
      />
      <Layer
        theme={theme}
        testId="shell-fog-near"
        art="fog-wisps-thin"
        height="30%"
        opacity={NEAR_OPACITY}
        driftClass={reducedMotion ? "" : "fog-wisps-thin"}
      />
    </>
  );
}
