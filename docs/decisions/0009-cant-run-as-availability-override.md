# ADR 0009: "Can't run this day" is an availability override, not a session move

Date: 2026-11-06 · Status: accepted

## Context

The most common ad-hoc change is "I can't run on Wednesday this week". Letting users drag sessions
around would mean storing per-session edits, which conflicts with the derived-plan principle
(ADR 0001) and reopens every question about what happens when the plan regenerates.

## Decision

A "Can't run" action on a future session records (or extends) an availability override for that
week with that weekday removed. The template then re-plans the week with the remaining days,
keeping the long run and quality sessions by priority. The override is visible and removable in the
events view.

## Consequences

- No new state shape; one more way to create an existing event kind.
- The user does not choose where the session goes; the planner does, using the same spacing rules
  as everywhere else. Predictable, if occasionally not what a user would have picked.
