# ADR 0019: The current week follows the log

Date: 2026-11-10 · Status: accepted (amends ADR 0004)

## Context

ADR 0004 kept the current week fixed from Monday to Sunday: past sessions were shown against the
log but never changed what came next. That keeps a plan stable, and it also keeps a plan that no
longer makes sense. A run on a rest day was ignored, so the week ended a run and several
kilometres over. A missed tempo run was gone even when the next day was free. And a "Can't run"
re-plan (ADR 0009) rebuilt the days already behind us as if they were still open, so a Monday the
athlete had run on was planned as rest again.

## Decision

The current week is the plan, fitted to what has been logged so far (`planner/adapt.ts`). The
pass runs last, on the week exactly as the athlete sees it (template plus race overlays).

A day is *settled* when it is before today, or when it is today and has a log entry. Today
without an entry means "not yet logged", an earlier day without one means "missed". The settled
days are replayed in order, each against the plan as it stood that morning:

- A run on a planned run day counts as that session, whatever its distance. Following the plan
  therefore changes nothing, and following an adjusted plan does not change it again.
- A run on a rest day makes up for a session missed earlier in the week. It counts as the long
  run if it covers at least 80 % of it. Otherwise it replaces the next easy run.
- A missed long run or quality session moves to a later day: a free day first, else in place of
  an easy run. It keeps two days from other hard sessions (a long run may sit next to a quality
  session, but stays at least three days from another long run or a race), stays out of the last
  three days before a race and off the days after one, and only lands on days that are available
  and not shaped by an event. If nothing fits it stays missed.
- A missed easy run is dropped.

The fitness estimate is still anchored to the Monday (ADR 0004): this week's log changes this
week's sessions, not its volume target or the weeks after it.

## Consequences

- Nothing new is stored. The adjustment is derived like the rest of the plan (ADR 0001).
- The days ahead never carry more than they were planned for, plus key sessions moved from
  missed days. Missed volume is never spread over the remaining runs.
- Logging late can move the plan twice: yesterday's unlogged tempo shows up today, and goes away
  once yesterday is logged. Accepted; the week note says the week was adjusted.
- The log stores distance, not intent. An easy jog on a tempo day counts as the tempo, and a
  long run done a day early on an *easy* day is not recognised as the long run.
- An availability change or block made part-way through the week still re-plans the template for
  the days behind us, so those can be relabelled. What was logged on them now counts either way.
