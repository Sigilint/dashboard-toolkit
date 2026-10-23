// Schematic: an SVG drawing supplied by the app, with the toolkit's sensor
// markers, area hit-zones, value callouts and tooltips on top. Plus the
// AreaBanner that names the area in focus, and OverlayCard for collapsible
// floating panels (e.g. a weather card).

import { useRef, useState, type ReactNode } from "react";
import { useDashboard, useDashboardState, useIsVisible, usePreference } from "../context";
import { SEVERITY_LABEL, SEVERITY_RANK } from "../../core/severity";
import { formatUnit, formatValue } from "../../core/format";
import type { Entity, Severity } from "../../core/types";
import { setFacet } from "../../core/filters";
import { ShapeLetter, ShapePath, CategoryIcon, StatusIcon, SeverityCounts } from "./glyphs";

// ---------- area focus (hover + pin), shared by rail, schematic and banner ----------

export interface AreaFocus {
  hover: string | null;
  pinned: string | null;
  setHover: (g: string | null) => void;
  /** Toggle the pin; null unpins */
  pin: (g: string | null) => void;
  /** Outline every area (the rail's "outline" switch) */
  showAreas?: boolean;
}

export function useAreaFocus(): AreaFocus {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  return { hover, pinned, setHover, pin: g => setPinned(p => (g && p !== g ? g : null)) };
}

// ---------- schematic ----------

export interface SchematicProps {
  /** [minX, minY, width, height] */
  viewBox: [number, number, number, number];
  /** The drawing, as SVG elements, rendered under everything else */
  background?: ReactNode;
  /** SVG drawn above the areas and below the markers (e.g. gas outlines) */
  overlay?: ReactNode;
  focus?: AreaFocus;
  /** Outline every area */
  showAreas?: boolean;
  /** HTML overlays positioned over the drawing (banner, cards, notes) */
  children?: ReactNode;
  /** Label above value callouts, e.g. for binary entities */
  calloutText?: (e: Entity, sev: Severity) => string;
}

interface Hover { id: string; x: number; y: number; w: number }

export function Schematic({ viewBox, background, overlay, focus, showAreas, children, calloutText }: SchematicProps) {
  const d = useDashboard();
  const s = useDashboardState();
  const isVisible = useIsVisible();
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [vx, , vw] = viewBox;
  const cats = new Map(s.categories.map(c => [c.key, c]));
  const placed = s.entities.filter(e => e.position);
  const focusGroups = new Set(s.filters.facets.group || []);

  const onHover = (e: Entity, ev: React.MouseEvent) => {
    const box = wrap.current!.getBoundingClientRect();
    setHover({ id: e.id, x: ev.clientX - box.left, y: ev.clientY - box.top, w: box.width });
    focus?.setHover(e.group);
  };
  const onLeave = () => { setHover(null); focus?.setHover(null); };

  // value callouts for abnormal, visible entities, placed to avoid overlap
  const callouts: { id: string; sev: Severity; text: string; box: { x: number; y: number; w: number; h: number } }[] = [];
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const hit = (a: typeof taken[0], b: typeof taken[0]) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  placed
    .map(e => ({ e, r: s.latest[e.id] }))
    .filter(({ e, r }) => r && r.severity !== "normal" && isVisible(e))
    .sort((a, b) => SEVERITY_RANK[b.r!.severity] - SEVERITY_RANK[a.r!.severity])
    .forEach(({ e, r }) => {
      const text = calloutText ? calloutText(e, r!.severity)
        : r!.severity === "offline" ? "NO DATA"
        : typeof r!.value === "number" ? `${formatValue(r!.value, e)} ${formatUnit(e)}`.trim() : r!.status || SEVERITY_LABEL[r!.severity];
      const w = 10 + text.length * 5.9, h = 14, { x, y } = e.position!;
      const box = [
        { x: x + 11, y: y - h / 2 }, { x: x - 11 - w, y: y - h / 2 }, { x: x - w / 2, y: y + 11 }, { x: x - w / 2, y: y - 11 - h },
      ].map(c => ({ ...c, w, h })).find(b => !taken.some(t => hit(t, b)) && b.x > vx && b.x + w < vx + vw);
      if (!box) return;
      taken.push(box);
      callouts.push({ id: e.id, sev: r!.severity, text, box });
    });

  const hovered = hover && s.entityById.get(hover.id);
  return (
    <div className="dt-schematic" ref={wrap}>
      <svg viewBox={viewBox.join(" ")} preserveAspectRatio="xMidYMid meet" className="dt-schematic-svg"
           onClick={() => focus?.pin(null)} role="img" aria-label="Schematic with sensor markers">
        {background}
        <g className="dt-areas">
          {s.groups.filter(g => g.rect).map(g => {
            const [x, y, w, h] = g.rect!;
            const on = showAreas || focus?.showAreas || focus?.hover === g.key || focus?.pinned === g.key || focusGroups.has(g.key);
            return (
              <g key={g.key} className={`dt-area ${on ? "on" : ""} ${focusGroups.has(g.key) ? "focus" : ""} ${focus?.pinned === g.key ? "pinned" : ""}`}
                 onMouseEnter={() => focus?.setHover(g.key)} onMouseLeave={() => focus?.setHover(null)}
                 onClick={e => { e.stopPropagation(); focus?.pin(g.key); }}>
                <rect x={x} y={y} width={w} height={h} rx="4" />
                {on && <text x={x + 4} y={y + 10} className="dt-area-label">{g.label.toUpperCase()}</text>}
              </g>
            );
          })}
        </g>
        {overlay}
        <g className="dt-markers">
          {placed.map(e => {
            const r = s.latest[e.id];
            const sev = r?.severity || "normal";
            const alert = s.alerts.find(a => a.entityId === e.id);
            const unack = alert && !alert.acked && alert.state === "active" && sev !== "normal";
            const dim = !isVisible(e);
            const cat = cats.get(e.category);
            if (!cat) return null;
            return (
              <g key={e.id} transform={`translate(${e.position!.x} ${e.position!.y})`}
                 className={`dt-mk st-${sev} ${dim ? "dim" : ""} ${s.selectedId === e.id ? "sel" : ""} ${hover?.id === e.id ? "hov" : ""}`}
                 onClick={ev => { ev.stopPropagation(); d.select(s.selectedId === e.id ? null : e.id); }}
                 onMouseEnter={ev => onHover(e, ev)} onMouseMove={ev => onHover(e, ev)} onMouseLeave={onLeave}
                 tabIndex={dim ? -1 : 0} role="button" aria-label={`${e.name}, ${e.id}, ${sev}`}
                 onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); d.select(e.id); } }}>
                <circle r="13" className="dt-mk-hit" />
                {unack && <circle r="9" className="dt-mk-pulse" />}
                {s.selectedId === e.id && <circle r="13" className="dt-mk-ring" />}
                <g className="dt-mk-body"><ShapePath shape={cat.shape} className="dt-mk-shape" /><ShapeLetter shape={cat.shape} code={cat.code} /></g>
              </g>
            );
          })}
        </g>
        {callouts.map(c => (
          <g key={c.id} className={`dt-callout st-${c.sev}`} pointerEvents="none">
            <rect x={c.box.x} y={c.box.y} width={c.box.w} height={c.box.h} rx="2" />
            <text x={c.box.x + 5} y={c.box.y + c.box.h / 2} dominantBaseline="central">{c.text}</text>
          </g>
        ))}
      </svg>
      {children}
      {hovered && hover && (
        <div className="dt-tooltip" style={{ left: hover.x > hover.w - 260 ? hover.x - 250 : hover.x + 16, top: hover.y + 14 }}>
          <div className="dt-row">
            <CategoryIcon category={cats.get(hovered.category)} />
            <span className="mono dt-tt-id">{hovered.id}</span>
            <span className="dt-tt-pill"><StatusIcon status={s.latest[hovered.id]?.severity || "normal"} size={10} /></span>
          </div>
          <div className="dt-tt-name">{hovered.name}</div>
          <div className="muted">{hovered.typeLabel || hovered.type}</div>
          <div className="dt-tt-value mono">
            {typeof s.latest[hovered.id]?.value === "number" || s.latest[hovered.id]?.value === null
              ? <>{formatValue(s.latest[hovered.id]?.value, hovered)} <span>{formatUnit(hovered)}</span></>
              : s.latest[hovered.id]?.status || "—"}
          </div>
          <div className="dt-tt-hint">Click for details</div>
        </div>
      )}
    </div>
  );
}

// ---------- area banner ----------

export function AreaBanner({ focus }: { focus: AreaFocus }) {
  const d = useDashboard();
  const s = useDashboardState();
  const key = focus.hover || focus.pinned;
  const group = key ? s.groups.find(g => g.key === key) : undefined;
  if (!group) return null;
  const pinned = !!focus.pinned && key === focus.pinned;
  const here = s.entities.filter(e => e.group === group.key);
  const counts: Partial<Record<Severity, number>> = {};
  here.forEach(e => { const sev = s.latest[e.id]?.severity; if (sev && sev !== "normal") counts[sev] = (counts[sev] || 0) + 1; });
  const worst = (["alarm", "warning", "offline"] as const).find(k => counts[k]) || "normal";
  const selected = s.filters.facets.group || [];
  const onlyThis = selected.length === 1 && selected[0] === group.key;

  return (
    <div className={`dt-area-banner st-${worst} ${pinned ? "pinned" : ""}`} role={pinned ? "region" : "status"} aria-label={`Area: ${group.label}`}>
      <div className="dt-ab-main">
        <div className="dt-row wrap">
          <span className="dt-code mono">{group.key}</span>
          <span className="dt-ab-name">{group.label}</span>
          <span className="dt-ab-counts mono">{here.length} {here.length === 1 ? "item" : "items"} <SeverityCounts counts={counts} /></span>
        </div>
        {group.description && <div className="dt-ab-desc">{group.description}</div>}
      </div>
      {pinned ? (
        <div className="dt-row wrap dt-ab-actions">
          {onlyThis ? (
            <button className="dt-btn small on" onClick={() => d.setFilters(f => setFacet(f, "group", []))}>Showing only this area · show all</button>
          ) : (
            <>
              <button className="dt-btn small primary" onClick={() => d.setFilters(f => setFacet(f, "group", [group.key]))}>Show only these {here.length}</button>
              {selected.length > 0 && !selected.includes(group.key) && (
                <button className="dt-btn small" onClick={() => d.setFilters(f => setFacet(f, "group", [...selected, group.key]))}>Add to filter</button>
              )}
            </>
          )}
          <button className="dt-btn icon" aria-label="Close area banner" onClick={() => focus.pin(null)}>×</button>
        </div>
      ) : <div className="dt-ab-hint">click to pin</div>}
    </div>
  );
}

// ---------- overlay card ----------

export interface OverlayCardProps {
  id: string;
  title: string;
  /** One-line content when collapsed */
  summary: ReactNode;
  severity?: Severity;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  children: ReactNode;
}

/** Floating card over a main view that collapses to a chip; remembers its state */
export function OverlayCard({ id, title, summary, severity = "normal", position = "top-right", children }: OverlayCardProps) {
  const [open, setOpen] = usePreference(`card-${id}`, true);
  if (!open) {
    return (
      <button className={`dt-card dt-card-chip ${position} st-${severity}`} onClick={() => setOpen(true)} aria-expanded="false" aria-label={`Show ${title}`}>
        <span className="dt-card-title mono">{title}</span>
        <span className="mono">{summary}</span>
        {severity !== "normal" && <StatusIcon status={severity} size={10} />}
        <span className="muted" aria-hidden="true">▸</span>
      </button>
    );
  }
  return (
    <div className={`dt-card ${position}`} aria-label={title}>
      <div className="dt-row dt-card-head">
        <span className="dt-card-title mono">{title}</span>
        <button className="dt-btn icon" aria-expanded="true" aria-label={`Collapse ${title}`} onClick={() => setOpen(false)}>–</button>
      </div>
      {children}
    </div>
  );
}

/** A label/value row for OverlayCard bodies */
export function CardRow({ label, value, severity = "normal" }: { label: string; value: ReactNode; severity?: Severity }) {
  return (
    <div className={`dt-card-row st-${severity}`}>
      <span>{label}</span>
      <span className="mono">{severity !== "normal" && <StatusIcon status={severity} size={9} />} {value}</span>
    </div>
  );
}
