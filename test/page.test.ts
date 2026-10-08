import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPage } from "../src/page.ts";
import { summarize } from "../src/summary.ts";
import type { Monitor } from "../src/monitors.ts";

const monitors: Monitor[] = [{ id: "a", name: "Alpha <script>", url: "https://alpha.example/" }];

test("the page escapes what it shows", () => {
  const html = renderPage(summarize(monitors, new Map()), 0);
  assert.ok(html.includes("Alpha &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("the page states the overall status and each service", () => {
  const now = 100_000;
  const html = renderPage(summarize(monitors, new Map([["a", { monitor: "a", at: now - 12_000, ok: false, status: 502, latencyMs: 80, error: "HTTP 502" }]])), now);
  assert.match(html, /<h1>Every service is down/);
  assert.match(html, /Checked 12 s ago/);
  assert.match(html, /class="svc down"/);
  assert.match(html, /HTTP 502/);
});

test("a fresh deployment says it has not checked yet", () => {
  assert.match(renderPage(summarize(monitors, new Map()), 0), /Not checked yet/);
});

test("each service shows a strip of its checks, oldest first, and its 24-hour uptime", () => {
  const now = 100_000;
  const latest = new Map([["a", { monitor: "a", at: now - 1000, ok: true, status: 200, latencyMs: 80, error: null }]]);
  const histories = new Map([["a", { bars: [{ at: 1, ok: true, error: null }, { at: 2, ok: false, error: "HTTP 503" }, { at: 3, ok: true, error: null }], uptime: 66.7 }]]);
  const html = renderPage(summarize(monitors, latest), now, histories);
  const bars = [...html.matchAll(/class="bar (ok|fail)"/g)].map((m) => m[1]);
  assert.deepEqual(bars, ["ok", "fail", "ok"]);
  assert.match(html, /66\.7% up in 24 h/);
  assert.match(html, /title="Down: HTTP 503"/);
  assert.match(html, /aria-label="Last 3 checks, oldest first: 2 passed\."/);
});

test("a service with no checks in 24 hours shows no percentage, not 100%", () => {
  const html = renderPage(summarize(monitors, new Map()), 0, new Map([["a", { bars: [], uptime: null }]]));
  assert.match(html, /No checks in 24 h/);
  assert.doesNotMatch(html, /100(\.0)?%/);
});

test("the page without histories still renders", () => {
  const html = renderPage(summarize(monitors, new Map()), 0);
  assert.match(html, /<h1>Waiting for the first checks/);
  assert.doesNotMatch(html, /class="bar /);
});
