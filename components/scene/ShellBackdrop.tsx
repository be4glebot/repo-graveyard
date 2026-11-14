/**
 * Painted backdrop for the themed shell (landing, edge states, loading, 404).
 *
 * A solid `--color-night-sky` fill is always rendered behind the image, so a
 * failed load leaves a readable dark ground instead of a broken-image box.
 * `onError` hides the image. The image is decorative (`alt=""`) and drawn at
 * its intrinsic 1536 x 1024 size with `object-cover`.
 *
 * Requirements: 1.1, 1.7, 8.4
 */

"use client";

import Image from "next/image";
import { useState } from "react";
import { useTheme } from "@/components/scene/ThemeProvider";
import DayPalette from "@/components/scene/DayPalette";
import { themeArt, themeFilter } from "@/lib/theme-art";

export type ShellBackdropImage = "place-gate" | "place-ground";

/** Intrinsic size of the place art (WebP, 1536 x 1024). */
const IMAGE_WIDTH = 1536;
const IMAGE_HEIGHT = 1024;

/** Brightness per image, matching the in-scene place backdrops. */
const BRIGHTNESS: Record<ShellBackdropImage, number> = {
  "place-gate": 0.85,
  "place-ground": 0.55,
};

export interface ShellBackdropProps {
  image?: ShellBackdropImage;
  priority?: boolean;
}

export default function ShellBackdrop({
  image = "place-gate",
  priority = false,
}: ShellBackdropProps) {
  const [failed, setFailed] = useState(false);
  const { theme } = useTheme();
  // Unmapped art (the gate plate) falls back to night inside themeArt.
  const src = themeArt(theme, `/art/${image}.webp`);
  const isDayArt = src !== themeArt("night", `/art/${image}.webp`);
  const filter = isDayArt
    ? themeFilter(theme, `brightness(${BRIGHTNESS[image]})`, "--art-filter-ground")
    : `brightness(${BRIGHTNESS[image]})`;

  // Day with no painted day plate (the gate): draw the day palette instead of
  // night art.
  if (theme === "day" && !isDayArt) {
    return (
      <div
        aria-hidden="true"
        data-testid="shell-backdrop"
        data-image={image}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <DayPalette variant="full" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="shell-backdrop"
      data-image={image}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        data-testid="shell-backdrop-fallback"
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-night-sky)" }}
      />
      {!failed && (
        <Image
          src={src}
          alt=""
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          priority={priority}
          draggable={false}
          sizes="100vw"
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{ filter }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
