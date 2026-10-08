// What the checks mean for a human: each service's current state and the state of everything together.

import type { Monitor } from "./monitors.ts";
import type { CheckResult } from "./probe.ts";

export type ServiceState = "up" | "down" | "unknown";

export type ServiceSummary = {
  id: string;
  name: string;
  host: string;
  state: ServiceState;
  latencyMs: number | null;
  checkedAt: number | null;
  error: string | null;
};

export type Summary = {
  overall: "operational" | "partial" | "major" | "unknown";
  services: ServiceSummary[];
  checkedAt: number | null;
};

/** `latest` holds each monitor's most recent result, if it has one. */
export function summarize(monitors: Monitor[], latest: Map<string, CheckResult>): Summary {
  const services = monitors.map((m): ServiceSummary => {
    const r = latest.get(m.id);
    return {
      id: m.id, name: m.name, host: new URL(m.url).host,
      state: !r ? "unknown" : r.ok ? "up" : "down",
      latencyMs: r ? r.latencyMs : null, checkedAt: r ? r.at : null, error: r?.error ?? null,
    };
  });
  const known = services.filter((s) => s.state !== "unknown");
  const down = known.filter((s) => s.state === "down").length;
  const overall = !known.length ? "unknown" : down === 0 ? "operational" : down === known.length ? "major" : "partial";
  const times = known.map((s) => s.checkedAt!).filter((t) => t !== null);
  return { overall, services, checkedAt: times.length ? Math.max(...times) : null };
}

export function headline(s: Summary): string {
  const down = s.services.filter((x) => x.state === "down").length;
  switch (s.overall) {
    case "operational": return "All systems operational";
    case "partial": return down === 1 ? "One service is down" : `${down} services are down`;
    case "major": return "Every service is down";
    default: return "Waiting for the first checks";
  }
}

/** "12 s ago", "3 min ago": how long since `then`, for humans. */
export function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
