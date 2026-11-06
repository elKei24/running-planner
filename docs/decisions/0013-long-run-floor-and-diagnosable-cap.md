# ADR 0013: Marathon long-run floor, 3.5-hour cap, and a warning that names the binding limit

Date: 2026-11-06 · Status: accepted

## Context

A runner with more than a year to train saw a longest run of 24.5 km. Two independent rules can
produce that number: the long run is a share (33–45 %) of the peak weekly volume, which the plan
never exceeds, and the long run is capped at about three hours at easy pace. With 60 km/week or a
~7:20/km easy pace both land at 24.5 km, and the warning only said "there may not be enough weeks",
which was wrong for a year-long horizon.

## Decision

1. **Marathon floor.** For goals over 40 km, peak-phase long runs target at least
   min(32 km, 50 % of the week), progressing 28 → 30 → 32 km across the peak phase. The share rule
   still applies when it gives more. Novice plans (Higdon) routinely put 32 km long runs into
   ~60 km weeks; 50 % of the week is the accepted ceiling.
2. **Time cap raised to 3.5 hours** at the middle of the easy zone (Pfitzinger's upper bound).
   Beyond that, damage outpaces adaptation for most amateurs.
3. **The warning names the binding limit** and the fix: raise peak weekly volume in Settings, or
   accept that the time cap limits slower runners (and shrinks as easy pace improves).
4. **Setup and Settings show the implied longest run** next to the peak-volume field, so the
   trade-off is visible before the plan exists.

## Consequences

- Moderate-volume marathoners get marathon-appropriate long runs without raising total volume.
- The growth rule (+3 km first, +2.5 km per ramp week relative to recent long runs) and the
  35 km absolute cap are unchanged, so the floor never produces a jump after a layoff.
