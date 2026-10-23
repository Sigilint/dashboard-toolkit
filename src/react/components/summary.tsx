// Summary strip: one tile per category (counts by severity; click to filter)
// and the app's derived-state tiles.

import { useMemo } from "react";
import { useDashboard, useDashboardState, useDerivedTiles } from "../context";
import { toggleFacet } from "../../core/filters";
import type { Severity } from "../../core/types";
import { CategoryIcon, SeverityCounts, StatusIcon } from "./glyphs";

export function CategoryTiles({ facetKey = "category" }: { facetKey?: string }) {
  const d = useDashboard();
  const { categories, entities, latest, filters } = useDashboardState();
  const counts = useMemo(() => {
    const out: Record<string, { total: number } & Partial<Record<Severity, number>>> = {};
    categories.forEach(c => (out[c.key] = { total: 0 }));
    entities.forEach(e => {
      const c = out[e.category];
      if (!c) return;
      c.total++;
      const s = latest[e.id]?.severity || "normal";
      c[s] = (c[s] || 0) + 1;
    });
    return out;
  }, [categories, entities, latest]);
  const selected = filters.facets[facetKey] || [];
  return (
    <div className="dt-strip-group cats" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}>
      {categories.map(c => {
        const n = counts[c.key];
        const worst: Severity = n.alarm ? "alarm" : n.warning ? "warning" : n.offline ? "offline" : "normal";
        const on = selected.includes(c.key);
        return (
          <button key={c.key} className={`dt-tile st-${worst} ${on ? "on" : ""}`} aria-pressed={on}
                  onClick={() => d.setFilters(f => toggleFacet(f, facetKey, c.key))}>
            <div className="dt-tile-head"><CategoryIcon category={c} size={18} /><span className="dt-tile-label">{c.label}</span></div>
            <div className="dt-tile-counts mono">
              <SeverityCounts counts={n} />
              {worst === "normal" && <span className="dt-cnt ok">all normal</span>}
              <span className="dt-cnt total">{n.total}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function DerivedTiles() {
  const tiles = useDerivedTiles();
  if (!tiles.length) return null;
  return (
    <div className="dt-strip-group ops" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map(t => (
        <div key={t.key} className={`dt-op st-${t.severity}`} title={t.detail}>
          <div className="dt-op-label">{t.label}</div>
          <div className="dt-op-value mono">{t.severity !== "normal" && <StatusIcon status={t.severity} size={11} />} {t.value}</div>
          {t.detail && <div className="dt-op-why">{t.detail}</div>}
        </div>
      ))}
    </div>
  );
}

export function SummaryStrip({ showCategories = true }: { showCategories?: boolean }) {
  return (
    <section className="dt-strip" aria-label="Summary">
      {showCategories && <CategoryTiles />}
      <DerivedTiles />
    </section>
  );
}
