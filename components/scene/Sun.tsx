/**
 * The sun: the day-theme counterpart of the moon, sharing its placement props.
 *
 * A warm CSS-drawn glowing disc (tokens only) sits under an optional painted
 * image resolved through `themeArt("day", "/art/day/sun.webp")`. The painted
 * file may not exist yet; `onError` hides the image so the CSS sun shows.
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { themeArt } from "@/lib/theme-art";

export interface SunProps {
  className?: string;
  placement?: { cx: number; cy: number; diameter: number };
  fillParent?: boolean;
  glowScale?: number;
}

const GLOW_BLUR = 110;
const GLOW_SPREAD = 36;

export default function Sun({
  className,
  placement,
  fillParent = false,
  glowScale = 1,
}: SunProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const positionClass = placement
    ? "absolute"
    : fillParent
      ? "absolute inset-0"
      : "absolute right-[24%] top-[8%] h-[130px] w-[130px]";
  const positionStyle = placement
    ? {
        left: `${placement.cx}px`,
        top: `${placement.cy}px`,
        width: `${placement.diameter}px`,
        height: `${placement.diameter}px`,
        transform: "translate(-50%, -50%)",
      }
    : undefined;
  const sizes = placement
    ? `${Math.max(1, Math.round(placement.diameter))}px`
    : fillParent
      ? "256px"
      : "130px";

  return (
    <div
      aria-hidden="true"
      data-sun-source={imageFailed ? "drawn" : "image"}
      className={`pointer-events-none ${positionClass} rounded-full${
        className ? ` ${className}` : ""
      }`}
      style={{
        ...positionStyle,
        backgroundImage:
          "radial-gradient(circle at 50% 50%, var(--color-day-sun-core) 0%, var(--color-day-sun-mid) 55%, var(--color-day-sun-edge) 100%)",
        boxShadow: `0 0 ${Math.round(GLOW_BLUR * glowScale)}px ${Math.round(GLOW_SPREAD * glowScale)}px var(--color-day-sun-glow)`,
      }}
    >
      {imageFailed ? null : (
        <Image
          src={themeArt("day", "/art/day/sun.webp")}
          alt=""
          fill
          sizes={sizes}
          className="object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
