# Working on Beacon

Beacon is an uptime monitor and public status page: a Cloudflare Worker that checks a list of services
once a minute, keeps every result in a SQLite Durable Object, and serves what they mean to humans.

## Where things are

| File | What it does |
| --- | --- |
| `src/monitors.ts` | The services Beacon watches. Changing it needs a human's review. |
| `src/probe.ts` | One check of one monitor: a timed GET, classified by status code. |
| `src/summary.ts` | What results mean: each service's state, the overall state, the headline. |
| `src/page.ts` | The status page, rendered on the server. |
| `src/ledger.ts` | The `Ledger` Durable Object: stores results, runs checks at most every 30 s. |
| `src/index.ts` | Routes (`/`, `/api/status`) and the cron trigger. |
| `test/` | `node --test` tests for the pure modules. |

## Rules

- `monitors`, `probe`, `summary` and `page` are pure: they never import `cloudflare:workers`, so tests import
  them directly. Only `ledger.ts` and `index.ts` touch the runtime. Put new logic in a pure module with
  tests, and keep the runtime files thin.
- Node runs the TypeScript directly. Write relative imports with their `.ts` extension, use `import type`
  for types, and only erasable syntax: no enums, namespaces or parameter properties.
- Tests never use the network. `probe` takes a `Fetcher`; pass a fake one.
- The page ships no client script and must load without errors. Escape every value you render with `esc`.
- Storage changes are additive: `CREATE TABLE IF NOT EXISTS`, new columns with defaults. Production data
  from earlier versions must keep working.
- A Preview has its own empty storage and no cron trigger; a stale page runs the checks itself.
- Colours: `--up` blue and `--down` crimson, on paper and ink. No green, yellow, orange or brown.

## Checks

Every change is checked on the whole composed result with `npm test` and `npx tsc --noEmit`, and its
Preview deployment is opened in a real browser. Run the first two before you publish.
