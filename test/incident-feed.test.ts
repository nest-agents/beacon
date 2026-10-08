import { test } from "node:test";
import assert from "node:assert/strict";
import { INCIDENT_FEED_MAX_ENTRIES, INCIDENT_FEED_WINDOW_MS, incidentFeed, serializeAtomFeed } from "../src/incident-feed.ts";
import type { Incident } from "../src/incidents.ts";
import type { Monitor } from "../src/monitors.ts";

type XmlElement = { name: string; attributes: Record<string, string>; children: (XmlElement | string)[] };

/** A small test-only XML parser: it checks nesting and decodes entities before assertions inspect the feed. */
function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "#document", attributes: {}, children: [] };
  const stack = [root];
  const tokens = /<\?[^?]*\?>|<\/[^>]+>|<[^>]+>|[^<]+/g;
  let cursor = 0;
  for (const match of xml.matchAll(tokens)) {
    assert.equal(match.index, cursor, "XML has no unparsed characters");
    cursor += match[0].length;
    const token = match[0];
    if (token.startsWith("<?")) continue;
    if (!token.startsWith("<")) {
      const text = decodeXml(token);
      if (stack.length === 1) assert.equal(text.trim(), "", "no text outside the document element");
      else stack.at(-1)!.children.push(text);
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      assert.ok(stack.length > 1, "elements close in nesting order");
      assert.equal(stack.at(-1)!.name, name, "closing tag matches its opening tag");
      stack.pop();
      continue;
    }

    const selfClosing = token.endsWith("/>");
    const inner = token.slice(1, selfClosing ? -2 : -1).trim();
    const nameMatch = /^([A-Za-z_][\w:.-]*)/.exec(inner);
    assert.ok(nameMatch, `valid element name in ${token}`);
    const name = nameMatch[1]!;
    let rest = inner.slice(name.length).trim();
    const attributes: Record<string, string> = {};
    while (rest) {
      const attribute = /^([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"\s*/.exec(rest);
      assert.ok(attribute, `valid quoted attribute in ${token}`);
      assert.equal(attributes[attribute[1]!], undefined, "attribute names are unique");
      attributes[attribute[1]!] = decodeXml(attribute[2]!);
      rest = rest.slice(attribute[0].length);
    }
    const element: XmlElement = { name, attributes, children: [] };
    stack.at(-1)!.children.push(element);
    if (!selfClosing) stack.push(element);
  }
  assert.equal(cursor, xml.length, "all XML was parsed");
  assert.equal(stack.length, 1, "all elements are closed");
  const elements = root.children.filter((child): child is XmlElement => typeof child !== "string");
  assert.equal(elements.length, 1, "document has one root element");
  return elements[0]!;
}

function decodeXml(text: string): string {
  const entities = /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi;
  assert.doesNotMatch(text.replace(entities, ""), /&/, "XML entities are complete and known");
  return text.replace(entities, (_entity, code: string) => {
    if (code === "amp") return "&";
    if (code === "lt") return "<";
    if (code === "gt") return ">";
    if (code === "quot") return '"';
    if (code === "apos") return "'";
    return String.fromCodePoint(code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  });
}

function children(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child): child is XmlElement => typeof child !== "string" && child.name === name);
}

function text(element: XmlElement, name: string): string {
  const matches = children(element, name);
  assert.equal(matches.length, 1, `one ${name} element`);
  assert.ok(matches[0]!.children.every((child) => typeof child === "string"), `${name} contains text only`);
  return (matches[0]!.children as string[]).join("");
}

const monitors: Monitor[] = [
  { id: "alpha", name: "Alpha & <API>", url: "https://alpha.example/" },
  { id: "beta", name: "Beta's service", url: "https://beta.example/" },
];

test("the typed incident feed serializes to parseable Atom with ordered, escaped incident entries", () => {
  const now = Date.UTC(2026, 9, 8);
  const incidents: Incident[] = [
    { monitor: "alpha", openedAt: now - 2_000, closedAt: null, error: "HTTP 503 & <retry>" },
    { monitor: "beta", openedAt: now - 1_000, closedAt: now - 500, error: "Timeout 'again'" },
    { monitor: "alpha", openedAt: now - INCIDENT_FEED_WINDOW_MS - 1, closedAt: now - INCIDENT_FEED_WINDOW_MS, error: "Too old" },
  ];
  const model = incidentFeed(incidents, monitors, now, "https://beacon.example/incidents.atom");
  const parsed = parseXml(serializeAtomFeed(model));

  assert.equal(parsed.name, "feed");
  assert.equal(parsed.attributes.xmlns, "http://www.w3.org/2005/Atom");
  assert.equal(text(parsed, "id"), model.id);
  assert.equal(text(parsed, "title"), "Beacon incidents");
  assert.equal(text(parsed, "updated"), model.updated);
  const link = children(parsed, "link")[0]!;
  assert.deepEqual(link.attributes, { href: model.self, rel: "self", type: "application/atom+xml" });

  const entries = children(parsed, "entry");
  assert.equal(entries.length, 2, "incidents older than 30 days are omitted");
  assert.deepEqual(entries.map((entry) => text(entry, "title")), ["Beta's service incident", "Alpha & <API> incident"]);
  assert.equal(text(entries[0]!, "published"), new Date(now - 1_000).toISOString());
  assert.equal(text(entries[0]!, "updated"), new Date(now - 500).toISOString());
  assert.equal(text(entries[0]!, "content"), [
    "Service: Beta's service",
    `Opened: ${new Date(now - 1_000).toISOString()}`,
    `Closed: ${new Date(now - 500).toISOString()}`,
    "Error: Timeout 'again'",
  ].join("\n"));
  assert.match(text(entries[1]!, "content"), /Status: Ongoing/);
  assert.match(text(entries[1]!, "content"), /Error: HTTP 503 & <retry>/);
  assert.ok(text(entries[0]!, "id").startsWith("urn:beacon:incident:beta:"));
  for (const entry of entries) {
    assert.deepEqual(children(entry, "link").map((link) => link.attributes), [{ href: "https://beacon.example/" }]);
  }
});

test("an empty feed is still a valid Atom document with a current updated timestamp", () => {
  const now = Date.UTC(2026, 9, 8);
  const model = incidentFeed([], monitors, now, "https://beacon.example/incidents.atom");
  const parsed = parseXml(serializeAtomFeed(model));
  assert.equal(text(parsed, "updated"), new Date(now).toISOString());
  assert.deepEqual(children(parsed, "entry"), []);
});

test("the feed keeps the newest 50 incidents and leaves out the 51st", () => {
  const now = Date.UTC(2026, 9, 8);
  assert.equal(INCIDENT_FEED_MAX_ENTRIES, 50);
  // 51 incidents inside the window, opened one minute apart; the oldest is the 51st.
  const incidents: Incident[] = Array.from({ length: 51 }, (_, i) => ({
    monitor: "alpha",
    openedAt: now - (i + 1) * 60_000,
    closedAt: null,
    error: `Error #${i}`,
  }));
  const model = incidentFeed(incidents, monitors, now, "https://beacon.example/incidents.atom");
  const parsed = parseXml(serializeAtomFeed(model));
  const entries = children(parsed, "entry");

  assert.equal(entries.length, 50, "at most 50 entries");
  const published = entries.map((entry) => text(entry, "published"));
  assert.equal(published[0], new Date(now - 60_000).toISOString(), "newest entry comes first");
  assert.equal(published[49], new Date(now - 50 * 60_000).toISOString(), "50th-newest is the last entry");
  assert.ok(!published.includes(new Date(now - 51 * 60_000).toISOString()), "the 51st incident is left out");
  assert.ok(!entries.some((entry) => text(entry, "content").includes("Error #50\n")), "the 51st incident's content is absent");
});
