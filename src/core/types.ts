// Shared data model. Sensors, workflow events and anything else a dashboard
// watches are described with the same few shapes:
//
//   Entity      — a thing being watched (a sensor, a component in an
//                 environment, a well, a service)
//   DataRecord  — one observation or event about an entity (a reading, a
//                 deployment finishing, a door opening)
//   Alert       — an abnormal condition on an entity that needs a person
//
// Apps describe their own vocabulary with Categories, Groups and Facets.

/** Normalised severity. Apps map their own statuses onto this. */
export type Severity = "normal" | "warning" | "alarm" | "offline";

/** Category marker shapes. Category is shown by shape + letter, never colour. */
export type Shape = "circle" | "square" | "diamond" | "triangle" | "hexagon" | "invtriangle";

export interface Category {
  key: string;
  label: string;
  /** One or two letters drawn inside the shape */
  code: string;
  shape: Shape;
  description?: string;
}

/** A location, project, environment or other grouping of entities. */
export interface Group {
  key: string;
  label: string;
  description?: string;
  /** Hit area on a schematic: [x, y, width, height] in its viewBox */
  rect?: [number, number, number, number];
}

export interface Limits {
  /** [warning, alarm] — at or above */
  hi?: [number, number];
  /** [warning, alarm] — at or below */
  lo?: [number, number];
}

export interface Entity {
  id: string;
  name: string;
  /** Machine type, e.g. "GD_H2S" or "service" */
  type: string;
  /** Human label for the type, used in search and detail */
  typeLabel?: string;
  category: string;
  group: string;
  unit?: string;
  /** Decimal places for values */
  dp?: number;
  limits?: Limits;
  /** Two-state entities show these words instead of 0 / 1 */
  binary?: [string, string];
  /** Position on a schematic, in its viewBox */
  position?: { x: number; y: number };
  /** Free-form, searchable key/values (env, node, link, owner…) */
  tags?: Record<string, string>;
  /** Long-form text for the detail drawer */
  description?: string;
  insights?: string[];
  meta?: Record<string, unknown>;
}

export interface DataRecord {
  /** Monotonic sequence from the source; used as the cursor */
  seq: number;
  /** ISO 8601 */
  ts: string;
  entityId: string;
  severity: Severity;
  /** Numeric reading, if this record is a measurement. null = no data */
  value?: number | null;
  /** Workflow or domain status, e.g. "running", "failed", "OPEN" */
  status?: string;
  /** Event type, e.g. "reading", "deployment.finished" */
  kind?: string;
  message?: string;
  quality?: string;
  /** Anything else the source sent, shown in the raw view */
  data?: Record<string, unknown>;
}

export type AlertPriority = "alarm" | "warning" | "fault";

export interface Alert {
  id: string;
  entityId: string;
  priority: AlertPriority;
  /** active, or rtn = returned to normal but not yet acknowledged */
  state: "active" | "rtn";
  acked: boolean;
  raisedAt: string;
  updatedAt: string;
  clearedAt: string | null;
  value?: number | null;
  peak?: number | null;
  limit?: number | null;
  dir?: "hi" | "lo" | null;
  message?: string;
}

export type SeverityFilter = "all" | "attention" | "alarm" | "offline";

export interface FilterState {
  q: string;
  severity: SeverityFilter;
  /** facet key → selected values (empty or missing = all) */
  facets: Record<string, string[]>;
}

export interface FacetOption {
  value: string;
  label: string;
  description?: string;
}

export interface FacetDef {
  key: string;
  label: string;
  /** Value(s) of this facet for an entity */
  get: (entity: Entity) => string | string[] | undefined;
  /** Options to show; defaults to the distinct values found on entities */
  options?: FacetOption[];
  control?: "checkbox" | "select";
}

export interface View {
  id: string;
  name: string;
  description?: string;
  filters: FilterState;
  /** App-defined layout, e.g. "matrix" or "summary" */
  layout?: string;
  builtIn?: boolean;
}

export interface HeaderMeta {
  label?: string;
  value: string;
  title?: string;
  /** Hide below this width class */
  hideBelow?: "sm" | "md";
}

export interface HeaderInfo {
  title: string;
  subtitle?: string;
  meta?: HeaderMeta[];
}

export interface DerivedTile {
  key: string;
  label: string;
  value: string;
  severity: Severity;
  detail?: string;
}

export type ConnectionStatus = "idle" | "loading" | "connected" | "reconnecting" | "error";
