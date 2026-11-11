"use client";

import type { ReactNode } from "react";
import ThemedButton, { type ThemedButtonVariant } from "./ThemedButton";

export interface ReloadButtonProps {
  /** Test seam; defaults to a real page reload. */
  onReload?: () => void;
  variant?: ThemedButtonVariant;
  className?: string;
  children?: ReactNode;
}

/** "Try again" button: `window` is touched only inside the click handler. */
export default function ReloadButton({
  onReload,
  variant = "crimson",
  className,
  children = "Try again",
}: ReloadButtonProps) {
  const handleClick = () => {
    if (onReload) onReload();
    else window.location.reload();
  };
  return (
    <ThemedButton variant={variant} className={className} onClick={handleClick}>
      {children}
    </ThemedButton>
  );
}
