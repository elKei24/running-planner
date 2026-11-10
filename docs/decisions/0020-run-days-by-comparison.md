# ADR 0020: Run days are chosen by comparing layouts

Date: 2026-11-10 · Status: accepted

## Context

`chooseRunDays` took run days from a fixed order of preference counted from the long run (for a
Sunday long run: Wed, Fri, Tue, Thu, Sat, Mon) and gave the quality sessions to the first of them
that sat two days from the long run. With every day available that produced sensible weeks. With
a day taken ("Can't run", a block, a partial first week) it simply fell through the list: without
Wednesday the tempo went to Friday, two days before the long run, although Thursday is three days
clear; with three runs a week Thursday was not even a run day; without Friday the three runs
became Tue · Wed · Sun, back to back and then three days off. The list encoded good outcomes for
one situation, not the reasons for them.

## Decision

The long run stays on the preferred day, or the nearest available one. For the rest of the week
every way of choosing the other run days, and the quality days among them, is compared. The best
layout wins, judged in this order:

1. Run days spread as evenly over the week as possible.
2. As much room as possible between the hard sessions (long run and quality sessions), counted
   up to three days.
3. No run the day after the long run, then none the day before it.
4. Otherwise the earlier days: quality sessions first, then the run days as a whole. An earlier
   key session leaves days in the week to make it up when it is missed (ADR 0019).

There are at most a few hundred layouts per week, so all of them are simply tried.

## Consequences

- Weeks with one quality session and every day available are unchanged: for a Sunday long run it
  is on Wednesday for any number of runs.
- Weeks with two quality sessions move them from Wed · Fri to Tue · Thu (five or more runs a
  week): the same spacing, earlier.
- An easy-only week with three runs moves from Wed · Fri to Tue · Thu.
- For a Thursday long run the single quality session moves from Sunday to Monday: both are three
  days clear, Monday is earlier in the week.
- Weeks with days taken are laid out again from the same criteria rather than from what is left
  of a list.
