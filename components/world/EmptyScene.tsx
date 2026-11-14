/**
 * EmptyScene (sky variant): the finished night sky shown when the Restless Sky
 * has zero ghosts (Req 16.4), at exactly one screen with no scrollbar.
 *
 * Contents: one uniform Crop of `place-sky` framed on the painted moon, a CSS
 * star field, cloud banks (`EnvMist`, Environmental_Mist only), a soft moon
 * glow locked to the painted moon with `plateToStage`, and an empty lantern
 * hook. The empty copy hangs on a carved stone plaque from that hook, so it
 * is an object of the scene and never text floating over the art (Req 16.5).
 * The plaque uses the stone token pair (text on surface >= 4.5:1).
 *
 * Decor is `aria-hidden` and `inert`; only the plaque is exposed. The root
 * is clipped to the viewport (`overflow-clip`), so no scrollbar can appear.
 * If the plate fails to load, `CropLayer` keeps the `--color-night-sky` fill
 * and the plaque stays rendered (Req 16.7).
 *
 * Requirements: 7.11, 16.1, 16.4, 16.5
 */
import type { CSSProperties } from "react";

import { PAINTED_MOON } from "@/lib/estate-view";
import { PLATE_SIZE, computeCrop, plateToStage } from "@/lib/world-art";
import { themeFilter, type Theme } from "@/lib/theme-art";
import { dayCopy } from "@/lib/day-copy";

import DayPalette from "@/components/scene/DayPalette";
import Sun from "@/components/scene/Sun";

import CropLayer from "./CropLayer";
import EnvMist from "./EnvMist";

/** Parchment card for the empty-state plaques in day. */
const DAY_CARD_STYLE: CSSProperties = {
  backgroundColor: "var(--color-day-parchment)",
  border: "1px solid var(--color-day-card-border)",
  boxShadow: "0 4px 12px var(--color-day-card-shadow)",
};

export interface EmptySceneProps {
  variant: "sky" | "ground" | "crypt";
  /** Viewport size in px; the scene is exactly one screen. */
  viewportW: number;
  viewportH: number;
  reducedMotion?: boolean;
  /** Art theme (default night). */
  theme?: Theme;
  /** Plaque heading. */
  title?: string;
  /** Plaque body. */
  body?: string;
}

/**
 * Ground variant (Req 16.2, 16.5, 8.10): a finished cemetery at one screen
 * with the entry gate, fence, worn path, mausoleum, two lit lanterns and one
 * unmarked plot (mound and stake) whose carved plaque carries the copy.
 * Lit by the ground Light_Source (warm lantern glow). Decor is `aria-hidden`
 * and `inert`; the plaque sits outside it. Mist is the fixed-density
 * Environmental_Mist, never Data_Fog.
 */
function EmptyGround({
  viewportW,
  viewportH,
  reducedMotion = false,
  theme = "night",
  title = "No tombstones rest here yet",
  body = "One plot waits, unmarked. A stone will stand here when a project is done.",
}: EmptySceneProps) {
  const isDay = theme === "day";
  const cardTitle = isDay ? dayCopy(theme, "empty.ground.title") : title;
  const cardBody = isDay ? dayCopy(theme, "empty.ground.body") : body;
  const cardStyle: CSSProperties = isDay
    ? {
        backgroundColor: "var(--color-day-parchment)",
        border: "1px solid var(--color-day-card-border)",
        boxShadow: "0 4px 12px var(--color-day-card-shadow)",
      }
    : { boxShadow: "0 6px 18px var(--color-plaque-shadow)" };
  const W = Math.max(1, viewportW);
  const H = Math.max(1, viewportH);
  const sideW = Math.round(Math.min(0.28 * W, 340));
  const gateW = Math.round(Math.min(0.5 * W, 560));
  const flicker = reducedMotion ? "" : "lantern-flicker";
  const lanternStyle: CSSProperties = {
    width: 10,
    height: 14,
    backgroundColor: "var(--color-candle-400)",
    boxShadow: "0 0 22px 10px var(--light-ground-glow)",
    border: "1px solid var(--color-brass-edge)",
  };

  return (
    <div
      data-testid="empty-scene"
      data-variant="ground"
      data-place="ground"
      className="pointer-events-none absolute inset-x-0 top-0 overflow-clip"
      style={{ height: H, backgroundColor: "var(--color-night-sky)" }}
    >
      <div
        data-testid="empty-scene-decor"
        data-decor-clip=""
        aria-hidden="true"
        inert
        className="absolute inset-0 overflow-clip"
      >
        <CropLayer
          plate="place-ground"
          theme={theme}
          data-testid="empty-ground-plate"
          element={{ w: W, h: H }}
          focal={{ fx: 0.4, fy: 0.38 }}
          anchor={{ ax: 0.4, ay: 0.45 }}
          filter={themeFilter(theme, "brightness(0.55)", "--art-filter-ground")}
          edgeMask={0}
        />

        {/* Worn path: a tapering ribbon from the foreground to the gate (night only; no tint over day art). */}
        {theme === "day" ? null : <div
          data-testid="empty-ground-path"
          className="absolute left-1/2 bottom-0 -translate-x-1/2"
          style={{
            top: "46%",
            width: "34%",
            clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
            backgroundImage:
              "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-candle-tan) 22%, transparent))",
          }}
        />}

        {/* Mausoleum, once, far on the right. */}
        <CropLayer
          plate="mausoleum"
          theme={theme}
          data-testid="empty-ground-mausoleum"
          element={{ w: 150, h: 204 }}
          focal={{ fx: 0.5, fy: 0.5 }}
          anchor={{ ax: 0.5, ay: 0.5 }}
          filter={themeFilter(theme, "brightness(0.7)", "--art-filter-ground")}
          backdrop={false}
          edgeMask={0}
          className="pointer-events-none absolute overflow-clip"
          style={{ right: "12%", top: "30%", width: 150, height: 204 }}
        />

        {/* Fence: side pieces either side of the entry gate. */}
        <CropLayer
          plate="mg-fence-tile"
          theme={theme}
          data-testid="empty-ground-fence-left"
          element={{ w: sideW, h: 120 }}
          focal={{ fx: 0.5, fy: 0.5 }}
          anchor={{ ax: 0.5, ay: 0.5 }}
          filter={themeFilter(theme, "brightness(0.7)", "--art-filter-fence")}
          backdrop={false}
          edgeMask={0}
          className="pointer-events-none absolute overflow-clip"
          style={{ left: 0, top: "40%", width: sideW, height: 120 }}
        />
        <CropLayer
          plate="mg-fence-tile"
          theme={theme}
          data-testid="empty-ground-fence-right"
          element={{ w: sideW, h: 120 }}
          focal={{ fx: 0.5, fy: 0.5 }}
          anchor={{ ax: 0.5, ay: 0.5 }}
          filter={themeFilter(theme, "brightness(0.7)", "--art-filter-fence")}
          backdrop={false}
          edgeMask={0}
          className="pointer-events-none absolute overflow-clip"
          style={{ right: 0, top: "40%", width: sideW, height: 120 }}
        />

        {/* Entry gate, centred. */}
        <CropLayer
          plate="mg-fence"
          theme={theme}
          data-testid="empty-ground-gate"
          element={{ w: gateW, h: 170 }}
          focal={{ fx: 0.5, fy: 0.5 }}
          anchor={{ ax: 0.5, ay: 0.5 }}
          filter={themeFilter(theme, "brightness(0.75)", "--art-filter-fence")}
          backdrop={false}
          edgeMask={0}
          className="pointer-events-none absolute overflow-clip"
          style={{
            left: "50%",
            marginLeft: -gateW / 2,
            top: "37%",
            width: gateW,
            height: 170,
          }}
        />

        {/* Two lit lanterns along the path. */}
        {theme === "day" ? null : (
          <>
            <span
              data-testid="empty-ground-lantern"
              className={`absolute ${flicker}`.trim()}
              style={{ ...lanternStyle, left: "36%", top: "56%" }}
            />
            <span
              data-testid="empty-ground-lantern"
              className={`absolute ${flicker}`.trim()}
              style={{ ...lanternStyle, left: "63%", top: "52%" }}
            />
          </>
        )}

        <div
          data-testid="empty-ground-mist"
          className="absolute inset-x-0 bottom-0"
          style={{ height: "35%" }}
        >
          <EnvMist place="ground" layer="far" reducedMotion={reducedMotion} />
          <EnvMist place="ground" layer="near" reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* The unmarked plot: plaque on a stake over a fresh mound. */}
      <div
        data-testid="empty-ground-plot"
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={{ top: "max(58%, 24rem)", width: "min(88vw, 22rem)" }}
      >
        <section
          data-testid="empty-scene-plaque"
          aria-label="Empty cemetery"
          className="fixture-ledge w-full px-5 py-4 text-center"
          style={cardStyle}
        >
          <h2
            className="text-sm uppercase"
            style={{
              fontFamily: "var(--font-heading), Georgia, serif",
              letterSpacing: "0.14em",
              color: isDay ? "var(--color-day-ink)" : "var(--color-stone-text)",
            }}
          >
            {cardTitle}
          </h2>
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-narrative), Georgia, serif",
              fontStyle: "italic",
              fontSize: "var(--text-body)",
              color: isDay
                ? "var(--color-day-ink-muted)"
                : "var(--color-stone-text-muted)",
            }}
          >
            {cardBody}
          </p>
        </section>
        <span
          aria-hidden="true"
          data-testid="empty-ground-stake"
          className="block w-1"
          style={{
            height: 22,
            backgroundColor: isDay
              ? "var(--color-day-card-border)"
              : "var(--color-iron-border)",
          }}
        />
        <span
          aria-hidden="true"
          data-testid="empty-ground-mound"
          className="block rounded-t-full"
          style={
            isDay
              ? {
                  width: 120,
                  height: 26,
                  backgroundColor: "var(--color-day-parchment)",
                  border: "1px solid var(--color-day-card-border)",
                }
              : {
                  width: 120,
                  height: 26,
                  backgroundColor: "var(--color-stone-surface-raised)",
                  boxShadow: "0 0 24px 4px var(--light-ground-glow)",
                }
          }
        />
      </div>
    </div>
  );
}

/** Number of CSS stars. */
export const EMPTY_SKY_STAR_COUNT = 36;

/** Deterministic star positions (percent), top 65 percent of the screen. */
function starField(count: number): { x: number; y: number; size: number; o: number }[] {
  let s = 0x9e3779b1;
  const next = (): number => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x7f4a7c15) >>> 0;
    return s / 0x100000000;
  };
  return Array.from({ length: count }, () => ({
    x: next() * 100,
    y: next() * 65,
    size: 1 + Math.floor(next() * 2),
    o: 0.35 + next() * 0.5,
  }));
}

const STARS = starField(EMPTY_SKY_STAR_COUNT);

/**
 * Crypt variant (Req 16.3, 16.5, 9.11): a finished crypt at one screen with a
 * vaulted ceiling (ribs), wall niches, two torches, steps leading down, drifting
 * dust, and an iron-banded sealed door at the far end. The copy is a plate on
 * the door (stone token pair, >= 4.5:1). Lit by the crypt Light_Source (torch).
 * Decor is `aria-hidden` and `inert`; the plate sits outside it.
 */
function EmptyCrypt({
  viewportW,
  viewportH,
  reducedMotion = false,
  theme = "night",
  title = "No coffins lie sealed here",
  body = "The door stays shut. A chain will bind it when a project is let go.",
}: EmptySceneProps) {
  const isDay = theme === "day";
  const W = Math.max(1, viewportW);
  const H = Math.max(1, viewportH);
  const flicker = reducedMotion ? "" : "lantern-flicker";
  const torchStyle: CSSProperties = {
    width: 10,
    height: 16,
    backgroundColor: "var(--color-candle-400)",
    boxShadow: "0 0 26px 12px var(--light-crypt-glow)",
    border: "1px solid var(--light-crypt-rim)",
  };
  const ribs = [18, 34, 50, 66, 82];
  const niches = [
    { side: "left", top: "34%", offset: "6%" },
    { side: "left", top: "34%", offset: "17%" },
    { side: "right", top: "34%", offset: "6%" },
    { side: "right", top: "34%", offset: "17%" },
  ] as const;
  const steps = [0, 1, 2, 3, 4];

  return (
    <div
      data-testid="empty-scene"
      data-variant="crypt"
      data-place="crypt"
      className="pointer-events-none absolute inset-x-0 top-0 overflow-clip"
      style={{ height: H, backgroundColor: "var(--color-night-sky)" }}
    >
      <div
        data-testid="empty-scene-decor"
        data-decor-clip=""
        aria-hidden="true"
        inert
        className="absolute inset-0 overflow-clip"
      >
        {isDay ? (
          <DayPalette variant="meadow" />
        ) : (
        <CropLayer
          plate="place-crypt"
          data-testid="empty-crypt-plate"
          element={{ w: W, h: H }}
          focal={{ fx: 0.5, fy: 0.45 }}
          anchor={{ ax: 0.5, ay: 0.45 }}
          filter="brightness(0.7)"
          edgeMask={0}
        />
        )}

        {/* Vaulted ceiling: dark gradient with arched ribs (night only). */}
        {!isDay && (<>
        <div
          data-testid="empty-crypt-ceiling"
          className="absolute inset-x-0 top-0"
          style={{
            height: "30%",
            backgroundImage:
              "linear-gradient(to bottom, var(--light-crypt-shadow), transparent)",
          }}
        >
          {ribs.map((x) => (
            <span
              key={x}
              data-testid="empty-crypt-rib"
              className="absolute top-0 block w-px"
              style={{
                left: `${x}%`,
                height: "100%",
                backgroundColor: "var(--color-iron-border)",
                opacity: 0.6,
              }}
            />
          ))}
        </div>

        {/* Wall niches, two each side. */}
        {niches.map((n, i) => (
          <span
            key={i}
            data-testid="empty-crypt-niche"
            className="absolute block rounded-t-full"
            style={{
              [n.side]: n.offset,
              top: n.top,
              width: 54,
              height: 90,
              backgroundColor: "var(--color-night-sky)",
              border: "1px solid var(--color-stone-edge)",
              boxShadow: "inset 0 6px 14px var(--light-crypt-shadow)",
            }}
          />
        ))}

        {/* Two wall torches, warm light from the sides. */}
        <span
          data-testid="empty-crypt-torch"
          className={`absolute ${flicker}`.trim()}
          style={{ ...torchStyle, left: "28%", top: "36%" }}
        />
        <span
          data-testid="empty-crypt-torch"
          className={`absolute ${flicker}`.trim()}
          style={{ ...torchStyle, right: "28%", top: "36%" }}
        />

        {/* Steps leading down toward the viewer. */}
        <div
          data-testid="empty-crypt-steps"
          className="absolute inset-x-0 bottom-0 flex flex-col items-center"
        >
          {steps.map((i) => (
            <span
              key={i}
              data-testid="empty-crypt-step"
              className="block"
              style={{
                width: `${52 + i * 9}%`,
                height: 12,
                backgroundColor: "var(--color-stone-surface-raised)",
                borderTop: "1px solid var(--color-stone-edge)",
                boxShadow: "0 4px 10px var(--light-crypt-shadow)",
              }}
            />
          ))}
        </div>
        </>)}

        <div
          data-testid="empty-crypt-dust"
          className="absolute inset-x-0 bottom-0"
          style={{ height: "55%" }}
        >
          <EnvMist place="crypt" layer="far" reducedMotion={reducedMotion} />
          <EnvMist place="crypt" layer="near" reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* The sealed door at the far end, carrying the copy as a plate. */}
      <div
        data-testid="empty-crypt-door"
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={{ top: "max(36%, 15rem)", width: "min(88vw, 24rem)" }}
      >
        {isDay ? null : (
        <div
          aria-hidden="true"
          data-testid="empty-crypt-arch"
          className="w-full rounded-t-full border"
          style={{
            height: 28,
            borderColor: "var(--color-stone-edge)",
            backgroundColor: "var(--color-stone-surface-raised)",
          }}
        />
        )}
        <div
          className="relative w-full px-4 py-5"
          style={
            isDay
              ? undefined
              : {
                  backgroundColor: "var(--color-stone-surface)",
                  border: "1px solid var(--color-iron-border)",
                  boxShadow: "0 0 30px 2px var(--light-crypt-glow)",
                }
          }
        >
          {isDay ? null : (
            <>
          <span
            aria-hidden="true"
            data-testid="empty-crypt-band"
            className="absolute inset-x-0 block"
            style={{ top: "18%", height: 8, backgroundColor: "var(--color-iron-bg-top)", borderBlock: "1px solid var(--color-iron-border)" }}
          />
          <span
            aria-hidden="true"
            data-testid="empty-crypt-band"
            className="absolute inset-x-0 block"
            style={{ bottom: "18%", height: 8, backgroundColor: "var(--color-iron-bg-top)", borderBlock: "1px solid var(--color-iron-border)" }}
          />
            </>
          )}
          <section
            data-testid="empty-scene-plaque"
            aria-label="Empty crypt"
            className="fixture-ledge relative w-full px-5 py-4 text-center"
            style={isDay ? DAY_CARD_STYLE : { boxShadow: "0 6px 18px var(--color-plaque-shadow)" }}
          >
            <h2
              className="text-sm uppercase"
              style={{
                fontFamily: "var(--font-heading), Georgia, serif",
                letterSpacing: "0.14em",
                color: isDay ? "var(--color-day-ink)" : "var(--color-stone-text)",
              }}
            >
              {isDay ? dayCopy(theme, "empty.crypt.title") : title}
            </h2>
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--font-narrative), Georgia, serif",
                fontStyle: "italic",
                fontSize: "var(--text-body)",
                color: isDay ? "var(--color-day-ink-muted)" : "var(--color-stone-text-muted)",
              }}
            >
              {isDay ? dayCopy(theme, "empty.crypt.body") : body}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function EmptyScene(props: EmptySceneProps) {
  if (props.variant === "ground") return <EmptyGround {...props} />;
  if (props.variant === "crypt") return <EmptyCrypt {...props} />;
  return <EmptySky {...props} />;
}

function EmptySky({
  viewportW,
  viewportH,
  reducedMotion = false,
  theme = "night",
  title = "No ghosts haunt this sky",
  body = "The hook is empty. A lantern will hang here when a project wakes.",
}: EmptySceneProps) {
  const element = {
    w: Math.max(1, viewportW),
    h: Math.max(1, viewportH),
  };
  const crop = computeCrop({
    plate: PLATE_SIZE["place-sky"],
    element,
    focal: { fx: PAINTED_MOON.fx, fy: PAINTED_MOON.fy },
    anchor: { ax: 0.75, ay: 0.22 },
    flip: { h: false, v: false },
  });
  const moon = plateToStage(crop, element, PAINTED_MOON.fx, PAINTED_MOON.fy);
  const moonD = PAINTED_MOON.diamFrac * crop.plate.w * crop.scale;
  const isDay = theme === "day";

  const moonStyle: CSSProperties = {
    left: moon.x - moonD,
    top: moon.y - moonD,
    width: moonD * 2,
    height: moonD * 2,
    backgroundImage:
      "radial-gradient(circle, var(--color-moon-glow-pale) 0%, transparent 70%)",
  };

  return (
    <div
      data-testid="empty-scene"
      data-variant="sky"
      data-place="sky"
      className="pointer-events-none absolute inset-x-0 top-0 overflow-clip"
      style={{
        height: element.h,
        backgroundColor: "var(--color-night-sky)",
      }}
    >
      <div
        data-testid="empty-scene-decor"
        data-decor-clip=""
        aria-hidden="true"
        inert
        className="absolute inset-0 overflow-clip"
      >
        {isDay ? (
          <DayPalette variant="sky" />
        ) : (
        <CropLayer
          plate="place-sky"
          data-testid="empty-sky-plate"
          element={element}
          focal={{ fx: PAINTED_MOON.fx, fy: PAINTED_MOON.fy }}
          anchor={{ ax: 0.75, ay: 0.22 }}
          filter="brightness(0.8)"
          edgeMask={0}
        />
        )}

        <div data-testid="empty-sky-stars" className="absolute inset-0">
          {(isDay ? [] : STARS).map((st, i) => (
            <span
              key={i}
              data-testid="empty-sky-star"
              className="absolute rounded-full"
              style={{
                left: `${st.x}%`,
                top: `${st.y}%`,
                width: st.size,
                height: st.size,
                opacity: st.o,
                backgroundColor: "var(--color-moon-pale)",
              }}
            />
          ))}
        </div>

        {isDay ? (
          <div data-testid="empty-sky-sun">
            <Sun
              placement={{ cx: moon.x, cy: moon.y, diameter: moonD }}
              glowScale={0.5}
            />
          </div>
        ) : (
        <div
          data-testid="empty-sky-moon"
          className="absolute rounded-full"
          style={moonStyle}
        />
        )}

        <div
          data-testid="empty-sky-clouds"
          className="absolute inset-x-0 bottom-0"
          style={{ height: "40%" }}
        >
          <EnvMist place="sky" layer="far" reducedMotion={reducedMotion} />
          <EnvMist place="sky" layer="near" reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* The empty lantern hook with the plaque hanging from it on two chains. */}
      <div
        data-testid="empty-sky-hook"
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={{ top: "max(34%, 20.5rem)", width: "min(88vw, 22rem)" }}
      >
        {isDay ? null : (
          <>
        <div
          aria-hidden="true"
          className="h-3 w-24 rounded-b-full border"
          style={{
            borderColor: "var(--color-brass-edge)",
            backgroundColor: "var(--color-iron-border)",
          }}
        />
        <div
          aria-hidden="true"
          data-testid="empty-sky-chains"
          className="flex w-[70%] justify-between"
        >
          <span
            className="block w-px"
            style={{ height: 28, backgroundColor: "var(--color-iron-label)" }}
          />
          <span
            className="block w-px"
            style={{ height: 28, backgroundColor: "var(--color-iron-label)" }}
          />
        </div>
          </>
        )}
        <section
          data-testid="empty-scene-plaque"
          aria-label="Empty sky"
          className="fixture-ledge w-full px-5 py-4 text-center"
          style={isDay ? DAY_CARD_STYLE : { boxShadow: "0 6px 18px var(--color-plaque-shadow)" }}
        >
          <h2
            className="text-sm uppercase"
            style={{
              fontFamily: "var(--font-heading), Georgia, serif",
              letterSpacing: "0.14em",
              color: isDay ? "var(--color-day-ink)" : "var(--color-stone-text)",
            }}
          >
            {isDay ? dayCopy(theme, "empty.sky.title") : title}
          </h2>
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-narrative), Georgia, serif",
              fontStyle: "italic",
              fontSize: "var(--text-body)",
              color: isDay ? "var(--color-day-ink-muted)" : "var(--color-stone-text-muted)",
            }}
          >
            {isDay ? dayCopy(theme, "empty.sky.body") : body}
          </p>
        </section>
      </div>
    </div>
  );
}
