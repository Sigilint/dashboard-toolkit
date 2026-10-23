// Well pad example: an overhead view of one oil well on private land. The
// operator's pumping unit and tank battery, the landowner's fence and gate
// sensor, four solar ESP32 emissions nodes on the fenceline, and a Raspberry
// Pi gateway that relays them over LTE. Built to explain as much as to
// monitor: a guided tour, a story behind each scenario, device cutaways and
// plain-language notes in the drawer. All data is synthetic.

import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/toolkit.css";
import {
  createDashboard, createSimulator, evaluateLimits, localViewStorage, emptyFilters, formatTime, formatUnit, formatValue,
  DashboardProvider, DashboardApp, Schematic, AreaBanner, OverlayCard, CardRow, DrawerSection, StatusIcon,
  useDashboard, useDashboardState, type AreaFocus, type DerivedTile, type DrawerContext, type Entity,
} from "../../src";
import {
  categories, groups, entities, scenarios, LOOP_SECONDS, NODES, NODE_SENSORS, NODE_SPECS, GATEWAY_SPECS,
  WELL_INFO, OPERATOR, GLOSSARY, TOUR,
} from "./site";
import { SitePlan, NodeDevice, GatewayDevice, PumpjackDiagram, compass } from "./drawing";

const source = createSimulator({
  entities, scenarios, loopSeconds: LOOP_SECONDS, warmup: 12,
  // a stopped pumping unit is worth a look but is usually the pump-off controller, so never an alarm
  severityOf: (e, v) => e.id === "WELL" ? (v == null ? "offline" : v < 2 ? "warning" : "normal") : evaluateLimits(e.limits, v).severity,
  startAt: Number(new URLSearchParams(location.search).get("t") || 12),
});

const active = (id: string) => source.clock().active.includes(id);

const dashboard = createDashboard({
  source,
  categories,
  groups,
  header: {
    title: "HARGROVE RANCH No. 2",
    subtitle: "Well pad · synthetic",
    meta: [
      { label: "API", value: "42-227-39xxx", hideBelow: "md" },
      { label: "RRC", value: "District 08", hideBelow: "md" },
      { label: "loop", value: "6 min", hideBelow: "sm" },
    ],
  },
  views: {
    builtIn: [
      { id: "all", name: "Everything", filters: emptyFilters() },
      { id: "attention", name: "Needs attention", filters: { ...emptyFilters(), severity: "attention" } },
      { id: "air", name: "Fenceline air", filters: { ...emptyFilters(), facets: { category: ["emissions"] } } },
      { id: "health", name: "Sensor health", filters: { ...emptyFilters(), facets: { category: ["device", "network"] } } },
      { id: "well", name: "Well & tanks", filters: { ...emptyFilters(), facets: { category: ["production"] } } },
    ],
    storage: localViewStorage("well-pad-views"),
  },
  derived: ({ value, severity }): DerivedTile[] => {
    const spm = value("WELL", 8.4);
    const worst = NODES.map(n => ({ id: n.id, v: value(n.id, 2) })).sort((a, b) => b.v - a.v)[0];
    const airSev = severity(worst.id);
    const gateOpen = value("GATE") >= 0.5;
    const reporting = value("GW", 4);
    const wind = `${compass(value("WX-DIR", 185))} ${value("WX-WIND", 9)} mph`;
    return [
      spm > 0.5
        ? { key: "well", label: "Well", value: `PUMPING ${spm.toFixed(1)} SPM`, severity: "normal", detail: `fillage ${value("WELL-FILL", 93)} %` }
        : { key: "well", label: "Well", value: "IDLE · PUMP-OFF", severity: "warning", detail: "controller resting the well" },
      {
        key: "air", label: "Fenceline air", severity: airSev,
        value: airSev === "alarm" ? "LEAK LIKELY" : airSev === "warning" ? "ELEVATED" : "BACKGROUND",
        detail: `${worst.id} CH₄ ${worst.v.toFixed(1)} ppm · wind ${wind}`,
      },
      gateOpen
        ? active("pumper")
          ? { key: "access", label: "Access", value: "PUMPER ON SITE", severity: "normal", detail: "scheduled daily visit" }
          : { key: "access", label: "Access", value: "GATE OPEN", severity: "warning", detail: "outside the pumper's schedule" }
        : { key: "access", label: "Access", value: "GATE CLOSED", severity: "normal", detail: "magnetic sensor at the post" },
      { key: "net", label: "Sensor network", value: `${reporting} / 4 REPORTING`, severity: reporting < 4 ? "warning" : "normal", detail: `LTE ${value("GW-LTE", -88)} dBm` },
    ];
  },
});

// ---------- drawer pieces ----------

const kindOf = (e: Entity) => (e.meta?.kind as string) || "";
const nodeOf = (e: Entity) => (e.meta?.node as string) || "";
const age = (ts?: string) => (ts ? (Date.now() - new Date(ts).getTime()) / 1000 : Infinity);

function Reading({ id }: { id: string }) {
  const s = useDashboardState();
  const e = s.entityById.get(id), r = s.latest[id];
  if (!e) return null;
  const sev = r?.severity || "normal";
  return (
    <span className={`mono wp-reading st-text-${sev}`}>
      {sev !== "normal" && <StatusIcon status={sev} size={10} />} {formatValue(r?.value, e)} {formatUnit(e)}
    </span>
  );
}

/** Clickable list of live readings */
function ChannelList({ ids }: { ids: string[] }) {
  const d = useDashboard();
  const s = useDashboardState();
  return (
    <ul className="dt-dr-list">
      {ids.map(id => {
        const e = s.entityById.get(id);
        if (!e) return null;
        return (
          <li key={id}>
            <button className={`dt-dr-item ${s.selectedId === id ? "wp-current" : ""}`} onClick={() => d.select(id)}>
              <span className="dt-dr-item-label">{e.name}</span>
              <span className="dt-dr-item-val"><Reading id={id} /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="wp-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function WhatItIs({ entity }: { entity: Entity }) {
  if (!entity.description) return null;
  return (
    <DrawerSection title="What this is">
      <p className="wp-prose">{entity.description}</p>
      {entity.insights?.length ? <ul className="wp-insights">{entity.insights.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
    </DrawerSection>
  );
}

/** The path a reading takes, with one step highlighted */
function DataPath({ at }: { at: number }) {
  const steps = [["Sensor", "samples the air"], ["ESP32", "averages, corrects, packs"], ["LoRa radio", "915 MHz, up to ~2 km"],
                 ["Pi gateway", "time-stamps & stores"], ["LTE uplink", "to the cloud"], ["Dashboard", "you are here"]];
  return (
    <ol className="wp-path">
      {steps.map(([t, sub], i) => <li key={t} className={i === at ? "on" : ""}><b>{t}</b><span>{sub}</span></li>)}
    </ol>
  );
}

function NodeSections({ node }: { node: string }) {
  const d = useDashboard();
  const s = useDashboardState();
  const info = NODES.find(n => n.id === node)!;
  const last = s.latest[node];
  const tx = age(last?.ts) < 1.2;
  return (
    <>
      <DrawerSection title="The device" aside={info.serial}>
        <NodeDevice transmitting={tx} solar={s.latest[`${node}-SOL`]?.value ?? 4} />
        <p className="wp-caption">
          A weatherproof box on the fence. The ESP32 sleeps most of the time, then wakes every 5 minutes, warms the gas sensors,
          takes readings and radios them to the gateway. The TX light flashes on each send.
        </p>
      </DrawerSection>
      <DrawerSection title="Sensors on this node" aside={`${NODE_SENSORS.length}`}>
        <ul className="wp-sensors">
          {NODE_SENSORS.map(x => {
            const id = node + x.suffix;
            return (
              <li key={id}>
                <button className={s.selectedId === id ? "wp-current" : ""} onClick={() => d.select(id)}>
                  <span className="wp-sn-head"><b>{x.label}</b><Reading id={id} /></span>
                  <span className="wp-sn-part mono">{x.part} · {x.range}</span>
                  <span className="wp-sn-how">{x.method}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DrawerSection>
      <WhatItIs entity={s.entityById.get(node)!} />
      <DrawerSection title="How a reading gets here"><DataPath at={1} /></DrawerSection>
      <DrawerSection title="Hardware">
        <h4 className="wp-sub">Controller & radio</h4><KV rows={NODE_SPECS.board as [string, string][]} />
        <h4 className="wp-sub">Power</h4><KV rows={NODE_SPECS.power as [string, string][]} />
        <h4 className="wp-sub">Housing</h4><KV rows={NODE_SPECS.housing as [string, string][]} />
      </DrawerSection>
      <DrawerSection title="Node record">
        <KV rows={[
          ["Serial", info.serial], ["Placement", `${info.side} fenceline`], ["Mount", info.mount], ["Installed", `${info.installed} by landowner`],
          ["Last bump test", "2026-09-30 · passed"], ["Last report", last ? `${formatTime(last.ts)} (${Math.round(age(last.ts))} s ago)` : "—"],
        ]} />
      </DrawerSection>
    </>
  );
}

function WellSections({ entity }: { entity: Entity }) {
  const s = useDashboardState();
  const p = WELL_INFO.production;
  const max = Math.max(p.oil, p.water, p.gas / 6);
  return (
    <>
      <DrawerSection title="How a pumping unit works">
        <PumpjackDiagram spm={s.latest.WELL?.value ?? 8.4} />
        <p className="wp-caption">
          The motor turns the gearbox and cranks, and the counterweights balance the weight of the rods. The walking beam rocks
          on the samson post, and the horsehead pulls the polished rod up and lets it fall. The rod string reaches a plunger pump
          near the bottom of the well, which lifts a mix of oil, water and gas to the surface on each upstroke.
        </p>
      </DrawerSection>
      <DrawerSection title="Live from the operator's controller">
        <ChannelList ids={["WELL", "WELL-FILL", "WELL-AMP", "WELL-TP", "WELL-CP", "TANK-1", "TANK-2", "TANK-W"]} />
      </DrawerSection>
      {entity.id === "WELL" && (
        <>
          <DrawerSection title="Railroad Commission record" aside="synthetic">
            <KV rows={[
              ["Lease / well", `${WELL_INFO.lease} No. ${WELL_INFO.wellNo}`], ["API number", WELL_INFO.api], ["Lease ID", WELL_INFO.leaseId],
              ["District", WELL_INFO.district], ["County", WELL_INFO.county], ["Field", WELL_INFO.field],
              ["Type / status", `${WELL_INFO.type} · ${WELL_INFO.status}`], ["Drilling permit", WELL_INFO.permit],
              ["Spud / completed", `${WELL_INFO.spud} / ${WELL_INFO.completed}`], ["Depth", WELL_INFO.depth], ["Formation", WELL_INFO.formation],
              ["Lift", WELL_INFO.lift], ["Survey", WELL_INFO.survey], ["Location", WELL_INFO.location],
              ["Last test", WELL_INFO.lastTest], ["Last inspection", WELL_INFO.lastInspection],
            ]} />
          </DrawerSection>
          <DrawerSection title="Reported production" aside={p.month}>
            {[["Oil", p.oil, "bbl"], ["Gas", p.gas, "mcf"], ["Water", p.water, "bbl"]].map(([k, v, u]) => (
              <div key={k as string} className="wp-bar">
                <span>{k}</span>
                <span className="wp-bar-track"><i style={{ width: `${(((k === "Gas" ? (v as number) / 6 : (v as number)) / max) * 100).toFixed(0)}%` }} /></span>
                <span className="mono">{(v as number).toLocaleString()} {u}</span>
              </div>
            ))}
            <p className="wp-caption">Operators report production monthly per lease. Older oil wells often make more water than oil, which is trucked off and disposed of or recycled.</p>
          </DrawerSection>
          <DrawerSection title="Operator" aside="fictitious">
            <KV rows={[
              ["Name", OPERATOR.name], ["P-5 no.", OPERATOR.p5], ["P-5 status", OPERATOR.p5Status], ["Financial assurance", OPERATOR.assurance],
              ["Office", OPERATOR.office], ["Field office", OPERATOR.fieldOffice], ["24-h emergency", OPERATOR.emergency],
              ["Pumper", OPERATOR.pumper], ["Surface owner", OPERATOR.surfaceOwner],
            ]} />
          </DrawerSection>
          <DrawerSection title="What these records mean">
            <dl className="wp-gloss">{GLOSSARY.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          </DrawerSection>
        </>
      )}
    </>
  );
}

function GatewaySections() {
  const s = useDashboardState();
  const tx = NODES.some(n => age(s.latest[n.id]?.ts) < 1.2);
  return (
    <>
      <DrawerSection title="The gateway">
        <GatewayDevice transmitting={tx} />
        <p className="wp-caption">
          The mast at the barn holds the LoRa antenna and the weather sensors. In the box, a Raspberry Pi runs the packet
          forwarder, keeps a local copy of every reading, and pushes data out through the LTE modem.
        </p>
      </DrawerSection>
      <DrawerSection title="How a reading gets here"><DataPath at={3} /></DrawerSection>
      <DrawerSection title="Gateway readings"><ChannelList ids={["GW", "GW-LTE", "GW-CPU", "GW-BAT", ...NODES.map(n => `${n.id}-RSSI`)]} /></DrawerSection>
      <DrawerSection title="Hardware"><KV rows={GATEWAY_SPECS} /></DrawerSection>
    </>
  );
}

function GateSections() {
  const s = useDashboardState();
  const d = useDashboard();
  const h = d.historyFor("GATE");
  const openings = h.filter((r, i) => r.value === 1 && h[i - 1]?.value === 0).slice(-6).reverse();
  return (
    <DrawerSection title="Recent openings" aside={`${openings.length}`}>
      {openings.length ? (
        <ul className="wp-insights mono">{openings.map(r => <li key={r.seq}>{formatTime(r.ts)} · opened</li>)}</ul>
      ) : <p className="wp-caption">No openings in the recent window.</p>}
      <p className="wp-caption">Expected: the contract pumper, once a day. {s.latest.GATE?.value === 1 ? "The gate is open now." : ""}</p>
    </DrawerSection>
  );
}

function Extra({ entity }: DrawerContext) {
  const kind = kindOf(entity);
  const d = useDashboard();
  return (
    <>
      {kind === "node" && <NodeSections node={entity.id} />}
      {kind !== "node" && <WhatItIs entity={entity} />}
      {kind === "channel" && (
        <>
          <DrawerSection title={`Part of node ${nodeOf(entity)}`}>
            <button className="dt-btn small" onClick={() => d.select(nodeOf(entity))}>Open node {nodeOf(entity)}: device, sensors and hardware</button>
          </DrawerSection>
          <DrawerSection title="Other sensors on this node">
            <ChannelList ids={NODE_SENSORS.map(x => nodeOf(entity) + x.suffix)} />
          </DrawerSection>
        </>
      )}
      {kind === "well" && <WellSections entity={entity} />}
      {kind === "gateway" && <GatewaySections />}
      {kind === "gate" && <GateSections />}
      {kind === "weather" && (
        <DrawerSection title="Weather at the mast">
          <ChannelList ids={["WX-WIND", "WX-GUST", "WX-DIR", "WX-TEMP", "WX-RH", "WX-BARO"]} />
        </DrawerSection>
      )}
    </>
  );
}

// ---------- overlay cards ----------

function Weather() {
  const s = useDashboardState();
  const v = (id: string, f = 0) => s.latest[id]?.value ?? f;
  const from = v("WX-DIR", 185), heading = (from + 180) % 360;
  const downwind = NODES.map(n => {
    const b = (Math.atan2(n.x - 432, -(n.y - 252)) * 180) / Math.PI;
    return { id: n.id, off: Math.abs(((b - heading + 540) % 360) - 180) };
  }).sort((a, b) => a.off - b.off)[0];
  const sev = [s.latest["WX-WIND"]?.severity, s.latest["WX-GUST"]?.severity].includes("warning") ? "warning" : "normal";
  return (
    <OverlayCard id="weather" title="Weather" summary={`${compass(from)} ${v("WX-WIND", 9)} mph · ${v("WX-TEMP", 74)}°F`} severity={sev}>
      <CardRow label="Wind from" value={`${compass(from)} ${Math.round(from)}°`} />
      <CardRow label="Speed / gust" value={`${v("WX-WIND", 9)} / ${v("WX-GUST", 14)} mph`} severity={s.latest["WX-GUST"]?.severity} />
      <CardRow label="Temperature" value={`${v("WX-TEMP", 74)} °F`} />
      <CardRow label="Humidity" value={`${v("WX-RH", 31)} %`} />
      <CardRow label="Pressure" value={`${v("WX-BARO", 29.92).toFixed(2)} inHg`} />
      <CardRow label="Downwind node" value={downwind.off < 40 ? downwind.id : "between nodes"} />
      <div className="wp-card-note">
        Forecast (NWS, synthetic): {active("front") ? "front passing; NW 20–25 mph, gusts to 35, falling to 58 °F." : "sunny, high 78 °F, S wind 8–12 mph. Front due this afternoon."}
      </div>
    </OverlayCard>
  );
}

function Tour({ focus }: { focus: AreaFocus }) {
  const d = useDashboard();
  const [i, setI] = useState(0);
  const go = (n: number) => {
    const step = TOUR[n];
    setI(n);
    if (step.seek != null) source.seek(step.seek);
    d.select(step.select ?? null);
    focus.pin(step.pin ?? null);
  };
  const step = TOUR[i];
  return (
    <OverlayCard id="tour" title="Guided tour" summary={`${i + 1} / ${TOUR.length} · ${step.title}`} position="bottom-left">
      <div className="wp-tour-title">{step.title}</div>
      <p className="wp-tour-body">{step.body}</p>
      <div className="dt-row wp-tour-nav">
        <button className="dt-btn small" disabled={i === 0} onClick={() => go(i - 1)}>‹ Back</button>
        <span className="mono muted">{i + 1} / {TOUR.length}</span>
        {i < TOUR.length - 1
          ? <button className="dt-btn small primary" onClick={() => go(i + 1)}>Next ›</button>
          : <button className="dt-btn small" onClick={() => go(0)}>Restart</button>}
      </div>
    </OverlayCard>
  );
}

function Scenarios() {
  const s = useDashboardState();
  const c = source.clock();
  void s.version; // re-render with the store
  const story = scenarios.filter(sc => c.active.includes(sc.id)).at(-1);
  return (
    <div className="dt-rail-section">
      <div className="dt-rail-title">Scenarios <span className="dt-tag">demo</span></div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 6 }}>LOOP {Math.floor(c.loopT)} / {c.loopSeconds} s</div>
      {scenarios.map(sc => (
        <button key={sc.id} className={`dt-btn small full ${c.active.includes(sc.id) ? "on" : ""}`} style={{ marginBottom: 4, textAlign: "left" }}
                onClick={() => source.seek(Math.max(0, sc.window[0] - 3))}>
          {sc.title} <span className="muted">· {sc.window[0]}s</span>
        </button>
      ))}
      {story && <p className="wp-story"><b>Now: {story.title}.</b> {story.story}</p>}
    </div>
  );
}

const css = `
  :root { --wp-grass: #dfe3cf; --wp-grass-dot: #c3c9ac; --wp-caliche: #ece4d2; --wp-road: #cfcac0; --wp-tree: #a9b98a; --wp-water: #b9d3e4;
          --wp-plume: 255, 140, 40; --wp-wind: #2a78d6; --wp-pcb: #1f6f4a; --wp-steel: #8b949a; }
  :root[data-theme="dark"] { --wp-grass: #161c17; --wp-grass-dot: #222b22; --wp-caliche: #24231f; --wp-road: #2a2c2d; --wp-tree: #26331f; --wp-water: #1b2c38;
          --wp-wind: #5aa2ec; --wp-pcb: #1d5a3e; --wp-steel: #7d878d; }
  .wp-plan .wp-pasture { fill: var(--wp-grass); }
  .wp-plan .wp-grass-dot { fill: var(--wp-grass-dot); }
  .wp-plan .wp-caliche { fill: var(--wp-caliche); }
  .wp-plan .wp-road { fill: var(--wp-road); }
  .wp-plan .wp-road-edge, .wp-plan .wp-thin { stroke: var(--dt-ink-3); stroke-width: 0.8; fill: none; }
  .wp-plan .wp-property { fill: none; stroke: var(--dt-ink-3); stroke-width: 1; stroke-dasharray: 10 4 2 4; }
  .wp-plan .wp-water { fill: var(--wp-water); stroke: var(--dt-ink-3); stroke-width: 0.6; }
  .wp-plan .wp-tree { fill: var(--wp-tree); opacity: 0.85; }
  .wp-plan .wp-building { fill: var(--dt-panel); stroke: var(--dt-ink-2); stroke-width: 1.2; }
  .wp-plan .wp-mast, .wp-plan .wp-pole { fill: var(--dt-panel); stroke: var(--dt-ink-2); stroke-width: 1.5; }
  .wp-plan .wp-power { stroke: var(--dt-ink-3); stroke-width: 0.8; stroke-dasharray: 2 3; fill: none; }
  .wp-plan .wp-fence { fill: none; stroke: var(--dt-ink-2); stroke-width: 1.4; stroke-dasharray: 6 2; }
  .wp-plan .wp-post { fill: var(--dt-ink-2); }
  .wp-plan .wp-gate { stroke: var(--dt-ink); stroke-width: 3; transition: transform 0.6s; transform-origin: 0 0; }
  .wp-plan .wp-gate.open { transform: rotate(-80deg); stroke: var(--dt-warn); }
  .wp-plan .wp-flowline { stroke: var(--dt-ink-3); stroke-width: 1.6; stroke-dasharray: 5 3; fill: none; }
  .wp-plan .wp-slab { fill: var(--dt-panel-2); stroke: var(--dt-ink-3); stroke-width: 0.8; }
  .wp-plan .wp-equip, .wp-plan .wp-tank { fill: var(--dt-panel); stroke: var(--dt-ink-2); stroke-width: 1.2; }
  .wp-plan .wp-tank-fill { fill: var(--dt-accent-soft); stroke: var(--dt-accent); stroke-width: 0.6; }
  .wp-plan .wp-berm { fill: none; stroke: var(--dt-ink-3); stroke-width: 4; opacity: 0.45; }
  .wp-plan .wp-steel { fill: var(--wp-steel); }
  .wp-plan .wp-steel-line { stroke: var(--wp-steel); stroke-width: 2.5; fill: none; }
  .wp-plan .wp-weight { fill: var(--dt-ink-2); }
  .wp-plan .wp-rod { fill: var(--dt-ink); }
  .wp-plan .wp-link { stroke: var(--dt-accent); stroke-width: 0.8; stroke-dasharray: 2 4; opacity: 0.35; transition: opacity 0.4s; }
  .wp-plan .wp-link.tx { opacity: 1; stroke-width: 1.4; }
  .wp-plan .wp-link.down { stroke: var(--dt-alarm); opacity: 0.6; stroke-dasharray: 1 6; }
  .wp-plan .wp-plume-a { stop-color: rgb(var(--wp-plume)); stop-opacity: 0.75; }
  .wp-plan .wp-plume-b { stop-color: rgb(var(--wp-plume)); stop-opacity: 0; }
  .wp-plan .wp-plume { transition: opacity 1s; pointer-events: none; }
  .wp-plan .wp-compass { fill: var(--dt-panel); stroke: var(--dt-rule); }
  .wp-plan .wp-wind { stroke: var(--wp-wind); stroke-width: 3; fill: none; stroke-linecap: round; transition: transform 1s; }
  .wp-plan .wp-label { font: 500 8.5px var(--dt-mono); fill: var(--dt-ink-3); letter-spacing: 0.05em; }
  .wp-plan .wp-label.dim { opacity: 0.7; } .wp-plan .wp-label.tiny { font-size: 7px; } .wp-plan .wp-label.mid { fill: var(--dt-ink-2); }

  .wp-unit .wp-beam { animation: wp-bob var(--stroke) ease-in-out infinite alternate; animation-play-state: var(--play); }
  .wp-unit .wp-cranks { animation: wp-sweep var(--stroke) ease-in-out infinite alternate; animation-play-state: var(--play); }
  .wp-unit .wp-rock { transform-box: view-box; transform-origin: 210px 62px; animation: wp-rock calc(var(--stroke) / 2) ease-in-out infinite alternate; animation-play-state: var(--play); }
  .wp-unit .wp-polish { animation: wp-polish calc(var(--stroke) / 2) ease-in-out infinite alternate; animation-play-state: var(--play); }
  .wp-unit .wp-crank { transform-box: view-box; transform-origin: 295px 114px; animation: wp-turn var(--stroke) linear infinite; animation-play-state: var(--play); }
  @keyframes wp-bob { from { transform: translateX(-3px); } to { transform: translateX(3px); } }
  @keyframes wp-sweep { from { transform: translateX(-8px); } to { transform: translateX(8px); } }
  @keyframes wp-rock { from { transform: rotate(-8deg); } to { transform: rotate(8deg); } }
  @keyframes wp-polish { from { transform: translateY(18px); } to { transform: translateY(-18px); } }
  @keyframes wp-turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .wp-unit * { animation: none !important; } }

  .wp-device { width: 100%; height: auto; display: block; border: 1px solid var(--dt-rule); }
  .wp-dev-bg { fill: var(--dt-stage); }
  .wp-dev-ground { fill: var(--wp-caliche); }
  .wp-dev-hole { fill: var(--dt-panel-2); stroke: var(--dt-ink-3); }
  .wp-dev-rodline { stroke: var(--dt-ink-3); stroke-dasharray: 3 3; }
  .wp-dev-pole { fill: var(--wp-steel); }
  .wp-dev-wire { stroke: var(--dt-ink-3); stroke-width: 1.5; fill: none; }
  .wp-dev-panel { fill: #24476b; stroke: var(--dt-ink-2); stroke-width: 1.2; }
  .wp-dev-cell { stroke: #8fb2d6; stroke-width: 0.6; }
  .wp-dev-antenna { stroke: var(--dt-ink); stroke-width: 3; stroke-linecap: round; }
  .wp-dev-antenna-tip { fill: var(--dt-ink); }
  .wp-dev-omni { fill: var(--dt-panel); stroke: var(--dt-ink-2); stroke-width: 1.2; }
  .wp-dev-waves path { stroke: var(--dt-accent); stroke-width: 1.5; fill: none; }
  .wp-dev-box { fill: #d9dcdc; stroke: var(--dt-ink-2); stroke-width: 1.5; }
  .wp-dev-inside { fill: var(--dt-panel-2); stroke: var(--dt-ink-3); stroke-dasharray: 3 2; }
  .wp-dev-pcb { fill: var(--wp-pcb); }
  .wp-dev-can { fill: #b8bec2; stroke: #5d666b; stroke-width: 0.8; }
  .wp-dev-board2 { fill: #2c3a44; stroke: #5d666b; }
  .wp-dev-trace { stroke: #e3c46a; stroke-width: 1.2; fill: none; }
  .wp-dev-chip { font: 600 8px var(--dt-mono); fill: #f4f6f6; }
  .wp-dev-chip.small { font-size: 7px; }
  .wp-dev-chip.lft { fill: var(--dt-ink-2); font-weight: 500; } .wp-dev-chip.dim { fill: var(--dt-ink-3); }
  .wp-dev-coax { stroke: #444; stroke-width: 1.4; fill: none; }
  .wp-dev-led { fill: #3d4a3d; } .wp-dev-led.on { fill: #6dff8a; }
  .wp-dev-cellbat { fill: #3b6fb0; stroke: #23466f; }
  .wp-dev-bay { fill: var(--dt-panel); stroke: var(--dt-ink-3); }
  .wp-dev-mesh { fill: none; stroke: #5d666b; stroke-dasharray: 1 1; }
  .wp-dev-ec { fill: #d8d1b8; stroke: #6b6248; }
  .wp-dev-vent { fill: #50585d; }
  .wp-dev-louvre { stroke: var(--dt-ink-2); stroke-width: 3; stroke-linecap: round; }
  .wp-dev-shield { fill: var(--dt-panel); stroke: var(--dt-ink-3); }
  .wp-dev-steel { stroke: var(--wp-steel); stroke-width: 5; fill: none; }
  .wp-dev-steel-fill { fill: var(--wp-steel); }
  .wp-dev-weight { fill: var(--dt-ink-2); }
  .wp-dev-polished { stroke: #d8dde0; stroke-width: 3; }
  .wp-dev-callouts text { font: 500 9px var(--dt-mono); fill: var(--dt-ink-2); }
  .wp-dev-callouts path { stroke: var(--dt-ink-3); stroke-width: 0.7; fill: none; }

  .wp-caption { font-size: 11.5px; color: var(--dt-ink-2); line-height: 1.5; margin: 8px 0 0; }
  .wp-prose { font-size: 12.5px; line-height: 1.55; margin: 0 0 6px; }
  .wp-insights { margin: 4px 0 0; padding-left: 16px; font-size: 11.5px; color: var(--dt-ink-2); line-height: 1.5; }
  .wp-sub { font: 600 9px var(--dt-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dt-ink-3); margin: 10px 0 4px; }
  .wp-kv { margin: 0; font-size: 11px; }
  .wp-kv div { display: grid; grid-template-columns: 118px 1fr; gap: 8px; padding: 3px 0; border-top: 1px solid var(--dt-rule-2); }
  .wp-kv dt { color: var(--dt-ink-3); } .wp-kv dd { margin: 0; }
  .wp-gloss { margin: 0; font-size: 11.5px; }
  .wp-gloss div { padding: 4px 0; border-top: 1px solid var(--dt-rule-2); }
  .wp-gloss dt { font-weight: 600; } .wp-gloss dd { margin: 0; color: var(--dt-ink-2); }
  .dt-dr-sec .wp-sensors { list-style: none; margin: 0; padding: 0; }
  .wp-sensors button { all: unset; box-sizing: border-box; display: grid; gap: 2px; width: 100%; padding: 6px 6px; border-top: 1px solid var(--dt-rule-2); cursor: pointer; }
  .wp-sensors button:hover, .wp-sensors button:focus-visible, .wp-current { background: var(--dt-accent-soft); }
  .wp-sn-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
  .wp-sn-part { font-size: 10px; color: var(--dt-ink-3); }
  .wp-sn-how { font-size: 11px; color: var(--dt-ink-2); }
  .wp-reading { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .wp-path { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; counter-reset: s; }
  .wp-path li { counter-increment: s; border: 1px solid var(--dt-rule); padding: 5px 6px; font-size: 10.5px; display: grid; }
  .wp-path li b::before { content: counter(s) " "; color: var(--dt-ink-3); font-family: var(--dt-mono); }
  .wp-path li span { color: var(--dt-ink-3); }
  .wp-path li.on { border-color: var(--dt-accent); background: var(--dt-accent-soft); }
  .wp-bar { display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; font-size: 11px; padding: 3px 0; }
  .wp-bar-track { height: 8px; background: var(--dt-panel-2); }
  .wp-bar-track i { display: block; height: 100%; background: var(--dt-accent); }
  .wp-story { font-size: 11px; line-height: 1.5; color: var(--dt-ink-2); margin: 8px 0 0; padding: 6px 8px; border-left: 2px solid var(--dt-accent); background: var(--dt-accent-soft); }
  .wp-card-note { font-size: 10.5px; color: var(--dt-ink-3); line-height: 1.4; margin-top: 6px; }
  .dt-card.top-right { width: 220px; }
  .dt-card.bottom-left:not(.dt-card-chip) { width: 300px; }
  .wp-tour-title { font: 600 13px var(--dt-display); margin-bottom: 4px; }
  .wp-tour-body { font-size: 11.5px; line-height: 1.5; color: var(--dt-ink-2); margin: 0 0 8px; }
  .wp-tour-nav { justify-content: space-between; }
`;

createRoot(document.getElementById("root")!).render(
  <DashboardProvider dashboard={dashboard} storageKey="well-pad">
    <style>{css}</style>
    <DashboardApp
      main={focus => (
        <Schematic viewBox={[0, 0, 1000, 640]} background={<SitePlan />} focus={focus}>
          <AreaBanner focus={focus} />
          <Weather />
          <Tour focus={focus} />
        </Schematic>
      )}
      drawer={{ extra: ctx => <Extra {...ctx} />, hide: ["about", "related"] }}
      railBottom={<Scenarios />}
      streamTitle="Raw feed"
      disclaimer="SYNTHETIC DATA · fictitious well, operator and landowner · demo thresholds"
    />
  </DashboardProvider>,
);
