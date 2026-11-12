"use client";

/**
 * Decorative painted art that fades in over whatever sits behind it.
 *
 * Renders a `next/image` (`fill`, `alt=""`) at opacity 0, then sets opacity 1
 * once the image has loaded, with a 700 ms opacity transition. Under
 * `prefers-reduced-motion` the transition is dropped, so the art simply appears
 * when loaded. If the image fails, it stays at opacity 0 and the layer behind
 * it (the token-based night-sky gradient) remains visible, with no
 * broken-image box.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Fade duration for a loaded plate, in milliseconds. */
const FADE_MS = 700;

export interface FadeArtProps {
  src: string;
  /** `sizes` hint matching the image's rendered width. */
  sizes: string;
  /** Preload the image (use for the largest above-the-fold plate). */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function FadeArt({
  src,
  sizes,
  priority = false,
  className,
  style,
}: FadeArtProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // One-shot read of an external media query on mount (hydration-safe);
    // same pattern as SceneView.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // A cached or preloaded image can finish before hydration attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  if (failed) {
    return null;
  }

  return (
    <Image
      ref={imgRef}
      src={src}
      alt=""
      aria-hidden
      fill
      priority={priority}
      sizes={sizes}
      draggable={false}
      data-loaded={loaded ? "true" : "false"}
      className={`select-none ${className ?? ""}`.trim()}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: reduced ? "none" : `opacity ${FADE_MS}ms ease-out`,
      }}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}
