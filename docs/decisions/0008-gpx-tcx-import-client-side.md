# ADR 0008: GPX/TCX import is parsed client-side with a minimal parser

Date: 2026-11-06 · Status: accepted

## Context

Logging a run by hand is fine, but most runners have a watch export. Direct Strava/Garmin API
integration needs OAuth and therefore a server (ADR 0002 rules that out for now). File export is
universal.

## Decision

Accept `.gpx` and `.tcx` files in the log view. Parse them with small regex-based extractors
(`io/gpx.ts`), compute distance by haversine over track points (TCX: prefer the device's
`DistanceMeters`), duration from timestamps, and pre-fill the log dialog. The user confirms before
anything is saved. FIT (binary) is not supported.

## Consequences

- No new dependency; works offline; no data leaves the browser.
- Regex parsing is not a full XML parser. It handles the regular structure every GPX/TCX exporter
  produces, and the user sees the parsed numbers before saving, so a bad parse is visible.
- Track points are not stored, only the summary (distance, duration, date). Keeps the document small.
