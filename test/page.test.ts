import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, renderPage } from "../src/page.ts";
import { summarize } from "../src/summary.ts";
import type { Monitor } from "../src/monitors.ts";
import type { Incident } from "../src/incidents.ts";

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

test("duration reads as minutes, hours and days", () => {
  assert.equal(duration(0), "1 min");
  assert.equal(duration(45 * 60_000), "45 min");
  assert.equal(duration(2 * 3_600_000), "2 h");
  assert.equal(duration(125 * 60_000), "2 h 5 min");
  assert.equal(duration(47 * 3_600_000), "47 h");
  assert.equal(duration(3 * 24 * 3_600_000), "3 days");
});

test("open incidents come first, then recent closed ones with their duration", () => {
  const now = 10 * 3_600_000;
  const incidents: Incident[] = [
    { monitor: "a", openedAt: now - 1_000_000, closedAt: now - 100_000, error: "HTTP 503" },
    { monitor: "a", openedAt: now - 200_000, closedAt: null, error: "No response within 10 s" },
  ];
  const html = renderPage(summarize(monitors, new Map()), now, new Map(), incidents);
  assert.match(html, /<h2>Incidents<\/h2>/);
  const openAt = html.indexOf("Ongoing for 3 min");
  const closedAt = html.indexOf("Resolved after 15 min");
  assert.ok(openAt > 0 && closedAt > openAt, "open incident is listed before the closed one");
  assert.match(html, /No response within 10 s/);
});

test("incident text is escaped and no incidents means no incident section", () => {
  const now = 1_000_000;
  const html = renderPage(summarize(monitors, new Map()), now, new Map(), [{ monitor: "a", openedAt: 0, closedAt: null, error: "<img onerror=x>" }]);
  assert.ok(html.includes("&lt;img onerror=x&gt;"));
  assert.ok(!html.includes("<img"));
  assert.ok(!renderPage(summarize(monitors, new Map()), now).includes("Incidents"));
});

test("the page without histories still renders", () => {
  const html = renderPage(summarize(monitors, new Map()), 0);
  assert.match(html, /<h1>Waiting for the first checks/);
  assert.doesNotMatch(html, /class="bar /);
});
