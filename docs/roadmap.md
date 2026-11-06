# Roadmap and iteration log

## Iteration 1 – MVP (done)

- Pure planner: fitness replay, periodisation, volume curve, week template, race/block overlays,
  warnings. Property-based tests with fast-check.
- Store: validated schema, migration scaffold, localStorage persistence, Preact signals.
- UI: setup, week view with logging, plan overview, log, events, settings with JSON/ICS export.
- PWA manifest + service worker. CI (typecheck, lint, test, build) and GitHub Pages deployment.
- Docs: architecture, training science, ADRs.

## Iteration 2 – full version (done)

- Units preference (km/mi) in the state document; schema v2 and the first migration (ADR 0007).
- GPX/TCX import to pre-fill a log entry (ADR 0008).
- "Can't run this day" on any future session, implemented as an availability override (ADR 0009).
- Today card and a plan-health card (adherence over the last four weeks, fitness trend) on the week view.
- ICS export honours units and includes distances.

## Iteration 3 – UX and training-science alignment (done)

- Easy-only weeks after a layoff (ADR 0010).
- Long-run share scales with weekly volume (ADR 0011).
- Marathon-pace progression in peak long runs; intervals kept in the first taper week (ADR 0012).
- Session titles and descriptions follow the units preference.
- Week notes explain every adjustment (step-back, block, race, return-to-running).

## Follow-ups (done)

- Node 26 and the latest dependency majors (see ADR 0003).
- Custom race distances (e.g. 6 km) for tune-up races, the goal race and the reference race,
  via a "Custom…" option on every distance picker. The planner never depended on presets.

## Open ideas (not scheduled)

- GPX/FIT file import for logging.
- Optional sync via a user-provided WebDAV/S3-compatible endpoint (still no app backend).
- Heart-rate based effort guidance.
- Localisation (miles, languages).
