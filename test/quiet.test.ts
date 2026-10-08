import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuiet, QUIET_WINDOW_MS } from "../src/quiet.ts";
import type { Incident } from "../src/incidents.ts";

const now = 100 * QUIET_WINDOW_MS;
const incident = (openedAt: number, closedAt: number | null = openedAt + 60_000): Incident => ({ monitor: "a", openedAt, closedAt, error: "HTTP 503" });

test("with no incidents at all, it is quiet", () => {
  assert.equal(isQuiet([], now), true);
});

test("an incident that opened within the last 7 days is not quiet", () => {
  assert.equal(isQuiet([incident(now - 6 * 24 * 60 * 60 * 1000)], now), false);
  assert.equal(isQuiet([incident(now - 1000, null)], now), false);
});

test("an incident that opened more than 7 days ago does not count", () => {
  assert.equal(isQuiet([incident(now - QUIET_WINDOW_MS - 1, now - QUIET_WINDOW_MS + 1000)], now), true);
});

test("any one recent incident among older ones is enough to be not quiet", () => {
  assert.equal(isQuiet([incident(now - 30 * 24 * 60 * 60 * 1000), incident(now - 3600_000)], now), false);
});
