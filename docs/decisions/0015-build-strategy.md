# ADR 0015: Build strategy – steady ramp or build fast, then maintain

Date: 2026-11-07 · Status: accepted

## Context

A runner with 57 weeks to race day saw volume grow about 1 % per week and the long run sit at its
current length for most of a year, because the ramp is spread evenly over every available week
(ADR 0011/0013 fix the end of the plan, not the middle). Coaches structure long horizons
differently: build to a sustainable volume in a few months, hold and vary the stimulus, then run a
dedicated marathon block.

## Decision

A per-athlete `buildStrategy` with two values:

- **steady** (previous behaviour): base → build → peak → taper, volume ramped evenly to the peak by
  the end of the peak phase. Right for 8–24 weeks.
- **fast**: for more than 24 weeks, the plan is
  1. an initial block of up to 16 weeks (base 6 + build 10) that ramps to peak volume at up to
     10 %/week,
  2. a **maintain** phase holding about 90 % of peak volume, with step-back weeks, alternating
     tempo and interval sessions, and every third week a longer long run (+15 %, within half the
     week) with a steady finish, and
  3. a final 12-week marathon block (build 6 + peak 3 + taper 3): the six build weeks walk the
     long run up from 22 km to 27 km, the peak weeks run 28 → 30 → 32 km, then the taper.

The volume model gets a per-week target factor (0.9 in maintain) and lets the simulated level drift
down to the held volume, so the final block re-ramps from 90 % to 100 % rather than jumping. With
24 weeks or fewer, `fast` behaves exactly like `steady`.

Setup defaults to `fast` when the race is more than 24 weeks away and `steady` otherwise; the
setting is editable afterwards. It is optional in the stored document (older documents read as
`steady`), so no schema bump is needed.

## Consequences

- Long horizons stop being a year-long 1 % ramp; the athlete reaches peak volume early and spends
  the middle months consolidating, which is where tune-up races fit naturally.
- A fifth phase, `maintain`, appears in the UI (own colour and label) and in the template.
- Holding 90 % of peak for many months is itself demanding; the peak-volume setting is the knob
  for that, and the settings hint says so.
