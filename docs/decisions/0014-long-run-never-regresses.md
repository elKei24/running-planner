# ADR 0014: The long run never regresses below what the athlete already does

Date: 2026-11-06 · Status: accepted

## Context

A runner doing 19 km long runs on ~40 km/week saw the plan start at 12 km. The long run was
derived purely as a share of weekly volume (36 % in the base phase), so an athlete whose habit is a
larger share than the model's was told to regress. The declared "longest recent run" only acted as
a *cap* (growth rule), never as a floor.

## Decision

Every week's long run has an evidence-based floor: the recent longest run (declared at setup, then
the longest run in the last four logged weeks), limited to 60 % of that week's volume. Step-back,
blocked and post-layoff weeks therefore still shrink it, and the growth, time and 35 km caps still
apply on top. The partial first week measures the share against the full week so the first long
run is not cut.

## Consequences

- Plans start from the athlete's actual long-run habit instead of the model's share.
- The share rule (ADR 0011) remains the growth path once volume rises; the floor only prevents
  regression.
- 60 % is above the 50 % ceiling used for the marathon floor on purpose: a demonstrated habit is
  stronger evidence than a template.
