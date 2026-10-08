// The services Beacon watches. Adding or changing one is a reviewed change like any other code.

export type Monitor = {
  /** Stable identifier: lowercase letters, digits and hyphens. Used in URLs and storage. */
  id: string;
  /** What humans call the service. */
  name: string;
  /** The URL Beacon requests with GET. */
  url: string;
  /** Status codes that count as up. Defaults to any 2xx or 3xx. */
  expect?: { min: number; max: number };
  /** Give up after this long. Defaults to 10 seconds. */
  timeoutMs?: number;
};

export const MONITORS: Monitor[] = [
  { id: "nest", name: "Nest", url: "https://nestagents.dev/" },
  { id: "nest-api", name: "Nest API", url: "https://nestagents.dev/api/projects", expect: { min: 200, max: 299 } },
  { id: "cloudflare-docs", name: "Cloudflare Docs", url: "https://developers.cloudflare.com/" },
  { id: "cloudflare", name: "Cloudflare", url: "https://www.cloudflare.com/", expect: { min: 200, max: 399 } },
  { id: "cloudflare-status", name: "Cloudflare Status", url: "https://www.cloudflarestatus.com/api/v2/status.json", expect: { min: 200, max: 299 } },
  { id: "cloudflare-api", name: "Cloudflare API", url: "https://api.cloudflare.com/client/v4/ips", expect: { min: 200, max: 299 } },
];
