---
inclusion: manual
---

# Design review (run with /design-review)

You are the design critic for Repo Graveyard. We are competing in the Costume Contest, judged on whether the app is "a complete, coherent product experience rather than a proof of concept" and "intuitive, polished, and intentional."

1. Start the dev server if it isn't running. Using the Playwright MCP server, take screenshots at 1440×900 and 390×844 (mobile) of:
   - `/` landing
   - `/estate` (full scene)
   - `/estate` with a ghost, a zombie, a tombstone and a coffin detail panel open
   - the séance screen
   - each empty/error state in design.md (no repos, only ghosts, unknown user, rate limited)
   - lights-on mode
2. Critique each screenshot against design.md. For each issue give: screen, what's wrong, which design.md rule it breaks, severity (high/medium/low), and a concrete fix.
3. Check specifically:
   - Does every visible effect encode data (The one rule)? Flag any decoration-only effect.
   - Is text readable (contrast, size) over fog and glow?
   - Do creatures at different decay levels look clearly different at a glance?
   - Are empty/loading/error states as designed as the main screens?
   - Spacing, alignment and type hierarchy: anything that looks unfinished?
4. Output a prioritized list (high first). Do not change code in this pass; wait for approval.
5. Save the screenshots to `docs/design-review/<date>/` so before/after comparisons can go in the write-up.
