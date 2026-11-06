# Running Planner

An adaptive marathon training plan that lives entirely in your browser. No account, no server.

**Live app:** https://elkei24.github.io/running-planner/

- Enter your goal race, your current weekly volume and how many days you can run.
- Get a periodised plan (base → build → peak → taper) with paces derived from a recent race.
- Log your runs. Skip a week, go on holiday, add a tune-up race: the plan adjusts itself, because it
  is recomputed from your log and calendar every time you open it.
- Export a JSON backup or an `.ics` calendar. Works offline once loaded (PWA).

## Development

Requires Node 24 or newer (`.nvmrc` pins 26).

```sh
npm ci
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests + build
npm run test:watch
```

Time-travel for manual testing: append `?today=2027-01-18` to the URL.

## How it works

The plan is never stored. The app stores only your inputs (athlete, goal, events, log) and derives
the schedule with a pure function, `plan(state, today)`. See [docs/architecture.md](docs/architecture.md)
for the design, [docs/training-science.md](docs/training-science.md) for the training principles and
their sources, and [docs/decisions](docs/decisions) for the decision records.

## Deployment

Every push runs CI (typecheck, lint, tests with coverage, build). Pushes to `main` build with
`BASE_PATH=/running-planner/` and deploy to GitHub Pages via `actions/deploy-pages`. In the
repository settings, set *Pages → Source* to **GitHub Actions** once.

## License

MIT, see [LICENSE](LICENSE).
