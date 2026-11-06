# ADR 0012: Marathon-pace progression in peak long runs; intervals in the first taper week

Date: 2026-11-06 · Status: accepted

## Context

Marathon specificity comes mostly from running at goal pace inside long runs, and the stimulus
should progress. Tapers should cut volume but keep intensity (Bosquet 2007); a tempo every week was
a weaker signal than the build phase had been sending.

## Decision

- In the peak phase, every other long run (and always the last one) finishes at marathon pace. The
  share grows 30 % → 40 % → 50 % of the long run across the phase (`marathonPaceShare`).
- The first taper week (when the taper has at least two weeks) keeps a short interval session,
  capped at 5 × 1 km; later taper weeks use a short tempo.

## Consequences

- Peak-phase long runs are explicitly the key sessions; descriptions say so.
- Taper intensity is maintained with lower total work.
