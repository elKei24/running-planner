# ADR 0007: Display units live in the state document (schema v2)

Date: 2026-11-06 · Status: accepted

## Context

Runners in the US and UK think in miles. Everything in the planner is computed in kilometres and
the training-science constants are in km. The preference needs to survive export/import together
with the rest of the data.

## Decision

Add `prefs: { units: 'km' | 'mi' }` to the persisted state and bump the schema to version 2 with a
migration that defaults existing documents to km. Storage and the planner stay in km; only the
formatting layer (`ui/format.ts`, `io/ics.ts`) converts. Inputs are still entered in km for now.

## Consequences

- First real migration proves the migration path (`store/migrations.ts`) and its tests.
- A later "input in miles" feature only needs the forms to convert on the way in.
