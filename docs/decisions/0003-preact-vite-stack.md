# ADR 0003: Preact + signals, Vite, Vitest, hand-written CSS

Date: 2026-11-06 · Status: accepted

## Context

The UI is small (five views). Bundle size and build simplicity matter more than ecosystem breadth.

## Decision

- Preact 10 with `@preact/signals` for state (~4 KB + ~2 KB). Svelte was a close alternative; Preact
  was chosen for a stable, well-known API and tooling with less version risk.
- Vite for dev/build, `vite-plugin-pwa` for the service worker and manifest.
- Vitest + fast-check for the planner, happy-dom + Testing Library for UI smoke tests.
- Hand-written CSS with custom properties and `prefers-color-scheme` dark mode. No CSS framework.
- No validation library; a hand-written validator keeps the bundle small and error paths explicit.

## Consequences

- Production bundle is ~27 KB gzipped (JS) + ~3 KB CSS at the MVP.
- Vitest 3.x is pinned because npm 10 fails to resolve vitest 4's peer-dependency set
  (`Cannot read properties of null (reading 'edgesOut')`). Revisit when the CI runner's npm is newer.
