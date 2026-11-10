# ADR 0019: Re-planning the current week keeps the days already behind us

Date: 2026-11-10 · Status: accepted (extends ADR 0004 and ADR 0009)

## Context

A "Can't run" on a future day (ADR 0009) re-plans the whole calendar week, including the days that
have already passed. On a Tuesday, Monday was planned again as if it were still open: a rest day
stayed a rest day even though the athlete ran, or a run day appeared on a day the athlete had
rested and was shown as "missed". What actually happened on those days did not count towards the
week's run days or volume. The plan is derived (ADR 0001), so there is no stored "original plan"
to fall back on, and the fitness anchor (ADR 0004) only protects the week from changes in the log,
not from a re-plan.

## Decision

An availability override records the date it was made when that is part-way through its own
week (`replanFrom`). When the planner builds the current week and such a date is set, the days
before it are *history*:

- Each history day shows what the log says: "Ran 8 km" (counted as a run) or "Rest". Nothing is
  planned for it, and no overlay (race taper, recovery, race-week pattern) touches it.
- The remaining days are planned with the run days and volume still left: the athlete's days per
  week minus the runs already logged, and the week's target minus the kilometres already logged.
- The long run belongs to the day it would get with the whole week open. If that day has passed
  it is not planned again: a long run done is done, and a missed one is simply missed (its volume
  is dropped, not crammed into the remaining days). Otherwise it is placed as usual.

The date is set by the store (`setAvailability`, used by "Can't run" and the availability form)
only when the override's week is the current week and today is not its Monday. An override made
in advance has no such date and the week is planned as before. A second re-plan later in the
week moves the date forward.

## Consequences

- The re-planned week is stable afterwards: the history line is a stored date, not "today", so
  the week does not change again as days pass or runs are logged (ADR 0004 still holds).
- Which kind of run a logged history day was is unknown, so the remaining days may repeat a
  quality session the athlete already did. Accepted: the log stores distance, not intent.
- Only availability overrides carry the date. A block or race added part-way through the current
  week still re-plans the passed days; extending the same mechanism to those events is possible.
- One optional field on an existing event kind; no schema version bump or migration.
