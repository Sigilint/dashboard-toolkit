# Architecture

## Layers

```
 ┌──────────────────────────── your app ─────────────────────────────┐
 │  config: categories, groups, facets, header, derived rules, views │
 │  main view: Schematic + drawing │ Matrix │ EntityTable │ your own │
 └──────────────┬─────────────────────────────────────┬──────────────┘
                │ props / hooks                       │ createDashboard()
 ┌──────────────▼──────────────┐       ┌──────────────▼───────────────┐
 │ src/react                   │       │ src/core                     │
 │  DashboardProvider          │ store │  Dashboard (external store)  │
 │  useDashboardState …        │◄──────┤   filters · views · alerts   │
 │  components (DashboardApp,  │       │   live/paused · history      │
 │  AppShell, Drawer, Stream…) │       │   derived tiles · header     │
 └─────────────────────────────┘       └──────────────┬───────────────┘
                                                      │ DataSource
                     ┌────────────┬────────────┬──────┴─────┬────────────┐
                     ▼            ▼            ▼            ▼            ▼
                 simulator     polling        SSE       WebSocket     manual
                 (browser)   GET /records  GET /stream    ws://…     push()
                                   ▲            ▲
                                   └─────┬──────┘
                              server/relay.mjs  ◄── POST /webhook (JSON, CloudEvents)
```

- **Core** has no UI framework and no DOM access beyond `fetch`,
  `EventSource`, `WebSocket` and `localStorage`. It can run under React,
  Svelte, plain JS or Node (the tests run it in Node).
- **React** renders the core's state and calls its actions. Components read
  state through hooks; nothing is passed by prop drilling except per-view
  configuration.
- **Styles** are one CSS file of tokens and `dt-` classes, independent of
  React.

## Data model

| Type | Meaning | Examples |
|---|---|---|
| `Entity` | Something watched | A gas detector; `payments-api@prod`; a pump |
| `DataRecord` | One observation or event about an entity | A reading of 16.4 ppm; `deployment.finished: failed`; a door opening |
| `Alert` | An abnormal condition needing a person | H₂S alarm, unacknowledged |
| `Category` | What kind of thing, drawn as shape + letter | Safety (circle S), Service (square S) |
| `Group` | Where or which | Well bay; Payments project |
| `FacetDef` | A filter dimension | Category, location, environment, kind |
| `View` | A named filter set | "PROD watch", "Tank battery" |
| `DerivedTile` | A decision computed from several entities | Helideck: SUSPENDED; Pending promotions: 6 |

Every record carries a normalised **severity** (`normal`, `warning`,
`alarm`, `offline`). Domain statuses such as `running`, `failed` or `OPEN`
ride along in `status`. That one rule lets sensor readings and workflow
events share the alert engine, filters, stream and colours.

## The Dashboard store

`createDashboard(config)` returns a `Dashboard`: a plain object holding all
state, with `getState()` and `subscribe()` (the external-store protocol).
Each change replaces the state object, so React can compare snapshots by
reference.

**Lifecycle**
1. `start()` calls `source.load()` for entities, recent records,
   alerts, header and built-in views. At the same time it loads saved views
   from the `ViewStorage`.
2. `source.subscribe()` delivers `SourceBatch`es.
3. Each batch is ingested:
   - records are sorted, and any older than the highest sequence number
     seen are dropped
   - `latest` and per-entity `history` (300 by default) are updated
   - the newest records go to the front of the `records` buffer (2,000 by
     default)
   - the client alert engine runs, unless the source manages alerts
4. While paused (`setLive(false)`), batches queue and `queued` counts the
   records. `setLive(true)` applies them in one step.
5. `stop()` unsubscribes.

**Selection and history.** `select(id)` sets `selectedId`. If the entity has
little history and the source supports `history()`, it backfills.

**Derived values** (visible entities, facet counts, derived tiles, the
active view, the view hash) are computed from the snapshot, never stored
separately.

## React bindings

- `DashboardProvider` takes a `Dashboard`, starts it on mount and stops
  it on unmount. It also sets the `localStorage` prefix for per-viewer
  preferences.
- `useDashboardState()` subscribes through `useSyncExternalStore`.
- Narrower hooks memoise derived data from the snapshot:
  `useVisibleEntities`, `useIsVisible`, `useMatchRecord`,
  `useDerivedTiles`, `useHistory` and `useSelectedEntity`.
- `useDashboard()` returns the instance for actions.

Component-local state (feed pause, table/JSON toggle, area hover/pin) stays
in components. Preferences that should survive a reload (stream size,
weather card open, area outlines, theme) use `usePreference` or
`useTheme`.

## Folder layout

```
src/
  core/
    types.ts         data model
    severity.ts      ranking, limit evaluation, severity filter
    format.ts        values, units, times, limits
    filters.ts       canonical filters, facets, search, matching
    views.ts         saved views, storage adapters, view hash
    alerts.ts        client alert engine (ISA-18.2-style lifecycle)
    dashboard.ts     the store
    sources/
      types.ts       DataSource contract, back-off
      rest.ts        RestClient + polling source
      push.ts        SSE and WebSocket sources
      simulator.ts   scripted in-browser source
      mappers.ts     CloudEvents → DataRecord
      factory.ts     createSource(), ?source=, manual source
  react/
    context.tsx      provider and hooks
    components/      glyphs, shell, summary, filters, alerts, drawer,
                     stream, schematic, tables, DashboardApp
  styles/toolkit.css tokens + component styles
server/relay.mjs     webhook relay (Node, no dependencies)
examples/            three example apps + mock server
test/                Vitest suites
```

## Design decisions

- **Framework-agnostic core, React UI.** State, data fetching and rules
  live in plain TypeScript, so they can be tested in Node and reused from
  the Svelte release dashboard. React is the UI layer, matching the two
  monitors. It runs client-side only, with no Next.js.
- **External store, not React state.** One object owns the data and its
  rules. React subscribes, and other frameworks could subscribe the same
  way. This also keeps the 1-second update cycle out of React context
  re-render chains.
- **Sources behind one interface.** The UI never knows whether data is
  simulated, polled or pushed. `createSource()` picks the kind from
  configuration or `?source=`.
- **Webhooks through a relay.** Browsers can't receive webhooks. The relay
  turns POSTs into the same polling/SSE protocol, so a webhook dashboard
  uses no special client code.
- **Severity normalised at the edge.** Sources or mappers decide severity;
  everything downstream (alerts, filters, colours) uses that one field.
- **Colour means abnormal.** Carried over from the monitors (ISA-101). See
  [Design](DESIGN.md).
- **Source-first distribution.** The package exports TypeScript and CSS,
  and the app's Vite build compiles them. A prebuilt bundle can come later.
