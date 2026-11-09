# ADR 0018: Heart-rate bands from a declared maximum, as guidance only

Date: 2026-11-09 · Status: accepted

## Context

Sessions describe effort by pace (when a reference race is known) and RPE. Many runners train with
a heart-rate monitor and asked for a heart-rate range on planned runs. Deriving zones needs an
anchor: maximum heart rate, resting heart rate (Karvonen), or lactate-threshold heart rate.

## Decision

- The athlete may enter a **maximum heart rate** (optional, 100–230 bpm) in Setup and Settings. It
  is stored on the athlete; no schema migration is needed because the field is optional.
- Planned runs show a band as a share of that maximum (`domain/heartRate.ts`), next to distance and
  pace, in the week view, the today card and the calendar export. Settings lists the zones.
- The bands follow Daniels' HRmax ranges (easy 65–79 %, marathon 80–90 %, threshold 88–92 %,
  intervals 95–100 %) plus a recovery band at 60–70 %. Races get none.
- Heart rate is **not logged** and does not influence the plan. The fitness model stays volume-based
  (ADR 0005).

## Consequences

- One optional number, no new dependency, nothing changes for athletes who leave it empty.
- Maximum heart rate is the simplest anchor but a coarse one: the bands are a cross-check against
  pace and feel, and the UI says so. Karvonen (heart-rate reserve) or threshold-based zones could be
  added later with a second optional field.
