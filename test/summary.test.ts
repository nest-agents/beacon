import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, headline, summarize } from "../src/summary.ts";
import type { Monitor } from "../src/monitors.ts";
import type { CheckResult } from "../src/probe.ts";

const monitors: Monitor[] = [
  { id: "a", name: "Alpha", url: "https://alpha.example/health" },
  { id: "b", name: "Beta", url: "https://beta.example/" },
];
const result = (monitor: string, ok: boolean, at = 1000): CheckResult => ({ monitor, at, ok, status: ok ? 200 : 500, latencyMs: 50, error: ok ? null : "HTTP 500" });

test("with no results yet, every service is unknown", () => {
  const s = summarize(monitors, new Map());
  assert.equal(s.overall, "unknown");
  assert.deepEqual(s.services.map((x) => x.state), ["unknown", "unknown"]);
  assert.equal(s.checkedAt, null);
  assert.equal(headline(s), "Waiting for the first checks");
});

test("all up is operational", () => {
  const s = summarize(monitors, new Map([["a", result("a", true, 1000)], ["b", result("b", true, 2000)]]));
  assert.equal(s.overall, "operational");
  assert.equal(s.checkedAt, 2000);
  assert.equal(headline(s), "All systems operational");
});

test("some down is partial, all down is major", () => {
  const partial = summarize(monitors, new Map([["a", result("a", true)], ["b", result("b", false)]]));
  assert.equal(partial.overall, "partial");
  assert.equal(headline(partial), "One service is down");
  const major = summarize(monitors, new Map([["a", result("a", false)], ["b", result("b", false)]]));
  assert.equal(major.overall, "major");
  assert.equal(headline(major), "Every service is down");
});

test("a service shows its host, not its full URL", () => {
  const s = summarize(monitors, new Map());
  assert.equal(s.services[0]!.host, "alpha.example");
});

test("ago reads like a human wrote it", () => {
  assert.equal(ago(0, 12_000), "12 s ago");
  assert.equal(ago(0, 3 * 60_000), "3 min ago");
  assert.equal(ago(0, 5 * 3_600_000), "5 h ago");
  assert.equal(ago(0, 4 * 86_400_000), "4 days ago");
  assert.equal(ago(10_000, 0), "0 s ago");
});
