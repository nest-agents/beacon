import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBadge } from "../src/badge.ts";

test("badge names and accessible labels are XML escaped", () => {
  const svg = renderBadge(`A&B <service> "one"`, "up");
  assert.match(svg, /A&amp;B &lt;service&gt; &quot;one&quot;/);
  assert.match(svg, /aria-label="A&amp;B &lt;service&gt; &quot;one&quot;: Operational"/);
  assert.doesNotMatch(svg, /<service>/);
});

test("a long name is scaled and clipped to the fixed badge name area", () => {
  const name = "A very long service name with wide characters 界界界界界";
  const svg = renderBadge(name, "down");
  assert.match(svg, /width="196" height="20"/);
  assert.match(svg, /<rect x="6" y="0" width="108" height="20"/);
  assert.match(svg, /clip-path="url\(#name-clip\)" textLength="108"/);
  assert.ok(svg.includes(`<title>${name}: Down</title>`));
  assert.match(svg, /fill="#d0103a"/);
});

test("badge states use the page palette and grey for no data", () => {
  assert.match(renderBadge("Nest", "up"), /fill="#1f4fff"/);
  assert.match(renderBadge("Nest", "down"), /fill="#d0103a"/);
  assert.match(renderBadge("Nest", "unknown"), /fill="#6b7280"/);
});
