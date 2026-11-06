# Architecture

## The one idea

**The plan is never stored. Only the inputs are stored, and the plan is derived from them.**

```
plan(state, today) → Schedule
```

`state` holds three things: the athlete and goal, the list of events (tune-up races, blocked periods,
availability overrides) and the training log. Every render derives the whole schedule from that
document and today's date. Adaptation therefore needs no special "re-plan" step:

- A skipped week is a log with nothing in it. The fitness estimate drops and the next weeks ramp
  more gently (see `planner/fitness.ts`).
- A race is an event. The overlay inserts a mini taper before it and recovery after it
  (`planner/events.ts`).
- A vacation is a block. Those days are removed and the volume curve re-ramps afterwards
  (`planner/volume.ts`).

Because the planner is a pure function of a small JSON document, there is no backend, the whole
state fits in `localStorage`, and the planner is unit-tested without a DOM.

## Stability within a week

A fully derived plan could churn: log one short run and tomorrow's session changes. Two rules avoid
that:

1. **The fitness estimate only looks at completed weeks.** `estimateFitness` replays the log up to
   the Monday of the current week (the *anchor date*). Logging runs during the week does not change
   this week's or next week's sessions; the plan updates at the week boundary.
2. **Hysteresis in the level response.** Actual load within ±15 % of the expected load leaves the
   level unchanged (`levelResponse` in `fitness.ts`).

## Layers

```
src/
  domain/    types.ts (persisted schema + derived types), dates.ts (ISO local dates, Monday weeks)
  planner/   pure planning pipeline, no DOM, no I/O
    paces.ts      Daniels VDOT model → pace zones, race predictions
    fitness.ts    replay the log → sustainable weekly "level" and recent long run
    periodize.ts  weeks → base/build/peak/taper allocation, taper fractions
    volume.ts     forward simulation of weekly volume (ramp limit, step-backs, blocks, taper)
    template.ts   one week → sessions (which day, which type, how far, descriptions)
    events.ts     overlays by date: tune-up races, goal race week, post-race recovery
    plan.ts       orchestrates the above and produces warnings
  store/     schema validation, migrations, localStorage persistence, Preact signals
  io/        JSON export/import, iCalendar export
  ui/        Preact components (setup, week, plan overview, log, events, settings)
```

Data flows one way: UI actions mutate `state` (a signal); `schedule` is a computed signal calling
`plan()`; components read both.

## Dates

All dates are `YYYY-MM-DD` strings in the device's local timezone, never timestamps. Weeks start on
Monday. `today` is a signal so it can be injected for tests and overridden with `?today=YYYY-MM-DD`
for demos.

## Persistence and schema

The state document carries a `version`. `store/migrations.ts` upgrades older documents step by step
before `store/schema.ts` validates them. Validation is hand-written (no schema library) to keep the
bundle small; it is strict about shapes and ranges and reports the failing path.

If stored data cannot be read, the app keeps the raw text available for download rather than
silently discarding it.

## Build and deployment

Vite + TypeScript + Preact + signals. Vitest with fast-check for property tests; happy-dom and
Testing Library for UI smoke tests. `vite-plugin-pwa` produces a service worker so the app works
offline once loaded. GitHub Actions run typecheck, lint, tests and build on every push; pushes to
`main` deploy `dist/` to GitHub Pages (`BASE_PATH=/running-planner/`).

## What a backend would add

Nothing in the planner changes if sync is added later. Sync is a storage-layer concern: the state is
one document, so a CouchDB/PouchDB style replication or a tiny KV endpoint would do. Direct Strava or
Garmin API integration needs OAuth and therefore at least a serverless token exchange; file-based
import (GPX/FIT) could stay fully client-side.
