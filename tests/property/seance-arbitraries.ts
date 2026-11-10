import fc from "fast-check";
import { VERDICTS, type SeanceResult } from "@/lib/seance-schema";

// Letters only, so no generated prose can contain a digit, date or day count.
const word = fc.stringMatching(/^[a-z]{1,10}$/);

const sentence = fc
  .tuple(
    fc.array(word, { minLength: 1, maxLength: 6 }),
    fc.constantFrom(".", "!", "?"),
  )
  .map(([words, end]) => words.join(" ") + end);

const sentences = (min: number, max: number) =>
  fc
    .array(sentence, { minLength: min, maxLength: max })
    .map((list) => list.join(" "));

const evidence = fc
  .array(fc.stringMatching(/^[A-Za-z0-9:]{1,12}$/), {
    minLength: 2,
    maxLength: 10,
  })
  .map((parts) => parts.join(" "))
  .filter((s) => s.length >= 8 && s.length <= 200);

const item = fc.record({
  title: fc.array(word, { minLength: 1, maxLength: 8 }).map((w) => w.join(" ")),
  detail: sentences(1, 3).filter((s) => s.length <= 300),
  evidence,
});

/** Arbitrary for schema-valid SeanceResults. */
export const validSeanceResult: fc.Arbitrary<SeanceResult> = fc.record({
  voice: sentences(2, 4),
  causeOfDeath: sentence,
  unfinishedBusiness: fc.array(item, { minLength: 2, maxLength: 5 }),
  verdict: fc.constantFrom(...VERDICTS),
  verdictReason: sentences(1, 3).filter((s) => s.length <= 300),
});
