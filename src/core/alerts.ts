// Client-side alert engine, loosely after ISA-18.2. Use it when the source
// sends records with severities but no alert list of its own.
//
//   abnormal record            → ACTIVE, unacked
//   acknowledge                → ACTIVE, acked
//   back to normal, unacked    → RTN (stays until acknowledged)
//   back to normal, acked      → removed
//   escalation or re-activation clears the acknowledgement

import type { Alert, AlertPriority, DataRecord, Entity } from "./types";
import { SEVERITY_RANK, evaluateLimits } from "./severity";

export class AlertEngine {
  private alerts = new Map<string, Alert>();
  private nextId = 1;

  /** Update with one record; returns true if the alert list changed */
  apply(r: DataRecord, entity?: Entity): boolean {
    const existing = this.alerts.get(r.entityId);
    if (r.severity !== "normal") {
      const priority: AlertPriority = r.severity === "offline" ? "fault" : r.severity;
      const ev = typeof r.value === "number" ? evaluateLimits(entity?.limits, r.value) : { dir: undefined, limit: undefined };
      if (!existing) {
        this.alerts.set(r.entityId, {
          id: `ALM-${String(this.nextId++).padStart(5, "0")}`,
          entityId: r.entityId, priority, state: "active", acked: false,
          raisedAt: r.ts, updatedAt: r.ts, clearedAt: null,
          value: r.value ?? null, peak: r.value ?? null,
          dir: ev.dir ?? null, limit: ev.limit ?? null, message: r.message,
        });
        return true;
      }
      const a = existing;
      if (SEVERITY_RANK[priority] > SEVERITY_RANK[a.priority]) { a.priority = priority; a.acked = false; }
      if (a.state === "rtn") { a.state = "active"; a.acked = false; a.clearedAt = null; }
      a.value = r.value ?? null;
      if (typeof r.value === "number" && ev.dir === "hi") a.peak = Math.max(a.peak ?? -Infinity, r.value);
      if (typeof r.value === "number" && ev.dir === "lo") a.peak = Math.min(a.peak ?? Infinity, r.value);
      a.dir = ev.dir ?? a.dir ?? null;
      a.limit = ev.limit ?? a.limit ?? null;
      a.updatedAt = r.ts;
      if (r.message) a.message = r.message;
      return true;
    }
    if (existing && existing.state === "active") {
      existing.state = "rtn";
      existing.value = r.value ?? null;
      existing.clearedAt = r.ts;
      if (existing.acked) this.alerts.delete(r.entityId);
      return true;
    }
    return false;
  }

  acknowledge(alertId: string): boolean {
    for (const [key, a] of this.alerts) {
      if (a.id !== alertId) continue;
      a.acked = true;
      if (a.state === "rtn") this.alerts.delete(key);
      return true;
    }
    return false;
  }

  acknowledgeAll(): void {
    for (const [key, a] of this.alerts) {
      a.acked = true;
      if (a.state === "rtn") this.alerts.delete(key);
    }
  }

  /** Fresh copies, so callers can treat them as immutable */
  list(): Alert[] {
    return [...this.alerts.values()].map(a => ({ ...a }));
  }
}

/** Active first, then priority, then newest */
export function sortAlerts(list: Alert[]): Alert[] {
  return list.slice().sort((a, b) =>
    Number(a.state === "rtn") - Number(b.state === "rtn") ||
    SEVERITY_RANK[b.priority] - SEVERITY_RANK[a.priority] ||
    b.raisedAt.localeCompare(a.raisedAt));
}
