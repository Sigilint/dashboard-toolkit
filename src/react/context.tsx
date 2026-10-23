// React bindings: a provider that owns a Dashboard's lifecycle, and hooks
// that subscribe to its store with useSyncExternalStore.

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Dashboard, DashboardState } from "../core/dashboard";
import type { DataRecord, Entity } from "../core/types";

interface Ctx {
  dashboard: Dashboard;
  /** Prefix for per-viewer preferences in localStorage */
  storageKey: string;
}

const DashboardContext = createContext<Ctx | null>(null);

export interface DashboardProviderProps {
  dashboard: Dashboard;
  /** localStorage prefix for this app's preferences; default "dt" */
  storageKey?: string;
  /** Call start() on mount and stop() on unmount; default true */
  autoStart?: boolean;
  children: ReactNode;
}

export function DashboardProvider({ dashboard, storageKey = "dt", autoStart = true, children }: DashboardProviderProps) {
  useEffect(() => {
    if (!autoStart) return;
    dashboard.start();
    return () => dashboard.stop();
  }, [dashboard, autoStart]);
  const value = useMemo(() => ({ dashboard, storageKey }), [dashboard, storageKey]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

function useCtx(): Ctx {
  const c = useContext(DashboardContext);
  if (!c) throw new Error("dashboard-toolkit: wrap components in <DashboardProvider>");
  return c;
}

/** The Dashboard instance (for actions: setFilters, select, acknowledge…) */
export function useDashboard(): Dashboard {
  return useCtx().dashboard;
}

/** The current state snapshot; re-renders on every change */
export function useDashboardState(): DashboardState {
  const d = useDashboard();
  return useSyncExternalStore(d.subscribe, d.getState, d.getState);
}

/** Entities passing the current filters */
export function useVisibleEntities(): Entity[] {
  const d = useDashboard();
  const s = useDashboardState();
  return useMemo(() => d.visibleEntities(s), [d, s.entities, s.filters, s.latest]);
}

/** Visibility test bound to the current state */
export function useIsVisible(): (e: Entity) => boolean {
  const d = useDashboard();
  const s = useDashboardState();
  return useMemo(() => (e: Entity) => d.isVisible(e, s), [d, s.filters, s.latest, s.entities]);
}

/** Record filter bound to the current state */
export function useMatchRecord(): (r: DataRecord) => boolean {
  const d = useDashboard();
  const s = useDashboardState();
  return useMemo(() => (r: DataRecord) => d.matchRecord(r, s), [d, s.filters, s.entityById]);
}

export function useDerivedTiles() {
  const d = useDashboard();
  const s = useDashboardState();
  return useMemo(() => d.derived(s), [d, s.latest, s.alerts]);
}

/** Held history for an entity, oldest first (re-renders as it grows) */
export function useHistory(entityId: string | null | undefined): DataRecord[] {
  const d = useDashboard();
  const s = useDashboardState();
  return useMemo(() => (entityId ? d.historyFor(entityId).slice() : []), [d, entityId, s.version]);
}

export function useSelectedEntity(): Entity | undefined {
  const s = useDashboardState();
  return s.selectedId ? s.entityById.get(s.selectedId) : undefined;
}

/** A per-viewer preference kept in localStorage under the provider's prefix */
export function usePreference<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const { storageKey } = useCtx();
  const full = `${storageKey}-${key}`;
  const [value, setValue] = useState<T>(() => {
    try { const v = localStorage.getItem(full); return v == null ? initial : JSON.parse(v); } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(full, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [full, value]);
  return [value, setValue];
}

/** Re-render on an interval (for clocks and "2m ago" labels) */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
