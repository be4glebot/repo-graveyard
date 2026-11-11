"use client";

import { usePathname } from "next/navigation";
import { loadingLabel, usernameFromPath } from "@/lib/edge-states";

/** Status line that resolves the username from the current pathname. */
export default function GraveyardLoadingLabel({
  className,
}: {
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const text = loadingLabel(usernameFromPath(pathname));
  return (
    <p role="status" className={className}>
      {text}
    </p>
  );
}
