# ADR 0011: Long-run share of weekly volume depends on the volume

Date: 2026-11-06 · Status: accepted

## Context

A fixed "long run = 35 % of the week" produced 22 km long runs for a 60 km/week runner, which is too
short for a marathon, while 35 % of 100 km is already 35 km, the hard cap. Published plans show the
share falling as volume rises: Higdon's novice plans peak around 60 km with a 32 km long run (≈50 %),
Pfitzinger's 90 km plans carry 32–35 km long runs (≈35 %).

## Decision

The peak-phase share is linear from 45 % at 40 km/week to 33 % at 100 km/week, clamped to
[30 %, 45 %], then scaled by phase (base ×0.8, build ×0.9, taper ×0.8). The absolute caps stay:
35 km, about three hours at easy pace, and the "no more than +3 km then +2.5 km/week" growth rule.

## Consequences

- Lower-volume runners now reach 26–28 km long runs in the peak; high-volume runners keep sane
  shares.
- Property tests still hold: the long run is the longest session and never exceeds its cap.
