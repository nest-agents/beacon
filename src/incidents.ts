// Incidents: when a service's failures are real enough to open one, and when it has recovered enough to close it.
// A pure rule over one service's checks, oldest first; the Ledger stores what it decides.

import type { CheckResult } from "./probe.ts";

/**
 * An incident opens when at least FAILURES of the last WINDOW checks failed. The window is five checks
 * (five minutes at one check a minute): three failures in it means the service is failing repeatedly, not
 * that one request was dropped, and a single dropped request can never reach the threshold on its own.
 * It closes when fewer than FAILURES of the last WINDOW checks fail, i.e. at least three of the last five
 * pass, so one lucky answer during an outage does not close it.
 */
export const WINDOW = 5;
export const FAILURES = 3;

export type Incident = {
  monitor: string;
  /** When the check that opened the incident ran. */
  openedAt: number;
  /** When the check that closed it ran; null while open. */
  closedAt: number | null;
  /** The error from the most recent failing check when it opened, e.g. "HTTP 503". */
  error: string;
};

export type Decision = { open: true; at: number; error: string } | { open: false; at: number } | null;

/**
 * Decide what the newest check changes. `recent` is one service's checks, oldest first, ending with the
 * newest; only its last WINDOW entries matter. `isOpen` says whether an incident is currently open.
 * Returns null when nothing changes.
 */
export function decide(recent: CheckResult[], isOpen: boolean): Decision {
  const window = recent.slice(-WINDOW);
  const newest = window[window.length - 1];
  if (!newest) return null;
  const failing = window.filter((r) => !r.ok);
  if (!isOpen && failing.length >= FAILURES) {
    const last = [...failing].reverse().find((r) => r.error) ?? failing[failing.length - 1]!;
    return { open: true, at: newest.at, error: last.error ?? "Check failed" };
  }
  if (isOpen && failing.length < FAILURES) return { open: false, at: newest.at };
  return null;
}
