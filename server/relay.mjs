// dashboard-toolkit relay — a small, dependency-free Node server that turns
// webhooks (and anything else that calls ingest()) into the toolkit's feed
// protocol, so a browser dashboard can read them by polling or SSE.
//
//   POST /webhook                 receive records (see "Webhook bodies" below)
//   GET  /snapshot                entities, recent records, alerts, header, views
//   GET  /records?after=<seq>     records since a cursor, plus the alert list
//   GET  /stream?after=<seq>      Server-Sent Events: replay since the cursor, then live
//   GET  /entities/:id/history    ?limit=n
//   POST /alerts/:id/ack
//   POST /alerts/ack-all
//
// Webhook bodies (JSON): a record, an array of records, { records: [...] },
// a CloudEvent, or an array of CloudEvents. A record needs entityId; seq and
// ts are filled in, and severity is computed from the entity's limits when
// missing. Pass `mapWebhook` to accept any other shape.
//
// Usage:
//   import { createRelay } from "./server/relay.mjs";
//   const relay = createRelay({ entities, token: process.env.WEBHOOK_TOKEN });
//   http.createServer(relay.handle).listen(8790);

const SEV_RANK = { normal: 0, offline: 1, fault: 1, warning: 2, alarm: 3 };

function evaluate(limits, value) {
  if (value == null) return { severity: "offline" };
  if (!limits || typeof value !== "number") return { severity: "normal" };
  if (limits.hi) {
    if (value >= limits.hi[1]) return { severity: "alarm", dir: "hi", limit: limits.hi[1] };
    if (value >= limits.hi[0]) return { severity: "warning", dir: "hi", limit: limits.hi[0] };
  }
  if (limits.lo) {
    if (value <= limits.lo[1]) return { severity: "alarm", dir: "lo", limit: limits.lo[1] };
    if (value <= limits.lo[0]) return { severity: "warning", dir: "lo", limit: limits.lo[0] };
  }
  return { severity: "normal" };
}

const isCloudEvent = x => x && typeof x === "object" && "specversion" in x && "type" in x;
const ALARM = /fail|error|incident\.opened|breach/i;
const WARN = /roll(ed)?_?back|degraded|retry|cancel/i;

function fromCloudEvent(ce) {
  const status = ce.data?.status;
  const text = `${ce.type} ${status ?? ""}`;
  return {
    entityId: ce.subject || ce.source,
    ts: ce.time,
    kind: ce.type,
    status,
    severity: ce.data?.severity || (ALARM.test(text) ? "alarm" : WARN.test(text) ? "warning" : "normal"),
    message: ce.data?.message,
    value: typeof ce.data?.value === "number" ? ce.data.value : undefined,
    data: ce,
  };
}

export function createRelay(opts = {}) {
  const prefix = (opts.prefix ?? "").replace(/\/$/, "");
  const historyLimit = opts.historyLimit ?? 300;
  const bufferLimit = opts.bufferLimit ?? 5000;
  const entities = new Map((opts.entities || []).map(e => [e.id, e]));
  const buffer = [];
  const history = new Map();
  const alerts = new Map();
  const clients = new Set();
  let seq = 0, alertSeq = 0;

  function applyAlert(r) {
    const existing = alerts.get(r.entityId);
    if (r.severity !== "normal") {
      const priority = r.severity === "offline" ? "fault" : r.severity;
      const ev = evaluate(entities.get(r.entityId)?.limits, r.value);
      if (!existing) {
        alerts.set(r.entityId, {
          id: `ALM-${String(++alertSeq).padStart(5, "0")}`, entityId: r.entityId, priority, state: "active", acked: false,
          raisedAt: r.ts, updatedAt: r.ts, clearedAt: null, value: r.value ?? null, peak: r.value ?? null,
          dir: ev.dir ?? null, limit: ev.limit ?? null, message: r.message,
        });
        return;
      }
      if (SEV_RANK[priority] > SEV_RANK[existing.priority]) { existing.priority = priority; existing.acked = false; }
      if (existing.state === "rtn") { existing.state = "active"; existing.acked = false; existing.clearedAt = null; }
      existing.value = r.value ?? null;
      if (typeof r.value === "number" && ev.dir === "hi") existing.peak = Math.max(existing.peak ?? -Infinity, r.value);
      if (typeof r.value === "number" && ev.dir === "lo") existing.peak = Math.min(existing.peak ?? Infinity, r.value);
      existing.updatedAt = r.ts;
      if (r.message) existing.message = r.message;
    } else if (existing && existing.state === "active") {
      existing.state = "rtn";
      existing.clearedAt = r.ts;
      if (existing.acked) alerts.delete(r.entityId);
    }
  }

  const alertList = () => [...alerts.values()];

  /** Add records from any source; returns the stored records */
  function ingest(input) {
    const list = (Array.isArray(input) ? input : [input]).filter(Boolean);
    const stored = [];
    for (const raw of list) {
      const r0 = isCloudEvent(raw) ? fromCloudEvent(raw) : raw;
      if (!r0.entityId) continue;
      if (!entities.has(r0.entityId) && opts.autoEntities !== false) {
        entities.set(r0.entityId, { id: r0.entityId, name: r0.entityId, type: r0.kind || "event", category: opts.defaultCategory || "events", group: opts.defaultGroup || "webhooks" });
      }
      const ent = entities.get(r0.entityId);
      const r = {
        ...r0,
        seq: ++seq,
        ts: r0.ts || new Date().toISOString(),
        severity: r0.severity || evaluate(ent?.limits, r0.value).severity,
      };
      buffer.push(r);
      if (buffer.length > bufferLimit) buffer.splice(0, buffer.length - bufferLimit);
      const h = history.get(r.entityId) || [];
      h.push(r);
      if (h.length > historyLimit) h.shift();
      history.set(r.entityId, h);
      applyAlert(r);
      stored.push(r);
    }
    if (stored.length) {
      const msg = `data: ${JSON.stringify({ records: stored, alerts: alertList() })}\n\n`;
      clients.forEach(res => res.write(msg));
    }
    return stored;
  }

  function upsertEntities(list) {
    list.forEach(e => entities.set(e.id, e));
  }

  const send = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json", ...cors });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const cors = {
    "access-control-allow-origin": opts.corsOrigin ?? "*",
    "access-control-allow-headers": "content-type, authorization, x-webhook-token",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  const readBody = req => new Promise((resolve, reject) => {
    let s = "";
    req.on("data", c => { s += c; if (s.length > 5e6) reject(new Error("body too large")); });
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });

  async function handle(req, res) {
    const url = new URL(req.url, "http://relay");
    if (!url.pathname.startsWith(prefix)) return false;
    const path = url.pathname.slice(prefix.length) || "/";
    if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return true; }
    try {
      if (req.method === "POST" && path === "/webhook") {
        if (opts.token && req.headers["x-webhook-token"] !== opts.token && req.headers.authorization !== `Bearer ${opts.token}`) {
          send(res, 401, { error: "bad token" }); return true;
        }
        const body = JSON.parse((await readBody(req)) || "null");
        const mapped = opts.mapWebhook ? opts.mapWebhook(body, req.headers) : body;
        if (mapped && mapped.entities) upsertEntities(mapped.entities);
        const stored = ingest(mapped && Array.isArray(mapped.records) ? mapped.records : mapped);
        send(res, 202, { accepted: stored.length, lastSeq: seq });
        return true;
      }
      if (req.method === "GET" && path === "/snapshot") {
        send(res, 200, { entities: [...entities.values()], records: buffer.slice(-400), alerts: alertList(), header: opts.header, views: opts.views, clock: new Date().toISOString() });
        return true;
      }
      if (req.method === "GET" && path === "/records") {
        const after = Number(url.searchParams.get("after") || 0);
        const limit = Number(url.searchParams.get("limit") || 800);
        send(res, 200, { records: buffer.filter(r => r.seq > after).slice(-limit), alerts: alertList(), clock: new Date().toISOString() });
        return true;
      }
      if (req.method === "GET" && path === "/stream") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", ...cors });
        const after = Number(url.searchParams.get("after") || 0);
        const missed = buffer.filter(r => r.seq > after);
        res.write(`retry: 2000\n\n`);
        if (missed.length) res.write(`data: ${JSON.stringify({ records: missed, alerts: alertList() })}\n\n`);
        clients.add(res);
        const ping = setInterval(() => res.write(": ping\n\n"), 15000);
        req.on("close", () => { clearInterval(ping); clients.delete(res); });
        return true;
      }
      const hist = path.match(/^\/entities\/([^/]+)\/history$/);
      if (req.method === "GET" && hist) {
        const limit = Number(url.searchParams.get("limit") || 180);
        send(res, 200, (history.get(decodeURIComponent(hist[1])) || []).slice(-limit));
        return true;
      }
      const ack = path.match(/^\/alerts\/([^/]+)\/ack$/);
      if (req.method === "POST" && ack) {
        for (const [k, a] of alerts) if (a.id === decodeURIComponent(ack[1])) { a.acked = true; if (a.state === "rtn") alerts.delete(k); }
        send(res, 200, { ok: true });
        return true;
      }
      if (req.method === "POST" && path === "/alerts/ack-all") {
        for (const [k, a] of alerts) { a.acked = true; if (a.state === "rtn") alerts.delete(k); }
        send(res, 200, { ok: true });
        return true;
      }
      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, 400, { error: String(err.message || err) });
    }
    return true;
  }

  return { handle, ingest, upsertEntities, alerts: alertList, get lastSeq() { return seq; } };
}
