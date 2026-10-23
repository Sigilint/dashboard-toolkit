// Mock sensor/event service for the live-service example: the toolkit relay
// (server/relay.mjs) plus a generator that posts readings to itself every
// second. It also accepts real webhooks, so you can inject events by hand:
//
//   npm run mock-server            # http://127.0.0.1:8790/api
//
//   curl -X POST http://127.0.0.1:8790/api/webhook \
//     -H 'content-type: application/json' -H 'x-webhook-token: demo' \
//     -d '{"entityId":"PT-101","value":182}'
//
//   curl -X POST http://127.0.0.1:8790/api/webhook \
//     -H 'content-type: application/json' -H 'x-webhook-token: demo' \
//     -d '{"specversion":"1.0","id":"1","source":"ci","type":"deployment.finished","subject":"pump-controller","data":{"status":"failed","message":"health checks failed"}}'

import http from "node:http";
import { createRelay } from "../server/relay.mjs";

const PORT = Number(process.env.PORT || 8790);
const TOKEN = process.env.WEBHOOK_TOKEN || "demo";

const entities = [
  { id: "PT-101", name: "Inlet pressure", type: "PT", typeLabel: "Pressure transmitter", category: "process", group: "INLET", unit: "psi", dp: 0, limits: { hi: [150, 175] }, tags: { node: "RTU-1", link: "wired" } },
  { id: "FT-101", name: "Inlet flow", type: "FT", typeLabel: "Flow meter", category: "process", group: "INLET", unit: "gpm", dp: 0, limits: { lo: [300, 200] }, tags: { node: "RTU-1", link: "wired" } },
  { id: "VT-201", name: "Pump A vibration", type: "VT", typeLabel: "Vibration sensor", category: "equipment", group: "PUMPS", unit: "in/s", dp: 2, limits: { hi: [0.5, 0.8] }, tags: { node: "RTU-2", link: "wired" } },
  { id: "TT-201", name: "Pump A bearing temp", type: "TT", typeLabel: "Temperature", category: "equipment", group: "PUMPS", unit: "°F", dp: 0, limits: { hi: [180, 200] }, tags: { node: "RTU-2", link: "wired" } },
  { id: "VT-202", name: "Pump B vibration", type: "VT", typeLabel: "Vibration sensor", category: "equipment", group: "PUMPS", unit: "in/s", dp: 2, limits: { hi: [0.5, 0.8] }, tags: { node: "RTU-2", link: "wired" } },
  { id: "LT-301", name: "Wet well level", type: "LT", typeLabel: "Level transmitter", category: "process", group: "WETWELL", unit: "ft", dp: 1, limits: { hi: [14, 17], lo: [3, 1.5] }, tags: { node: "RTU-3", link: "radio" } },
  { id: "GD-301", name: "Wet well H₂S", type: "GD", typeLabel: "Gas detector", category: "safety", group: "WETWELL", unit: "ppm", dp: 1, limits: { hi: [5, 10] }, tags: { node: "RTU-3", link: "radio" } },
  { id: "DR-401", name: "Control room door", type: "DR", typeLabel: "Door contact", category: "security", group: "BLDG", binary: ["CLOSED", "OPEN"], limits: { hi: [0.5, 0.5] }, tags: { node: "RTU-4", link: "cellular" } },
  { id: "pump-controller", name: "Pump controller firmware", type: "deploy", typeLabel: "Deployment", category: "software", group: "BLDG", tags: { repo: "acme/pump-controller" } },
];

const relay = createRelay({
  prefix: "/api",
  entities,
  token: TOKEN,
  header: { title: "LIFT STATION 7", subtitle: "Mock service", meta: [{ label: "relay", value: `127.0.0.1:${PORT}` }] },
  views: [{ id: "pumps", name: "Pumps", filters: { q: "", severity: "all", facets: { group: ["PUMPS"] } } }],
});

// Random walk with an occasional excursion on one sensor at a time
const base = { "PT-101": 120, "FT-101": 420, "VT-201": 0.22, "TT-201": 150, "VT-202": 0.2, "LT-301": 8, "GD-301": 0.4 };
const value = { ...base };
let excursion = null, t = 0;
setInterval(() => {
  t++;
  if (!excursion && Math.random() < 0.04) {
    const ids = Object.keys(base);
    const id = ids[Math.floor(Math.random() * ids.length)];
    const e = entities.find(x => x.id === id);
    const target = e.limits.hi ? e.limits.hi[0] + (e.limits.hi[1] - e.limits.hi[0]) * 1.3 : e.limits.lo[0] - (e.limits.lo[0] - e.limits.lo[1]) * 1.3;
    excursion = { id, target, until: t + 25 };
  }
  if (excursion && t > excursion.until) excursion = null;
  const records = Object.keys(base).map(id => {
    const goal = excursion?.id === id ? excursion.target : base[id];
    value[id] += (goal - value[id]) * 0.15 + (Math.random() - 0.5) * base[id] * 0.03;
    const e = entities.find(x => x.id === id);
    const f = 10 ** (e.dp ?? 1);
    return { entityId: id, value: Math.round(value[id] * f) / f, kind: "reading", quality: "GOOD" };
  });
  if (t % 45 === 0) records.push({ entityId: "DR-401", value: 1, kind: "door.opened" });
  if (t % 45 === 8) records.push({ entityId: "DR-401", value: 0, kind: "door.closed" });
  relay.ingest(records);
}, 1000);

http.createServer(async (req, res) => {
  if (!(await relay.handle(req, res))) { res.writeHead(404); res.end(); }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock service on http://127.0.0.1:${PORT}/api  (webhook token: ${TOKEN})`);
});
