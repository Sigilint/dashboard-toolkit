// Alert list: priority-sorted, with acknowledge and ack-all.

import { useState } from "react";
import { useDashboard, useDashboardState, useIsVisible } from "../context";
import { formatTime, formatUnit, formatValue } from "../../core/format";
import type { Alert, Entity } from "../../core/types";
import { CategoryIcon, StatusIcon } from "./glyphs";

export function alertMessage(a: Alert, e?: Entity): string {
  if (a.message) return a.message;
  if (a.priority === "fault") return "No data — not reporting (comms fault)";
  if (e?.binary) return `${e.typeLabel || e.name}: ${e.binary[1].toLowerCase()}`;
  const cmp = a.dir === "lo" ? "≤" : "≥";
  const v = `${formatValue(a.value, e)} ${formatUnit(e)}`.trim();
  return a.state === "rtn" ? `${v} (now normal)` : a.limit != null ? `${v} ${cmp} ${a.limit}` : v;
}

export function AlertList({ title = "Alerts" }: { title?: string }) {
  const d = useDashboard();
  const { alerts, entityById, categories, selectedId } = useDashboardState();
  const isVisible = useIsVisible();
  const [matchFilters, setMatchFilters] = useState(false);
  const catByKey = new Map(categories.map(c => [c.key, c]));
  const list = alerts.filter(a => !matchFilters || (entityById.get(a.entityId) && isVisible(entityById.get(a.entityId)!)));
  const unacked = alerts.filter(a => !a.acked).length;

  return (
    <section className="dt-alerts" aria-label={title}>
      <header className="dt-panel-head">
        <span className="dt-panel-title">{title}</span>
        <span className="mono muted">{alerts.length} open · {unacked} unack</span>
        <button className="dt-btn small" disabled={!unacked} onClick={() => d.acknowledgeAll()}>Ack all</button>
      </header>
      <label className="dt-toggle pad">
        <input type="checkbox" checked={matchFilters} onChange={e => setMatchFilters(e.target.checked)} />
        Only alerts matching filters
      </label>
      <ul className="dt-alert-list">
        {list.length === 0 && <li className="dt-empty">No open alerts{matchFilters ? " for these filters" : ""}.</li>}
        {list.map(a => {
          const e = entityById.get(a.entityId);
          return (
            <li key={a.id}
                className={`dt-alert pr-${a.priority} ${a.acked ? "acked" : "unacked"} ${a.state} ${selectedId === a.entityId ? "sel" : ""}`}
                onClick={() => d.select(a.entityId)}>
              <div className="dt-alert-row1">
                <StatusIcon status={a.state === "rtn" ? "normal" : a.priority} size={13} />
                <span className="dt-alert-pr mono">{a.priority.toUpperCase()}</span>
                <span className="dt-alert-state mono">{a.state === "rtn" ? "RTN" : a.acked ? "ACK" : "UNACK"}</span>
                <span className="dt-alert-time mono">{formatTime(a.raisedAt)}</span>
              </div>
              <div className="dt-alert-name">{e?.name || a.entityId}</div>
              <div className="dt-alert-msg mono">
                <CategoryIcon category={e && catByKey.get(e.category)} size={13} /> {a.entityId} · {alertMessage(a, e)}
              </div>
              {!a.acked && (
                <button className="dt-btn small dt-ack" onClick={ev => { ev.stopPropagation(); d.acknowledge(a.id); }}>Ack</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
