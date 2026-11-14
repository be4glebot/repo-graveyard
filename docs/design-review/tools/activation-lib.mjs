// Pure helpers for activation-check.mjs (task 20.4). No I/O, no browser.

/** Every activation case, who runs it, and whether the record must open. */
export const CASES = [
  { id: "mouse-scroll-0", pointer: "mouse", expectOpen: true, needsScroller: true, gapMs: 0 },
  { id: "mouse-scroll-30", pointer: "mouse", expectOpen: true, needsScroller: true, gapMs: 30 },
  { id: "mouse-scroll-60", pointer: "mouse", expectOpen: true, needsScroller: true, gapMs: 60 },
  { id: "mouse-scroll-100", pointer: "mouse", expectOpen: true, needsScroller: true, gapMs: 100 },
  { id: "mouse-click", pointer: "mouse", expectOpen: true, needsScroller: false },
  { id: "mouse-hover-then-click", pointer: "mouse", expectOpen: true, needsScroller: false },
  // The 8 px drag guard lives in the world scroller; the static gate stage has no scroll to guard.
  { id: "mouse-drag-12px", pointer: "mouse", expectOpen: false, needsScroller: true },
  { id: "key-enter", pointer: "mouse", expectOpen: true, needsScroller: false },
  { id: "key-space", pointer: "mouse", expectOpen: true, needsScroller: false },
  { id: "close-escape", pointer: "mouse", expectOpen: true, needsScroller: false },
  { id: "deep-link", pointer: "mouse", expectOpen: true, needsScroller: false },
  { id: "touch-tap", pointer: "touch", expectOpen: true, needsScroller: false },
  { id: "touch-tap-after-settle", pointer: "touch", expectOpen: true, needsScroller: true },
  { id: "touch-tap-during-momentum", pointer: "touch", expectOpen: false, needsScroller: true },
  { id: "touch-drag-30px", pointer: "touch", expectOpen: false, needsScroller: false },
];

export const VIEWPORTS = {
  mouse: { width: 1440, height: 900, mobile: false },
  touch: { width: 390, height: 844, mobile: true },
};

export const PLACES = ["sky", "ground", "crypt", "gate"];

/** Cases that apply to a place: scroll cases need a world scroller (not the gate). */
export function casesFor(pointer, hasScroller) {
  return CASES.filter((c) => c.pointer === pointer && (!c.needsScroller || hasScroller));
}

/** One result row -> pass/fail. `opened` is the observed dialog state. */
export function judge(c, observed) {
  return { id: c.id, expected: c.expectOpen, observed, pass: observed === c.expectOpen };
}

/** Exit code for a list of judged rows (non-zero when any fail or none ran). */
export function exitCodeFor(rows) {
  if (rows.length === 0) return 2;
  return rows.some((r) => !r.pass) ? 1 : 0;
}

/** Plain-text table of rows {place, viewport, id, expected, observed, pass}. */
export function formatTable(rows) {
  const head = "place   viewport  case                        expect   got      result";
  const lines = rows.map(
    (r) =>
      `${r.place.padEnd(7)} ${r.viewport.padEnd(9)} ${r.id.padEnd(27)} ${(r.expected ? "open" : "closed").padEnd(8)} ${(r.observed ? "open" : "closed").padEnd(8)} ${r.pass ? "PASS" : "FAIL"}`,
  );
  return [head, ...lines].join("\n");
}
