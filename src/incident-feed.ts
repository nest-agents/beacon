// A typed Atom feed model for incidents, and its single XML serialization point.

import type { Incident } from "./incidents.ts";
import type { Monitor } from "./monitors.ts";

export const INCIDENT_FEED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type AtomEntry = {
  id: string;
  title: string;
  updated: string;
  published: string;
  content: string;
};

export type AtomFeed = {
  id: string;
  title: string;
  updated: string;
  self: string;
  entries: AtomEntry[];
};

/** Build the incidents opened within the last 30 days, newest first. */
export function incidentFeed(
  incidents: Incident[],
  monitors: readonly Monitor[],
  now: number,
  feedUrl: string,
): AtomFeed {
  const names = new Map(monitors.map((monitor) => [monitor.id, monitor.name]));
  const entries = incidents
    .filter((incident) => incident.openedAt >= now - INCIDENT_FEED_WINDOW_MS)
    .sort((a, b) => b.openedAt - a.openedAt || a.monitor.localeCompare(b.monitor))
    .map((incident): AtomEntry => {
      const service = names.get(incident.monitor) ?? incident.monitor;
      const opened = new Date(incident.openedAt).toISOString();
      const closed = incident.closedAt === null ? null : new Date(incident.closedAt).toISOString();
      return {
        id: `urn:beacon:incident:${encodeURIComponent(incident.monitor)}:${incident.openedAt}`,
        title: `${service} incident`,
        updated: closed ?? opened,
        published: opened,
        content: [
          `Service: ${service}`,
          `Opened: ${opened}`,
          closed === null ? "Status: Ongoing" : `Closed: ${closed}`,
          `Error: ${incident.error}`,
        ].join("\n"),
      };
    });

  const latestUpdate = entries.reduce((latest, entry) => Math.max(latest, Date.parse(entry.updated)), now);
  return {
    id: feedUrl,
    title: "Beacon incidents",
    updated: new Date(latestUpdate).toISOString(),
    self: feedUrl,
    entries,
  };
}

const escXml = (value: string): string => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[c]!);

/** Serialize the typed feed as an Atom 1.0 XML document. */
export function serializeAtomFeed(feed: AtomFeed): string {
  const entries = feed.entries.map((entry) => `  <entry>
    <id>${escXml(entry.id)}</id>
    <title>${escXml(entry.title)}</title>
    <updated>${escXml(entry.updated)}</updated>
    <published>${escXml(entry.published)}</published>
    <content type="text">${escXml(entry.content)}</content>
  </entry>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escXml(feed.id)}</id>
  <title>${escXml(feed.title)}</title>
  <updated>${escXml(feed.updated)}</updated>
  <link href="${escXml(feed.self)}" rel="self" type="application/atom+xml" />${entries ? `\n${entries}` : ""}
</feed>`;
}
