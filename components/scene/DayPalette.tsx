/**
 * Day palette: a warm sky gradient with an optional soft meadow, drawn only
 * from day tokens. It replaces the painted night plates (and their brightness
 * filters) for worlds that have no day art: the estate hub, the Open Sky, the
 * Garden Gate and the Keepsake Vault.
 *
 * Presentational and decorative: no state, no hooks, `pointer-events: none`.
 */

export type DayPaletteVariant = "sky" | "full" | "meadow";

const GRADIENTS: Record<DayPaletteVariant, string> = {
  // Sky only: high sky fading to the warm horizon.
  sky: "linear-gradient(to bottom, var(--color-day-sky-top) 0%, var(--color-day-sky-horizon) 100%)",
  // Sky over a soft meadow with a gentle blend at the horizon.
  full: "linear-gradient(to bottom, var(--color-day-sky-top) 0%, var(--color-day-sky-horizon) 52%, var(--color-day-meadow-far) 62%, var(--color-day-meadow-near) 100%)",
  // Mostly meadow, for interior-feeling places such as the vault.
  meadow:
    "linear-gradient(to bottom, var(--color-day-sky-horizon) 0%, var(--color-day-meadow-far) 40%, var(--color-day-meadow-near) 100%)",
};

export interface DayPaletteProps {
  variant?: DayPaletteVariant;
  className?: string;
}

export default function DayPalette({
  variant = "full",
  className,
}: DayPaletteProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="day-palette"
      data-variant={variant}
      className={`pointer-events-none absolute inset-0${
        className ? ` ${className}` : ""
      }`}
      style={{ backgroundImage: GRADIENTS[variant] }}
    />
  );
}
