# ADR 0016: Logging past runs; races are only planned ahead

Date: 2026-11-07 · Status: accepted (replaces an interim "past races" form that was removed the same day)

## Context

Runners often log a day late, or a whole week late. The log dialog's date picker was rendered
behind the modal (unusable), and the week view could only move forward from the current week, so
earlier days had no "Log" button. An interim feature that let races be entered after the fact
turned out to be the wrong tool: a race already run is just a run with a result.

## Decision

- The log dialog owns the date when opened from the log view ("Log a run"), limited to today.
- The week view navigates back up to 52 weeks. Past weeks show seven "Past day" cards (the plan is
  derived, ADR 0001, so no plan is kept for them) with the logged runs and a Log/Edit button.
- The race form only accepts future dates and says to log a past race as a run.
- Two useful pieces of the interim feature stay: the post-race recovery window applies from the
  race date even when the race was before the current week, and a planned race that has passed
  shows its logged result in the events list with a "Use for paces" shortcut.

## Consequences

- Catching up on last week's runs takes a few taps from either view.
- Past weeks never show what had been planned, consistent with ADR 0001; the plan-overview bars
  show the logged volume per past week instead.
