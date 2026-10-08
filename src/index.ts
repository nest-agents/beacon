// Beacon: uptime monitor and public status page. Scaffold, replaced by the first real version.
export default {
  async fetch(): Promise<Response> {
    return new Response("Beacon is being set up.\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
  },
} satisfies ExportedHandler;
