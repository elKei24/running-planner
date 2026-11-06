# ADR 0006: Races and the goal race are overlays on a date → session map

Date: 2026-11-06 · Status: accepted

## Context

Tune-up races and the goal race need to change sessions around them, and those sessions may belong
to a different calendar week (a Wednesday race affects the previous week's Thursday to Sunday).

## Decision

The template generates every week independently, the sessions are flattened into a
`Map<LocalDate, Session>`, and overlays (`applyRaces`, `applyGoalRace`) mutate that map by date.
Blocked days and availability overrides, by contrast, are inputs to the week template because they
change which days are run days before distances are distributed.

## Consequences

- Overlays are simple to reason about and test in isolation on a two-week fixture.
- Weekly `targetKm` is recomputed after overlays, so it reflects what is actually scheduled.
- Overlays must respect `createdAt` (never plan days before the plan existed) and blocked dates; both
  are passed explicitly.
- A mid-week goal race can overload the preceding calendar week with the fixed pre-race pattern; the
  overlay drops the least valuable non-pattern runs until the week fits the athlete's run-day budget.
