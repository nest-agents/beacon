// Beacon Worker: the status page, its JSON, and the checks behind them. A cron trigger runs the checks in
// production every minute; any request also runs them when the latest result is stale, which is how a
// Preview (where cron triggers do not run) shows live data.

import { MONITORS } from "./monitors.ts";
import { renderBadge } from "./badge.ts";
import { renderPage } from "./page.ts";
import { indexingHeaders } from "./robots.ts";
import { summarize } from "./summary.ts";
import { HISTORY_BARS, serviceHistory, UPTIME_WINDOW_MS, type ServiceHistory } from "./history.ts";
import { openIncidentsByMonitor } from "./incidents.ts";
import { INCIDENT_FEED_WINDOW_MS, incidentFeed, serializeAtomFeed } from "./incident-feed.ts";
import type { CheckResult } from "./probe.ts";

export { Ledger } from "./ledger.ts";

/** A page older than this triggers a fresh run before it is served. */
const STALE_MS = 90_000;

const ledgerOf = (ctx: ExecutionContext) => ctx.exports.Ledger.getByName("main");

async function current(ctx: ExecutionContext, now: number) {
  const ledger = ledgerOf(ctx);
  let latest = await ledger.latest();
  const newest = latest.reduce((t, r) => Math.max(t, r.at), 0);
  if (now - newest > STALE_MS) {
    const run = await ledger.runChecks(now);
    if (run.ran) latest = await ledger.latest();
  }
  return summarize(MONITORS, new Map(latest.map((r) => [r.monitor, r])));
}

/** Open incidents and those closed in the last 7 days, as the page lists them. */
const INCIDENT_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;
const incidentsSince = (ctx: ExecutionContext, since: number) => ledgerOf(ctx).incidents(since);

/** Each service's strip and 24-hour uptime, from the results the Ledger holds. */
async function histories(ctx: ExecutionContext, now: number): Promise<Map<string, ServiceHistory>> {
  const results = await ledgerOf(ctx).recent(now, HISTORY_BARS, UPTIME_WINDOW_MS);
  const byMonitor = new Map<string, CheckResult[]>();
  for (const r of results) {
    const list = byMonitor.get(r.monitor) ?? [];
    list.push(r);
    byMonitor.set(r.monitor, list);
  }
  return new Map(MONITORS.map((m) => [m.id, serviceHistory(byMonitor.get(m.id) ?? [], now)]));
}

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

async function route(request: Request, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed\n", { status: 405, headers: { allow: "GET, HEAD" } });
    if (url.pathname === "/") {
      // Sequential on purpose: `current` may run the checks, and the history must include what it just stored.
      const summary = await current(ctx, now);
      const html = renderPage(summary, now, await histories(ctx, now), await incidentsSince(ctx, now - INCIDENT_HISTORY_MS));
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS } });
    }
    if (url.pathname === "/api/status") {
      const s = await current(ctx, now);
      const hs = await histories(ctx, now);
      const openIncidents = openIncidentsByMonitor(await incidentsSince(ctx, now - INCIDENT_HISTORY_MS));
      const services = s.services.map((x) => {
        const history = hs.get(x.id);
        const lat = history?.latency ?? null;
        return {
          ...x,
          uptime: history?.uptime ?? null,
          latencyP50Ms: lat?.p50 ?? null,
          latencyP95Ms: lat?.p95 ?? null,
          incident: openIncidents.get(x.id) ?? null,
        };
      });
      return Response.json({ generatedAt: new Date(now).toISOString(), ...s, services }, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*", ...SECURITY_HEADERS } });
    }
    if (url.pathname === "/incidents.atom") {
      // Like the status routes, polling in a Preview should refresh stale checks even without cron.
      await current(ctx, now);
      const feed = incidentFeed(
        await incidentsSince(ctx, now - INCIDENT_FEED_WINDOW_MS),
        MONITORS,
        now,
        `${url.origin}/incidents.atom`,
      );
      const body = serializeAtomFeed(feed);
      return new Response(request.method === "HEAD" ? null : body, {
        headers: {
          "content-type": "application/atom+xml; charset=utf-8",
          "cache-control": "public, max-age=60",
          "access-control-allow-origin": "*",
          ...SECURITY_HEADERS,
        },
      });
    }
    const badgePath = /^\/badge\/([a-z0-9-]+)\.svg$/.exec(url.pathname);
    if (badgePath) {
      const monitor = MONITORS.find((m) => m.id === badgePath[1]);
      if (!monitor) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS } });
      const service = (await current(ctx, now)).services.find((s) => s.id === monitor.id);
      const svg = renderBadge(monitor.name, service?.state ?? "unknown");
      return new Response(request.method === "HEAD" ? null : svg, {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=60", ...SECURITY_HEADERS },
      });
    }
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS } });
}

export default {
  async fetch(request, _env, ctx): Promise<Response> {
    const response = await route(request, ctx);
    const extra = indexingHeaders(request.url);
    if (Object.keys(extra).length === 0) return response;
    // Every response, Previews' 404s included, carries the header; the body passes through untouched.
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(extra)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },

  async scheduled(controller, _env, ctx): Promise<void> {
    await ledgerOf(ctx).runChecks(controller.scheduledTime);
  },
} satisfies ExportedHandler<Env>;
