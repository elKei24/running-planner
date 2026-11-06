# ADR 0002: No backend; localStorage single-document store

Date: 2026-11-06 · Status: accepted

## Context

The requirement is a lightweight app, ideally without a backend. The whole state is small (a few KB
even with a year of log entries).

## Decision

Store one JSON document in `localStorage` under a versioned key. Provide JSON export/import for
backup and device transfer, and ICS export for calendars. Deploy as static files to GitHub Pages
with a service worker for offline use.

## Consequences

- No accounts, no server costs, nothing to operate. Privacy by construction.
- No automatic multi-device sync. Mitigated by export/import; a sync layer could be added later
  without touching the planner because the state is one document.
- `localStorage` can be cleared by the browser; the UI nudges users to export a backup.
- IndexedDB was considered and rejected for now: the document is far below the ~5 MB localStorage
  limit and synchronous access keeps the store code simple.
