# ADR 0016: Races can be entered after the fact

Date: 2026-11-07 · Status: accepted

## Context

Runners enter races they forgot to plan, or decide on the day. The race form refused past dates,
and a race run in the previous week had no effect on the current week because the overlay only
acted when the race day itself was inside the plan window.

## Decision

- The race form accepts any date. For a past date it also takes the finish time, logs the run on
  that day (optional, default on) and can set the result as the reference race for training paces.
- The post-race recovery window (0.4 days per km for tune-up races) is applied from the race date
  regardless of whether that date is inside the schedule, so a race last Saturday still turns this
  week's quality sessions easy.
- Past races in the events list show the logged result and a "Use for paces" shortcut.
- Days before the plan's creation are never re-planned (ADR 0006), but a race run just before
  creating the plan still produces recovery days inside it.

## Consequences

- A late-entered race is as good as a planned one for recovery; the mini taper before it is
  obviously moot.
- Logging through the race form creates an ordinary log entry; nothing new is persisted.
