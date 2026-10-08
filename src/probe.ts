// One check of one monitor: a GET request, timed, classified by the status code it returns.

import type { Monitor } from "./monitors.ts";

export type CheckResult = {
  monitor: string;
  /** When the check started, in milliseconds since the epoch. */
  at: number;
  ok: boolean;
  /** HTTP status, or null when no response arrived. */
  status: number | null;
  latencyMs: number;
  /** Why the check failed, in a few words; null when it passed. */
  error: string | null;
};

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "Beacon uptime monitor (+https://beacon.nestagents.dev)";

export async function probe(monitor: Monitor, fetcher: Fetcher = fetch, now: () => number = Date.now): Promise<CheckResult> {
  const at = now();
  const timeoutMs = monitor.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const expect = monitor.expect ?? { min: 200, max: 399 };
  try {
    const res = await fetcher(monitor.url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, "cache-control": "no-cache" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.max(0, now() - at);
    // The body is not needed; release it so the connection can be reused.
    await res.body?.cancel().catch(() => undefined);
    const ok = res.status >= expect.min && res.status <= expect.max;
    return { monitor: monitor.id, at, ok, status: res.status, latencyMs, error: ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    const latencyMs = Math.max(0, now() - at);
    const name = (e as { name?: string })?.name;
    const error = name === "TimeoutError" || name === "AbortError" ? `No response within ${Math.round(timeoutMs / 1000)} s` : `Request failed: ${String((e as Error)?.message ?? e).slice(0, 160)}`;
    return { monitor: monitor.id, at, ok: false, status: null, latencyMs, error };
  }
}
