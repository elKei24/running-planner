# ADR 0004: Fitness is estimated from completed weeks only

Date: 2026-11-06 · Status: accepted

## Context

With a derived plan (ADR 0001), using "the last 28 days ending yesterday" as the fitness window
would change this week's remaining sessions every time a run is logged. That feels random to the
athlete.

## Decision

`estimateFitness` replays the log week by week up to the Monday of the current week (the anchor).
Runs logged during the current week affect the plan only from next Monday. Sessions already in the
past are shown against the log (done / missed / skipped) but are not re-planned.

The replay starts at `baselineDate` (defaults to `createdAt`). Editing the athlete's "current
fitness" numbers in Settings can move the baseline to the current week so that stale log history is
ignored ("re-baseline").

## Consequences

- The schedule is stable Monday to Sunday; it changes only when an event is added or the week
  rolls over.
- The partial first week is pro-rated (both for planned volume and when it is later replayed).
- A run logged on Sunday for a long run done on Sunday still counts for that week, as expected.
