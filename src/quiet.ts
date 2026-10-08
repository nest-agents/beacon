// Whether any incident opened recently. A pure helper: the status page uses it to say plainly when there
// have been no incidents, instead of showing nothing.

import type { Incident } from "./incidents.ts";

export const QUIET_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** True when no incident opened in the QUIET_WINDOW_MS before `now`. An incident that opened earlier does not count, even if it is still open. */
export function isQuiet(incidents: readonly Incident[], now: number): boolean {
  return !incidents.some((i) => i.openedAt >= now - QUIET_WINDOW_MS);
}
