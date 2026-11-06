# ADR 0005: A piecewise "level response" instead of ACWR

Date: 2026-11-06 · Status: accepted

## Context

The planner needs a single number for "what the athlete can sustain now" that reacts sensibly to
skipped weeks, overachieving weeks and holidays. The acute:chronic workload ratio with a 4-week
rolling average was the obvious candidate but has artefacts: four weeks after a week off, the
rolling mean drops again as the zero week is still inside the window, and a steady +10 %/week ramp
produces an ACWR that forbids sustaining the ramp.

## Decision

Keep one state variable, the weekly *level* in km. After each completed week multiply it by
`levelResponse(actual / expected)`:

| actual / expected | multiplier |
| ----------------- | ---------- |
| ≥ 1.1             | 1.10       |
| 1.0 – 1.1         | ratio      |
| 0.85 – 1.0        | 1.00       |
| 0.5 – 0.85        | 0.85 → 1.0 (linear) |
| 0 – 0.5           | 0.70 → 0.85 (linear) |

The same function simulates future weeks that are reduced by blocks or tune-up races, so the volume
curve after a holiday re-ramps from a lower level.

## Consequences

- Monotone, continuous, bounded; easy to test (property tests in `fitness.test.ts`).
- The ±15 % dead band gives hysteresis: ordinary variation does not move the plan.
- Numbers are judgement calls informed by return-to-running guidance (≈75 % after one week off,
  ≈50 % after two). Documented in `docs/training-science.md`.
