// Push sources: Server-Sent Events and WebSocket. Both load the snapshot over
// REST, then receive messages in either of these shapes:
//
//   { "records": [...], "alerts": [...]?, "clock": "..."? }   a batch
//   { "seq": 1, "ts": "...", "entityId": "...", ... }         a single record
//
// Reconnects back off exponentially. On reconnect the snapshot is not
// reloaded; use `resumeParam` so the server can replay from the last seq.

import type { DataSource, SourceHandlers } from "./types";
import { backoff } from "./types";
import { RestClient, type RestOptions } from "./rest";

function toBatch(client: RestClient, msg: any) {
  if (Array.isArray(msg)) return client.mapBatch({ records: msg });
  if (msg && Array.isArray(msg.records)) return client.mapBatch(msg);
  return client.mapBatch({ records: [msg] });
}

export interface SseOptions extends RestOptions {
  /** Stream URL, relative to baseUrl; default "/stream" */
  streamPath?: string;
  /** Named events to listen for; default the unnamed "message" event */
  events?: string[];
  /** Query parameter carrying the last seq on reconnect; default "after" */
  resumeParam?: string;
  withCredentials?: boolean;
}

export function sseSource(opts: SseOptions): DataSource & { client: RestClient } {
  const client = new RestClient(opts);
  let last = 0;
  return {
    client,
    managesAlerts: opts.managesAlerts,
    async load() {
      const snap = await client.snapshot();
      last = Math.max(0, ...(snap.records || []).map(r => r.seq));
      return snap;
    },
    subscribe({ onBatch, onStatus }: SourceHandlers) {
      let es: EventSource | undefined, stopped = false, attempt = 0, timer: ReturnType<typeof setTimeout> | undefined;
      const open = () => {
        es = new EventSource(client.url(opts.streamPath || "/stream", { [opts.resumeParam || "after"]: last }),
          { withCredentials: opts.withCredentials });
        const handle = (ev: MessageEvent) => {
          const batch = toBatch(client, JSON.parse(ev.data));
          if (batch.records.length) last = Math.max(last, ...batch.records.map(r => r.seq));
          onBatch(batch);
        };
        (opts.events || ["message"]).forEach(name => es!.addEventListener(name, handle as EventListener));
        es.onopen = () => { attempt = 0; onStatus("connected"); };
        es.onerror = () => {
          es?.close();
          if (stopped) return;
          onStatus("reconnecting", "stream interrupted");
          timer = setTimeout(open, backoff(attempt++));
        };
      };
      open();
      return () => { stopped = true; clearTimeout(timer); es?.close(); };
    },
    history: (id, limit) => client.history(id, limit),
    acknowledge: id => client.acknowledge(id),
    acknowledgeAll: () => client.acknowledgeAll(),
  };
}

export interface WebSocketOptions extends RestOptions {
  /** Absolute ws(s):// URL, or a path resolved against baseUrl */
  url: string;
  /** Sent after connecting, e.g. a subscribe message with a view hash */
  hello?: (last: number) => unknown;
  protocols?: string | string[];
}

export function webSocketSource(opts: WebSocketOptions): DataSource & { client: RestClient } {
  const client = new RestClient(opts);
  let last = 0;
  const wsUrl = () => {
    if (/^wss?:/.test(opts.url)) return opts.url;
    return client.url(opts.url).replace(/^http/, "ws");
  };
  return {
    client,
    managesAlerts: opts.managesAlerts,
    async load() {
      const snap = await client.snapshot();
      last = Math.max(0, ...(snap.records || []).map(r => r.seq));
      return snap;
    },
    subscribe({ onBatch, onStatus }: SourceHandlers) {
      let ws: WebSocket | undefined, stopped = false, attempt = 0, timer: ReturnType<typeof setTimeout> | undefined;
      const open = () => {
        ws = new WebSocket(wsUrl(), opts.protocols);
        ws.onopen = () => {
          attempt = 0;
          onStatus("connected");
          if (opts.hello) ws!.send(JSON.stringify(opts.hello(last)));
        };
        ws.onmessage = ev => {
          const batch = toBatch(client, JSON.parse(String(ev.data)));
          if (batch.records.length) last = Math.max(last, ...batch.records.map(r => r.seq));
          onBatch(batch);
        };
        ws.onclose = () => {
          if (stopped) return;
          onStatus("reconnecting", "socket closed");
          timer = setTimeout(open, backoff(attempt++));
        };
      };
      open();
      return () => { stopped = true; clearTimeout(timer); ws?.close(); };
    },
    history: (id, limit) => client.history(id, limit),
    acknowledge: id => client.acknowledge(id),
    acknowledgeAll: () => client.acknowledgeAll(),
  };
}
