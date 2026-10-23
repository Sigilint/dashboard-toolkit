// Formatting helpers for values, units, times and limits.

import type { Entity, Limits } from "./types";

export function formatValue(value: number | null | undefined, entity?: Pick<Entity, "dp" | "binary">): string {
  if (value == null) return "—";
  if (entity?.binary) return value >= 0.5 ? entity.binary[1] : entity.binary[0];
  const dp = entity?.dp ?? 1;
  return value.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function formatUnit(entity?: Pick<Entity, "unit" | "binary">): string {
  return entity?.binary ? "" : entity?.unit ?? "";
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** HH:MM:SS (local), with .mmm when ms is true */
export function formatTime(iso: string, ms = false): string {
  const d = new Date(iso);
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return ms ? `${base}.${pad(d.getMilliseconds(), 3)}` : base;
}

/** "12s ago", "4m ago", "2h ago", "3d ago" */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** "2m 08s", "1h 04m" */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
}

export function formatLimits(limits: Limits | undefined, entity?: Pick<Entity, "unit" | "binary">): string {
  if (!limits) return "No alarm limits — informational";
  if (entity?.binary) return `Alarm when ${entity.binary[1].toLowerCase()}`;
  const u = entity?.unit ? ` ${entity.unit}` : "";
  const parts: string[] = [];
  if (limits.hi) parts.push(`High: warn ≥ ${limits.hi[0]}, alarm ≥ ${limits.hi[1]}${u}`);
  if (limits.lo) parts.push(`Low: warn ≤ ${limits.lo[0]}, alarm ≤ ${limits.lo[1]}${u}`);
  return parts.join(" · ");
}
