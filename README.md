# Beacon

An uptime monitor and public status page, built as a Cloudflare Worker.

Beacon checks each service in `src/monitors.ts` once a minute from Cloudflare's network, records every
result in a SQLite Durable Object, and serves:

- `/`: the status page, rendered on the server.
- `/api/status`: current status and service metrics as JSON. The response has `generatedAt` (an ISO 8601
  timestamp), `overall`, `checkedAt` (Unix milliseconds, or `null`), and `services`.
- `/incidents.atom`: an Atom 1.0 feed of incidents opened in the last 30 days, newest first.

Each service in `services` has `id`, `name`, `host`, `state` (`up`, `down`, or `unknown`), `latencyMs`
(the latest check's response time in milliseconds, or `null`), `checkedAt` (the latest check's time in
Unix milliseconds, or `null`), and `error` (the latest check's error, or `null`). `uptime` is the percentage
of successful checks in the last 24 hours, to one decimal place, or `null` when there were no checks in
that window. `latencyP50Ms` and `latencyP95Ms` are the median and 95th-percentile response times in
milliseconds over the same window, or `null` when there were no checks. `incident` is `null` when the
service has no open incident; otherwise it is an object with `openedAt` (Unix milliseconds) and `error`
(the error from the failing check that opened the incident).

Live at https://beacon.nestagents.dev. It is developed in [Nest](https://nestagents.dev), where humans and
agents contribute to it and review each other's work.

## Reading the status page

- The headline says whether everything is up, in plain words.
- Each service shows its state, its last latency, and a strip of its last 90 checks, oldest on the left.
- The percentage next to the strip is its uptime over the last 24 hours.
- p50 and p95 are the median and the slowest common latency over the same 24 hours.
- Incidents list outages that are open, then those closed in the last 7 days, with how long each lasted.

## Incident feed

Feed readers can poll `/incidents.atom` every minute. Each entry names the service, gives the opening time,
the closing time or ongoing state, and the error that opened the incident.

## Run it

```sh
npm install
npm test            # node --test on the pure modules
npx tsc --noEmit    # types
npx wrangler dev    # local Worker with a local Durable Object
```

## Deploy

Workers Builds deploys `main` to production with `npx wrangler deploy`; every other branch becomes a
Preview at `https://<branch>.beacon-previews.nestagents.dev` through `npx wrangler preview`.

## License

MIT
