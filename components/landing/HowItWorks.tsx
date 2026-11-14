/**
 * Three-step "how it works" row: an ordered list, one existing creature image
 * per step. Images are decorative (empty alt) because the step text names the
 * step.
 *
 * Requirements: 2.7, 2.8
 */
import Image from "next/image";

import { themeArt } from "@/lib/theme-art";

const STEPS = [
  { title: "Visit a graveyard", art: "ghost-0" },
  { title: "Hold a séance", art: "zombie-0" },
  { title: "Revive it in Kiro", art: "risen" },
] as const;

export default function HowItWorks() {
  return (
    <ol
      data-testid="how-it-works"
      className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 sm:grid-cols-3"
    >
      {STEPS.map((step) => (
        <li
          key={step.title}
          className="flex flex-col items-center gap-2 text-center"
        >
          <Image
            // The landing gate is always night; creatures have no day art here.
            src={themeArt("night", `/art/${step.art}.webp`)}
            alt=""
            width={96}
            height={96}
            draggable={false}
            className="h-24 w-24 select-none object-contain"
          />
          <span className="font-heading text-base text-scene-fg">
            {step.title}
          </span>
        </li>
      ))}
    </ol>
  );
}
