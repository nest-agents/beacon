// How fast a service answers over the last 24 hours: its median (p50) and slowest common case (p95) latency.
// Pure: it works from stored results and the current time.

import type { CheckResult } from "./probe.ts";
import { UPTIME_WINDOW_MS } from "./history.ts";

export type Latency = { p50: number; p95: number };

/**
 * The nearest-rank percentile: the value at rank ceil(p/100 * n) in ascending order (1-based).
 * Returns the stored value itself, never an interpolation. `values` must be non-empty.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new RangeError("percentile of no values");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1]!;
}

/** p50 and p95 of the latencies of results from the last `windowMs`; null when the window is empty. */
export function latencyPercentiles(results: readonly CheckResult[], now: number, windowMs = UPTIME_WINDOW_MS): Latency | null {
  const latencies = results.filter((r) => r.at >= now - windowMs).map((r) => r.latencyMs);
  if (latencies.length === 0) return null;
  return { p50: percentile(latencies, 50), p95: percentile(latencies, 95) };
}
