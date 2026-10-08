import { test } from "node:test";
import assert from "node:assert/strict";
import { MONITORS } from "../src/monitors.ts";

test("monitor ids are unique and well formed", () => {
  const ids = MONITORS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

test("Cloudflare API is watched at its public ips endpoint, expecting 2xx", () => {
  const m = MONITORS.find((x) => x.id === "cloudflare-api");
  assert.ok(m, "cloudflare-api monitor exists");
  assert.equal(m.name, "Cloudflare API");
  assert.equal(m.url, "https://api.cloudflare.com/client/v4/ips");
  assert.deepEqual(m.expect, { min: 200, max: 299 });
});
