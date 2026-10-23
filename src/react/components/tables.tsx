// Non-spatial main views: Matrix (rows × columns of entities, like the release
// dashboard's environment matrix) and EntityTable (a sortable list).

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useDashboard, useDashboardState, useIsVisible } from "../context";
import { SEVERITY_LABEL, SEVERITY_RANK } from "../../core/severity";
import { formatAgo, formatUnit, formatValue } from "../../core/format";
import type { DataRecord, Entity } from "../../core/types";
import { CategoryIcon, StatusIcon } from "./glyphs";

export interface MatrixColumn { key: string; label: string; sub?: string }

export interface MatrixProps {
  columns: MatrixColumn[];
  /** Row key for an entity (e.g. the component), and its label */
  rowOf: (e: Entity) => string;
  rowLabel?: (row: string, entities: Entity[]) => ReactNode;
  /** Column key for an entity (e.g. the environment) */
  columnOf: (e: Entity) => string;
  /** Section heading per group; rows are grouped by entity.group */
  groupLabel?: (group: string) => ReactNode;
  /** Cell body; defaults to value/status, kind and age */
  renderCell?: (e: Entity, latest: DataRecord | undefined) => ReactNode;
}

export function Matrix({ columns, rowOf, rowLabel, columnOf, groupLabel, renderCell }: MatrixProps) {
  const d = useDashboard();
  const s = useDashboardState();
  const isVisible = useIsVisible();
  const grid = useMemo(() => {
    const byGroup = new Map<string, Map<string, Map<string, Entity>>>();
    s.entities.forEach(e => {
      const g = byGroup.get(e.group) || new Map();
      const row = g.get(rowOf(e)) || new Map();
      row.set(columnOf(e), e);
      g.set(rowOf(e), row);
      byGroup.set(e.group, g);
    });
    return byGroup;
  }, [s.entities, rowOf, columnOf]);
  const groupName = (k: string) => groupLabel?.(k) ?? s.groups.find(g => g.key === k)?.label ?? k;

  const cell = (e: Entity | undefined) => {
    if (!e) return <td className="dt-mx-cell empty">—</td>;
    const r = s.latest[e.id];
    const sev = r?.severity || "normal";
    return (
      <td className={`dt-mx-cell st-${sev} ${isVisible(e) ? "" : "dim"} ${s.selectedId === e.id ? "sel" : ""}`}>
        <button className="dt-mx-btn" onClick={() => d.select(e.id)} aria-label={`${e.name}: ${r?.status || SEVERITY_LABEL[sev]}`}>
          {renderCell ? renderCell(e, r) : (
            <>
              <div className="dt-row"><span className="mono dt-mx-main">{typeof r?.value === "number" ? `${formatValue(r.value, e)} ${formatUnit(e)}` : r?.status || "—"}</span>
                {sev !== "normal" && <StatusIcon status={sev} size={11} />}</div>
              {r?.kind && <div className="dt-mx-kind mono">{r.kind}</div>}
              {r && <div className="dt-mx-age muted">{r.message ? `${r.message} · ` : ""}{formatAgo(r.ts)}</div>}
            </>
          )}
        </button>
      </td>
    );
  };

  return (
    <div className="dt-matrix-wrap">
      <table className="dt-matrix">
        <thead>
          <tr><th className="dt-mx-corner">Item</th>{columns.map(c => <th key={c.key}>{c.label}{c.sub && <div className="mono muted">{c.sub}</div>}</th>)}</tr>
        </thead>
        {[...grid].map(([g, rows]) => (
          <tbody key={g}>
            <tr className="dt-mx-group"><th colSpan={columns.length + 1}>{groupName(g)}</th></tr>
            {[...rows].map(([row, cols]) => {
              const ents = [...cols.values()];
              if (!ents.some(e => isVisible(e))) return null;
              return (
                <tr key={row}>
                  <th className="dt-mx-row">{rowLabel ? rowLabel(row, ents) : row}</th>
                  {columns.map(c => <Fragment key={c.key}>{cell(cols.get(c.key))}</Fragment>)}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

type SortKey = "name" | "severity" | "group" | "value" | "updated";

/** Sortable list of the visible entities with their latest record */
export function EntityTable() {
  const d = useDashboard();
  const s = useDashboardState();
  const isVisible = useIsVisible();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "severity", dir: -1 });
  const cats = new Map(s.categories.map(c => [c.key, c]));
  const rows = s.entities.filter(isVisible).map(e => ({ e, r: s.latest[e.id] }));
  const val = (x: typeof rows[0]): string | number => {
    switch (sort.key) {
      case "severity": return SEVERITY_RANK[x.r?.severity || "normal"];
      case "group": return x.e.group;
      case "value": return typeof x.r?.value === "number" ? x.r.value : -Infinity;
      case "updated": return x.r?.ts || "";
      default: return x.e.name;
    }
  };
  rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir || a.e.name.localeCompare(b.e.name));
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="dt-th-btn" onClick={() => setSort(p => ({ key, dir: p.key === key ? (p.dir === 1 ? -1 : 1) : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  return (
    <div className="dt-table-wrap">
      <table className="dt-entity-table">
        <thead><tr>{th("name", "Name")}{th("group", "Location")}{th("severity", "Status")}{th("value", "Value")}{th("updated", "Updated")}</tr></thead>
        <tbody>
          {rows.map(({ e, r }) => (
            <tr key={e.id} className={`st-${r?.severity || "normal"} ${s.selectedId === e.id ? "sel" : ""}`} tabIndex={0}
                onClick={() => d.select(e.id)} onKeyDown={ev => { if (ev.key === "Enter") d.select(e.id); }}>
              <td><CategoryIcon category={cats.get(e.category)} size={13} /> {e.name} <span className="mono muted">{e.id}</span></td>
              <td>{s.groups.find(g => g.key === e.group)?.label || e.group}</td>
              <td className="dt-cell-status">{r && r.severity !== "normal" && <StatusIcon status={r.severity} size={10} />} {SEVERITY_LABEL[r?.severity || "normal"]}</td>
              <td className="num mono">{typeof r?.value === "number" || r?.value === null ? `${formatValue(r?.value, e)} ${formatUnit(e)}` : r?.status || "—"}</td>
              <td className="muted">{r ? formatAgo(r.ts) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="dt-empty">Nothing matches these filters.</div>}
    </div>
  );
}
