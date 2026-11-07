# 17. Visual identity: a race-day notice board

## Status

Accepted.

## Context

The first UI used the defaults every component library and generated app converges on: white
cards with soft shadows, a teal accent, system sans-serif, emoji as tab icons. It was usable but
indistinguishable from any other dashboard.

## Decision

One typeface, one accent, hairlines instead of shadows:

- **Typeface.** Bricolage Grotesque (variable, bundled via `@fontsource-variable` so the PWA keeps
  working offline). Headings and numbers use the condensed end of the width axis; body text the
  normal width. Numbers are tabular everywhere they line up (paces, km, dates).
- **Palette.** Warm paper and ink in light mode, soft black and bone in dark mode, and a single
  hi-vis lime accent (`--lime`) reserved for *today*, the primary action and the race countdown.
  Phase and session-type colours stay pastel so the accent is always the loudest thing on screen.
- **Surfaces.** Panels are flat with a 1 px hairline; no drop shadows. The week is a timeline
  (day · rail · session), not a stack of cards. The countdown is a dark "board" with the days-to-go
  as the biggest number on the page.
- **Icons.** Inline SVG strokes in the nav and a track-oval brand mark; no emoji in chrome.

## Consequences

- The font adds ~130 kB (woff2, latin subset) to the bundle, cached by the service worker.
- Colours and type scale live as custom properties in `src/ui/styles.css`; components only use
  class names, so a re-skin stays a CSS change.
- Tests select by text and a few structural classes (`article.session`, `table.weeks`, `dialog`),
  which the redesign keeps.
