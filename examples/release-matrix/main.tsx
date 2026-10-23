// Release matrix example: builds, deployments and test runs flowing through
// four environments, shown as a components × environments matrix. The same
// pattern as the release dashboard, built from toolkit parts. Entities are
// component@environment cells; records are workflow events.

import { createRoot } from "react-dom/client";
import "../../src/styles/toolkit.css";
import {
  createDashboard, createSimulator, localViewStorage, emptyFilters,
  DashboardProvider, DashboardApp, Matrix, EVENT_COLUMNS, StatusIcon, formatAgo, useDashboardState,
  type Category, type Group, type SimEntity, type FacetDef, type DerivedTile, type DataRecord, type Entity,
} from "../../src";

const ENVS = [
  { key: "dev", label: "DEV", sub: "k8s-dev" },
  { key: "qa", label: "QA", sub: "k8s-qa" },
  { key: "staging", label: "STAGING", sub: "k8s-stg" },
  { key: "prod", label: "PROD", sub: "k8s-prod · protected" },
];

const categories: Category[] = [
  { key: "service", label: "Service", code: "S", shape: "square" },
  { key: "worker", label: "Worker", code: "W", shape: "triangle" },
  { key: "web", label: "Web app", code: "A", shape: "circle" },
];

const groups: Group[] = [
  { key: "payments", label: "Payments", description: "Team Ledger · acme/payments · GitHub Actions → Argo CD" },
  { key: "identity", label: "Identity", description: "Team Gatekeeper · acme/identity · GitLab CI → Argo CD" },
  { key: "catalog", label: "Catalog", description: "Team Shelf · acme/catalog · Jenkins → Spinnaker" },
];

const COMPONENTS = [
  { id: "payments-api", kind: "service", group: "payments", v: [2, 15] },
  { id: "ledger-worker", kind: "worker", group: "payments", v: [1, 9] },
  { id: "checkout-web", kind: "web", group: "payments", v: [5, 4] },
  { id: "auth-service", kind: "service", group: "identity", v: [3, 9] },
  { id: "user-profile", kind: "service", group: "identity", v: [1, 6] },
  { id: "catalog-api", kind: "service", group: "catalog", v: [4, 2] },
  { id: "storefront", kind: "web", group: "catalog", v: [8, 0] },
];

const entities: SimEntity[] = COMPONENTS.flatMap(c => ENVS.map((env, i) => ({
  id: `${c.id}@${env.key}`,
  name: `${c.id} in ${env.label}`,
  type: c.kind,
  typeLabel: categories.find(k => k.key === c.kind)!.label,
  category: c.kind,
  group: c.group,
  tags: { component: c.id, env: env.key, cluster: env.sub },
  meta: { version: `${c.v[0]}.${Math.max(0, c.v[1] - i)}.0` },
})));

// Event generator: start a run every few seconds; finish it a few seconds later
type Run = { entity: SimEntity; kind: "build" | "deployment" | "test.run"; endsAt: number; version: string };
const running: Run[] = [];
const version = new Map(entities.map(e => [e.id, e.meta!.version as string]));
const source = createSimulator({
  entities,
  tickMs: 700,
  warmup: 0,
  events: ({ t, random, emit }) => {
    if (random() < 0.35 && running.length < 6) {
      const c = COMPONENTS[Math.floor(random() * COMPONENTS.length)];
      const envIdx = Math.floor(random() * ENVS.length);
      const e = entities.find(x => x.id === `${c.id}@${ENVS[envIdx].key}`)!;
      if (!running.some(r => r.entity.id === e.id)) {
        const kind = envIdx === 0 ? "build" : random() < 0.35 ? "test.run" : "deployment";
        const prev = envIdx > 0 ? version.get(`${c.id}@${ENVS[envIdx - 1].key}`)! : bump(version.get(e.id)!);
        running.push({ entity: e, kind, endsAt: t + 3 + random() * 6, version: prev });
        emit({ entityId: e.id, kind: `${kind}.started`, status: "running", severity: "normal", message: `${version.get(e.id)} → ${prev}`, data: { version: prev } });
      }
    }
    for (const r of running.filter(r => r.endsAt <= t)) {
      running.splice(running.indexOf(r), 1);
      const roll = random();
      const status = roll < 0.12 ? "failed" : roll < 0.18 && r.kind === "deployment" ? "rolled_back" : "succeeded";
      if (status === "succeeded" && r.kind !== "test.run") version.set(r.entity.id, r.version);
      emit({
        entityId: r.entity.id, kind: `${r.kind}.finished`, status,
        severity: status === "failed" ? "alarm" : status === "rolled_back" ? "warning" : "normal",
        message: status === "succeeded" ? `${r.version} ${r.kind === "test.run" ? "passed" : "live"}` : status === "failed" ? `${r.kind} failed at ${r.version}` : `rolled back from ${r.version}`,
        data: { version: version.get(r.entity.id) },
      });
    }
  },
});

function bump(v: string) {
  const [a, b, c] = v.split(".").map(Number);
  return `${a}.${b + 1}.${c}`;
}

const facets: FacetDef[] = [
  { key: "group", label: "Project", get: e => e.group, options: groups.map(g => ({ value: g.key, label: g.label })) },
  { key: "env", label: "Environment", get: e => e.tags?.env, options: ENVS.map(e => ({ value: e.key, label: e.label })) },
  { key: "category", label: "Kind", get: e => e.category, options: categories.map(c => ({ value: c.key, label: c.label })) },
];

const dashboard = createDashboard({
  source,
  categories,
  groups,
  facets,
  header: { title: "Release Dashboard", subtitle: "Acme Corp", meta: [{ label: "release", value: "2026.11" }] },
  views: {
    builtIn: [
      { id: "all", name: "Environment matrix", filters: emptyFilters() },
      { id: "prod", name: "PROD watch", filters: { ...emptyFilters(), facets: { env: ["prod"] } } },
      { id: "payments", name: "Payments release", filters: { ...emptyFilters(), facets: { group: ["payments"] } } },
      { id: "broken", name: "Failures & rollbacks", filters: { ...emptyFilters(), severity: "attention" } },
    ],
    storage: localViewStorage("release-matrix-views"),
  },
  derived: ({ state }): DerivedTile[] => {
    const latest = Object.values(state.latest);
    const runningNow = latest.filter(r => r.status === "running").length;
    const failures = latest.filter(r => r.status === "failed").length;
    const pending = COMPONENTS.filter(c => ENVS.slice(1).some((env, i) => {
      const here = state.latest[`${c.id}@${env.key}`]?.data?.version ?? entities.find(e => e.id === `${c.id}@${env.key}`)!.meta!.version;
      const before = state.latest[`${c.id}@${ENVS[i].key}`]?.data?.version ?? entities.find(e => e.id === `${c.id}@${ENVS[i].key}`)!.meta!.version;
      return here !== before;
    })).length;
    return [
      { key: "running", label: "Running now", value: String(runningNow), severity: "normal", detail: "builds, deploys and test runs" },
      { key: "failures", label: "Failing cells", value: String(failures), severity: failures ? "alarm" : "normal", detail: failures ? "open the cell for the run" : "nothing failing" },
      { key: "pending", label: "Pending promotions", value: String(pending), severity: "normal", detail: "components with newer versions upstream" },
    ];
  },
});

function Cell({ e, r }: { e: Entity; r?: DataRecord }) {
  const v = (r?.data?.version as string) || (e.meta?.version as string);
  const kind = r?.kind?.split(".")[0];
  return (
    <>
      <div className="dt-row"><span className="mono dt-mx-main">{v}</span>{r && r.severity !== "normal" && <StatusIcon status={r.severity} size={11} />}</div>
      {r && (
        <div className="dt-row mono" style={{ fontSize: 10.5 }}>
          <span className="dt-tag" style={{ marginLeft: 0 }}>{kind}</span>
          <span className={r.status === "running" ? "rm-running" : ""}>{r.status}</span>
        </div>
      )}
      <div className="dt-mx-age muted">{r ? `${r.message} · ${formatAgo(r.ts)}` : "no events yet"}</div>
    </>
  );
}

function Main() {
  useDashboardState(); // re-render as events arrive
  return (
    <Matrix
      columns={ENVS}
      rowOf={e => e.tags!.component}
      columnOf={e => e.tags!.env}
      rowLabel={row => <><span>{row}</span><div className="muted" style={{ fontWeight: 400 }}>{COMPONENTS.find(c => c.id === row)!.kind}</div></>}
      groupLabel={g => <>{groups.find(x => x.key === g)!.label} <span className="muted" style={{ fontWeight: 400 }}>{groups.find(x => x.key === g)!.description}</span></>}
      renderCell={(e, r) => <Cell e={e} r={r} />}
    />
  );
}

const css = `.rm-running { color: var(--dt-accent); } .rm-running::before { content: "● "; animation: dt-blink 1.2s infinite; }`;

createRoot(document.getElementById("root")!).render(
  <DashboardProvider dashboard={dashboard} storageKey="release-matrix">
    <style>{css}</style>
    <DashboardApp
      main={<Main />}
      categoryTiles={false}
      searchPlaceholder="Component, environment, version…"
      streamTitle="Event stream"
      streamColumns={EVENT_COLUMNS}
      drawer={{ hide: ["trend"], relatedLabel: () => "Same project" }}
      defaultTheme="light"
      disclaimer="SIMULATED EVENTS"
    />
  </DashboardProvider>,
);
