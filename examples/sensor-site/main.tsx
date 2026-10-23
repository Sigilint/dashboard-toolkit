// Sensor site example: a compressor station drawn as a simple SVG, with
// sensors, scripted scenarios on the simulator, derived states, a weather
// card and the area banner. The same pattern as offshore-platform-monitor
// and well-site-monitor, built from toolkit parts.

import { createRoot } from "react-dom/client";
import "../../src/styles/toolkit.css";
import {
  createDashboard, createSimulator, localViewStorage, emptyFilters,
  DashboardProvider, DashboardApp, Schematic, AreaBanner, OverlayCard, CardRow, useDashboardState,
  type Category, type Group, type SimEntity, type Scenario, type DerivedTile,
} from "../../src";

const categories: Category[] = [
  { key: "safety", label: "Safety", code: "S", shape: "circle" },
  { key: "process", label: "Process", code: "P", shape: "square" },
  { key: "environment", label: "Environment", code: "E", shape: "hexagon" },
  { key: "weather", label: "Weather", code: "W", shape: "invtriangle" },
];

const groups: Group[] = [
  { key: "MET", label: "Weather mast", description: "Wind and lightning for the whole site", rect: [20, 60, 70, 230] },
  { key: "INL", label: "Inlet & separator", description: "Gas arrives from the field and drops its liquids", rect: [100, 150, 160, 140] },
  { key: "CMP", label: "Compressor building", description: "Two engine-driven compressors boost gas to pipeline pressure", rect: [270, 120, 260, 170] },
  { key: "TNK", label: "Tank battery", description: "Condensate and produced water storage inside a berm", rect: [540, 160, 170, 130] },
  { key: "FNC", label: "Fenceline", description: "Air monitors at the property line", rect: [720, 180, 70, 110] },
];

const e = (id: string, name: string, type: string, category: string, group: string, x: number, y: number, unit: string, dp: number,
           limits: SimEntity["limits"], sim: SimEntity["sim"], extra: Partial<SimEntity> = {}): SimEntity =>
  ({ id, name, type, typeLabel: name.replace(/ [A-Z]$/, ""), category, group, unit, dp, limits, sim, position: { x, y }, tags: { node: `RTU-${group}` }, ...extra });

const entities: SimEntity[] = [
  e("WIND", "Wind speed", "WIND", "weather", "MET", 55, 80, "mph", 0, { hi: [30, 45] }, { base: 11, noise: 2, period: 2 }),
  e("LTNG", "Lightning distance", "LTNG", "weather", "MET", 55, 120, "mi", 0, { lo: [20, 10] }, { base: 70, period: 3 }),
  e("PT-IN", "Inlet pressure", "PT", "process", "INL", 140, 200, "psi", 0, { hi: [900, 1000] }, { base: 720, noise: 10, period: 1 }),
  e("LT-SEP", "Separator level", "LT", "process", "INL", 215, 215, "%", 0, { hi: [75, 90] }, { base: 40, noise: 3, period: 2 }),
  e("GD-INL", "Inlet gas detector", "GD", "safety", "INL", 180, 270, "%LEL", 1, { hi: [20, 40] }, { base: 1, noise: 0.4, period: 1 }),
  e("VT-A", "Compressor vibration A", "VT", "process", "CMP", 330, 220, "in/s", 2, { hi: [0.5, 0.8] }, { base: 0.22, noise: 0.03, period: 1 }),
  e("TT-A", "Discharge temp A", "TT", "process", "CMP", 370, 180, "°F", 0, { hi: [300, 330] }, { base: 255, noise: 3, period: 2 }),
  e("VT-B", "Compressor vibration B", "VT", "process", "CMP", 450, 220, "in/s", 2, { hi: [0.5, 0.8] }, { base: 0.2, noise: 0.03, period: 1 }),
  e("TT-B", "Discharge temp B", "TT", "process", "CMP", 490, 180, "°F", 0, { hi: [300, 330] }, { base: 250, noise: 3, period: 2 }),
  e("GD-CMP", "Building gas detector", "GD", "safety", "CMP", 410, 140, "%LEL", 1, { hi: [20, 40] }, { base: 0.8, noise: 0.4, period: 1 }),
  e("FD-CMP", "Flame detector", "FD", "safety", "CMP", 300, 150, "% signal", 0, { hi: [40, 75] }, { base: 2, noise: 1, period: 1 }),
  e("LT-T1", "Condensate tank level", "LT", "process", "TNK", 590, 240, "ft", 1, { hi: [16, 18] }, { base: 9, noise: 0.05, period: 3 }),
  e("HATCH", "Thief hatch", "HATCH", "environment", "TNK", 660, 180, "", 0, { hi: [0.5, 0.5] }, { base: 0, period: 2 }, { binary: ["CLOSED", "OPEN"] }),
  e("CH4-F", "Fenceline methane", "CH4", "environment", "FNC", 755, 210, "ppm", 1, { hi: [10, 25] }, { base: 2.1, noise: 0.1, period: 2 }),
  e("VOC-F", "Fenceline VOC", "VOC", "environment", "FNC", 755, 255, "ppb", 0, { hi: [100, 250] }, { base: 15, noise: 4, period: 2 }),
];

const scenarios: Scenario[] = [
  { id: "bearing", title: "Compressor A bearing wear", window: [0, 300], effects: [
    { entityId: "VT-A", kind: "ramp", delta: 0.45 }, { entityId: "TT-A", kind: "ramp", delta: 60 }] },
  { id: "hatch", title: "Thief hatch left open", window: [40, 160], effects: [
    { entityId: "HATCH", kind: "plateau", delta: 1, rise: 2 },
    { entityId: "CH4-F", kind: "plateau", delta: 14, rise: 25 }, { entityId: "VOC-F", kind: "plateau", delta: 190, rise: 25 }] },
  { id: "storm", title: "Thunderstorm", window: [170, 280], effects: [
    { entityId: "WIND", kind: "plateau", delta: 26, rise: 30 }, { entityId: "LTNG", kind: "plateau", delta: -64, rise: 40 }] },
  { id: "slug", title: "Liquid slug at the inlet", window: [200, 260], effects: [
    { entityId: "LT-SEP", kind: "plateau", delta: 42, rise: 15 }, { entityId: "PT-IN", kind: "plateau", delta: 190, rise: 15 }] },
];

const source = createSimulator({ entities, scenarios, loopSeconds: 300, startAt: Number(new URLSearchParams(location.search).get("t") || 30) });

const dashboard = createDashboard({
  source,
  categories,
  groups,
  header: { title: "CS-14 COMPRESSOR STATION", subtitle: "Simulated", meta: [{ label: "loop", value: "5 min" }] },
  views: {
    builtIn: [
      { id: "all", name: "All sensors", filters: emptyFilters() },
      { id: "attention", name: "Needs attention", filters: { ...emptyFilters(), severity: "attention" } },
      { id: "compressors", name: "Compressors", filters: { ...emptyFilters(), facets: { group: ["CMP"] } } },
      { id: "fence", name: "Emissions & fenceline", filters: { ...emptyFilters(), facets: { category: ["environment"] } } },
    ],
    storage: localViewStorage("sensor-site-views"),
  },
  derived: ({ value, severity }): DerivedTile[] => {
    const lightning = value("LTNG", 70), wind = value("WIND");
    const work: DerivedTile = lightning <= 10 ? { key: "work", label: "Site work", value: "SUSPENDED", severity: "alarm", detail: `lightning ${lightning} mi` }
      : lightning <= 20 || wind >= 30 ? { key: "work", label: "Site work", value: "LIMITED", severity: "warning", detail: lightning <= 20 ? `lightning ${lightning} mi` : `wind ${wind} mph` }
      : { key: "work", label: "Site work", value: "OPEN", severity: "normal", detail: "No weather limits" };
    const cmp = (["VT-A", "TT-A", "VT-B", "TT-B"] as const).map(severity);
    const units = cmp.includes("alarm") ? "alarm" : cmp.includes("warning") ? "warning" : "normal";
    return [
      work,
      { key: "units", label: "Compression", value: units === "normal" ? "2 / 2 RUNNING" : "CHECK UNIT A", severity: units, detail: `A ${value("TT-A")} °F · B ${value("TT-B")} °F` },
      { key: "emissions", label: "Emissions", value: value("HATCH") >= 0.5 ? "VENTING" : "CONTROLLED", severity: value("HATCH") >= 0.5 ? "warning" : "normal", detail: `fence CH₄ ${value("CH4-F")} ppm` },
    ];
  },
});

// The site drawing: plain SVG, owned by the app
function Drawing() {
  const s = useDashboardState();
  const level = s.latest["LT-T1"]?.value ?? 9;
  const sep = s.latest["LT-SEP"]?.value ?? 40;
  const storm = Math.max(0, Math.min(1, ((s.latest.WIND?.value ?? 11) - 15) / 20));
  return (
    <g className="site-drawing">
      <rect x="0" y="0" width="800" height="300" className="sky" />
      <rect x="0" y="0" width="800" height="300" className="storm" style={{ opacity: storm * 0.6 }} />
      <rect x="0" y="290" width="800" height="70" className="ground" />
      <line x1="55" y1="290" x2="55" y2="65" className="steel" />
      <rect x="120" y="190" width="120" height="16" rx="8" className="equip" />
      <rect x="196" y="180" width="40" height="90" rx="16" className="equip" />
      <rect x="196" y={270 - 0.9 * sep} width="40" height={0.9 * sep} className="liquid" />
      <rect x="280" y="130" width="240" height="160" className="equip" fill="none" />
      <path d="M270,130 L400,100 L530,130" className="steel" fill="none" />
      {[310, 430].map(x => <g key={x}><rect x={x} y="200" width="70" height="60" className="equip" /><circle cx={x + 35} cy="230" r="14" className="steel" fill="none" /></g>)}
      {[560, 630].map((x, i) => (
        <g key={x}>
          <rect x={x} y="190" width="55" height="100" className="equip" fill="none" />
          {i === 0 && <rect x={x + 1} y={290 - level * 5} width="53" height={level * 5} className="liquid" />}
        </g>
      ))}
      <path d="M548,290 V280 H722 V290" className="steel" fill="none" />
      <path d="M740,290 V185 M770,290 V185" className="steel" />
      <path d="M240,198 H280 M520,230 H560" className="pipe" />
      <text x="12" y="315" className="label">MET</text>
      <text x="150" y="315" className="label">INLET · SEPARATOR</text>
      <text x="360" y="315" className="label">COMPRESSOR BUILDING</text>
      <text x="580" y="315" className="label">TANK BATTERY</text>
      <text x="728" y="315" className="label">FENCE</text>
    </g>
  );
}

function Weather() {
  const s = useDashboardState();
  const wind = s.latest.WIND, ltng = s.latest.LTNG;
  const worst = [wind?.severity, ltng?.severity].includes("alarm") ? "alarm" : [wind?.severity, ltng?.severity].includes("warning") ? "warning" : "normal";
  return (
    <OverlayCard id="weather" title="Weather" summary={`${wind?.value ?? "—"} mph`} severity={worst}>
      <CardRow label="Wind" value={`${wind?.value ?? "—"} mph`} severity={wind?.severity} />
      <CardRow label="Lightning" value={(ltng?.value ?? 99) >= 60 ? "none nearby" : `${ltng?.value} mi`} severity={ltng?.severity} />
    </OverlayCard>
  );
}

function Scenarios() {
  const s = useDashboardState();
  const c = source.clock();
  void s.version; // re-render with the store
  return (
    <div className="dt-rail-section">
      <div className="dt-rail-title">Simulation <span className="dt-tag">demo</span></div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 6 }}>LOOP {Math.floor(c.loopT)} / {c.loopSeconds} s</div>
      {source.scenarios.map(sc => (
        <button key={sc.id} className={`dt-btn small full ${c.active.includes(sc.id) ? "on" : ""}`} style={{ marginBottom: 4, textAlign: "left" }}
                onClick={() => source.seek(Math.max(0, sc.window[0] - 3))}>
          {sc.title} <span className="muted">· {sc.window[0]}s</span>
        </button>
      ))}
    </div>
  );
}

const css = `
  .site-drawing .sky { fill: var(--dt-stage); }
  .site-drawing .storm { fill: #000; transition: opacity 1s; }
  .site-drawing .ground { fill: var(--dt-panel-2); }
  .site-drawing .equip { fill: var(--dt-panel); stroke: var(--dt-ink-2); stroke-width: 1.2; }
  .site-drawing .steel { stroke: var(--dt-ink-2); stroke-width: 2; }
  .site-drawing .pipe { stroke: var(--dt-ink-3); stroke-width: 3; fill: none; }
  .site-drawing .liquid { fill: var(--dt-accent-soft); stroke: none; }
  .site-drawing .label { font: 500 8px var(--dt-mono); fill: var(--dt-ink-3); letter-spacing: 0.05em; }
`;

createRoot(document.getElementById("root")!).render(
  <DashboardProvider dashboard={dashboard} storageKey="sensor-site">
    <style>{css}</style>
    <DashboardApp
      main={focus => (
        <Schematic viewBox={[0, 40, 800, 300]} background={<Drawing />} focus={focus}>
          <AreaBanner focus={focus} />
          <Weather />
        </Schematic>
      )}
      railBottom={<Scenarios />}
      streamTitle="Raw feed"
      disclaimer="SIMULATED DATA · demo thresholds"
    />
  </DashboardProvider>,
);
