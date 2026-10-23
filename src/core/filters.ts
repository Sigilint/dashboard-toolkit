// Filter model: free-text search, a severity filter, and any number of
// facets (category, group, type, environment…). Within a facet, ticked
// values are alternatives; across facets, all must match.

import type { DataRecord, Entity, FacetDef, FacetOption, FilterState, Group, Category, Severity } from "./types";
import { severityMatches } from "./severity";

export const emptyFilters = (): FilterState => ({ q: "", severity: "all", facets: {} });

/** Sorted, de-duplicated, with empty facets removed — stable for comparing and hashing */
export function canonicalFilters(f: Partial<FilterState>): FilterState {
  const facets: Record<string, string[]> = {};
  Object.keys(f.facets || {}).sort().forEach(k => {
    const v = [...new Set(f.facets![k])].sort();
    if (v.length) facets[k] = v;
  });
  return { q: (f.q || "").trim(), severity: f.severity || "all", facets };
}

export const sameFilters = (a: Partial<FilterState>, b: Partial<FilterState>) =>
  JSON.stringify(canonicalFilters(a)) === JSON.stringify(canonicalFilters(b));

export const isEmptyFilters = (f: Partial<FilterState>) => sameFilters(f, emptyFilters());

/** Toggle one facet value */
export function toggleFacet(f: FilterState, key: string, value: string): FilterState {
  const cur = new Set(f.facets[key] || []);
  cur.has(value) ? cur.delete(value) : cur.add(value);
  return { ...f, facets: { ...f.facets, [key]: [...cur] } };
}

export function setFacet(f: FilterState, key: string, values: string[]): FilterState {
  return { ...f, facets: { ...f.facets, [key]: values } };
}

/** Default facets: category, group and type */
export function defaultFacets(categories: Category[], groups: Group[]): FacetDef[] {
  return [
    {
      key: "category", label: "Category", get: e => e.category,
      options: categories.map(c => ({ value: c.key, label: c.label, description: c.description })),
    },
    {
      key: "type", label: "Type", control: "select", get: e => e.type,
    },
    {
      key: "group", label: "Location", get: e => e.group,
      options: groups.map(g => ({ value: g.key, label: g.label, description: g.description })),
    },
  ];
}

const asArray = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Options for a facet, falling back to distinct values on the entities */
export function facetOptions(def: FacetDef, entities: Entity[]): FacetOption[] {
  if (def.options) return def.options;
  const labels = new Map<string, string>();
  entities.forEach(e => asArray(def.get(e)).forEach(v => {
    if (!labels.has(v)) labels.set(v, def.key === "type" ? e.typeLabel || v : v);
  }));
  return [...labels].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export interface MatchContext {
  facets: FacetDef[];
  groups?: Map<string, Group>;
}

function searchText(e: Entity, ctx: MatchContext): string {
  const g = ctx.groups?.get(e.group);
  return [e.id, e.name, e.type, e.typeLabel, e.group, g?.label, ...Object.values(e.tags || {})]
    .filter(Boolean).join(" ").toLowerCase();
}

/** Does the entity pass search + facets (ignoring severity)? */
export function matchEntity(e: Entity, f: FilterState, ctx: MatchContext): boolean {
  for (const def of ctx.facets) {
    const want = f.facets[def.key];
    if (!want || !want.length) continue;
    if (!asArray(def.get(e)).some(v => want.includes(v))) return false;
  }
  const q = f.q.trim().toLowerCase();
  if (q && !q.split(/\s+/).every(term => searchText(e, ctx).includes(term))) return false;
  return true;
}

/** Entity is visible given its current severity */
export function isVisible(e: Entity, severity: Severity, f: FilterState, ctx: MatchContext): boolean {
  return matchEntity(e, f, ctx) && severityMatches(f.severity, severity);
}

/** Record matches the filters, judged on the record's own severity */
export function matchRecord(r: DataRecord, entity: Entity | undefined, f: FilterState, ctx: MatchContext): boolean {
  if (!entity) return !f.q && Object.values(f.facets).every(v => !v.length) && severityMatches(f.severity, r.severity);
  return matchEntity(entity, f, ctx) && severityMatches(f.severity, r.severity);
}

/** Entity counts per facet value (before that facet's own selection) */
export function facetCounts(def: FacetDef, entities: Entity[]): Map<string, number> {
  const counts = new Map<string, number>();
  entities.forEach(e => asArray(def.get(e)).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
  return counts;
}
