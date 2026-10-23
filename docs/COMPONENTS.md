# Components

Exported from `@sigilint/dashboard-toolkit/react` (and the package root).
Import the styles once: `import "@sigilint/dashboard-toolkit/styles.css"`.

Every component reads the dashboard from context, so wrap the tree in
`DashboardProvider`.

## Hooks

| Hook | Returns |
|---|---|
| `useDashboard()` | The `Dashboard` instance, for actions |
| `useDashboardState()` | The current snapshot; re-renders on change |
| `useVisibleEntities()` | Entities passing the filters |
| `useIsVisible()`, `useMatchRecord()` | Predicates bound to the current filters |
| `useDerivedTiles()` | The config's derived tiles |
| `useHistory(id)` | Held records for an entity |
| `useSelectedEntity()` | The entity open in the drawer |
| `usePreference(key, initial)` | A value kept in `localStorage` under the provider's `storageKey` |
| `useNow(ms)` | Re-renders on an interval |
| `useTheme(key?, fallback?)` | `[theme, setTheme]`; reads `?theme=`, then storage; sets `data-theme` |
| `useAreaFocus()` | `{ hover, pinned, setHover, pin }`, shared by rail, schematic and banner |

## DashboardProvider

```tsx
<DashboardProvider dashboard={d} storageKey="my-app" autoStart>
```

It starts the dashboard on mount and stops it on unmount
(`autoStart={false}` to manage that yourself). `storageKey` namespaces
per-viewer preferences.

## DashboardApp

The standard layout in one component:
- **Top:** header and summary strip.
- **Left:** views and filter rail.
- **Middle:** your main view.
- **Right:** alerts, with the detail drawer sliding in beside them.
- **Bottom:** event stream and status bar.

| Prop | Type | Default |
|---|---|---|
| `main` | `ReactNode` or `(focus: AreaFocus) => ReactNode` | — (required). Use the function form with `Schematic` + `AreaBanner` |
| `brand`, `headerActions` | `ReactNode` | sigilint mark; none |
| `categoryTiles` | boolean | `true` |
| `railBottom` | `ReactNode` | none (e.g. simulation or source controls) |
| `searchPlaceholder` | string | "ID, name or type…" |
| `streamTitle`, `streamColumns` | string, `StreamColumn[]` | "Event stream", `SENSOR_COLUMNS` |
| `drawer` | `DetailDrawerProps` | defaults |
| `statusExtra`, `disclaimer` | `ReactNode` | none |
| `defaultTheme` | `"light" \| "dark"` | `"dark"` |
| `noAlerts` | boolean | `false` |

## Building your own layout

```tsx
const [theme, setTheme] = useTheme();
const [size, setSize] = usePreference<StreamSize>("stream", "normal");
<AppShell
  header={<Header theme={theme} setTheme={setTheme} actions={<MyButton />} />}
  strip={<SummaryStrip />}
  rail={<FilterRail top={<ViewsPanel />} bottom={<MyControls />} />}
  main={<MyMainView />}
  side={<AlertList title="Incidents" />}
  drawer={<DetailDrawer extra={ctx => <MySection {...ctx} />} />}
  stream={<EventStream columns={EVENT_COLUMNS} size={size} setSize={setSize} />}
  streamSize={size}
  statusbar={<StatusBar disclaimer="Simulated" />}
/>
```

## Shell

| Component | Props | Notes |
|---|---|---|
| `AppShell` | `header, strip?, rail?, main, side?, drawer?, stream?, streamSize?, statusbar?` | Full-height grid; one column below 1100 px; dashed outline while paused |
| `Header` | `brand?, actions?, theme?, setTheme?` | Title, subtitle and meta from `state.header`; then Live, UNACK, clock, theme |
| `LiveToggle`, `UnackBadge`, `Clock`, `Brand`, `ThemeToggle` | | The header's parts, usable alone |
| `StatusBar` | `children?, disclaimer?` | Source status, reporting count, rate, buffer, paused flag |

## Summary

| Component | Props | Notes |
|---|---|---|
| `SummaryStrip` | `showCategories?` | Category tiles plus derived tiles |
| `CategoryTiles` | `facetKey?` | Count and severity counts per category; click toggles the category filter |
| `DerivedTiles` | | One tile per `derived()` result: label, value, why |

## Filters and views

| Component | Props | Notes |
|---|---|---|
| `FilterRail` | `top?, bottom?, searchPlaceholder?, onHoverGroup?, groupTitleExtra?` | Views, search, status, one control per facet, clear |
| `ViewsPanel` | | Built-in and saved views; active view highlighted; *unsaved* + save form when nothing matches; view hash tag |
| `SearchBox`, `SeverityFilterControl`, `FacetControl`, `ClearFilters` | | Rail parts. `FacetControl` shows checkboxes with counts and worst severity, or a `select` |

## Alerts

`AlertList({ title? })`:
- priority, state (UNACK, ACK, RTN), time, entity, and the message
- **Ack** and **Ack all**
- an *Only alerts matching filters* switch
- clicking an alert opens its entity

`alertMessage(alert, entity)` formats the message line.

## Detail drawer

`DetailDrawer` shows the selected entity. It opens from a marker, an alert, a
stream row, a matrix cell or a table row. Esc, × or the backdrop closes it,
and focus moves to the close button when it opens.

**Head:** value or status, limits, the latest message, and an acknowledge
button.

**Default sections**, in order:

| Key | Section |
|---|---|
| `alert` | Alert details |
| `trend` | Sparkline with limit lines and hover readout |
| (your `extra`) | |
| `about` | `entity.description` and `insights` |
| `related` | Other entities in the same group; click to switch |
| `recent` | Last eight records |
| `tags` | Entity tags, last time, quality |
| `raw` | Latest record as JSON |

| Prop | Type |
|---|---|
| `extra` | `(ctx: { entity, latest, alert, history }) => ReactNode`, inserted after the trend |
| `hide` | Default section keys to leave out |
| `actions` | Extra buttons in the head |
| `relatedLabel` | `(groupLabel) => string` |

`DrawerSection({ title, aside?, children })` gives custom sections the same
look. `Sparkline({ data, entity?, height? })` works anywhere.

## Event stream

`EventStream({ title?, columns?, size, setSize, maxRows? })` shows every
record, newest first.

**Controls**
- table or JSON view
- Match filters (off shows everything), Exceptions only, Selected only
- Pause, Clear and Restore
- collapse, normal or expand

**Rows:** click or Enter opens the entity. New rows flash, and the selected
entity's rows are highlighted.

**Columns** are `StreamColumn { key, label, render(r, entity, group),
className?, secondary? }`. Columns marked `secondary` hide on phones. There
are two presets: `SENSOR_COLUMNS` and `EVENT_COLUMNS`.

## Schematic, area banner, overlay card

```tsx
<DashboardApp main={focus => (
  <Schematic viewBox={[0, 0, 1200, 760]} background={<MyDrawing />} overlay={<GasOutlines />} focus={focus}>
    <AreaBanner focus={focus} />
    <OverlayCard id="weather" title="Weather" summary="14 kt SE" severity="normal">
      <CardRow label="Wind" value="14 kt" />
    </OverlayCard>
  </Schematic>
)} />
```

- **`Schematic`**
  - **Your SVG:** `background` is drawn first; `overlay` goes between the
    areas and the markers.
  - **Areas:** hit zones come from `group.rect`.
  - **Markers:** placed from `entity.position`. Each is drawn as its
    category's shape and letter, with status fill, a pulse while
    unacknowledged, a ring when selected, and dimmed when filtered out.
  - **Callouts:** value callouts for abnormal entities, placed to avoid
    collisions.
  - **Interaction:** hover tooltips; markers are keyboard-focusable.
- **`AreaBanner({ focus })`**
  - Names the hovered or pinned area: code, label, description, counts.
  - Pinned, it adds **Show only these N** and **Add to filter**.
- **`OverlayCard({ id, title, summary, severity?, position?, children })`**
  - A floating card that collapses to a chip and remembers its state.
  - `CardRow` is a label/value line for it.

## Matrix and EntityTable

```tsx
<Matrix columns={[{ key: "dev", label: "DEV" }, …]}
        rowOf={e => e.tags.component} columnOf={e => e.tags.env}
        rowLabel={…} groupLabel={…} renderCell={(e, latest) => …} />
```

`Matrix` lays entities out in rows × columns, grouped by `entity.group`,
like the release dashboard's environment matrix:
- rows with nothing visible are hidden, and filtered-out cells are dimmed
- clicking a cell opens the drawer

`EntityTable` is a sortable list of the visible entities with their latest
value, status and age.

## Glyphs

| Component | Purpose |
|---|---|
| `CategoryIcon({ category, size })` | Shape + letter for a category |
| `StatusIcon({ status, size })` | Diamond = alarm, triangle = warning, crossed box = offline/fault, circle = normal |
| `StatusPill({ status, label? })` | Icon + word in a pill |
| `SeverityCounts({ counts })` | ◆2 ▲3 style counts |
| `ShapePath`, `ShapeLetter` | Raw SVG pieces for custom markers |
