"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LifecycleState } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";
import { PARALLAX_FRAME_EVENT } from "@/components/scene/useParallax";
import HoverCard from "./HoverCard";
import { useHoverCardActions, useHoverCardState } from "./HoverCardProvider";

const GAP = 12;
const MARGIN = 8;

/** DOM id for a creature's hover tooltip; creatures use it for aria-describedby. */
export function hoverCardId(name: string): string {
  return `hover-card-${name.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Pick a position: below → above → right → left, each kept within the viewport
 * margin on its main axis (cross axis is clamped). If none fit, clamp the
 * top-left of the first choice into the viewport.
 */
export function computeCardPosition(
  a: Box,
  w: number,
  h: number,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const cx = (a.left + a.right) / 2;
  const cy = (a.top + a.bottom) / 2;
  const maxLeft = vw - w - MARGIN;
  const maxTop = vh - h - MARGIN;
  const fitsX = (l: number) => l >= MARGIN && l <= maxLeft;
  const fitsY = (t: number) => t >= MARGIN && t <= maxTop;

  const below = { left: clamp(cx - w / 2, MARGIN, maxLeft), top: a.bottom + GAP };
  if (fitsY(below.top)) return below;
  const above = { left: below.left, top: a.top - GAP - h };
  if (fitsY(above.top)) return above;
  const right = { left: a.right + GAP, top: clamp(cy - h / 2, MARGIN, maxTop) };
  if (fitsX(right.left)) return right;
  const left = { left: a.left - GAP - w, top: right.top };
  if (fitsX(left.left)) return left;
  return {
    left: clamp(below.left, MARGIN, maxLeft),
    top: clamp(below.top, MARGIN, maxTop),
  };
}

export interface HoverCardLayerProps {
  rowsByName: Map<string, RepoRow>;
  owner: string;
  classificationsByName: Map<string, { state: LifecycleState; decayLevel: number | null }>;
  renderedAt: string;
  isFixture: boolean;
}

export function HoverCardLayer(props: HoverCardLayerProps) {
  const { openFor, trigger, anchor } = useHoverCardState();
  if (openFor === null || trigger === null || anchor === null) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <OpenCard key={openFor} name={openFor} trigger={trigger} anchor={anchor} {...props} />,
    document.body,
  );
}

function OpenCard({
  name,
  trigger,
  anchor,
  rowsByName,
  owner,
  classificationsByName,
  renderedAt,
  isFixture,
}: HoverCardLayerProps & { name: string; trigger: "pointer" | "focus"; anchor: HTMLElement }) {
  const actions = useHoverCardActions();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Measure and place; returns false when the anchor is gone/off-screen.
  const place = useRef<() => boolean>(() => true);
  place.current = () => {
    const el = ref.current;
    if (!el) return true;
    if (!anchor.isConnected) return false;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return false;
    const { left, top } = computeCardPosition(r, el.offsetWidth, el.offsetHeight, vw, vh);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    return true;
  };

  useLayoutEffect(() => {
    if (!place.current()) {
      actions.closeNow();
      return;
    }
    setReduced(
      typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setShown(true);
  }, [actions]);

  // Follow the anchor while open; Escape closes. Listeners live only while open.
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!place.current()) actions.closeNow();
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.closeNow();
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener(PARALLAX_FRAME_EVENT, schedule);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(PARALLAX_FRAME_EVENT, schedule);
      window.removeEventListener("keydown", onKey);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [actions]);

  const interactive = trigger === "pointer";
  const classification = classificationsByName.get(name);
  const row = rowsByName.get(name);
  if (!row || !classification) return null;

  return (
    <div
      ref={ref}
      id={hoverCardId(name)}
      role={interactive ? undefined : "tooltip"}
      className="fixed z-[60]"
      style={{
        left: 0,
        top: 0,
        opacity: shown ? 1 : 0,
        transform: reduced || shown ? "none" : "translateY(4px)",
        transition: reduced ? "opacity 120ms linear" : "opacity 120ms linear, transform 120ms ease-out",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerEnter={interactive ? actions.onCardPointerEnter : undefined}
      onPointerLeave={interactive ? actions.onCardPointerLeave : undefined}
    >
      <HoverCard
        row={row}
        owner={owner}
        classification={classification}
        renderedAt={renderedAt}
        isFixture={isFixture}
        interactive={interactive}
      />
    </div>
  );
}

export default HoverCardLayer;
