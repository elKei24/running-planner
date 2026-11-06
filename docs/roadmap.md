# Roadmap and iteration log

## Iteration 1 – MVP (done)

- Pure planner: fitness replay, periodisation, volume curve, week template, race/block overlays,
  warnings. Property-based tests with fast-check.
- Store: validated schema, migration scaffold, localStorage persistence, Preact signals.
- UI: setup, week view with logging, plan overview, log, events, settings with JSON/ICS export.
- PWA manifest + service worker. CI (typecheck, lint, test, build) and GitHub Pages deployment.
- Docs: architecture, training science, ADRs.

## Iteration 2 – full version

See the git history and ADRs 0007+ for what landed.

## Open ideas (not scheduled)

- GPX/FIT file import for logging.
- Optional sync via a user-provided WebDAV/S3-compatible endpoint (still no app backend).
- Heart-rate based effort guidance.
- Localisation (miles, languages).
