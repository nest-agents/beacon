// Ledger: every check result, in one Durable Object's SQLite database. One instance per deployment;
// each Preview gets its own automatically.

import { DurableObject } from "cloudflare:workers";
import { MONITORS } from "./monitors.ts";
import { probe, type CheckResult } from "./probe.ts";

/** Checks run at most this often, however many requests or cron ticks ask for them. */
export const MIN_INTERVAL_MS = 30_000;
/** Results older than this are deleted. */
export const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

type Row = Record<string, SqlStorageValue>;

export class Ledger extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS checks(id INTEGER PRIMARY KEY AUTOINCREMENT, monitor TEXT NOT NULL, at INTEGER NOT NULL,
        ok INTEGER NOT NULL, status INTEGER, latency_ms INTEGER NOT NULL, error TEXT);
      CREATE INDEX IF NOT EXISTS checks_monitor_at ON checks(monitor, at);
      CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
    `);
  }

  /** Checks every monitor now, unless a run started less than MIN_INTERVAL_MS ago. */
  async runChecks(now = Date.now()): Promise<{ ran: boolean; results: CheckResult[] }> {
    const last = Number(this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'last_run'").toArray()[0]?.v ?? 0);
    if (now - last < MIN_INTERVAL_MS) return { ran: false, results: [] };
    this.sql.exec("INSERT INTO meta VALUES ('last_run', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", String(now));
    const results = await Promise.all(MONITORS.map((m) => probe(m)));
    for (const r of results)
      this.sql.exec("INSERT INTO checks(monitor, at, ok, status, latency_ms, error) VALUES (?, ?, ?, ?, ?, ?)", r.monitor, r.at, r.ok ? 1 : 0, r.status, r.latencyMs, r.error);
    this.sql.exec("DELETE FROM checks WHERE at < ?", now - RETENTION_MS);
    return { ran: true, results };
  }

  /** Each monitor's most recent result. */
  latest(): CheckResult[] {
    return this.sql.exec<Row>(
      "SELECT c.* FROM checks c JOIN (SELECT monitor, MAX(at) at FROM checks GROUP BY monitor) m ON c.monitor = m.monitor AND c.at = m.at",
    ).toArray().map(toResult);
  }
}

const toResult = (r: Row): CheckResult => ({
  monitor: String(r.monitor), at: Number(r.at), ok: Number(r.ok) === 1, status: r.status === null ? null : Number(r.status),
  latencyMs: Number(r.latency_ms), error: r.error === null ? null : String(r.error),
});
