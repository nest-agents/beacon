import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../src/incidents.ts";
import type { CheckResult } from "../src/probe.ts";

// One service's checks from a string, one minute apart: "x" is a failure, "." a pass.
const run = (pattern: string): CheckResult[] =>
  [...pattern].map((c, i) => ({
    monitor: "svc", at: i * 60_000, ok: c === ".", status: c === "." ? 200 : 503, latencyMs: 40,
    error: c === "." ? null : "HTTP 503",
  }));

/** Feed checks one at a time, as the Ledger does, and list each opening and closing. */
function replay(pattern: string): { i: number; kind: "open" | "close" }[] {
  const checks = run(pattern);
  let open = false;
  const out: { i: number; kind: "open" | "close" }[] = [];
  checks.forEach((_, i) => {
    const d = decide(checks.slice(0, i + 1), open);
    if (!d) return;
    if (d.open) { open = true; out.push({ i, kind: "open" }); }
    else { open = false; out.push({ i, kind: "close" }); }
  });
  return out;
}

test("a single dropped request never opens an incident", () => {
  assert.deepEqual(replay("....x....."), []);
  assert.deepEqual(replay("...x...x..."), [], "two drops spread apart stay under the threshold");
});

test("three failures in the last five checks open one, and the error is kept", () => {
  assert.deepEqual(decide(run("..xx.x"), false), { open: true, at: 5 * 60_000, error: "HTTP 503" });
  assert.deepEqual(replay("..xx.x"), [{ i: 5, kind: "open" }]);
});

test("an opened incident is not reported again while it stays open", () => {
  // "..xxx" is the first window with three failures, at index 4; the rest of the outage changes nothing.
  assert.deepEqual(replay("..xxxxxxxx"), [{ i: 4, kind: "open" }]);
});

test("flapping that never has three failures in five checks opens nothing", () => {
  assert.deepEqual(replay("x..x..x..x..x..x"), []);
  assert.deepEqual(replay("xx...xx...xx...xx"), []);
});

test("alternating pass and fail does open, because it is three failures in five", () => {
  // Honest about the rule: x.x.x has three failures in five checks, so it counts as failing.
  assert.deepEqual(replay("x.x.x"), [{ i: 4, kind: "open" }]);
});

test("recovery closes once fewer than three of the last five fail", () => {
  // Open at index 4. The window at index 6 ("xxx..") still has three failures; at index 7 ("xx...") it has two.
  assert.deepEqual(replay("..xxx..."), [{ i: 4, kind: "open" }, { i: 7, kind: "close" }]);
});

test("one passing check in the middle of an outage does not close it", () => {
  // "xxx." still has three failures in its window, so the incident stays open.
  assert.equal(decide(run("xxx.").slice(0, 4), true), null);
  assert.deepEqual(replay("xxx.xxx"), [{ i: 2, kind: "open" }]);
});

test("the close decision carries the time of the check that closed it", () => {
  const checks = run("xxxx...");
  assert.deepEqual(decide(checks, true), { open: false, at: 6 * 60_000 });
});

test("with no checks, nothing changes", () => {
  assert.equal(decide([], false), null);
  assert.equal(decide([], true), null);
});

test("a healthy service with no open incident changes nothing", () => {
  assert.equal(decide(run("....."), false), null);
});
