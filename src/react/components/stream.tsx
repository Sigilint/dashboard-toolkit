// Event stream: every record as it arrives, newest first. Table or raw JSON,
// match-filters, exceptions-only, pause, clear, collapse / normal / expand,
// click a row to open its entity, new rows flash.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDashboard, useDashboardState, useMatchRecord } from "../context";
import { SEVERITY_LABEL } from "../../core/severity";
import { formatTime, formatUnit, formatValue } from "../../core/format";
import type { DataRecord, Entity, Group } from "../../core/types";
import { CategoryIcon, StatusIcon } from "./glyphs";
import type { StreamSize } from "./shell";

export interface StreamColumn {
  key: string;
  label: string;
  render: (r: DataRecord, e: Entity | undefined, g: Group | undefined) => ReactNode;
  className?: string;
  /** Hide on narrow screens */
  secondary?: boolean;
}

/** Columns for sensor-style records */
export const SENSOR_COLUMNS: StreamColumn[] = [
  { key: "time", label: "Time", render: r => formatTime(r.ts, true) },
  { key: "entity", label: "Sensor", className: "dt-cell-id", render: r => r.entityId },
  { key: "type", label: "Type", secondary: true, className: "muted", render: (_, e) => e?.typeLabel || e?.type },
  { key: "group", label: "Location", render: (_, e) => e?.group ?? "" },
  { key: "value", label: "Value", className: "num", render: (r, e) => formatValue(r.value, e) },
  { key: "unit", label: "Unit", className: "muted", render: (_, e) => formatUnit(e) },
  { key: "status", label: "Status", className: "dt-cell-status", render: r => <>{r.severity !== "normal" && <StatusIcon status={r.severity} size={10} />} {SEVERITY_LABEL[r.severity]}</> },
  { key: "quality", label: "Quality", secondary: true, render: r => r.quality ?? "" },
  { key: "seq", label: "Seq", secondary: true, className: "num muted", render: r => r.seq },
];

/** Columns for workflow-event records */
export const EVENT_COLUMNS: StreamColumn[] = [
  { key: "time", label: "Time", render: r => formatTime(r.ts) },
  { key: "kind", label: "Event", render: r => r.kind },
  { key: "entity", label: "Target", className: "dt-cell-id", render: (r, e) => e?.name || r.entityId },
  { key: "group", label: "Group", render: (_, __, g) => g?.label ?? "" },
  { key: "status", label: "Status", className: "dt-cell-status", render: r => <>{r.severity !== "normal" && <StatusIcon status={r.severity} size={10} />} {r.status || SEVERITY_LABEL[r.severity]}</> },
  { key: "message", label: "Detail", render: r => r.message ?? "" },
];

export interface EventStreamProps {
  title?: string;
  columns?: StreamColumn[];
  size: StreamSize;
  setSize: (s: StreamSize) => void;
  /** Max rows rendered; default 250 */
  maxRows?: number;
}

export function EventStream({ title = "Event stream", columns, size, setSize, maxRows = 250 }: EventStreamProps) {
  const d = useDashboard();
  const s = useDashboardState();
  const matchRecord = useMatchRecord();
  const [paused, setPaused] = useState(false);
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [matchFilters, setMatchFilters] = useState(true);
  const [onlySelected, setOnlySelected] = useState(false);
  const [view, setView] = useState<"table" | "json">("table");
  const [clearedSeq, setClearedSeq] = useState(0);
  const frozen = useRef(s.records);
  if (!paused) frozen.current = s.records;

  const groups = new Map(s.groups.map(g => [g.key, g]));
  const cats = new Map(s.categories.map(c => [c.key, c]));
  const cols = columns || SENSOR_COLUMNS;

  const seen = useRef<number | null>(null);
  const newest = frozen.current[0]?.seq ?? 0;
  const flashAfter = seen.current ?? newest;
  useEffect(() => { seen.current = newest; }, [newest]);

  const shown: DataRecord[] = [];
  for (const r of frozen.current) {
    if (r.seq <= clearedSeq) break;
    if (onlySelected && s.selectedId && r.entityId !== s.selectedId) continue;
    if (exceptionsOnly && r.severity === "normal") continue;
    if (matchFilters && !matchRecord(r)) continue;
    shown.push(r);
    if (shown.length >= maxRows) break;
  }
  const collapsed = size === "collapsed", expanded = size === "expanded";
  const rowProps = (r: DataRecord) => ({
    tabIndex: 0, title: `Open ${r.entityId}`,
    onClick: () => d.select(r.entityId),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") d.select(r.entityId); },
  });
  const cls = (r: DataRecord) => `st-${r.severity}${r.seq > flashAfter ? " new" : ""}${r.entityId === s.selectedId ? " sel" : ""}`;

  return (
    <section className={`dt-stream ${collapsed ? "collapsed" : ""}`} aria-label={title}>
      <header className="dt-panel-head dt-stream-head">
        <span className="dt-panel-title">{title}</span>
        <span className="mono muted">
          {Math.round(s.rate * 60).toLocaleString()}/min · showing {shown.length}
          {(paused || !s.live) && <span className="dt-tag">paused</span>}
        </span>
        <div className="dt-stream-controls">
          {!collapsed && (
            <>
              <label className="dt-toggle" title="Off shows everything regardless of the filters">
                <input type="checkbox" checked={matchFilters} onChange={e => setMatchFilters(e.target.checked)} /> Match filters
              </label>
              <label className="dt-toggle">
                <input type="checkbox" checked={exceptionsOnly} onChange={e => setExceptionsOnly(e.target.checked)} /> Exceptions only
              </label>
              {s.selectedId && (
                <label className="dt-toggle hide-sm">
                  <input type="checkbox" checked={onlySelected} onChange={e => setOnlySelected(e.target.checked)} /> Selected only
                </label>
              )}
              <div className="dt-seg small">
                <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>Table</button>
                <button className={view === "json" ? "on" : ""} onClick={() => setView("json")}>JSON</button>
              </div>
              <button className={`dt-btn small ${paused ? "on" : ""}`} aria-pressed={paused} onClick={() => setPaused(!paused)}>
                {paused ? "▶ Resume" : "❚❚ Pause"}
              </button>
              <button className="dt-btn small hide-sm" onClick={() => setClearedSeq(newest)}>Clear</button>
              {clearedSeq > 0 && <button className="dt-btn small hide-sm" onClick={() => setClearedSeq(0)}>Restore</button>}
            </>
          )}
          <button className="dt-btn icon" aria-pressed={expanded} aria-label={expanded ? "Restore stream height" : "Expand stream"}
                  onClick={() => setSize(expanded ? "normal" : "expanded")}>{expanded ? "⤓" : "⤒"}</button>
          <button className="dt-btn icon" aria-expanded={!collapsed} aria-label={collapsed ? "Show stream" : "Collapse stream"}
                  onClick={() => setSize(collapsed ? "normal" : "collapsed")}>{collapsed ? "▴" : "▾"}</button>
        </div>
      </header>
      {!collapsed && (
        <div className="dt-stream-body">
          {view === "table" ? (
            <table className="dt-stream-table mono">
              <thead><tr>{cols.map(c => <th key={c.key} className={`${c.className || ""} ${c.secondary ? "hide-sm" : ""}`}>{c.label}</th>)}</tr></thead>
              <tbody>
                {shown.map(r => {
                  const e = s.entityById.get(r.entityId);
                  const g = e ? groups.get(e.group) : undefined;
                  return (
                    <tr key={r.seq} {...rowProps(r)} className={cls(r)}>
                      {cols.map(c => (
                        <td key={c.key} className={`${c.className || ""} ${c.secondary ? "hide-sm" : ""}`}>
                          {c.key === "entity" && <CategoryIcon category={e && cats.get(e.category)} size={12} />} {c.render(r, e, g)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <pre className="dt-stream-json">
              {shown.slice(0, 80).map(r => <div key={r.seq} {...rowProps(r)} className={`dt-json-line ${cls(r)}`}>{JSON.stringify(r)}</div>)}
            </pre>
          )}
          {shown.length === 0 && <div className="dt-empty">{clearedSeq ? "Cleared — new records will appear here." : "No records match."}</div>}
        </div>
      )}
    </section>
  );
}
