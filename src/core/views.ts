// Saved views: named filter sets. Built-in views come from the app or the
// data source; personal views go to a ViewStorage — the browser by default,
// or a server.

import type { FilterState, View } from "./types";
import { canonicalFilters, sameFilters } from "./filters";

export interface ViewStorage {
  load(): Promise<View[]>;
  save(views: View[]): Promise<void>;
}

/** Per-browser storage. Survives reloads; never shared between people. */
export function localViewStorage(key: string): ViewStorage {
  return {
    async load() {
      try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
    },
    async save(views) {
      try { localStorage.setItem(key, JSON.stringify(views)); } catch { /* storage unavailable */ }
    },
  };
}

export function memoryViewStorage(initial: View[] = []): ViewStorage {
  let views = initial;
  return { async load() { return views; }, async save(v) { views = v; } };
}

/** Server storage: GET {url} → View[], PUT {url} with View[] */
export function remoteViewStorage(url: string, init: RequestInit = {}): ViewStorage {
  return {
    async load() {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(`views: ${r.status}`);
      return r.json();
    },
    async save(views) {
      const r = await fetch(url, {
        ...init, method: "PUT",
        headers: { "content-type": "application/json", ...(init.headers || {}) },
        body: JSON.stringify(views),
      });
      if (!r.ok) throw new Error(`views: ${r.status}`);
    },
  };
}

export function makeView(name: string, filters: FilterState, extra: Partial<View> = {}): View {
  return {
    id: `v-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    filters: canonicalFilters(filters),
    ...extra,
  };
}

export const findMatchingView = (views: View[], filters: FilterState) =>
  views.find(v => sameFilters(v.filters, filters));

/**
 * Stable short hash of a filter selection (FNV-1a, 32-bit, hex). Usable as
 * a subscription key: the same selection always gives the same hash.
 */
export function viewHash(filters: Partial<FilterState>, layout = ""): string {
  const s = JSON.stringify([canonicalFilters(filters), layout]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
