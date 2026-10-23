// REST client shared by the polling, SSE and WebSocket sources, plus the
// polling source itself.
//
// Default endpoints (all relative to baseUrl; override any of them):
//
//   GET  /snapshot                 → { entities, records?, alerts?, header?, views?, clock? }
//   GET  /records?after=<seq>      → { records, alerts?, clock? }
//   GET  /entities/:id/history     → DataRecord[]            (?limit=n)
//   POST /alerts/:id/ack
//   POST /alerts/ack-all

import type { DataRecord } from "../types";
import type { DataSource, Mappers, SourceBatch, SourceHandlers, SourceSnapshot } from "./types";
import { backoff } from "./types";

export interface RestOptions {
  baseUrl: string;
  paths?: Partial<{
    snapshot: string;
    records: string;
    history: string;   // may contain :id
    ack: string;       // may contain :id
    ackAll: string;
  }>;
  headers?: Record<string, string>;
  /** Set when the server owns the alert list (it returns `alerts`) */
  managesAlerts?: boolean;
  mappers?: Mappers;
  fetch?: typeof fetch;
}

const DEFAULT_PATHS = {
  snapshot: "/snapshot",
  records: "/records",
  history: "/entities/:id/history",
  ack: "/alerts/:id/ack",
  ackAll: "/alerts/ack-all",
};

export class RestClient {
  readonly paths: typeof DEFAULT_PATHS;
  private f: typeof fetch;

  constructor(readonly opts: RestOptions) {
    this.paths = { ...DEFAULT_PATHS, ...opts.paths };
    this.f = opts.fetch || ((...a) => fetch(...a));
  }

  url(path: string, params?: Record<string, string | number>): string {
    const u = new URL(this.opts.baseUrl.replace(/\/$/, "") + path, typeof location !== "undefined" ? location.href : "http://localhost/");
    Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    return u.toString();
  }

  async json<T>(path: string, params?: Record<string, string | number>, init: RequestInit = {}): Promise<T> {
    const r = await this.f(this.url(path, params), { ...init, headers: { accept: "application/json", ...this.opts.headers, ...init.headers } });
    if (!r.ok) throw new Error(`${init.method || "GET"} ${path}: ${r.status}`);
    const text = await r.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  mapBatch(raw: any): SourceBatch {
    const m = this.opts.mappers || {};
    return {
      records: (raw.records || []).map(m.record || ((x: any) => x)),
      alerts: raw.alerts ? raw.alerts.map(m.alert || ((x: any) => x)) : undefined,
      entities: raw.entities ? raw.entities.map(m.entity || ((x: any) => x)) : undefined,
      clock: raw.clock,
    };
  }

  async snapshot(): Promise<SourceSnapshot> {
    const raw = await this.json<any>(this.paths.snapshot);
    const m = this.opts.mappers || {};
    return {
      ...raw,
      entities: (raw.entities || []).map(m.entity || ((x: any) => x)),
      records: raw.records ? raw.records.map(m.record || ((x: any) => x)) : undefined,
      alerts: raw.alerts ? raw.alerts.map(m.alert || ((x: any) => x)) : undefined,
    };
  }

  async history(entityId: string, limit: number): Promise<DataRecord[]> {
    const raw = await this.json<any[]>(this.paths.history.replace(":id", encodeURIComponent(entityId)), { limit });
    return raw.map(this.opts.mappers?.record || (x => x));
  }

  async acknowledge(alertId: string): Promise<void> {
    await this.json(this.paths.ack.replace(":id", encodeURIComponent(alertId)), undefined, { method: "POST" });
  }

  async acknowledgeAll(): Promise<void> {
    await this.json(this.paths.ackAll, undefined, { method: "POST" });
  }
}

export interface PollingOptions extends RestOptions {
  /** Poll interval; default 1000 ms */
  intervalMs?: number;
}

/** Polls GET /records?after=<seq> on an interval, backing off on errors. */
export function pollingSource(opts: PollingOptions): DataSource & { client: RestClient } {
  const client = new RestClient(opts);
  let cursor = 0;
  return {
    client,
    managesAlerts: opts.managesAlerts,
    async load() {
      const snap = await client.snapshot();
      cursor = Math.max(0, ...(snap.records || []).map(r => r.seq));
      return snap;
    },
    subscribe({ onBatch, onStatus }: SourceHandlers) {
      let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, failures = 0;
      const tick = async () => {
        try {
          const raw = await client.json<any>(client.paths.records, { after: cursor });
          if (stopped) return;
          const batch = client.mapBatch(raw);
          if (batch.records.length) cursor = Math.max(cursor, ...batch.records.map(r => r.seq));
          if (failures) onStatus("connected");
          failures = 0;
          onBatch(batch);
          timer = setTimeout(tick, opts.intervalMs ?? 1000);
        } catch (err) {
          if (stopped) return;
          failures++;
          onStatus("reconnecting", String(err));
          timer = setTimeout(tick, backoff(failures - 1));
        }
      };
      onStatus("connected");
      timer = setTimeout(tick, opts.intervalMs ?? 1000);
      return () => { stopped = true; clearTimeout(timer); };
    },
    history: (id, limit) => client.history(id, limit),
    acknowledge: id => client.acknowledge(id),
    acknowledgeAll: () => client.acknowledgeAll(),
  };
}

