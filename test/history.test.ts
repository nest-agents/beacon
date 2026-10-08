import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_BARS, lastResults, serviceHistory, uptimePercent, UPTIME_WINDOW_MS } from "../src/history.ts";
import type { CheckResult } from "../src/probe.ts";

const H = 3_600_000;
const check = (at: number, ok = true): CheckResult => ({ monitor: "a", at, ok, status: ok ? 200 : 503, latencyMs: 10, error: ok ? null : "HTTP 503" });

test("the strip keeps the last 90 results, oldest first", () => {
  const results = Array.from({ length: 120 }, (_, i) => check(i * 1000));
  const last = lastResults(results, HISTORY_BARS);
  assert.equal(last.length, 90);
  assert.equal(last[0]!.at, 30_000);
  assert.equal(last[89]!.at, 119_000);
});

test("results arriving out of order are still shown oldest first", () => {
  const shuffled = [check(3000), check(1000), check(2000)];
  assert.deepEqual(lastResults(shuffled, 90).map((r) => r.at), [1000, 2000, 3000]);
});

test("fewer results than the strip holds are all shown", () => {
  assert.equal(lastResults([check(5), check(6)], 90).length, 2);
  assert.deepEqual(lastResults([], 90), []);
});

test("uptime is the share of passed checks in the last 24 hours, to one decimal place", () => {
  const now = 100 * H;
  const results = [
    ...Array.from({ length: 2 }, (_, i) => check(now - 2 * H + i)),
    check(now - 3 * H, false),
  ];
  assert.equal(uptimePercent(results, now), 66.7);
  assert.equal(uptimePercent([check(now - H), check(now - H + 1)], now), 100);
  assert.equal(uptimePercent([check(now - H), check(now - H + 1, false), check(now - H + 2, false)], now), 33.3);
});

test("checks older than 24 hours do not count toward uptime", () => {
  const now = 100 * H;
  const results = [check(now - UPTIME_WINDOW_MS - 1, false), check(now - H)];
  assert.equal(uptimePercent(results, now), 100);
});

test("a window with no checks has no uptime, not 100%", () => {
  const now = 100 * H;
  assert.equal(uptimePercent([], now), null);
  assert.equal(uptimePercent([check(now - 2 * UPTIME_WINDOW_MS)], now), null);
});

test("serviceHistory combines the strip and the uptime", () => {
  const now = 100 * H;
  const h = serviceHistory([check(now - 2 * H, false), check(now - H)], now);
  assert.deepEqual(h.bars.map((b) => b.ok), [false, true]);
  assert.equal(h.bars[0]!.error, "HTTP 503");
  assert.equal(h.uptime, 50);
  assert.deepEqual(h.latency, { p50: 10, p95: 10 });
  assert.deepEqual(serviceHistory([], now), { bars: [], uptime: null, latency: null });
});
