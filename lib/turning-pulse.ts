/**
 * Pulse rate of the turning-soon notice. Pure: more urgent (fewer days left)
 * means a faster, still gentle pulse. Never above PULSE_HZ_MAX (well under the
 * 3 flashes/second photosensitivity limit); no hard strobe.
 */

/** Slowest pulse, used at 30 days left. */
export const PULSE_HZ_MIN = 0.6;
/** Fastest pulse, used at 3 days left or fewer. */
export const PULSE_HZ_MAX = 1.4;

const WINDOW_DAYS = 30;
const URGENT_DAYS = 3;

/** Pulse frequency in Hz for a whole-day countdown (clamped, NaN-safe). */
export function turningPulseHz(daysLeft: number): number {
  const d = Number.isFinite(daysLeft) ? daysLeft : WINDOW_DAYS;
  const t = (WINDOW_DAYS - Math.min(WINDOW_DAYS, Math.max(URGENT_DAYS, d))) / (WINDOW_DAYS - URGENT_DAYS);
  return PULSE_HZ_MIN + t * (PULSE_HZ_MAX - PULSE_HZ_MIN);
}

/** Pulse period in seconds (1 / Hz), rounded to 2 decimals. */
export function turningPulseSeconds(daysLeft: number): number {
  return Math.round((1 / turningPulseHz(daysLeft)) * 100) / 100;
}
