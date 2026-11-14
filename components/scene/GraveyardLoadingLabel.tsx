"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "@/components/scene/ThemeProvider";
import { loadingLabel, usernameFromPath } from "@/lib/edge-states";

/** Status line that resolves the username from the current pathname. */
export default function GraveyardLoadingLabel({
  className,
  dayText,
}: {
  className?: string;
  /** Replaces the night line when the day theme is active. */
  dayText?: string;
}) {
  const pathname = usePathname() ?? "";
  const { theme } = useTheme();
  const text =
    theme === "day" && dayText
      ? dayText
      : loadingLabel(usernameFromPath(pathname));
  return (
    <p role="status" className={className}>
      {text}
    </p>
  );
}
