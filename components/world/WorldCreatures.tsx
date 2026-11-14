"use client";

import type { ComponentType, CSSProperties } from "react";

import Coffin from "@/components/creatures/Coffin";
import Ghost from "@/components/creatures/Ghost";
import Risen from "@/components/creatures/Risen";
import Tombstone from "@/components/creatures/Tombstone";
import Zombie from "@/components/creatures/Zombie";
import type { CreatureProps } from "@/components/creatures/Creature";
import { hoverCardId } from "@/components/detail/HoverCardLayer";
import { useOptionalHoverCardActions } from "@/components/detail/HoverCardProvider";
import { GHOST_DECAY_WORDS, ZOMBIE_DECAY_WORDS } from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";
import type { Theme } from "@/lib/theme-art";
import { effectProps, freshEarth } from "@/lib/world-effects";
import { coffinGroundingFor, rimFor, shadowFor } from "@/lib/world-light";
import type { WorldLayout } from "@/lib/world-layout";

import CreatureShadow from "./CreatureShadow";
import CreatureTag, { type CreatureTagVariant } from "./CreatureTag";

type ConcreteCreature = ComponentType<
  Omit<CreatureProps, "children" | "animationClassName">
>;

const CREATURE_BY_STATE: Record<LifecycleState, ConcreteCreature> = {
  ghost: Ghost,
  risen: Risen,
  zombie: Zombie,
  tombstone: Tombstone,
  coffin: Coffin,
};

const TAG_BY_STATE: Record<LifecycleState, CreatureTagVariant> = {
  ghost: "lantern",
  risen: "stake",
  zombie: "stake",
  tombstone: "grave-marker",
  coffin: "hanging",
};

/** Decay word for the tag sub-line (state is never colour alone). */
function decayWord(state: LifecycleState, level: number | null | undefined): string | undefined {
  if (level == null) return undefined;
  if (state === "ghost") return GHOST_DECAY_WORDS[level];
  if (state === "zombie") return ZOMBIE_DECAY_WORDS[level];
  return undefined;
}

/** Standing creatures get a contact shadow; ghosts never do. */
const STANDING: ReadonlySet<LifecycleState> = new Set([
  "zombie",
  "risen",
  "tombstone",
  "coffin",
]);

/** Most ravens perched in one ground Plot (Effects_Table: `ravens`). */
export const MAX_RAVENS = 2;

function nameHash(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Names of the (at most two) tombstones that carry a raven, chosen by name hash. */
export function ravenNames(rows: readonly GraveyardRow[]): Set<string> {
  return new Set(
    rows
      .filter((r) => r.state === "tombstone")
      .map((r) => ({ name: r.name, h: nameHash(r.name) }))
      .sort((a, b) => a.h - b.h || (a.name < b.name ? -1 : 1))
      .slice(0, MAX_RAVENS)
      .map((x) => x.name),
  );
}

export interface WorldCreaturesProps {
  layout: Pick<WorldLayout, "place" | "slots" | "domOrder" | "strata"> &
    Partial<Pick<WorldLayout, "chambers">>;
  /** Index-aligned with `layout.slots`. */
  rows: readonly GraveyardRow[];
  /** Stage width in px; turns `cx` into a percentage `left`. */
  viewportW: number;
  selectedName: string | null;
  onSelect: (name: string) => void;
  filterHeroes?: ReadonlySet<string>;
  theme?: Theme;
}

/**
 * The creature layer (z 20, band rate 1, no pointer offset): one `ol` per
 * Stratum, one `li` per slot. DOM order is `domOrder` (top to bottom), so the
 * tab sequence follows the picture. `li` z-index is the rank by `cy`.
 *
 * Requirements: 3.7, 5.2, 12.5, 12.6, 18.7, 18.11
 */
export function WorldCreatures({
  layout,
  rows,
  viewportW,
  selectedName,
  onSelect,
  filterHeroes,
  theme = "night",
}: WorldCreaturesProps) {
  const hover = useOptionalHoverCardActions();
  const { place, slots, domOrder, strata } = layout;

  const ravens = place === "ground" ? ravenNames(rows) : new Set<string>();
  const rank = new Map<number, number>();
  domOrder.forEach((slotIndex, r) => rank.set(slotIndex, r + 1));

  return (
    <div
      data-testid="depth-scatter"
      data-band-rate="1"
      className="world-creatures pointer-events-none absolute inset-0 z-20 isolate"
    >
      {strata.map((stratum, s) => (
        <ol
          key={stratum.id}
          aria-label={stratum.label}
          data-stratum={stratum.id}
          data-chamber={
            place === "crypt" && layout.chambers && s >= 1 ? s : undefined
          }
          className="pointer-events-none absolute inset-0 m-0 list-none p-0"
        >
          {domOrder
            .filter((i) => slots[i]?.stratum === s && rows[i] !== undefined)
            .map((i) => {
              const slot = slots[i];
              const row = rows[i];
              const Concrete = CREATURE_BY_STATE[row.state];
              const standing = STANDING.has(row.state);
              const grounded =
                place === "crypt" && row.state === "coffin"
                  ? coffinGroundingFor(slot.brightness, slot.size)
                  : null;
              const sh = grounded
                ? grounded.shadow
                : standing
                  ? shadowFor(place, slot.brightness, slot.size)
                  : null;
              const isGhost = row.state === "ghost";
              const isGrave = place === "ground" && row.state === "tombstone";
              const reveals = isGhost || isGrave;
              const fresh = isGrave && freshEarth(row.daysQuiet);
              // Day shows creatures as painted: no depth dimming.
              const filters = theme === "day" ? [] : [`brightness(${slot.brightness})`];
              // Rim glow rides on the existing wrapper filter (no new SVG filter).
              if (isGhost) filters.push(rimFor(place, row).filter);
              const style: CSSProperties = {
                left: viewportW > 0 ? `${(slot.cx / viewportW) * 100}%` : `${slot.cx}px`,
                top: `${slot.cy}px`,
                width: `${slot.size}px`,
                height: `${slot.size}px`,
                transform: "translate(-50%, -50%)",
                zIndex: rank.get(i),
                filter: filters.length ? filters.join(" ") : undefined,
              };
              return (
                <li
                  key={row.name}
                  data-testid="scatter-creature"
                  data-name={row.name}
                  data-mirrored={slot.mirrored ? "true" : "false"}
                  className="pointer-events-none absolute m-0 p-0"
                  style={style}
                  {...(isGhost ? effectProps("ghost-rim-glow") : null)}
                >
                  {/* Ghosts get one Discovery_Reveal (transform/opacity only) on an
                      inner wrapper, so the li's centring transform is untouched. */}
                  <div
                    className={
                      reveals
                        ? "world-reveal relative h-full w-full"
                        : "relative h-full w-full"
                    }
                    {...(reveals ? { "data-reveal": "" } : null)}
                    {...(isGrave ? effectProps("candle-glow-reveal") : null)}
                  >
                  {isGrave && theme !== "day" ? (
                    <span
                      data-part="candle-glow"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 motion-reduce:transition-none [[data-revealed=true]>&]:opacity-60"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 50% 70%, color-mix(in srgb, var(--color-candle-400) 45%, transparent), transparent 65%)",
                      }}
                    />
                  ) : null}
                  <div
                    data-part="tilt"
                    {...effectProps(isGrave ? "tombstone-moss" : "creature-motion")}
                    className="h-full w-full"
                    style={isGrave && slot.tilt ? { transform: `rotate(${slot.tilt}deg)` } : undefined}
                  >
                  <Concrete
                    row={row}
                    onSelect={onSelect}
                    selected={row.name === selectedName}
                    filterHero={filterHeroes?.has(row.name) ?? false}
                    size={slot.size}
                    mirror={slot.mirrored}
                    style={{ pointerEvents: "auto" }}
                    shadow={
                      sh ? (
                        <>
                          <CreatureShadow
                            width={slot.size * (grounded ? grounded.shadowWidthFactor : 0.8)}
                            offsetX={sh.offsetX}
                            offsetY={sh.offsetY}
                            blur={sh.blur}
                            opacity={sh.opacity}
                          />
                          {grounded ? (
                            <span
                              data-part="floor-line"
                              aria-hidden="true"
                              className="pointer-events-none absolute bottom-0 left-1/2 block -translate-x-1/2 translate-y-1/2 rounded-full"
                              style={{
                                width: slot.size * grounded.floorLine.widthFactor,
                                height: grounded.floorLine.thickness,
                                opacity: grounded.floorLine.opacity,
                                backgroundImage: `linear-gradient(to right, transparent, var(${grounded.floorLine.token}) 30%, var(${grounded.floorLine.token}) 70%, transparent)`,
                              }}
                            />
                          ) : null}
                        </>
                      ) : undefined
                    }
                    tag={
                      <CreatureTag
                        variant={TAG_BY_STATE[row.state]}
                        name={row.name}
                        parentBrightness={theme === "day" ? undefined : slot.brightness}
                        chainReveal={place === "crypt" && row.state === "coffin"}
                        subline={decayWord(row.state, row.decayLevel)}
                        decayLevel={row.state === "ghost" ? row.decayLevel : undefined}
                      />
                    }
                    onHoverStart={hover?.onPointerEnter}
                    onHoverEnd={hover?.onPointerLeave}
                    onFocusStart={hover?.onFocus}
                    onBlurEnd={hover?.onBlur}
                    hoverCardId={hover ? hoverCardId(row.name) : undefined}
                  />
                  </div>
                  {fresh ? (
                    <span
                      data-part="fresh-earth"
                      aria-hidden="true"
                      {...effectProps("fresh-earth")}
                      className="pointer-events-none absolute bottom-[8%] left-1/2 h-[7%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[color:var(--color-stone-surface-raised)]"
                    />
                  ) : null}
                  {isGrave && theme !== "day" && ravens.has(row.name) ? (
                    <span
                      data-part="raven"
                      aria-hidden="true"
                      {...effectProps("ravens")}
                      className="pointer-events-none absolute left-[58%] top-[2%] h-[9%] w-[16%] rounded-t-full bg-[color:var(--color-night-sky)]"
                    >
                      <span className="absolute right-[18%] top-[22%] h-[2px] w-[2px] rounded-full bg-[color:var(--color-crimson-400)]" />
                    </span>
                  ) : null}
                  </div>
                </li>
              );
            })}
        </ol>
      ))}
    </div>
  );
}

export default WorldCreatures;
