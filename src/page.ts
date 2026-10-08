// The public status page, rendered on the server: no client script, so it works everywhere and a
// browser reload is all it needs.

import { ago, headline, type Summary } from "./summary.ts";
import type { ServiceHistory } from "./history.ts";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STATE_LABEL = { up: "Operational", down: "Down", unknown: "No data yet" } as const;

/** "45 min", "2 h 5 min", "3 days": how long something lasted. */
export function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  if (h < 48) return rest ? `${h} h ${rest} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/** The strip: one bar per check, oldest on the left. Each bar says whether its check passed. */
function strip(h: ServiceHistory | undefined): string {
  const bars = h?.bars ?? [];
  const cells = bars.map((b) => `<span class="bar ${b.ok ? "ok" : "fail"}" title="${esc(b.ok ? "Up" : `Down: ${b.error ?? "failed"}`)}"></span>`).join("");
  const uptime = h?.uptime === null || h?.uptime === undefined ? "No checks in 24 h" : `${h.uptime.toFixed(1)}% up in 24 h`;
  const passed = bars.filter((b) => b.ok).length;
  const summary = bars.length ? `Last ${bars.length} checks, oldest first: ${passed} passed.` : "No checks yet.";
  return `<div class="hist">
          <div class="strip" role="img" aria-label="${esc(summary)}">${cells}</div>
          <span class="uptime">${esc(uptime)}</span>
        </div>`;
}

export function renderPage(s: Summary, now: number, histories: Map<string, ServiceHistory> = new Map()): string {
  const rows = s.services.map((x) => `
      <li class="svc ${x.state}">
        <span class="mark" aria-hidden="true"></span>
        <span class="name">${esc(x.name)}<span class="host">${esc(x.host)}</span></span>
        <span class="state">${STATE_LABEL[x.state]}${x.state === "down" && x.error ? `<span class="why">${esc(x.error)}</span>` : ""}</span>
        <span class="ms">${x.latencyMs === null ? "" : `${x.latencyMs} ms`}</span>
        ${strip(histories.get(x.id))}
      </li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>${esc(headline(s))} · Beacon</title>
<meta name="color-scheme" content="light dark">
<style>
:root { --paper: #f6f7f9; --ink: #0e1116; --muted: #5b626b; --line: #d5d9de; --up: #1f4fff; --down: #d0103a; }
@media (prefers-color-scheme: dark) { :root { --paper: #0d1015; --ink: #eef0f3; --muted: #9aa2ad; --line: #262c35; --up: #7d95ff; --down: #ff5c7a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 15px/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
main { max-width: 760px; margin: 0 auto; padding: 32px 20px 56px; }
header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.word { font-size: 13px; letter-spacing: .28em; text-transform: uppercase; }
.when { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
h1 { margin: 40px 0 28px; font-size: clamp(30px, 6vw, 48px); font-weight: 400; line-height: 1.05; letter-spacing: -.04em; text-wrap: balance; }
h1 .dot { color: var(--up); }
.overall-partial h1 .dot, .overall-major h1 .dot { color: var(--down); }
ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--ink); }
.svc { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto 72px; gap: 14px; align-items: baseline; padding: 15px 0; border-bottom: 1px solid var(--line); }
.mark { width: 10px; height: 10px; align-self: center; border: 1.5px solid var(--muted); }
.svc.up .mark { background: var(--up); border-color: var(--up); }
.svc.down .mark { background: var(--down); border-color: var(--down); }
.name { font-size: 17px; letter-spacing: -.012em; min-width: 0; }
.host { display: block; font: 12px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: var(--muted); overflow-wrap: anywhere; }
.state { font-size: 14px; text-align: right; }
.svc.down .state { color: var(--down); }
.why { display: block; font-size: 12px; color: var(--muted); }
.ms { font: 12.5px ui-monospace, "SF Mono", Menlo, monospace; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.hist { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; margin-top: 2px; }
.strip { flex: 1; min-width: 0; display: flex; align-items: stretch; gap: 2px; height: 22px; }
.bar { flex: 1 1 0; min-width: 1px; background: var(--line); }
.bar.ok { background: var(--up); }
.bar.fail { background: var(--down); }
.uptime { flex: none; font: 12.5px ui-monospace, "SF Mono", Menlo, monospace; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
footer { margin-top: 28px; font-size: 13px; color: var(--muted); }
footer a { color: inherit; }
@media (max-width: 520px) { .svc { grid-template-columns: 12px minmax(0, 1fr) auto; } .ms { grid-column: 2 / -1; text-align: left; } .strip { height: 18px; } }
</style>
</head>
<body class="overall-${s.overall}">
<main>
  <header><span class="word">Beacon</span><span class="when">${s.checkedAt === null ? "Not checked yet" : `Checked ${ago(s.checkedAt, now)}`}</span></header>
  <h1>${esc(headline(s))}<span class="dot">.</span></h1>
  <ul aria-label="Services">${rows}
  </ul>
  <footer>Beacon checks each service once a minute from Cloudflare's network. The same data is at <a href="/api/status">/api/status</a>.</footer>
</main>
</body>
</html>`;
}
