# Core API

Everything here is exported from `@sigilint/dashboard-toolkit/core` (and
from the package root).

## createDashboard(config)

```ts
const d = createDashboard({
  source,                       // DataSource (required)
  categories,                   // Category[] (required)
  groups,                       // Group[]: locations, projects, environments…
  facets,                       // FacetDef[]; default: category, type, group
  header: { title, subtitle, meta: [{ label, value, title, hideBelow }] },
  derived: ctx => DerivedTile[],
  views: { builtIn: View[], storage: ViewStorage },
  initialFilters: { severity: "attention" },
  historyLimit: 300,            // samples kept per entity
  bufferLimit: 2000,            // records kept for the stream
});
```

### State (`d.getState()`)

| Field | Type | Notes |
|---|---|---|
| `status`, `error` | `ConnectionStatus`, string | idle → loading → connected / reconnecting / error |
| `header` | `HeaderInfo` | Config header, merged with the source snapshot's header and `setHeader` |
| `categories`, `groups`, `facets` | | From config |
| `entities`, `entityById` | `Entity[]`, `Map` | From the snapshot and any `entities` in batches |
| `latest` | `Record<id, DataRecord>` | Most recent record per entity |
| `records` | `DataRecord[]` | Newest first, capped at `bufferLimit` |
| `alerts` | `Alert[]` | Sorted: active, then priority, then newest |
| `filters` | `FilterState` | Always canonical |
| `builtInViews`, `savedViews`, `activeView` | `View[]`, `View?` | `activeView` is the view whose filters equal the current ones |
| `viewHash` | string | 8-hex FNV-1a of the canonical filters (a subscription key) |
| `live`, `queued` | boolean, number | Paused when `live` is false; `queued` counts waiting records |
| `selectedId` | `string \| null` | Entity open in the drawer |
| `clock` | ISO string | Source clock, if it sends one |
| `rate` | number | Incoming records per second (10 s window) |
| `version` | number | Increments on every change |

### Actions

| Method | Effect |
|---|---|
| `start()` / `stop()` | Load and subscribe / unsubscribe |
| `setFilters(patch \| f => patch)` | Merge and canonicalise |
| `resetFilters()` | Back to empty |
| `applyView(id)` | Set filters from a view |
| `saveView(name, extra?)` | Save the current filters; persists to `storage` |
| `deleteView(id)` | Remove a saved view |
| `setLive(bool)` | Pause (queue) or resume (apply the queue) |
| `select(id \| null)` | Open or close the drawer; backfills history if available |
| `acknowledge(alertId)`, `acknowledgeAll()` | Client engine, or the source's acknowledge when it manages alerts |
| `setHeader(patch)` | Change the title, subtitle or meta at runtime |
| `loadHistory(id, limit?)` | Merge older records from `source.history` |

### Queries

| Method | Returns |
|---|---|
| `isVisible(entity)` | Passes search, facets and the severity filter |
| `matchesWithoutSeverity(entity)` | Passes search and facets only |
| `matchRecord(record)` | Record passes the filters, judged on its own severity |
| `visibleEntities()` | `Entity[]` |
| `severityOf(id)` | Latest severity, `"normal"` if none |
| `facetOptions(key)`, `facetCounts(key)` | Options with labels; counts per value |
| `historyFor(id)` | Held records, oldest first |
| `derived()` | The config's derived tiles, computed now |

`derived(ctx)` receives `{ state, value(id, fallback), severity(id), latest(id) }`.

## Filters (`filters.ts`)

`FilterState = { q, severity: "all" | "attention" | "alarm" | "offline", facets: { [key]: string[] } }`

- **How filters combine:** within a facet, values are alternatives; across
  facets, all must match. Search is AND across words. It matches id, name,
  type, type label, group key and label, and every tag value.
- **Functions:** `emptyFilters`, `canonicalFilters`, `sameFilters`,
  `isEmptyFilters`, `toggleFacet`, `setFacet`, `defaultFacets`,
  `facetOptions`, `facetCounts`, `matchEntity`, `isVisible` and
  `matchRecord`.
- **Custom facets** read anything off an entity:

```ts
{ key: "env", label: "Environment", get: e => e.tags?.env, options: [{ value: "prod", label: "PROD" }] }
```

## Views (`views.ts`)

| Export | Purpose |
|---|---|
| `localViewStorage(key)` | Per-browser storage |
| `memoryViewStorage()` | Tests and ephemeral use |
| `remoteViewStorage(url)` | `GET url` → `View[]`, `PUT url` with `View[]` |
| `makeView(name, filters, extra)` | New view with a generated id and canonical filters |
| `findMatchingView(views, filters)` | The view with equal filters, if any |
| `viewHash(filters, layout?)` | Stable 8-hex hash; the same selection always gives the same key |

## Alerts (`alerts.ts`)

`AlertEngine` follows the monitors' ISA-18.2-style lifecycle:

```
abnormal → ACTIVE unacked ─ack→ ACTIVE acked ─normal→ removed
                          └normal→ RTN unacked ─ack→ removed
escalation (warning→alarm, fault→warning/alarm) or re-activation clears the ack
```

- **Priority:** `alarm`, `warning`, or `fault` (offline).
- **Tracked:** the latest value, the peak in the direction of the excursion,
  the limit crossed, and raised / updated / cleared times.
- `sortAlerts()` gives the display order.

## Severity and formatting

| Export | Purpose |
|---|---|
| `SEVERITY_RANK`, `SEVERITY_LABEL` | normal 0, offline/fault 1, warning 2, alarm 3 |
| `worse(a, b)`, `worst(list)` | Combine severities |
| `evaluateLimits(limits, value)` | `{ severity, dir?, limit? }` from hi/lo `[warning, alarm]` |
| `severityMatches(filter, severity)` | The severity filter |
| `formatValue(value, entity)` | Decimals from `dp`; binary words; "—" for no data |
| `formatUnit`, `formatTime(iso, ms?)`, `formatAgo`, `formatDuration`, `formatLimits` | Display strings |

## Sources

See [Data sources](DATA_SOURCES.md) for `createSource`, `createSimulator`,
`pollingSource`, `sseSource`, `webSocketSource`, `manualSource`,
`RestClient`, `cloudEventMapper` and `backoff`.
