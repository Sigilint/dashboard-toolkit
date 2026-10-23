import { describe, expect, it, vi } from "vitest";
import {
  AlertEngine, canonicalFilters, cloudEventMapper, createDashboard, createSimulator, emptyFilters,
  evaluateLimits, formatValue, isVisible, matchEntity, memoryViewStorage, pollingSource, sameFilters,
  toggleFacet, viewHash, defaultFacets,
  type DataRecord, type DataSource, type Entity, type SourceBatch, type SourceHandlers,
} from "../src/core";

const cats = [
  { key: "safety", label: "Safety", code: "S", shape: "circle" as const },
  { key: "ops", label: "Operations", code: "O", shape: "square" as const },
];
const groups = [{ key: "WH", label: "Wellhead" }, { key: "TNK", label: "Tank battery" }];
const ent = (id: string, extra: Partial<Entity> = {}): Entity => ({
  id, name: id, type: "GD", category: "safety", group: "WH", limits: { hi: [20, 40] }, ...extra,
});
let seq = 0;
const rec = (entityId: string, value: number | null, severity: DataRecord["severity"]): DataRecord =>
  ({ seq: ++seq, ts: new Date(1_700_000_000_000 + seq * 1000).toISOString(), entityId, value, severity });

/** A source the test drives by hand */
function manualSource(entities: Entity[], extra: Partial<DataSource> = {}) {
  let handlers: SourceHandlers | undefined;
  const src: DataSource & { push: (b: SourceBatch) => void } = {
    async load() { return { entities }; },
    subscribe(h) { handlers = h; h.onStatus("connected"); return () => { handlers = undefined; }; },
    push: b => handlers!.onBatch(b),
    ...extra,
  };
  return src;
}

describe("severity", () => {
  it("evaluates hi and lo limits", () => {
    expect(evaluateLimits({ hi: [20, 40] }, 25)).toEqual({ severity: "warning", dir: "hi", limit: 20 });
    expect(evaluateLimits({ hi: [20, 40] }, 41).severity).toBe("alarm");
    expect(evaluateLimits({ lo: [10, 5] }, 4)).toEqual({ severity: "alarm", dir: "lo", limit: 5 });
    expect(evaluateLimits({ hi: [20, 40] }, null).severity).toBe("offline");
  });
  it("formats binary and decimal values", () => {
    expect(formatValue(1, { binary: ["CLOSED", "OPEN"] })).toBe("OPEN");
    expect(formatValue(1234.5, { dp: 1 })).toBe("1,234.5");
    expect(formatValue(null)).toBe("—");
  });
});

describe("filters", () => {
  const facets = defaultFacets(cats, groups);
  const ctx = { facets, groups: new Map(groups.map(g => [g.key, g])) };
  const e1 = ent("GD-WH-01", { tags: { node: "N-014" } });
  const e2 = ent("PT-TNK-01", { category: "ops", group: "TNK", type: "PT", typeLabel: "Tank level" });

  it("canonicalises so equivalent filters compare equal", () => {
    const a = { q: " x ", severity: "all" as const, facets: { group: ["TNK", "WH"], category: [] } };
    const b = { q: "x", severity: "all" as const, facets: { group: ["WH", "TNK"] } };
    expect(sameFilters(a, b)).toBe(true);
    expect(canonicalFilters(a).facets).toEqual({ group: ["TNK", "WH"] });
  });
  it("ORs within a facet and ANDs across facets", () => {
    let f = toggleFacet(emptyFilters(), "group", "WH");
    f = toggleFacet(f, "group", "TNK");
    expect(matchEntity(e1, f, ctx) && matchEntity(e2, f, ctx)).toBe(true);
    f = toggleFacet(f, "category", "ops");
    expect(matchEntity(e1, f, ctx)).toBe(false);
    expect(matchEntity(e2, f, ctx)).toBe(true);
  });
  it("searches ids, names, type labels, group labels and tags", () => {
    expect(matchEntity(e2, { ...emptyFilters(), q: "tank level" }, ctx)).toBe(true);
    expect(matchEntity(e1, { ...emptyFilters(), q: "wellhead n-014" }, ctx)).toBe(true);
    expect(matchEntity(e1, { ...emptyFilters(), q: "tank" }, ctx)).toBe(false);
  });
  it("applies the severity filter to the entity's current severity", () => {
    const f = { ...emptyFilters(), severity: "attention" as const };
    expect(isVisible(e1, "warning", f, ctx)).toBe(true);
    expect(isVisible(e1, "normal", f, ctx)).toBe(false);
  });
});

describe("views", () => {
  it("hashes equal selections equally and different ones differently", () => {
    const a = viewHash({ facets: { group: ["WH", "TNK"] } });
    expect(a).toBe(viewHash({ facets: { group: ["TNK", "WH"] }, q: "" }));
    expect(a).not.toBe(viewHash({ facets: { group: ["WH"] } }));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("AlertEngine", () => {
  it("follows active → ack → cleared, and RTN until acknowledged", () => {
    const eng = new AlertEngine();
    const e = ent("A");
    eng.apply(rec("A", 25, "warning"), e);
    const [a] = eng.list();
    expect(a).toMatchObject({ priority: "warning", state: "active", acked: false, limit: 20, dir: "hi" });
    eng.apply(rec("A", 45, "alarm"), e);
    expect(eng.list()[0]).toMatchObject({ priority: "alarm", peak: 45 });
    eng.acknowledge(a.id);
    eng.apply(rec("A", 5, "normal"), e);
    expect(eng.list()).toHaveLength(0);

    eng.apply(rec("A", 25, "warning"), e);
    eng.apply(rec("A", 5, "normal"), e);
    expect(eng.list()[0].state).toBe("rtn");
    eng.acknowledgeAll();
    expect(eng.list()).toHaveLength(0);
  });
  it("raises a fault for missing data", () => {
    const eng = new AlertEngine();
    eng.apply(rec("A", null, "offline"));
    expect(eng.list()[0].priority).toBe("fault");
  });
});

describe("Dashboard", () => {
  it("ingests batches into latest, records, history and alerts", async () => {
    const src = manualSource([ent("A"), ent("B", { group: "TNK" })]);
    const d = createDashboard({ source: src, categories: cats, groups });
    await d.start();
    expect(d.getState().status).toBe("connected");
    src.push({ records: [rec("A", 1, "normal"), rec("B", 30, "warning")] });
    const s = d.getState();
    expect(s.latest.B.value).toBe(30);
    expect(s.records[0].entityId).toBe("B");
    expect(s.alerts).toHaveLength(1);
    expect(d.historyFor("A")).toHaveLength(1);
  });

  it("queues while paused and applies the queue on resume", async () => {
    const src = manualSource([ent("A")]);
    const d = createDashboard({ source: src, categories: cats, groups });
    await d.start();
    d.setLive(false);
    src.push({ records: [rec("A", 1, "normal"), rec("A", 2, "normal")] });
    expect(d.getState().queued).toBe(2);
    expect(d.getState().latest.A).toBeUndefined();
    d.setLive(true);
    expect(d.getState().queued).toBe(0);
    expect(d.getState().latest.A.value).toBe(2);
  });

  it("filters, saves and re-applies views, and tracks the active view", async () => {
    const storage = memoryViewStorage();
    const d = createDashboard({
      source: manualSource([ent("A"), ent("B", { group: "TNK" })]), categories: cats, groups,
      views: { builtIn: [{ id: "all", name: "All", filters: emptyFilters() }], storage },
    });
    await d.start();
    expect(d.getState().activeView?.id).toBe("all");
    d.setFilters(f => toggleFacet(f, "group", "TNK"));
    expect(d.visibleEntities().map(e => e.id)).toEqual(["B"]);
    expect(d.getState().activeView).toBeUndefined();
    const v = await d.saveView("Tanks");
    expect(d.getState().activeView?.id).toBe(v.id);
    expect(await storage.load()).toHaveLength(1);
    d.resetFilters();
    d.applyView(v.id);
    expect(d.visibleEntities()).toHaveLength(1);
    await d.deleteView(v.id);
    expect(d.getState().savedViews).toHaveLength(0);
  });

  it("uses the source's alerts and acknowledgements when it manages them", async () => {
    const ack = vi.fn(async () => {});
    const src = manualSource([ent("A")], { managesAlerts: true, acknowledge: ack });
    const d = createDashboard({ source: src, categories: cats, groups });
    await d.start();
    src.push({
      records: [rec("A", 50, "alarm")],
      alerts: [{ id: "X1", entityId: "A", priority: "alarm", state: "active", acked: false, raisedAt: "t", updatedAt: "t", clearedAt: null }],
    });
    expect(d.getState().alerts.map(a => a.id)).toEqual(["X1"]);
    await d.acknowledge("X1");
    expect(ack).toHaveBeenCalledWith("X1");
    expect(d.getState().alerts[0].acked).toBe(true);
  });

  it("computes derived tiles and updates the header", async () => {
    const src = manualSource([ent("A")]);
    const d = createDashboard({
      source: src, categories: cats, groups, header: { title: "Site" },
      derived: ({ value }) => [{ key: "a", label: "A", value: `${value("A")} units`, severity: value("A") > 10 ? "warning" : "normal" }],
    });
    await d.start();
    src.push({ records: [rec("A", 12, "normal")] });
    expect(d.derived()[0]).toMatchObject({ value: "12 units", severity: "warning" });
    d.setHeader({ subtitle: "Pad 3" });
    expect(d.getState().header).toEqual({ title: "Site", subtitle: "Pad 3" });
  });
});

describe("pollingSource", () => {
  it("loads a snapshot and polls with the cursor", async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      const body = url.includes("/snapshot")
        ? { entities: [ent("A")], records: [{ ...rec("A", 1, "normal"), seq: 7 }] }
        : { records: [{ ...rec("A", 2, "normal"), seq: 8 }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const src = pollingSource({ baseUrl: "http://svc/api", intervalMs: 5, fetch: fakeFetch });
    const snap = await src.load();
    expect(snap.entities).toHaveLength(1);
    const got: SourceBatch[] = [];
    const stop = src.subscribe({ onBatch: b => got.push(b), onStatus: () => {} });
    await new Promise(r => setTimeout(r, 30));
    stop();
    expect(calls[1]).toBe("http://svc/api/records?after=7");
    expect(got[0].records[0].seq).toBe(8);
    expect(calls.some(c => c.endsWith("after=8"))).toBe(true);
  });
});

describe("simulator", () => {
  it("pushes an entity into alarm during its scenario", async () => {
    const sim = createSimulator({
      entities: [{ ...ent("H2S"), dp: 1, sim: { base: 1, noise: 0.2, period: 1 } }],
      scenarios: [{ id: "leak", title: "Leak", window: [0, 100], effects: [{ entityId: "H2S", kind: "plateau", delta: 50, rise: 5 }] }],
      startAt: 50, warmup: 30,
    });
    const snap = await sim.load();
    const last = snap.records!.filter(r => r.entityId === "H2S").pop()!;
    expect(last.severity).toBe("alarm");
    expect(sim.clock().loopT).toBeCloseTo(50, 0);
  });
});

describe("cloudEventMapper", () => {
  it("maps CloudEvents to records with a severity", () => {
    const map = cloudEventMapper();
    const r = map({ id: "1", source: "argo", type: "deployment.finished", subject: "payments-api|prod", time: "2026-10-22T10:00:00Z", data: { status: "failed" } });
    expect(r).toMatchObject({ entityId: "payments-api|prod", kind: "deployment.finished", status: "failed", severity: "alarm" });
  });
});
