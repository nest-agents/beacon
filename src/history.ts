// A service's recent history for humans: the strip of its last checks and its uptime over the last 24 hours.
// Pure: it works from stored results and the current time, and never touches storage.

import type { CheckResult } from "./probe.ts";

/** The strip shows this many checks, however many are stored. */
export const HISTORY_BARS = 90;
/** The uptime percentage covers checks from this long before now. */
export const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ServiceHistory = {
  /** The last HISTORY_BARS results, oldest first. */
  bars: { at: number; ok: boolean; error: string | null }[];
  /** Share of checks in the last 24 hours that passed, to one decimal place; null when there were none. */
  uptime: number | null;
};

/** The last `count` results by time, oldest first. Results may arrive in any order. */
export function lastResults(results: CheckResult[], count: number): CheckResult[] {
  const sorted = [...results].sort((a, b) => a.at - b.at);
  return sorted.slice(Math.max(0, sorted.length - count));
}

/** Percentage of results in the window that passed, rounded to one decimal place; null when the window is empty. */
export function uptimePercent(results: CheckResult[], now: number, windowMs = UPTIME_WINDOW_MS): number | null {
  const inWindow = results.filter((r) => r.at >= now - windowMs);
  if (inWindow.length === 0) return null;
  const passed = inWindow.filter((r) => r.ok).length;
  return Math.round((passed * 1000) / inWindow.length) / 10;
}

export function serviceHistory(results: CheckResult[], now: number): ServiceHistory {
  return {
    bars: lastResults(results, HISTORY_BARS).map((r) => ({ at: r.at, ok: r.ok, error: r.error })),
    uptime: uptimePercent(results, now),
  };
}
