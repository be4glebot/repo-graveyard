---
inclusion: manual
---

# Accessibility review (run with /a11y-review)

Review the components changed since the last review (use git diff against the last tagged review, or the files named in the prompt). Check and report, without changing code until approved:

- Every creature, menu item, toggle and button is reachable by keyboard in a logical order, with a visible `candle-400` focus ring.
- Every creature has an accessible name with repo name, state and age ("weather-app, zombie, quiet 8 months").
- Drag-to-override always has a keyboard/menu alternative.
- State is never conveyed by color or motion alone; there is a text label.
- `prefers-reduced-motion` disables bobbing, flicker, fog drift, typewriter and camera moves.
- Text contrast meets WCAG AA on `night-900`/`night-800`, including text over fog/glow.
- The séance typewriter is skippable, and the final text is available to screen readers at once (aria-live polite, not per character).
- Sound is off by default and has a labeled toggle.

Output: file, issue, WCAG reference if relevant, fix.
