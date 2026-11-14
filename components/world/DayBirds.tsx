import {
  BIRD_PERCH_HEIGHT_RATIO,
  PERCH_BIRDS,
  type Theme,
} from "@/lib/theme-art";

interface BirdProps {
  theme: Theme;
  /** Place or world id; birds only appear on "ground". */
  place: string;
  reducedMotion?: boolean;
}

function showsBirds(theme: Theme, place: string): boolean {
  return theme === "day" && place === "ground";
}

/**
 * Two songbirds on the gate pillars. Rendered inside the gate box of
 * GroundArt, so percentage placement follows that box. Decorative only.
 */
export function PerchBirds({ theme, place }: BirdProps) {
  if (!showsBirds(theme, place)) return null;
  return (
    <>
      {PERCH_BIRDS.map((b) => (
        <div
          key={b.side}
          aria-hidden="true"
          data-part="perch-bird"
          data-side={b.side}
          style={{
            position: "absolute",
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            height: `${BIRD_PERCH_HEIGHT_RATIO * 100}%`,
            aspectRatio: "1 / 1",
            backgroundImage: "url(/art/day/bird-perch.webp)",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            transform: b.mirror ? "scaleX(-1)" : undefined,
            transformOrigin: "center",
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}
