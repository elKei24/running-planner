# ADR 0003: Preact + signals, Vite, Vitest, hand-written CSS

Date: 2026-11-06 · Status: accepted

## Context

The UI is small (five views). Bundle size and build simplicity matter more than ecosystem breadth.

## Decision

- Preact 11 with `@preact/signals` for state (~4 KB + ~2 KB). Svelte was a close alternative; Preact
  was chosen for a stable, well-known API and tooling with less version risk.
- Vite for dev/build, `vite-plugin-pwa` for the service worker and manifest.
- Vitest + fast-check for the planner, happy-dom + Testing Library for UI smoke tests.
- Hand-written CSS with custom properties and `prefers-color-scheme` dark mode. No CSS framework.
- No validation library; a hand-written validator keeps the bundle small and error paths explicit.

## Consequences

- Production bundle is ~27 KB gzipped (JS) + ~3 KB CSS at the MVP.
- Node 26 (current release line) is required: `engines`, `.nvmrc`, CI and deploy all say 26.
  Dependencies track the latest majors (Vite 8, Vitest 5, Preact 11, TypeScript 6). TypeScript 7
  (the native compiler) is held back only until typescript-eslint supports it; `baseUrl` was
  removed from tsconfig because TypeScript 7 drops it.
- History: npm 10 (Node 22) failed to resolve Vitest 4's peer-dependency set
  (`Cannot read properties of null (reading 'edgesOut')`), which is why the project started on
  Vitest 3 before moving to a newer Node.
