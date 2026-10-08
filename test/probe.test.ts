import { test } from "node:test";
import assert from "node:assert/strict";
import { probe, type Fetcher } from "../src/probe.ts";
import type { Monitor } from "../src/monitors.ts";

const monitor: Monitor = { id: "svc", name: "Service", url: "https://svc.example/" };
const clock = (...times: number[]) => () => times.shift() ?? 0;
const answering = (status: number): Fetcher => async () => new Response("body", { status });

test("a 2xx answer is up, with its latency", async () => {
  const r = await probe(monitor, answering(200), clock(1000, 1142));
  assert.deepEqual(r, { monitor: "svc", at: 1000, ok: true, status: 200, latencyMs: 142, error: null });
});

test("a redirect is up by default", async () => {
  assert.equal((await probe(monitor, answering(301), clock(0, 5))).ok, true);
});

test("a 5xx answer is down and says why", async () => {
  const r = await probe(monitor, answering(503), clock(0, 20));
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  assert.equal(r.error, "HTTP 503");
});

test("a monitor's expected range decides", async () => {
  const strict = { ...monitor, expect: { min: 200, max: 299 } };
  assert.equal((await probe(strict, answering(302), clock(0, 1))).ok, false);
});

test("a network failure is down with no status", async () => {
  const failing: Fetcher = async () => { throw new TypeError("connection refused"); };
  const r = await probe(monitor, failing, clock(0, 3));
  assert.equal(r.ok, false);
  assert.equal(r.status, null);
  assert.match(r.error ?? "", /connection refused/);
});

test("no answer within the timeout is down", async () => {
  const hanging: Fetcher = (_url, init) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
  const r = await probe({ ...monitor, timeoutMs: 30 }, hanging);
  assert.equal(r.ok, false);
  assert.equal(r.error, "No response within 0 s");
});

test("the request is a plain GET that does not follow redirects", async () => {
  let seen: RequestInit | undefined;
  await probe(monitor, async (_url, init) => { seen = init; return new Response(null, { status: 204 }); }, clock(0, 1));
  assert.equal(seen?.method, "GET");
  assert.equal(seen?.redirect, "manual");
});
