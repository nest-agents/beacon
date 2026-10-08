// Which hosts may be indexed by search engines. Only production may be; every other host (a Preview) is noindex.

/** The host production Beacon is served from. Only this host may be indexed. */
export const PRODUCTION_HOST = "beacon.nestagents.dev";

/** Whether a request's host names production. Case, a trailing dot and a port do not change the answer. */
export function isProductionHost(host: string, production: string = PRODUCTION_HOST): boolean {
  const name = host.trim().toLowerCase().replace(/\.$/, "").replace(/:\d*$/, "");
  return name === production;
}

/** Headers to add to every response for a request URL: noindex unless the request is for production. */
export function indexingHeaders(requestUrl: string): Record<string, string> {
  return isProductionHost(new URL(requestUrl).hostname) ? {} : { "x-robots-tag": "noindex" };
}
