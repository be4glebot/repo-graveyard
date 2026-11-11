"use client";
/**
 * Full-bleed gate scene for the landing page. Stacks the painted backdrop, two
 * fog layers and the Moon, then renders the page content on top. Pointer
 * parallax uses the shared `useParallax` hook (which writes `--px` / `--py`
 * on the root) and three layer bands capped at 8, 16 and 24 px. Under
 * Reduced_Motion there is no listener, no fog drift and no layer offset.
 *
 * Only the backdrop (the largest image) carries the priority hint.
 *
 * Requirements: 1.1, 1.5, 1.6, 1.7, 1.8
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import ShellBackdrop from "@/components/scene/ShellBackdrop";
import ShellFog from "@/components/scene/ShellFog";
import Moon from "@/components/scene/Moon";
import useParallax from "@/components/scene/useParallax";
import { useMedia } from "@/components/ui/useMedia";

/** Max displacement (px) per layer band: backdrop, fog, moon. */
export const PARALLAX_BANDS_PX = { back: 8, mid: 16, front: 24 } as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function bandStyle(band: number, active: boolean): CSSProperties {
  if (!active) return {};
  return {
    transform: `translate3d(calc(var(--px, 0) * ${band}px), calc(var(--py, 0) * ${band}px), 0)`,
  };
}

export interface GateSceneProps {
  children: ReactNode;
}

export default function GateScene({ children }: GateSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMedia(REDUCED_MOTION_QUERY, false);
  useParallax(rootRef, { reducedMotion });
  const live = !reducedMotion;

  return (
    <div
      ref={rootRef}
      data-testid="gate-scene"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="relative flex min-h-dvh flex-col overflow-hidden bg-night-sky text-scene-fg"
    >
      {/* Layers extend past the root by their band so edges never show. */}
      <div
        data-testid="gate-layer-back"
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2"
        style={bandStyle(PARALLAX_BANDS_PX.back, live)}
      >
        <ShellBackdrop image="place-gate" priority />
      </div>
      <div
        data-testid="gate-layer-mid"
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4"
        style={bandStyle(PARALLAX_BANDS_PX.mid, live)}
      >
        <ShellFog reducedMotion={reducedMotion} />
      </div>
      <div
        data-testid="gate-layer-front"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={bandStyle(PARALLAX_BANDS_PX.front, live)}
      >
        <Moon rows={[]} />
      </div>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
