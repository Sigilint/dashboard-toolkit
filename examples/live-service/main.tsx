// Live service example: the same dashboard fed by a real HTTP service. Pick
// the transport with ?source=polling | sse | webhook | simulator:
//
//   polling    GET /api/records?after=<seq> every second
//   sse        GET /api/stream (Server-Sent Events)
//   webhook    webhooks POSTed to the relay, read over its SSE stream
//   simulator  no server; the in-browser simulator with the same entities
//
// Run `npm run mock-server` first (the Vite dev server proxies /api to it).

import { createRoot } from "react-dom/client";
import { useState } from "react";
import "../../src/styles/toolkit.css";
import {
  createDashboard, createSource, sourceKindFromUrl, remoteViewStorage, localViewStorage, emptyFilters,
  DashboardProvider, DashboardApp, EntityTable, useDashboardState,
  type Category, type Group, type SourceKind, type SimEntity, type SourceSpec,
} from "../../src";

const categories: Category[] = [
  { key: "process", label: "Process", code: "P", shape: "square" },
  { key: "equipment", label: "Equipment", code: "Q", shape: "triangle" },
  { key: "safety", label: "Safety", code: "S", shape: "circle" },
  { key: "security", label: "Security", code: "X", shape: "diamond" },
  { key: "software", label: "Software", code: "D", shape: "hexagon" },
];
const groups: Group[] = [
  { key: "INLET", label: "Inlet", description: "Influent pressure and flow" },
  { key: "PUMPS", label: "Pump room", description: "Duty and standby pumps" },
  { key: "WETWELL", label: "Wet well", description: "Level and gas in the wet well" },
  { key: "BLDG", label: "Building", description: "Doors, controls and firmware" },
];

// Used only by ?source=simulator, so the page works with no server at all
const simEntities: SimEntity[] = [
  { id: "PT-101", name: "Inlet pressure", type: "PT", category: "process", group: "INLET", unit: "psi", dp: 0, limits: { hi: [150, 175] }, sim: { base: 120, noise: 8, period: 1 } },
  { id: "FT-101", name: "Inlet flow", type: "FT", category: "process", group: "INLET", unit: "gpm", dp: 0, limits: { lo: [300, 200] }, sim: { base: 420, noise: 20, period: 1 } },
  { id: "VT-201", name: "Pump A vibration", type: "VT", category: "equipment", group: "PUMPS", unit: "in/s", dp: 2, limits: { hi: [0.5, 0.8] }, sim: { base: 0.22, noise: 0.03, period: 1 } },
  { id: "LT-301", name: "Wet well level", type: "LT", category: "process", group: "WETWELL", unit: "ft", dp: 1, limits: { hi: [14, 17], lo: [3, 1.5] }, sim: { base: 8, noise: 0.5, period: 2 } },
  { id: "GD-301", name: "Wet well H₂S", type: "GD", category: "safety", group: "WETWELL", unit: "ppm", dp: 1, limits: { hi: [5, 10] }, sim: { base: 0.4, noise: 0.2, period: 1 } },
];

const kind = sourceKindFromUrl("polling");
const api = { baseUrl: "/api", managesAlerts: true };
const spec: SourceSpec =
  kind === "simulator" ? { kind, entities: simEntities, scenarios: [{ id: "h2s", title: "H₂S", window: [20, 80], effects: [{ entityId: "GD-301", kind: "plateau", delta: 9, rise: 10 }] }], loopSeconds: 120 }
  : kind === "sse" ? { kind, ...api }
  : kind === "webhook" ? { kind, ...api }
  : { kind: "polling", ...api, intervalMs: 1000 };

const dashboard = createDashboard({
  source: createSource(spec),
  categories,
  groups,
  header: { title: "LIFT STATION 7", subtitle: kind },
  views: {
    builtIn: [{ id: "all", name: "Everything", filters: emptyFilters() }],
    // A real service would keep views per user; the mock server doesn't store them
    storage: new URLSearchParams(location.search).has("remoteViews") ? remoteViewStorage("/api/views") : localViewStorage("live-service-views"),
  },
  derived: ({ state }) => [
    { key: "src", label: "Source", value: kind.toUpperCase(), severity: state.status === "connected" ? "normal" : "warning", detail: state.error || state.status },
    { key: "open", label: "Open alerts", value: String(state.alerts.length), severity: state.alerts.some(a => a.priority === "alarm" && a.state === "active") ? "alarm" : state.alerts.length ? "warning" : "normal", detail: "managed by the server" },
  ],
});

function SourcePicker() {
  const kinds: SourceKind[] = ["polling", "sse", "webhook", "simulator"];
  return (
    <div className="dt-rail-section">
      <label className="dt-rail-title" htmlFor="src">Data source</label>
      <select id="src" className="dt-input" value={kind}
              onChange={e => { const u = new URL(location.href); u.searchParams.set("source", e.target.value); location.href = u.toString(); }}>
        {kinds.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
    </div>
  );
}

function WebhookTester() {
  const { entities } = useDashboardState();
  const [id, setId] = useState("PT-101");
  const [value, setValue] = useState("182");
  const [result, setResult] = useState("");
  if (kind === "simulator") return null;
  const send = async () => {
    const r = await fetch("/api/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-token": "demo" },
      body: JSON.stringify({ entityId: id, value: Number(value), kind: "webhook.test" }),
    });
    setResult(r.ok ? `accepted (${(await r.json()).accepted})` : `error ${r.status}`);
  };
  return (
    <div className="dt-rail-section">
      <div className="dt-rail-title">Send a test webhook</div>
      <select className="dt-input" value={id} onChange={e => setId(e.target.value)} aria-label="Entity">
        {entities.filter(e => e.unit).map(e => <option key={e.id} value={e.id}>{e.id} · {e.name}</option>)}
      </select>
      <div className="dt-row" style={{ marginTop: 6 }}>
        <input className="dt-input" value={value} onChange={e => setValue(e.target.value)} aria-label="Value" />
        <button className="dt-btn small primary" onClick={send}>POST</button>
      </div>
      {result && <div className="muted mono" style={{ fontSize: 10.5, marginTop: 4 }}>{result}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <DashboardProvider dashboard={dashboard} storageKey="live-service">
    <DashboardApp
      main={<EntityTable />}
      railBottom={<><SourcePicker /><WebhookTester /></>}
      streamTitle="Records"
      disclaimer={kind === "simulator" ? "SIMULATED" : "mock service · npm run mock-server"}
    />
  </DashboardProvider>,
);
