# ADR 0010: Easy-only weeks after a layoff

Date: 2026-11-06 · Status: accepted

## Context

The level response (ADR 0005) already cuts volume after a week with little running. Volume is only
half the story: coming back from illness, injury or a holiday, the first hard session is where
people get hurt. Return-to-running guidance is consistent on "easy first, intensity later".

## Decision

`estimateFitness` reports `layoffWeeks`, the number of consecutive completed weeks (ending last
week) with less than 50 % of the expected load. The planner removes all quality sessions and fast
finishes from the first week of the plan after one layoff week, and from the first two weeks after
two or more. Taper weeks are exempt (if you are in the taper, the race is what it is).

## Consequences

- A missed week costs one quality week; a missed fortnight costs two. The volume curve already
  handles the rest.
- Visible in the week notes so the athlete knows why the tempo run disappeared.
