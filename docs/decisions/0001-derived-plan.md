# ADR 0001: The plan is derived, never stored

Date: 2026-11-06 · Status: accepted

## Context

The app must adapt when the athlete skips sessions, adds a race, or is away for a week. A stored
plan would need an explicit "re-plan" operation with rules for what to keep and what to regenerate,
and any bug there corrupts the user's data.

## Decision

Persist only inputs (athlete, goal, events, log). The schedule is `plan(state, today)`, a pure
function recomputed on every render. Nothing derived is written back to storage.

## Consequences

- Adaptation is free: every input change is a new derivation.
- The planner is trivially testable and deterministic; property tests cover random inputs.
- Risk of churn (plan changing daily) is handled by anchoring the fitness estimate to the Monday of
  the current week (ADR 0004) rather than by caching.
- Past weeks are rendered from the log, not from a stored plan, so the "what was planned back then"
  is not preserved. Accepted: the log is what matters historically.
