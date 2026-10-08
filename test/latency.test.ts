import { test } from "node:test";
import assert from "node:assert/strict";
import { latencyPercentiles, percentile } from "../src/latency.ts";
import { UPTIME_WINDOW_MS } from "../src/history.ts";
import type { CheckResult } from "../src/probe.ts";

const H = 3_600_000;
const check = (at: number, latencyMs: number): CheckResult => ({ monitor: "a", at, ok: true, status: 200, latencyMs, error: null });

test("nearest rank on four values: p50 is the second, p95 the fourth", () => {
  const v = [40, 10, 30, 20];
  assert.equal(percentile(v, 50), 20);
  assert.equal(percentile(v, 95), 40);
});

test("nearest rank on twenty values 1..20: p50 is 10, p95 is 19", () => {
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(v, 50), 10);
  assert.equal(percentile(v, 95), 19);
  assert.equal(percentile(v, 100), 20);
});

test("a single value is both the median and the 95th percentile", () => {
  assert.equal(percentile([73], 50), 73);
  assert.equal(percentile([73], 95), 73);
});

test("the input is not reordered and percentiles are stored values", () => {
  const v = [5, 1, 3];
  percentile(v, 50);
  assert.deepEqual(v, [5, 1, 3]);
  assert.equal(percentile([100, 200], 50), 100);
});

test("an empty list has no percentile", () => {
  assert.throws(() => percentile([], 50), RangeError);
});

test("latency percentiles come from the last 24 hours only", () => {
  const now = 100 * H;
  const results = [
    check(now - UPTIME_WINDOW_MS - 1, 9999),
    check(now - 3 * H, 10),
    check(now - 2 * H, 20),
    check(now - H, 30),
    check(now - 1, 40),
  ];
  assert.deepEqual(latencyPercentiles(results, now), { p50: 20, p95: 40 });
});

test("no results in the window means no latency, not zero", () => {
  const now = 100 * H;
  assert.equal(latencyPercentiles([], now), null);
  assert.equal(latencyPercentiles([check(now - 2 * UPTIME_WINDOW_MS, 5)], now), null);
});
