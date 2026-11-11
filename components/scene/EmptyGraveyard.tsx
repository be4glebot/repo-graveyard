/**
 * Empty-graveyard state (server component): a user with no public repos gets a
 * peaceful cemetery under a full pale moon. `moonTreatment([])` is "pale"
 * (0 undead is not greater than 0 settled), so passing no rows yields the
 * calm full moon with no override. Colors come from theme tokens only.
 *
 * Requirements: 7.1, 7.6, 7.8, 7.9
 */

import ThemedButton from "@/components/ui/ThemedButton";
import { emptyGraveyardLine } from "@/lib/edge-states";
import Moon from "./Moon";
import ThemedShell from "./ThemedShell";

export interface EmptyGraveyardProps {
  username: string;
}

const MOON_DIAMETER_PX = 130;

export default function EmptyGraveyard({ username }: EmptyGraveyardProps) {
  return (
    <ThemedShell image="place-ground">
      <section
        role="status"
        className="flex w-full max-w-[420px] flex-col items-center gap-4"
      >
        <div
          className="relative mb-6"
          style={{ width: MOON_DIAMETER_PX, height: MOON_DIAMETER_PX }}
        >
          <Moon
            rows={[]}
            placement={{
              cx: MOON_DIAMETER_PX / 2,
              cy: MOON_DIAMETER_PX / 2,
              diameter: MOON_DIAMETER_PX,
            }}
          />
        </div>
        <h1 className="m-0 font-heading text-[17px] font-bold uppercase tracking-[2px] text-scene-fg">
          Nothing buried here yet.
        </h1>
        <p className="m-0 font-narrative text-[17px] italic leading-[1.45] text-scene-fg-muted">
          {emptyGraveyardLine(username)}
        </p>
        <ThemedButton href="/estate" variant="crimson">
          Tour the Haunted Estate
        </ThemedButton>
      </section>
    </ThemedShell>
  );
}
