// The contract between a dashboard and wherever its data comes from.

import type { Alert, ConnectionStatus, DataRecord, Entity, HeaderInfo, View } from "../types";

/** What a source returns once, when the dashboard starts */
export interface SourceSnapshot {
  entities: Entity[];
  /** Recent records, any order (the store sorts by seq) */
  records?: DataRecord[];
  /** Alerts, if the source manages them; omit to use the client alert engine */
  alerts?: Alert[];
  header?: Partial<HeaderInfo>;
  views?: View[];
  /** Source clock, ISO */
  clock?: string;
}

/** What a source pushes as it runs */
export interface SourceBatch {
  records: DataRecord[];
  /** Full current alert list, if the source manages alerts */
  alerts?: Alert[];
  /** Entities added or changed */
  entities?: Entity[];
  clock?: string;
}

export interface SourceHandlers {
  onBatch: (batch: SourceBatch) => void;
  onStatus: (status: ConnectionStatus, error?: string) => void;
}

export interface DataSource {
  /** Fetch reference data and the current state */
  load(): Promise<SourceSnapshot>;
  /** Start receiving batches; returns a function that stops it */
  subscribe(handlers: SourceHandlers): () => void;
  /** Older records for one entity, oldest first */
  history?(entityId: string, limit: number): Promise<DataRecord[]>;
  /** For sources that manage alerts */
  acknowledge?(alertId: string): Promise<void>;
  acknowledgeAll?(): Promise<void>;
  /** True if alerts come from the source rather than the client engine */
  readonly managesAlerts?: boolean;
}

/** Mapping hooks so a source can speak any wire format */
export interface Mappers {
  entity?: (raw: any) => Entity;
  record?: (raw: any) => DataRecord;
  alert?: (raw: any) => Alert;
}

export const identity = <T>(x: any) => x as T;

/** Exponential back-off with jitter: 1s, 2s, 4s … capped */
export function backoff(attempt: number, maxMs = 30000): number {
  const base = Math.min(maxMs, 1000 * 2 ** attempt);
  return base / 2 + Math.random() * base / 2;
}
