// Filter rail: saved views, search, severity, and one control per facet.

import { useMemo, useState, type ReactNode } from "react";
import { useDashboard, useDashboardState } from "../context";
import { isEmptyFilters, setFacet, toggleFacet } from "../../core/filters";
import { SEVERITY_RANK } from "../../core/severity";
import type { FacetDef, Severity, SeverityFilter } from "../../core/types";
import { CategoryIcon, StatusIcon } from "./glyphs";

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Warn+" },
  { value: "alarm", label: "Alarm" },
  { value: "offline", label: "Offline" },
];

export function SearchBox({ placeholder = "ID, name or type…" }: { placeholder?: string }) {
  const d = useDashboard();
  const { filters } = useDashboardState();
  return (
    <div className="dt-rail-section">
      <label className="dt-rail-title" htmlFor="dt-q">Search</label>
      <input id="dt-q" className="dt-input" type="search" placeholder={placeholder} value={filters.q}
             onChange={e => d.setFilters({ q: e.target.value })} />
    </div>
  );
}

export function SeverityFilterControl() {
  const d = useDashboard();
  const { filters } = useDashboardState();
  return (
    <div className="dt-rail-section">
      <div className="dt-rail-title" id="dt-sev">Status</div>
      <div className="dt-seg" role="radiogroup" aria-labelledby="dt-sev">
        {SEVERITY_OPTIONS.map(o => (
          <button key={o.value} role="radio" aria-checked={filters.severity === o.value}
                  className={filters.severity === o.value ? "on" : ""} onClick={() => d.setFilters({ severity: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface FacetControlProps {
  facet: FacetDef;
  /** Called while hovering an option (e.g. to outline an area) */
  onHoverValue?: (value: string | null) => void;
  /** Extra control in the title row */
  titleExtra?: ReactNode;
}

export function FacetControl({ facet, onHoverValue, titleExtra }: FacetControlProps) {
  const d = useDashboard();
  const s = useDashboardState();
  const options = useMemo(() => d.facetOptions(facet.key, s), [d, facet.key, s.entities]);
  const counts = useMemo(() => d.facetCounts(facet.key, s), [d, facet.key, s.entities]);
  // worst current severity per option, so a location shows where trouble is
  const worstBy = useMemo(() => {
    const m = new Map<string, Severity>();
    s.entities.forEach(e => {
      const sev = s.latest[e.id]?.severity || "normal";
      const vals = facet.get(e);
      (Array.isArray(vals) ? vals : vals == null ? [] : [vals]).forEach(v => {
        if (SEVERITY_RANK[sev] > SEVERITY_RANK[m.get(v) || "normal"]) m.set(v, sev);
      });
    });
    return m;
  }, [s.entities, s.latest, facet]);
  const selected = s.filters.facets[facet.key] || [];
  const catByKey = useMemo(() => new Map(s.categories.map(c => [c.key, c])), [s.categories]);

  if (facet.control === "select") {
    return (
      <div className="dt-rail-section">
        <label className="dt-rail-title" htmlFor={`dt-f-${facet.key}`}>{facet.label}</label>
        <select id={`dt-f-${facet.key}`} className="dt-input" value={selected[0] || ""}
                onChange={e => d.setFilters(f => setFacet(f, facet.key, e.target.value ? [e.target.value] : []))}>
          <option value="">All ({options.length})</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="dt-rail-section">
      <div className="dt-rail-title">{facet.label}{titleExtra}</div>
      {options.map(o => {
        const on = selected.includes(o.value);
        const worst = worstBy.get(o.value) || "normal";
        return (
          <label key={o.value} className={`dt-check ${on ? "on" : ""}`} title={o.description}
                 onMouseEnter={() => onHoverValue?.(o.value)} onMouseLeave={() => onHoverValue?.(null)}>
            <input type="checkbox" checked={on} onChange={() => d.setFilters(f => toggleFacet(f, facet.key, o.value))} />
            {facet.key === "category"
              ? <CategoryIcon category={catByKey.get(o.value)} />
              : /^[A-Z0-9_-]{1,6}$/.test(o.value) && o.value !== o.label ? <span className="dt-code mono">{o.value}</span> : <span />}
            <span className="dt-check-label">{o.label}</span>
            {worst !== "normal" && <StatusIcon status={worst} size={11} />}
            <span className="dt-count mono">{counts.get(o.value) || 0}</span>
          </label>
        );
      })}
    </div>
  );
}

export function ClearFilters() {
  const d = useDashboard();
  const { filters } = useDashboardState();
  if (isEmptyFilters(filters)) return null;
  return <button className="dt-btn ghost full" onClick={() => d.resetFilters()}>Clear all filters ×</button>;
}

export function ViewsPanel() {
  const d = useDashboard();
  const { builtInViews, savedViews, activeView, filters, viewHash } = useDashboardState();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const all = [...builtInViews, ...savedViews];
  const empty = isEmptyFilters(filters);
  if (!all.length && empty) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await d.saveView(name);
    setName("");
    setNaming(false);
  };

  return (
    <div className="dt-rail-section dt-views">
      <div className="dt-rail-title">
        Views
        {!activeView && !empty ? <span className="dt-tag">unsaved</span> : <span className="dt-tag" title="Subscription key for this selection">#{viewHash}</span>}
      </div>
      <ul className="dt-view-list">
        {all.map(v => {
          const on = activeView?.id === v.id;
          return (
            <li key={v.id} className={on ? "on" : ""}>
              <button className="dt-view-btn" aria-pressed={on} onClick={() => d.applyView(v.id)} title={v.description || v.name}>
                <span className="dt-view-name">{v.name}</span>
                {!v.builtIn && <span className="dt-tag">mine</span>}
              </button>
              {!v.builtIn && (
                <button className="dt-btn icon" aria-label={`Delete view ${v.name}`} onClick={() => d.deleteView(v.id)}>×</button>
              )}
            </li>
          );
        })}
      </ul>
      {naming ? (
        <form className="dt-view-form" onSubmit={save}>
          <label className="dt-sr" htmlFor="dt-view-name">View name</label>
          <input id="dt-view-name" className="dt-input" autoFocus placeholder="Name this view…" value={name}
                 onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setNaming(false); }} />
          <div className="dt-row">
            <button className="dt-btn small primary" type="submit" disabled={!name.trim()}>Save</button>
            <button className="dt-btn small" type="button" onClick={() => setNaming(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        !activeView && !empty && <button className="dt-btn ghost full" onClick={() => setNaming(true)}>+ Save current filters as a view</button>
      )}
    </div>
  );
}

export interface FilterRailProps {
  /** Above the filters; defaults to <ViewsPanel /> */
  top?: ReactNode;
  /** Below the filters, e.g. demo controls */
  bottom?: ReactNode;
  searchPlaceholder?: string;
  /** Hover callback for the group facet (outline areas on a schematic) */
  onHoverGroup?: (group: string | null) => void;
  /** Extra control in the group facet's title row */
  groupTitleExtra?: ReactNode;
}

export function FilterRail({ top, bottom, searchPlaceholder, onHoverGroup, groupTitleExtra }: FilterRailProps) {
  const { facets } = useDashboardState();
  return (
    <aside className="dt-rail" aria-label="Filters">
      {top ?? <ViewsPanel />}
      <SearchBox placeholder={searchPlaceholder} />
      <SeverityFilterControl />
      {facets.map(f => (
        <FacetControl key={f.key} facet={f}
                      onHoverValue={f.key === "group" ? onHoverGroup : undefined}
                      titleExtra={f.key === "group" ? groupTitleExtra : undefined} />
      ))}
      <ClearFilters />
      {bottom}
    </aside>
  );
}
