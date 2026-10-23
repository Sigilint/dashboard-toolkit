// Severity ranking and limit evaluation.

import type { AlertPriority, Limits, Severity, SeverityFilter } from "./types";

export const SEVERITY_RANK: Record<Severity | AlertPriority, number> = {
  normal: 0,
  offline: 1,
  fault: 1,
  warning: 2,
  alarm: 3,
};

export const SEVERITY_LABEL: Record<Severity | AlertPriority, string> = {
  normal: "NORMAL",
  warning: "WARNING",
  alarm: "ALARM",
  offline: "OFFLINE",
  fault: "FAULT",
};

/** The worse of two severities */
export function worse<T extends Severity | AlertPriority>(a: T, b: T): T {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

/** Worst severity in a list; "normal" when empty */
export function worst(list: Iterable<Severity>): Severity {
  let w: Severity = "normal";
  for (const s of list) w = worse(w, s);
  return w;
}

export interface Evaluation {
  severity: Severity;
  dir?: "hi" | "lo";
  limit?: number;
}

/** Evaluate a numeric value against hi / lo [warning, alarm] limits. */
export function evaluateLimits(limits: Limits | undefined, value: number | null | undefined): Evaluation {
  if (value == null) return { severity: "offline" };
  if (!limits) return { severity: "normal" };
  if (limits.hi) {
    const [w, a] = limits.hi;
    if (value >= a) return { severity: "alarm", dir: "hi", limit: a };
    if (value >= w) return { severity: "warning", dir: "hi", limit: w };
  }
  if (limits.lo) {
    const [w, a] = limits.lo;
    if (value <= a) return { severity: "alarm", dir: "lo", limit: a };
    if (value <= w) return { severity: "warning", dir: "lo", limit: w };
  }
  return { severity: "normal" };
}

export function severityMatches(filter: SeverityFilter, severity: Severity): boolean {
  switch (filter) {
    case "attention": return severity === "warning" || severity === "alarm";
    case "alarm": return severity === "alarm";
    case "offline": return severity === "offline";
    default: return true;
  }
}
