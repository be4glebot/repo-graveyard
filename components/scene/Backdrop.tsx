/**
 * Parallax backdrop: three painted plates composited back to front.
 *
 * Renders the three `Parallax_Backdrop` layers from `public/art` using the
 * `.layer-bg-far` / `.layer-mg-fence` / `.layer-fg-frame` utility classes
 * defined in `app/globals.css`. Those classes read `--px`/`--py` (written to
 * the Scene root by the rAF pointer loop) and the per-layer `--f-far` /
 * `--f-mid` / `--f-fg` factors, so each plate displaces by a strictly
 * increasing amount (bg-far < mg-fence < fg-frame) for the same pointer offset
 * (Req 2.3). The idle drift is layered on a wrapper via `.layer-idle-drift`
 * so it is additive to the pointer-driven translation (Req 2.4).
 *
 * This component is purely presentational: it holds no state and reads no
 * clock. Pointer parallax is driven entirely through CSS custom properties the
 * Scene root owns, so the plates just read those variables — no React re-render
 * happens on pointer movement. For that reason this component does not need to
 * be a client component.
 *
 * Every plate carries a `brightness(≤0.6)` filter so the backdrop stays darker
 * than the creatures (Req 2.5). All colors come from `@theme` tokens; no
 * hardcoded hex appears here. The art assets are the single source of the plate
 * imagery; a plate whose asset fails to load degrades to its token-based
 * gradient fallback with no broken-image placeholder, and the remaining layers
 * still render (Req 2.2).
 *
 * Requirements: 2.3, 2.5
 */

import FadeArt from "@/components/scene/FadeArt";

/** Base path for the backdrop art plates under `public/art`. */
const ART_BASE = "/art";

export interface BackdropProps {
  /**
   * Extra classes for the outermost wrapper (e.g. to position it within the
   * Scene). Optional; the backdrop fills its positioned parent by default.
   */
  className?: string;
}

export default function Backdrop({ className }: BackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0${
        className ? ` ${className}` : ""
      }`}
    >
      {/* First-paint night sky: pure CSS, in the server HTML, so the map never
          reads as black while the painted plates download. Painted art fades in
          over it; a failed plate leaves it visible. */}
      <div
        data-testid="backdrop-night-gradient"
        className="backdrop-night-gradient absolute inset-0"
      />

      {/* bg-far: opaque sky/castle/hills plate, farthest back, least motion.
          The largest above-the-fold image: `priority`, and `sizes` of 106vw
          because the plate is `-inset-[3%]` (106% of the viewport width). */}
      <div className="layer-idle-drift absolute inset-0">
        <div
          data-testid="backdrop-bg-far"
          className="layer-bg-far absolute -inset-[3%]"
          style={{
            // Keep the backdrop darker than the creatures (Req 2.5).
            filter: "brightness(0.6)",
          }}
        >
          <FadeArt
            src={`${ART_BASE}/bg-far.webp`}
            sizes="106vw"
            priority
            className="object-cover object-top"
          />
        </div>
      </div>

      {/* mg-fence: the gate centerpiece with mg-fence-tile repeated across the
          full width behind it. Middle plate, more motion than bg-far. */}
      <div className="layer-idle-drift absolute inset-0">
        <div
          className="layer-mg-fence absolute -inset-[3%] top-[43%]"
          style={{ filter: "brightness(0.5)" }}
        >
          {/* Tiled fence repeated horizontally to fill at least the viewport
              width (Req 2.1). */}
          <div
            className="absolute inset-0 bg-repeat-x"
            style={{
              backgroundImage: `url(${ART_BASE}/mg-fence-tile.webp)`,
              backgroundPosition: "0 bottom",
              backgroundSize: "auto 100%",
            }}
          />
          {/* The gate centerpiece, drawn on top of the tiled run. */}
          <div
            className="absolute inset-0 bg-no-repeat"
            style={{
              backgroundImage: `url(${ART_BASE}/mg-fence.webp)`,
              backgroundPosition: "center bottom",
              backgroundSize: "auto 100%",
            }}
          />
        </div>
      </div>

      {/* fg-frame: transparent tree/thorns plate in front of the creatures,
          most motion of the three. */}
      <div className="layer-idle-drift absolute inset-0">
        <div
          className="layer-fg-frame absolute -inset-[4%] bg-no-repeat"
          style={{
            backgroundImage: `url(${ART_BASE}/fg-frame.webp)`,
            backgroundPosition: "left top",
            backgroundSize: "100% 100%",
            filter: "brightness(0.35)",
          }}
        />
      </div>
    </div>
  );
}
