// Detail drawer for the selected entity, and the Sparkline trend chart.
// Default sections cover any entity; apps add their own with `extra` or
// drop defaults with `hide`.

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useDashboard, useDashboardState, useHistory, useSelectedEntity } from "../context";
import { SEVERITY_LABEL, SEVERITY_RANK } from "../../core/severity";
import { formatLimits, formatTime, formatUnit, formatValue } from "../../core/format";
import type { Alert, DataRecord, Entity } from "../../core/types";
import { CategoryIcon, StatusIcon, StatusPill } from "./glyphs";

// ---------- Sparkline ----------

export interface SparklineProps {
  data: DataRecord[];
  entity?: Entity;
  height?: number;
}

export function Sparkline({ data, entity, height = 110 }: SparklineProps) {
  const [hi, setHi] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const VW = 400, VH = height, PAD = 6;
  const pts = data.filter(d => typeof d.value === "number") as (DataRecord & { value: number })[];
  if (pts.length < 2) return <div className="dt-spark-empty mono">Collecting data…</div>;

  let lo = Math.min(...pts.map(p => p.value)), up = Math.max(...pts.map(p => p.value));
  const span = Math.max(up - lo, Math.abs(up) * 0.02, 0.5);
  const lims: ["warning" | "alarm", number][] = [];
  const L = entity?.limits;
  if (L?.hi) lims.push(["warning", L.hi[0]], ["alarm", L.hi[1]]);
  if (L?.lo) lims.push(["warning", L.lo[0]], ["alarm", L.lo[1]]);
  const shown = entity?.binary ? [] : lims.filter(([, v]) => v >= lo - span * 1.2 && v <= up + span * 1.2);
  shown.forEach(([, v]) => { lo = Math.min(lo, v); up = Math.max(up, v); });
  const pad = (up - lo) * 0.1 || 1;
  lo -= pad; up += pad;

  const t = (r: DataRecord) => new Date(r.ts).getTime();
  const t0 = t(pts[0]), t1 = t(pts[pts.length - 1]);
  const x = (r: DataRecord) => PAD + (VW - 2 * PAD) * (t1 === t0 ? 0 : (t(r) - t0) / (t1 - t0));
  const y = (v: number) => PAD + (VH - 2 * PAD) * (1 - (v - lo) / (up - lo));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * VW;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(p) - sx) < Math.abs(x(pts[best]) - sx)) best = i; });
    setHi(best);
  };
  const hp = hi != null ? pts[hi] : null;
  const last = pts[pts.length - 1];

  return (
    <div className="dt-spark" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="dt-spark-svg" style={{ height }}
           role="img" aria-label={`Trend of ${pts.length} samples`}>
        {shown.map(([k, v], i) => <line key={i} x1={PAD} x2={VW - PAD} y1={y(v)} y2={y(v)} className={`dt-lim ${k}`} />)}
        <path d={d} className="dt-spark-line" />
        <circle cx={x(last)} cy={y(last.value)} r="3" className="dt-spark-dot" />
        {hp && <line x1={x(hp)} x2={x(hp)} y1={PAD} y2={VH - PAD} className="dt-spark-cross" />}
        {hp && <circle cx={x(hp)} cy={y(hp.value)} r="3.5" className="dt-spark-dot" />}
      </svg>
      <div className="dt-spark-axis mono">
        <span>{formatTime(pts[0].ts)}</span><span>{Math.round((t1 - t0) / 1000)} s window</span><span>{formatTime(last.ts)}</span>
      </div>
      {shown.length > 0 && (
        <div className="dt-spark-legend mono">
          {shown.some(s => s[0] === "warning") && <span><i className="dt-lim-key warning" /> warn limit</span>}
          {shown.some(s => s[0] === "alarm") && <span><i className="dt-lim-key alarm" /> alarm limit</span>}
        </div>
      )}
      {hp && (
        <div className="dt-spark-tip mono" style={{ left: `${(x(hp) / VW) * 100}%` }}>
          {formatValue(hp.value, entity)} {formatUnit(entity)} · {formatTime(hp.ts)}
        </div>
      )}
    </div>
  );
}

// ---------- Drawer ----------

export function DrawerSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="dt-dr-sec">
      <h3 className="dt-dr-h">{title}{aside && <span className="dt-dr-aside">{aside}</span>}</h3>
      {children}
    </section>
  );
}

export interface DrawerContext {
  entity: Entity;
  latest?: DataRecord;
  alert?: Alert;
  history: DataRecord[];
}

export type DefaultSection = "alert" | "trend" | "about" | "related" | "recent" | "tags" | "raw";

export interface DetailDrawerProps {
  /** Sections inserted after the trend */
  extra?: (ctx: DrawerContext) => ReactNode;
  /** Default sections to leave out */
  hide?: DefaultSection[];
  /** Extra buttons in the head */
  actions?: (ctx: DrawerContext) => ReactNode;
  /** Label for the related-entities section; default "Also at {group}" */
  relatedLabel?: (groupLabel: string) => string;
}

export function DetailDrawer({ extra, hide = [], actions, relatedLabel }: DetailDrawerProps) {
  const d = useDashboard();
  const s = useDashboardState();
  const entity = useSelectedEntity();
  const history = useHistory(entity?.id);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = !!entity;

  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") d.select(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, d]);

  if (!entity) return null;
  const latest = s.latest[entity.id];
  const alert = s.alerts.find(a => a.entityId === entity.id);
  const severity = latest?.severity || "normal";
  const cat = s.categories.find(c => c.key === entity.category);
  const group = s.groups.find(g => g.key === entity.group);
  const ctx: DrawerContext = { entity, latest, alert, history };
  const show = (k: DefaultSection) => !hide.includes(k);
  const numeric = typeof latest?.value === "number" || latest?.value === null;
  const related = s.entities
    .filter(e => e.group === entity.group && e.id !== entity.id)
    .sort((a, b) => SEVERITY_RANK[d.severityOf(b.id, s)] - SEVERITY_RANK[d.severityOf(a.id, s)] || a.name.localeCompare(b.name));
  const recent = history.slice(-8).reverse();

  return (
    <>
      <div className="dt-drawer-scrim" onClick={() => d.select(null)} />
      <aside className={`dt-drawer st-${severity}`} role="dialog" aria-label={`${entity.name} details`}>
        <header className="dt-dr-head">
          <div className="dt-row">
            <CategoryIcon category={cat} size={18} />
            <span className="dt-panel-title">{cat?.label}</span>
            <span className="mono muted">{entity.id}</span>
            <button ref={closeRef} className="dt-btn icon dt-dr-close" aria-label="Close details (Esc)" onClick={() => d.select(null)}>×</button>
          </div>
          <h2 className="dt-dr-name">{entity.name}</h2>
          <div className="dt-dr-type">{entity.typeLabel || entity.type}{group && ` · ${group.label}`}</div>
          <div className="dt-dr-reading">
            {numeric ? (
              <><span className="dt-dr-value mono">{formatValue(latest?.value, entity)}</span><span className="muted">{formatUnit(entity)}</span></>
            ) : (
              <span className="dt-dr-value small mono">{latest?.status || latest?.kind || "—"}</span>
            )}
            <StatusPill status={severity} />
          </div>
          {numeric && <div className="dt-dr-limits mono">{formatLimits(entity.limits, entity)}</div>}
          {latest?.message && <p className="dt-dr-message">{latest.message}</p>}
          <div className="dt-row wrap">
            {alert && !alert.acked && (
              <button className="dt-btn small primary" onClick={() => d.acknowledge(alert.id)}>Acknowledge {alert.priority}</button>
            )}
            {actions?.(ctx)}
          </div>
        </header>

        <div className="dt-dr-body">
          {alert && show("alert") && (
            <DrawerSection title="Alert" aside={alert.id}>
              <dl className="dt-kv mono">
                <dt>Priority</dt><dd className={alert.priority === "fault" ? "muted" : `st-text-${alert.priority}`}>{SEVERITY_LABEL[alert.priority]}</dd>
                <dt>State</dt><dd>{alert.state === "rtn" ? "Returned to normal" : alert.acked ? "Acknowledged" : "Unacknowledged"}</dd>
                <dt>Raised</dt><dd>{formatTime(alert.raisedAt)}</dd>
                <dt>Updated</dt><dd>{formatTime(alert.updatedAt)}</dd>
                {alert.limit != null && <><dt>Limit</dt><dd>{entity.binary ? `when ${entity.binary[1]}` : `${alert.dir === "lo" ? "≤" : "≥"} ${alert.limit} ${entity.unit || ""}`}</dd></>}
                {alert.peak != null && <><dt>Peak</dt><dd>{formatValue(alert.peak, entity)} {formatUnit(entity)}</dd></>}
              </dl>
            </DrawerSection>
          )}

          {numeric && show("trend") && <DrawerSection title="Trend"><Sparkline data={history} entity={entity} height={130} /></DrawerSection>}

          {extra?.(ctx)}

          {show("about") && (entity.description || entity.insights?.length) ? (
            <DrawerSection title="About">
              {entity.description && <p>{entity.description}</p>}
              {entity.insights?.length ? <ul>{entity.insights.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
            </DrawerSection>
          ) : null}

          {show("related") && related.length > 0 && (
            <DrawerSection title={relatedLabel ? relatedLabel(group?.label || entity.group) : `Also at ${group?.label || entity.group}`}
                           aside={`${related.length}`}>
              <ul className="dt-dr-list">
                {related.slice(0, 12).map(e => {
                  const r = s.latest[e.id];
                  const sev = r?.severity || "normal";
                  return (
                    <li key={e.id}>
                      <button className={`dt-dr-item st-${sev}`} onClick={() => d.select(e.id)}>
                        <CategoryIcon category={s.categories.find(c => c.key === e.category)} size={13} />
                        <span className="dt-dr-item-label">{e.name}</span>
                        <span className="mono dt-dr-item-val">
                          {sev !== "normal" && <StatusIcon status={sev} size={10} />}
                          {typeof r?.value === "number" || r?.value === null ? `${formatValue(r?.value, e)} ${formatUnit(e)}` : r?.status || ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DrawerSection>
          )}

          {show("recent") && recent.length > 0 && (
            <DrawerSection title="Recent records">
              <table className="dt-dr-table mono">
                <tbody>
                  {recent.map(r => (
                    <tr key={r.seq} className={`st-${r.severity}`}>
                      <td>{formatTime(r.ts, true)}</td>
                      <td className="num">{typeof r.value === "number" || r.value === null ? `${formatValue(r.value, entity)} ${formatUnit(entity)}` : r.status || r.kind}</td>
                      <td>{r.severity !== "normal" && <StatusIcon status={r.severity} size={10} />} {SEVERITY_LABEL[r.severity]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DrawerSection>
          )}

          {show("tags") && entity.tags && Object.keys(entity.tags).length > 0 && (
            <DrawerSection title="Details">
              <dl className="dt-kv mono">
                {Object.entries(entity.tags).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
                {latest && <><dt>Last</dt><dd>{formatTime(latest.ts, true)}</dd></>}
                {latest?.quality && <><dt>Quality</dt><dd>{latest.quality}</dd></>}
              </dl>
            </DrawerSection>
          )}

          {show("raw") && (
            <DrawerSection title="Raw record">
              <details className="dt-dr-raw">
                <summary>Latest record as received</summary>
                <pre className="mono">{latest ? JSON.stringify(latest, null, 2) : "—"}</pre>
              </details>
            </DrawerSection>
          )}
        </div>
      </aside>
    </>
  );
}
