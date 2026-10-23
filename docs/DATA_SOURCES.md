# Data sources

A dashboard gets its data from one `DataSource`. Swap the source and nothing
else changes.

| Kind | Use it for | Create with |
|---|---|---|
| `simulator` | Demos, prototypes, tests, offline work | `createSimulator()` |
| `polling` | Any REST service; simplest to run behind proxies | `pollingSource()` |
| `sse` | Server push over plain HTTP; resumes from the last record | `sseSource()` |
| `websocket` | Existing WebSocket feeds; two-way subscribe messages | `webSocketSource()` |
| `webhook` | Systems that send webhooks (CI/CD, IoT platforms, alerting tools) | the relay + `createSource({ kind: "webhook" })` |
| `manual` | Records you receive yourself (postMessage, BroadcastChannel, an SDK callback) | `manualSource()` |

`createSource(spec)` builds any of them from a plain object.
`sourceKindFromUrl(default)` reads `?source=`, so one build can run against
the simulator or a live service:

```ts
const source = createSource(
  sourceKindFromUrl("simulator") === "simulator"
    ? { kind: "simulator", entities, scenarios }
    : { kind: sourceKindFromUrl("polling") as "polling" | "sse" | "webhook", baseUrl: "/api", managesAlerts: true },
);
```

## The contract

```ts
interface DataSource {
  load(): Promise<SourceSnapshot>;                 // once, at start
  subscribe(h: SourceHandlers): () => void;        // batches until stopped
  history?(entityId: string, limit: number): Promise<DataRecord[]>;
  acknowledge?(alertId: string): Promise<void>;
  acknowledgeAll?(): Promise<void>;
  readonly managesAlerts?: boolean;
}

interface SourceSnapshot { entities; records?; alerts?; header?; views?; clock? }
interface SourceBatch    { records; alerts?; entities?; clock? }
interface SourceHandlers { onBatch(batch); onStatus(status, error?) }
```

**Who owns alerts.**
- *Client:* if `managesAlerts` is false (the default) and batches carry no
  `alerts`, the dashboard runs its own alert engine on record severities.
- *Server:* if the source manages alerts, batches carry the full alert
  list, and acknowledgements are sent to the server. The dashboard marks
  them acked straight away, and the next batch confirms.

**Connection status** shows in the status bar:
- `connected`
- `reconnecting`, with the error as a tooltip
- `error`, if loading failed

Polling, SSE and WebSocket sources back off exponentially with jitter (1 s,
2 s, 4 s … capped at 30 s).

## Simulator

```ts
createSimulator({
  entities,            // SimEntity: Entity + sim: { base, noise, period }
  scenarios,           // { id, title, window: [s, e], effects: [...] }
  loopSeconds: 600,
  startAt: 60,         // loop second that "now" lands on
  warmup: 60,          // seconds of history generated before now
  tickMs: 500,
  events: ctx => {},   // emit workflow-style records each tick
  severityOf: (e, v) => …,   // default: evaluate e.limits
});
```

- **Effects:**
  - `plateau`: smooth rise, hold, then fall, adding `delta`
  - `ramp`: linear across the window
  - `offline`: reports `null`, so NO DATA
  - Any effect can set its own `at: [start, end]`.
- **Noise** is deterministic per entity, so loops repeat exactly.
- **Binary entities** (with `binary: [off, on]`) snap to 0 or 1.
- **Controls:**
  - `setSpeed(n)`
  - `seek(loopSecond)`, which never rewinds timestamps
  - `clock()` returns `{ t, loopT, loopSeconds, speed, active }`
- **`events(ctx)`** gets `t`, `loopT`, a seeded `random()` and `emit()`.
  The release-matrix example uses it to generate builds and deployments.

## REST polling

```ts
pollingSource({
  baseUrl: "/api",
  intervalMs: 1000,
  managesAlerts: true,
  headers: { authorization: `Bearer ${token}` },
  paths: { records: "/v2/readings" },        // override any endpoint
  mappers: { record: raw => ({ … }) },        // adapt any wire format
});
```

## Server-Sent Events

```ts
sseSource({ baseUrl: "/api", streamPath: "/stream", events: ["message"], resumeParam: "after" });
```

The snapshot comes over REST. The stream URL gets `?after=<last seq>`, so a
reconnect replays what was missed, and the relay honours it. Messages can
be a batch `{ records, alerts?, clock? }`, an array of records or a single
record.

## WebSocket

```ts
webSocketSource({
  baseUrl: "/api",                          // snapshot, history and acks over REST
  url: "/ws",                               // or wss://…
  hello: last => ({ subscribe: viewHash, after: last }),
});
```

Messages take the same shapes as SSE. `hello` is sent on every (re)connect.

## Webhooks and the relay

Webhooks are server-to-server, so the toolkit includes `server/relay.mjs`. It
is a Node module with no dependencies that receives webhooks and serves them
over the same protocol as the polling and SSE sources:

```js
import http from "node:http";
import { createRelay } from "./server/relay.mjs";

const relay = createRelay({
  prefix: "/api",
  entities,                         // optional; unknown ids are auto-created
  token: process.env.WEBHOOK_TOKEN, // X-Webhook-Token or Authorization: Bearer
  mapWebhook: (body, headers) => body, // adapt GitHub, PagerDuty, IoT payloads…
});
http.createServer(async (req, res) => {
  if (!(await relay.handle(req, res))) { res.writeHead(404); res.end(); } // outside the prefix
}).listen(8790);
```

```sh
# a reading
curl -X POST http://127.0.0.1:8790/api/webhook -H 'content-type: application/json' \
  -H 'x-webhook-token: demo' -d '{"entityId":"PT-101","value":182}'

# a CloudEvent
curl -X POST http://127.0.0.1:8790/api/webhook -H 'content-type: application/json' \
  -H 'x-webhook-token: demo' \
  -d '{"specversion":"1.0","id":"1","source":"ci","type":"deployment.finished","subject":"payments-api@prod","data":{"status":"failed"}}'
```

**What the relay does**
- **Accepts:** a record, an array of records, `{ records }`, a CloudEvent
  or an array of CloudEvents.
- **Fills in:** `seq` and `ts`, and severity from the entity's limits when
  the record has none.
- **Alerts:** runs the same alert lifecycle as the client and keeps the
  alert list.
- **Serves:** a ring of recent records and per-entity history.
- **Pushes:** to every open SSE stream.

In the browser, use `createSource({ kind: "webhook", baseUrl: "/api" })`.
That is an SSE source with `managesAlerts: true`; pass
`transport: "polling"` to poll instead. Code that receives data some other
way can call `relay.ingest(records)` directly.

The relay is meant for demos, development and small deployments. It keeps
everything in memory. Production would put the same protocol in front of a
durable store and an authenticated webhook endpoint.

## Wire protocol

All paths are relative to `baseUrl`; each can be overridden with `paths`.

| Method | Path | Returns |
|---|---|---|
| GET | `/snapshot` | `{ entities, records?, alerts?, header?, views?, clock? }` |
| GET | `/records?after=<seq>&limit=<n>` | `{ records, alerts?, clock? }` — records with `seq > after`, oldest first |
| GET | `/stream?after=<seq>` | `text/event-stream`; each `data:` is a batch |
| GET | `/entities/:id/history?limit=<n>` | `DataRecord[]`, oldest first |
| POST | `/alerts/:id/ack` | `{ ok: true }` |
| POST | `/alerts/ack-all` | `{ ok: true }` |
| POST | `/webhook` (relay only) | `202 { accepted, lastSeq }` |

`seq` must increase strictly across the whole feed. The dashboard drops any
record at or below the highest `seq` it has seen.

## Mappers

`mappers: { entity, record, alert }` adapt foreign payloads at the edge.
`cloudEventMapper()` turns CloudEvents 1.0 envelopes, the release dashboard's
format, into records:
- `entityId` from `subject`, falling back to `source`
- `status` from `data.status`
- **severity:** `failed`, `error` or `incident.opened` → alarm;
  `rolled_back`, `degraded` or `retry` → warning
- the original envelope kept in `data`

## Writing a source

Implement `load` and `subscribe`. The rest is optional.

```ts
const mqttSource = (client: MqttClient, entities: Entity[]): DataSource => ({
  async load() { return { entities }; },
  subscribe({ onBatch, onStatus }) {
    let seq = 0;
    client.on("connect", () => onStatus("connected"));
    client.on("offline", () => onStatus("reconnecting", "broker offline"));
    client.on("message", (topic, buf) => {
      const m = JSON.parse(buf.toString());
      onBatch({ records: [{ seq: ++seq, ts: m.ts, entityId: topic, value: m.v, severity: "normal" }] });
    });
    client.subscribe("site/+/readings");
    return () => client.end();
  },
});
```

If the source can't compute severity, use `evaluateLimits(entity.limits,
value).severity` from the core.
