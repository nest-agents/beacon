// A compact, self-contained SVG status badge for README embeds.

import type { ServiceState } from "./summary.ts";

const BADGE_WIDTH = 196;
const NAME_WIDTH = 108;

const STATE = {
  up: { label: "Operational", color: "#1f4fff" },
  down: { label: "Down", color: "#d0103a" },
  unknown: { label: "No data", color: "#6b7280" },
} as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]!);

/** Render a fixed-size badge; the clipped name area keeps any service name inside the SVG. */
export function renderBadge(name: string, state: ServiceState): string {
  const status = STATE[state];
  const accessibleName = `${name}: ${status.label}`;
  // Scale longer names to the available width. The clip remains a hard boundary for wide glyphs.
  const textLength = Math.min(NAME_WIDTH, Math.max(1, Array.from(name).length * 6.1));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="20" viewBox="0 0 ${BADGE_WIDTH} 20" role="img" aria-label="${esc(accessibleName)}">
  <title>${esc(accessibleName)}</title>
  <defs><clipPath id="name-clip"><rect x="6" y="0" width="${NAME_WIDTH}" height="20" /></clipPath></defs>
  <rect width="${BADGE_WIDTH}" height="20" rx="3" fill="#343a40" />
  <path d="M118 0h75a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3h-75z" fill="${status.color}" />
  <text x="7" y="14" clip-path="url(#name-clip)" textLength="${textLength}" lengthAdjust="spacingAndGlyphs" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="10">${esc(name)}</text>
  <text x="155" y="14" text-anchor="middle" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700">${status.label}</text>
</svg>`;
}
