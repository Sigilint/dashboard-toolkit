// Dashboard controller: one object that owns a dashboard's state and wires a
// DataSource to it. Framework-agnostic — it is an external store with
// immutable snapshots, so React (useSyncExternalStore), Svelte or plain JS
// can all subscribe to it.
//
//   source ──load/subscribe──► Dashboard ──snapshot──► UI
//                                 │  records → latest, history, buffer
//                                 │  records → AlertEngine (unless the source manages alerts)
//                                 │  filters, saved views, live/paused, selection, header
//                                 ▼
//                          derived tiles, facet counts, visibility

import type {
  Alert, Category, ConnectionStatus, DataRecord, DerivedTile, Entity, FacetDef, FilterState,
  Group, HeaderInfo, Severity, View,
} from "./types";
import type { DataSource, SourceBatch } from "./sources/types";
import { AlertEngine, sortAlerts } from "./alerts";
import {
  canonicalFilters, defaultFacets, emptyFilters, facetCounts, facetOptions, isVisible as visibleFn,
  matchEntity, matchRecord as matchRecordFn, type MatchContext,
} from "./filters";
import { findMatchingView, makeView, viewHash, type ViewStorage } from "./views";

export interface DerivedContext {
  state: DashboardState;
  /** Latest value of an entity, or the fallback */
  value: (entityId: string, fallback?: number) => number;
  severity: (entityId: string) => Severity;
  latest: (entityId: string) => DataRecord | undefined;
}

export interface DashboardConfig {
  source: DataSource;
  categories: Category[];
  groups?: Group[];
  /** Filter facets; default category, type and location */
  facets?: FacetDef[];
  header?: HeaderInfo;
  /** Computes the summary strip's derived-state tiles */
  derived?: (ctx: DerivedContext) => DerivedTile[];
  views?: { builtIn?: View[]; storage?: ViewStorage };
  initialFilters?: Partial<FilterState>;
  /** Samples kept per entity; default 300 */
  historyLimit?: number;
  /** Records kept for the stream; default 2000 */
  bufferLimit?: number;
}

export interface DashboardState {
  status: ConnectionStatus;
  error?: string;
  header: HeaderInfo;
  categories: Category[];
  groups: Group[];
  facets: FacetDef[];
  entities: Entity[];
  entityById: Map<string, Entity>;
  latest: Record<string, DataRecord>;
  /** Newest first */
  records: DataRecord[];
  /** Sorted: active first, then priority, then newest */
  alerts: Alert[];
  filters: FilterState;
  builtInViews: View[];
  savedViews: View[];
  /** View whose filters equal the current filters, if any */
  activeView?: View;
  /** Subscription key for the current selection */
  viewHash: string;
  live: boolean;
  /** Records waiting while paused */
  queued: number;
  selectedId: string | null;
  clock?: string;
  /** Incoming records per second, smoothed */
  rate: number;
  /** Bumps on every change */
  version: number;
}

type Listener = () => void;

export class Dashboard {
  private state: DashboardState;
  private listeners = new Set<Listener>();
  private engine = new AlertEngine();
  private history = new Map<string, DataRecord[]>();
  private pending: SourceBatch[] = [];
  private unsubscribe?: () => void;
  private maxSeq = 0;
  private arrivals: [number, number][] = [];
  private storage?: ViewStorage;

  constructor(readonly config: DashboardConfig) {
    const groups = config.groups || [];
    const filters = canonicalFilters({ ...emptyFilters(), ...config.initialFilters });
    this.storage = config.views?.storage;
    this.state = {
      status: "idle",
      header: config.header || { title: "Dashboard" },
      categories: config.categories,
      groups,
      facets: config.facets || defaultFacets(config.categories, groups),
      entities: [],
      entityById: new Map(),
      latest: {},
      records: [],
      alerts: [],
      filters,
      builtInViews: (config.views?.builtIn || []).map(v => ({ ...v, filters: canonicalFilters(v.filters), builtIn: true })),
      savedViews: [],
      viewHash: viewHash(filters),
      live: true,
      queued: 0,
      selectedId: null,
      rate: 0,
      version: 0,
    };
    this.state.activeView = this.findActive();
  }

  // ---------- store protocol ----------

  getState = (): DashboardState => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<DashboardState>) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    if ("filters" in patch || "savedViews" in patch || "builtInViews" in patch) {
      this.state.activeView = this.findActive();
      this.state.viewHash = viewHash(this.state.filters);
    }
    this.listeners.forEach(l => l());
  }

  // ---------- lifecycle ----------

  async start(): Promise<void> {
    this.set({ status: "loading", error: undefined });
    try {
      const [snap, saved] = await Promise.all([
        this.config.source.load(),
        this.storage ? this.storage.load().catch(() => []) : Promise.resolve([] as View[]),
      ]);
      const builtIn = snap.views
        ? [...this.state.builtInViews, ...snap.views.map(v => ({ ...v, filters: canonicalFilters(v.filters), builtIn: true }))]
        : this.state.builtInViews;
      this.set({
        entities: snap.entities,
        entityById: new Map(snap.entities.map(e => [e.id, e])),
        header: { ...this.state.header, ...snap.header, meta: snap.header?.meta || this.state.header.meta },
        builtInViews: builtIn,
        savedViews: saved,
        clock: snap.clock,
      });
      this.ingest({ records: snap.records || [], alerts: snap.alerts, clock: snap.clock }, false);
      this.unsubscribe = this.config.source.subscribe({
        onBatch: b => this.onBatch(b),
        onStatus: (status, error) => this.set({ status, error }),
      });
      if (this.state.status === "loading") this.set({ status: "connected" });
    } catch (err) {
      this.set({ status: "error", error: String(err) });
    }
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.set({ status: "idle" });
  }

  // ---------- data ----------

  private onBatch(b: SourceBatch) {
    const now = Date.now();
    this.arrivals.push([now, b.records.length]);
    while (this.arrivals.length && this.arrivals[0][0] < now - 10000) this.arrivals.shift();
    if (!this.state.live) {
      this.pending.push(b);
      this.set({ queued: this.state.queued + b.records.length });
      return;
    }
    this.ingest(b, true);
  }

  private ingest(b: SourceBatch, countRate: boolean) {
    const { historyLimit = 300, bufferLimit = 2000 } = this.config;
    let entities = this.state.entities, entityById = this.state.entityById;
    if (b.entities?.length) {
      entityById = new Map(entityById);
      b.entities.forEach(e => entityById.set(e.id, e));
      entities = [...entityById.values()];
    }
    const fresh = b.records.filter(r => r.seq > this.maxSeq).sort((a, z) => a.seq - z.seq);
    const latest = fresh.length ? { ...this.state.latest } : this.state.latest;
    const manages = !!this.config.source.managesAlerts || !!b.alerts;
    let alertsChanged = false;
    for (const r of fresh) {
      this.maxSeq = r.seq;
      latest[r.entityId] = r;
      const h = this.history.get(r.entityId) || [];
      h.push(r);
      if (h.length > historyLimit) h.splice(0, h.length - historyLimit);
      this.history.set(r.entityId, h);
      if (!manages && this.engine.apply(r, entityById.get(r.entityId))) alertsChanged = true;
    }
    const records = fresh.length
      ? fresh.slice().reverse().concat(this.state.records).slice(0, bufferLimit)
      : this.state.records;
    const span = this.arrivals.length > 1 ? (this.arrivals[this.arrivals.length - 1][0] - this.arrivals[0][0]) / 1000 : 0;
    const total = this.arrivals.slice(1).reduce((a, [, n]) => a + n, 0);
    this.set({
      entities, entityById, latest, records,
      alerts: b.alerts ? sortAlerts(b.alerts) : alertsChanged ? sortAlerts(this.engine.list()) : this.state.alerts,
      clock: b.clock || this.state.clock,
      rate: countRate && span > 0 ? total / span : this.state.rate,
    });
  }

  /** Samples held for an entity, oldest first */
  historyFor(entityId: string): DataRecord[] {
    return this.history.get(entityId) || [];
  }

  /** Backfill an entity's history from the source, if it can */
  async loadHistory(entityId: string, limit = 180): Promise<DataRecord[]> {
    if (!this.config.source.history) return this.historyFor(entityId);
    const older = await this.config.source.history(entityId, limit);
    const have = this.history.get(entityId) || [];
    const seen = new Set(have.map(r => r.seq));
    const merged = [...older.filter(r => !seen.has(r.seq)), ...have].sort((a, b) => a.seq - b.seq)
      .slice(-(this.config.historyLimit ?? 300));
    this.history.set(entityId, merged);
    this.set({});
    return merged;
  }

  // ---------- live / paused ----------

  setLive(live: boolean): void {
    if (live === this.state.live) return;
    if (live) {
      const queued = this.pending;
      this.pending = [];
      this.state = { ...this.state, live: true, queued: 0 };
      const merged: SourceBatch = {
        records: queued.flatMap(b => b.records),
        alerts: [...queued].reverse().find(b => b.alerts)?.alerts,
        entities: queued.flatMap(b => b.entities || []),
        clock: queued.length ? queued[queued.length - 1].clock : undefined,
      };
      this.ingest(merged, false);
    } else {
      this.set({ live: false });
    }
  }

  // ---------- filters & views ----------

  setFilters(next: Partial<FilterState> | ((f: FilterState) => Partial<FilterState>)): void {
    const patch = typeof next === "function" ? next(this.state.filters) : next;
    this.set({ filters: canonicalFilters({ ...this.state.filters, ...patch }) });
  }

  resetFilters(): void {
    this.set({ filters: emptyFilters() });
  }

  applyView(viewId: string): void {
    const v = [...this.state.builtInViews, ...this.state.savedViews].find(x => x.id === viewId);
    if (v) this.set({ filters: canonicalFilters(v.filters) });
  }

  async saveView(name: string, extra: Partial<View> = {}): Promise<View> {
    const v = makeView(name, this.state.filters, extra);
    const savedViews = [...this.state.savedViews, v];
    this.set({ savedViews });
    await this.storage?.save(savedViews);
    return v;
  }

  async deleteView(viewId: string): Promise<void> {
    const savedViews = this.state.savedViews.filter(v => v.id !== viewId);
    this.set({ savedViews });
    await this.storage?.save(savedViews);
  }

  private findActive(): View | undefined {
    return findMatchingView([...this.state.builtInViews, ...this.state.savedViews], this.state.filters);
  }

  // ---------- selection, alerts, header ----------

  select(entityId: string | null): void {
    this.set({ selectedId: entityId });
    if (entityId && this.config.source.history && this.historyFor(entityId).length < 20) {
      this.loadHistory(entityId).catch(() => {});
    }
  }

  async acknowledge(alertId: string): Promise<void> {
    if (this.config.source.managesAlerts && this.config.source.acknowledge) {
      // optimistic; the next batch carries the server's view
      this.set({ alerts: this.state.alerts.map(a => (a.id === alertId ? { ...a, acked: true } : a)) });
      await this.config.source.acknowledge(alertId);
      return;
    }
    if (this.engine.acknowledge(alertId)) this.set({ alerts: sortAlerts(this.engine.list()) });
  }

  async acknowledgeAll(): Promise<void> {
    if (this.config.source.managesAlerts && this.config.source.acknowledgeAll) {
      this.set({ alerts: this.state.alerts.map(a => ({ ...a, acked: true })) });
      await this.config.source.acknowledgeAll();
      return;
    }
    this.engine.acknowledgeAll();
    this.set({ alerts: sortAlerts(this.engine.list()) });
  }

  setHeader(patch: Partial<HeaderInfo>): void {
    this.set({ header: { ...this.state.header, ...patch } });
  }

  // ---------- queries ----------

  private ctx(s = this.state): MatchContext {
    return { facets: s.facets, groups: new Map(s.groups.map(g => [g.key, g])) };
  }

  severityOf(entityId: string, s = this.state): Severity {
    return s.latest[entityId]?.severity || "normal";
  }

  isVisible(e: Entity, s = this.state): boolean {
    return visibleFn(e, this.severityOf(e.id, s), s.filters, this.ctx(s));
  }

  /** Entities passing search + facets, ignoring severity (for facet counts) */
  matchesWithoutSeverity(e: Entity, s = this.state): boolean {
    return matchEntity(e, s.filters, this.ctx(s));
  }

  matchRecord(r: DataRecord, s = this.state): boolean {
    return matchRecordFn(r, s.entityById.get(r.entityId), s.filters, this.ctx(s));
  }

  visibleEntities(s = this.state): Entity[] {
    return s.entities.filter(e => this.isVisible(e, s));
  }

  facetOptions(key: string, s = this.state) {
    const def = s.facets.find(f => f.key === key);
    return def ? facetOptions(def, s.entities) : [];
  }

  facetCounts(key: string, s = this.state): Map<string, number> {
    const def = s.facets.find(f => f.key === key);
    return def ? facetCounts(def, s.entities) : new Map();
  }

  derived(s = this.state): DerivedTile[] {
    if (!this.config.derived) return [];
    return this.config.derived({
      state: s,
      value: (id, fallback = 0) => s.latest[id]?.value ?? fallback,
      severity: id => this.severityOf(id, s),
      latest: id => s.latest[id],
    });
  }
}

export function createDashboard(config: DashboardConfig): Dashboard {
  return new Dashboard(config);
}
