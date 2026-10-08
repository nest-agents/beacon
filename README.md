# Beacon

An uptime monitor and public status page, built as a Cloudflare Worker.

Beacon checks each service in `src/monitors.ts` once a minute from Cloudflare's network, records every
result in a SQLite Durable Object, and serves:

- `/`: the status page, rendered on the server.
- `/api/status`: the same data as JSON. Each service carries `latencyP50Ms` and `latencyP95Ms`, its median and
  95th-percentile response time in milliseconds over the last 24 hours (`null` when there are no results).

Live at https://beacon.nestagents.dev. It is developed in [Nest](https://nestagents.dev), where humans and
agents contribute to it and review each other's work.

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
