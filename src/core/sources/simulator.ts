// In-browser simulator source for demos, prototypes and tests. Generalised
// from the offshore-platform and well-site monitors' simulated APIs:
// numeric entities wander around a baseline, scripted scenarios push them
// over their limits on a loop, and an optional event generator emits
// workflow-style records (deploys, door openings…).

import type { DataRecord, Entity, HeaderInfo, Severity, View } from "../types";
import { evaluateLimits } from "../severity";
import type { DataSource, SourceHandlers, SourceSnapshot } from "./types";

export interface SimParams {
  base: number;
  /** Noise amplitude */
  noise?: number;
  /** Reporting period, seconds */
  period?: number;
}

export interface SimEntity extends Entity {
  sim?: SimParams;
}

export type Effect =
  | { entityId: string; kind: "plateau"; delta: number; rise?: number; at?: [number, number] }
  | { entityId: string; kind: "ramp"; delta: number; at?: [number, number] }
  | { entityId: string; kind: "offline"; at?: [number, number] };

export interface Scenario {
  id: string;
  title: string;
  category?: string;
  /** [start, end] seconds within the loop */
  window: [number, number];
  story?: string;
  effects: Effect[];
}

export interface EventContext {
  /** Simulated seconds since start */
  t: number;
  /** Seconds within the loop */
  loopT: number;
  /** Deterministic pseudo-random in [0, 1) */
  random: () => number;
  emit: (r: Omit<DataRecord, "seq" | "ts"> & { ts?: string }) => void;
}

export interface SimulatorOptions {
  entities: SimEntity[];
  scenarios?: Scenario[];
  /** Loop length, seconds; default 600 */
  loopSeconds?: number;
  /** Loop second that "now" lands on after warm-up; default 0 */
  startAt?: number;
  speed?: number;
  /** Wall-clock tick; default 500 ms */
  tickMs?: number;
  /** Seconds of history generated before "now"; default 60 */
  warmup?: number;
  /** Called every tick to emit event-style records */
  events?: (ctx: EventContext) => void;
  /** Map a value to a severity; default evaluates the entity's limits */
  severityOf?: (entity: SimEntity, value: number | null) => Severity;
  header?: Partial<HeaderInfo>;
  views?: View[];
  historyLimit?: number;
}

const smooth = (x: number) => x * x * (3 - 2 * x);
function hash(a: number, b: number) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function noise(i: number, t: number) {
  return 0.55 * Math.sin(t * 0.21 + i * 1.7) + 0.3 * Math.sin(t * 0.73 + i * 4.1) + 0.4 * (hash(i, Math.floor(t)) - 0.5);
}
function envelope(e: Effect, win: [number, number], t: number) {
  const [s, end] = e.at || win;
  if (t < s || t > end) return 0;
  if (e.kind === "ramp") return (t - s) / (end - s);
  const rise = (e.kind === "plateau" && e.rise) || 20;
  if (t < s + rise) return smooth((t - s) / rise);
  if (t > end - rise) return smooth((end - t) / rise);
  return 1;
}

export interface Simulator extends DataSource {
  setSpeed(speed: number): void;
  /** Jump the loop to a second, without rewinding timestamps */
  seek(loopT: number): void;
  clock(): { t: number; loopT: number; loopSeconds: number; speed: number; active: string[] };
  readonly scenarios: Scenario[];
}

export function createSimulator(opts: SimulatorOptions): Simulator {
  const loop = opts.loopSeconds ?? 600;
  const scenarios = opts.scenarios ?? [];
  const historyLimit = opts.historyLimit ?? 300;
  const entities = opts.entities;
  const byId = new Map(entities.map(e => [e.id, e]));
  const effects = new Map<string, { e: Effect; win: [number, number] }[]>();
  scenarios.forEach(sc => sc.effects.forEach(e => {
    if (!byId.has(e.entityId)) console.warn(`[simulator] scenario ${sc.id}: unknown entity ${e.entityId}`);
    const list = effects.get(e.entityId) || [];
    list.push({ e, win: sc.window });
    effects.set(e.entityId, list);
  }));
  const severityOf = opts.severityOf || ((ent: SimEntity, v: number | null) => evaluateLimits(ent.limits, v).severity);

  const startWall = Date.now();
  let simT = 0, offset = opts.startAt ?? 0, speed = opts.speed ?? 1, seq = 0;
  let lastWall = performance.now();
  let rngState = 1;
  const random = () => { rngState = (rngState * 16807) % 2147483647; return (rngState - 1) / 2147483646; };
  const nextDue = new Map(entities.map((e, i) => [e.id, (i % 5) * 0.2]));
  const history = new Map<string, DataRecord[]>();
  const loopTime = (t: number) => (((t + offset) % loop) + loop) % loop;
  const iso = (t: number) => new Date(startWall + t * 1000).toISOString();

  const valueAt = (ent: SimEntity, i: number, lt: number): number | null => {
    if (!ent.sim) return null;
    let v = ent.sim.base + noise(i, lt) * (ent.sim.noise ?? 0);
    for (const { e, win } of effects.get(ent.id) || []) {
      const k = envelope(e, win, lt);
      if (e.kind === "offline") { if (k > 0) return null; }
      else v += e.delta * k;
    }
    if (ent.binary) return v >= 0.5 ? 1 : 0;
    const f = 10 ** (ent.dp ?? 1);
    return Math.round(v * f) / f;
  };

  const record = (r: Omit<DataRecord, "seq" | "ts"> & { ts?: string }, t: number): DataRecord => {
    const out = { ...r, seq: ++seq, ts: r.ts || iso(t) } as DataRecord;
    const h = history.get(out.entityId) || [];
    h.push(out);
    if (h.length > historyLimit) h.shift();
    history.set(out.entityId, h);
    return out;
  };

  const advance = (): DataRecord[] => {
    const now = performance.now();
    const from = simT;
    simT += ((now - lastWall) / 1000) * speed;
    lastWall = now;
    const due: [SimEntity, number, number][] = [];
    entities.forEach((ent, i) => {
      if (!ent.sim) return;
      const period = ent.sim.period ?? 2;
      let d = nextDue.get(ent.id)!;
      if (simT - d > 60) d = simT - 60;
      while (d <= simT) { due.push([ent, i, d]); d += period; }
      nextDue.set(ent.id, d);
    });
    due.sort((a, b) => a[2] - b[2]);
    const out = due.map(([ent, i, t]) => {
      const value = valueAt(ent, i, loopTime(t));
      return record({ entityId: ent.id, value, severity: severityOf(ent, value), kind: "reading", quality: value == null ? "NO_DATA" : "GOOD" }, t);
    });
    if (opts.events) {
      const emitted: DataRecord[] = [];
      opts.events({ t: simT, loopT: loopTime(simT), random, emit: r => emitted.push(record(r, simT)) });
      // keep the batch in time order even if events fired between readings
      out.push(...emitted);
      if (simT - from > 0) out.sort((a, b) => a.ts.localeCompare(b.ts) || a.seq - b.seq);
    }
    return out;
  };

  return {
    scenarios,
    async load(): Promise<SourceSnapshot> {
      const warm = opts.warmup ?? 60;
      simT = -warm;
      nextDue.forEach((d, k) => nextDue.set(k, d - warm));
      lastWall = performance.now() - (warm * 1000) / speed;
      const records = advance();
      return { entities, records, header: opts.header, views: opts.views, clock: iso(simT) };
    },
    subscribe({ onBatch, onStatus }: SourceHandlers) {
      onStatus("connected");
      const id = setInterval(() => onBatch({ records: advance(), clock: iso(simT) }), opts.tickMs ?? 500);
      return () => clearInterval(id);
    },
    async history(entityId, limit) {
      return (history.get(entityId) || []).slice(-limit);
    },
    setSpeed(s) { advance(); speed = s; },
    seek(lt) { advance(); offset += lt - loopTime(simT); },
    clock() {
      const lt = loopTime(simT);
      return { t: simT, loopT: lt, loopSeconds: loop, speed, active: scenarios.filter(s => lt >= s.window[0] && lt <= s.window[1]).map(s => s.id) };
    },
  };
}
