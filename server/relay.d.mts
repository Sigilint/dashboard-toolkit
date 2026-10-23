// Types for server/relay.mjs
import type { IncomingMessage, ServerResponse } from "node:http";

export interface RelayOptions {
  /** Path prefix for every route, e.g. "/api" */
  prefix?: string;
  entities?: any[];
  header?: any;
  views?: any[];
  /** Shared secret: X-Webhook-Token header or Authorization: Bearer */
  token?: string;
  /** Map any webhook body to records (or { records, entities }) */
  mapWebhook?: (body: any, headers: IncomingMessage["headers"]) => any;
  /** Create entities for unknown entityIds; default true */
  autoEntities?: boolean;
  defaultCategory?: string;
  defaultGroup?: string;
  historyLimit?: number;
  bufferLimit?: number;
  corsOrigin?: string;
}

export interface Relay {
  /** Node request handler; resolves false if the path isn't under the prefix */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
  ingest(records: any | any[]): any[];
  upsertEntities(entities: any[]): void;
  alerts(): any[];
  readonly lastSeq: number;
}

export function createRelay(opts?: RelayOptions): Relay;
