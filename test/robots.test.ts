import { test } from "node:test";
import assert from "node:assert/strict";
import { indexingHeaders, isProductionHost } from "../src/robots.ts";

test("production's host may be indexed", () => {
  assert.equal(isProductionHost("beacon.nestagents.dev"), true);
  assert.deepEqual(indexingHeaders("https://beacon.nestagents.dev/"), {});
  assert.deepEqual(indexingHeaders("https://beacon.nestagents.dev/api/status"), {});
});

test("a Preview host is noindex", () => {
  assert.equal(isProductionHost("feature-x.beacon-previews.nestagents.dev"), false);
  assert.deepEqual(indexingHeaders("https://feature-x.beacon-previews.nestagents.dev/badge/web.svg"), { "x-robots-tag": "noindex" });
});

test("the host is compared case-insensitively, ignoring a trailing dot and a port", () => {
  assert.equal(isProductionHost("Beacon.NestAgents.dev"), true);
  assert.equal(isProductionHost("beacon.nestagents.dev."), true);
  assert.equal(isProductionHost("beacon.nestagents.dev:443"), true);
});

test("lookalike hosts are not production", () => {
  assert.equal(isProductionHost("beacon.nestagents.dev.evil.example"), false);
  assert.equal(isProductionHost("evil-beacon.nestagents.dev"), false);
  assert.equal(isProductionHost("nestagents.dev"), false);
  assert.equal(isProductionHost("localhost"), false);
});

test("the production host can be given", () => {
  assert.equal(isProductionHost("example.test", "example.test"), true);
});
