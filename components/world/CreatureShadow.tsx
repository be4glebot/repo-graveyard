/**
 * CreatureShadow: an elliptical contact shadow under a standing creature's
 * feet (design: Lighting). Decorative, `aria-hidden`, never takes pointer
 * events. Offset, blur and opacity come from `shadowFor` in `lib/world-light`
 * and are passed in by the caller.
 *
 * Requirements: 18.7
 */

import type { CSSProperties } from "react";

import { effectProps } from "@/lib/world-effects";

export interface CreatureShadowProps {
  /** Width in px. Defaults to a shadow about as wide as the art. */
  width?: number;
  /** Horizontal / vertical offset in px (from `shadowFor`). */
  offsetX?: number;
  offsetY?: number;
  /** Blur radius in px. */
  blur?: number;
  /** 0..1. */
  opacity?: number;
}

export default function CreatureShadow({
  width = 90,
  offsetX = 0,
  offsetY = 0,
  blur = 4,
  opacity = 0.5,
}: CreatureShadowProps) {
  const style: CSSProperties = {
    width,
    height: Math.max(4, Math.round(width * 0.22)),
    transform: `translate(calc(-50% + ${offsetX}px), calc(50% + ${offsetY}px))`,
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    background:
      "radial-gradient(ellipse at center, var(--color-plaque-shadow) 0%, transparent 70%)",
  };
  return (
    <span
      data-testid="creature-shadow"
      {...effectProps("contact-shadow")}
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-1/2 block rounded-full"
      style={style}
    />
  );
}
