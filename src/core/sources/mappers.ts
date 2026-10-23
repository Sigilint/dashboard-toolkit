// Ready-made mappers for common wire formats.

import type { DataRecord, Severity } from "../types";

export interface CloudEvent {
  specversion?: string;
  id: string;
  source: string;
  type: string;
  subject?: string;
  time?: string;
  data?: any;
  [ext: string]: unknown;
}

export interface CloudEventMapOptions {
  /** Entity id for an event; default `subject`, then `source` */
  entityId?: (ce: CloudEvent) => string;
  /** Workflow status from the event; default data.status */
  status?: (ce: CloudEvent) => string | undefined;
  /** Severity from status/type; default: failed|error → alarm, rolled_back|degraded → warning */
  severity?: (ce: CloudEvent, status: string | undefined) => Severity;
  message?: (ce: CloudEvent) => string | undefined;
  /** Sequence number; default a running counter */
  seq?: (ce: CloudEvent) => number;
}

const ALARM = /fail|error|incident\.opened|breach/i;
const WARN = /roll(ed)?_?back|degraded|retry|cancel/i;

/** CloudEvents 1.0 envelope → DataRecord (the release dashboard's event format) */
export function cloudEventMapper(opts: CloudEventMapOptions = {}) {
  let counter = 0;
  return (ce: CloudEvent): DataRecord => {
    const status = opts.status ? opts.status(ce) : ce.data?.status;
    const severity = opts.severity
      ? opts.severity(ce, status)
      : ALARM.test(`${ce.type} ${status ?? ""}`) ? "alarm" : WARN.test(`${ce.type} ${status ?? ""}`) ? "warning" : "normal";
    return {
      seq: opts.seq ? opts.seq(ce) : ++counter,
      ts: ce.time || new Date().toISOString(),
      entityId: opts.entityId ? opts.entityId(ce) : (ce.subject || ce.source),
      kind: ce.type,
      status,
      severity,
      message: opts.message ? opts.message(ce) : ce.data?.message,
      data: { ...ce },
    };
  };
}
