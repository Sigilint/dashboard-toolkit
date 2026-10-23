// One entry point for every kind of feed, so an app can switch between a
// simulation and a live service by configuration (or a ?source= parameter)
// without touching its UI.
//
//   simulator   in-browser scripted data               createSimulator()
//   polling     REST: GET /records?after=<seq>         pollingSource()
//   sse         Server-Sent Events: GET /stream        sseSource()
//   websocket   WebSocket messages                     webSocketSource()
//   webhook     webhooks POSTed to a relay, read over SSE (falls back to polling)
//   manual      records pushed from app code           manualSource()
//
// Browsers cannot receive webhooks, so "webhook" means: the sender POSTs to
// the toolkit's relay (server/relay.mjs), and the dashboard reads the relay's
// stream. The relay speaks the same protocol as the polling and SSE sources.

import type { DataRecord, Entity, Alert, HeaderInfo, View } from "../types";
import type { DataSource, SourceHandlers, SourceSnapshot, SourceBatch } from "./types";
import { pollingSource, type PollingOptions } from "./rest";
import { sseSource, webSocketSource, type SseOptions, type WebSocketOptions } from "./push";
import { createSimulator, type SimulatorOptions } from "./simulator";

export type SourceSpec =
  | ({ kind: "simulator" } & SimulatorOptions)
  | ({ kind: "polling" } & PollingOptions)
  | ({ kind: "sse" } & SseOptions)
  | ({ kind: "websocket" } & WebSocketOptions)
  | ({ kind: "webhook"; transport?: "sse" | "polling" } & SseOptions & PollingOptions)
  | ({ kind: "manual" } & ManualSourceOptions);

export type SourceKind = SourceSpec["kind"];

export function createSource(spec: SourceSpec): DataSource {
  switch (spec.kind) {
    case "simulator": return createSimulator(spec);
    case "polling": return pollingSource(spec);
    case "sse": return sseSource(spec);
    case "websocket": return webSocketSource(spec);
    case "webhook":
      return spec.transport === "polling"
        ? pollingSource({ managesAlerts: true, ...spec })
        : sseSource({ managesAlerts: true, ...spec });
    case "manual": return manualSource(spec);
  }
}

/** Reads ?source=<kind> (or another param) and falls back to the default */
export function sourceKindFromUrl(fallback: SourceKind, param = "source"): SourceKind {
  const v = typeof location !== "undefined" ? new URLSearchParams(location.search).get(param) : null;
  const kinds: SourceKind[] = ["simulator", "polling", "sse", "websocket", "webhook", "manual"];
  return v && (kinds as string[]).includes(v) ? (v as SourceKind) : fallback;
}

// ---------- manual source ----------

export interface ManualSourceOptions {
  entities: Entity[];
  records?: DataRecord[];
  alerts?: Alert[];
  header?: Partial<HeaderInfo>;
  views?: View[];
  managesAlerts?: boolean;
}

export interface ManualSource extends DataSource {
  /** Push records (seq and ts are filled in if missing) */
  push(records: (Partial<DataRecord> & Pick<DataRecord, "entityId" | "severity">)[], extra?: Omit<SourceBatch, "records">): void;
  /** Add or replace entities */
  upsertEntities(entities: Entity[]): void;
}

/**
 * A source the app feeds itself — from postMessage, a BroadcastChannel, a
 * third-party SDK callback, a test, or a webhook relay reached some other way.
 */
export function manualSource(opts: ManualSourceOptions): ManualSource {
  let handlers: SourceHandlers | undefined;
  let seq = Math.max(0, ...(opts.records || []).map(r => r.seq));
  const backlog: SourceBatch[] = [];
  const send = (b: SourceBatch) => (handlers ? handlers.onBatch(b) : backlog.push(b));
  return {
    managesAlerts: opts.managesAlerts,
    async load(): Promise<SourceSnapshot> {
      return { entities: opts.entities, records: opts.records, alerts: opts.alerts, header: opts.header, views: opts.views };
    },
    subscribe(h) {
      handlers = h;
      h.onStatus("connected");
      backlog.splice(0).forEach(b => h.onBatch(b));
      return () => { handlers = undefined; };
    },
    push(records, extra = {}) {
      send({
        ...extra,
        records: records.map(r => ({ ...r, seq: r.seq ?? ++seq, ts: r.ts ?? new Date().toISOString() }) as DataRecord),
      });
    },
    upsertEntities(entities) {
      send({ records: [], entities });
    },
  };
}
