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
