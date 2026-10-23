# Extraction

How the toolkit was derived from the three prototypes, what stayed behind,
and how each prototype could move onto it. None of the prototypes were
changed.

## Where each piece came from

| Toolkit | offshore-platform-monitor | well-site-monitor | release dashboard (mockup + SvelteKit app) |
|---|---|---|---|
| Data model (`Entity`, `DataRecord`, `Alert`) | sensors, readings, alerts in `api.jsx` | same | components × environments, CloudEvents, cells (`types.ts`) |
| `severity.ts` | `evaluate()` thresholds, `STATUS_RANK` | same | status → severity mapping (failed, rolled back) |
| `AlertEngine` | `updateAlert()` lifecycle | same | — (incidents were events, not alerts) |
| `filters.ts` | categories / zones / type / status / search | same | multi-select env / event / status, *in progress only* (`stores/filters`) |
| `views.ts`, `viewHash` | — | `views.jsx` saved views | view builder and selection hash (`views/hash.ts`) |
| `Dashboard.setLive` | — | Live / Paused with queue | Live toggle |
| Simulator | `api.jsx` warm-up, noise, scenario effects | same, plus binary sensors | `sim/simulator.ts` event generator → `events` hook |
| Polling / SSE / WebSocket / relay | the async API shape (`getReadings({ after })`) | same | connection store, CloudEvents envelope |
| `AppShell`, `Header` | top bar, strip, rail, stage, side, feed, status bar | + Live button | `AppHeader`, `Sidebar`, `PageHeader`, docked stream |
| `SummaryStrip` | category tiles + derived ops tiles | same | summary strip line and KPI tiles |
| `FilterRail`, `ViewsPanel` | `FilterRail` | + `ViewsSection` | `FilterBar` dropdowns, sidebar views |
| `AlertList` | `AlertsPanel` | same | bell / notifications |
| `DetailDrawer`, `Sparkline` | `SensorDetail` → `drawer.jsx` | same | `EventDrawer` and sections (summary, related, raw event) |
| `EventStream` | `RawFeed` | + match filters, clear, sizes, row click | `EventStream`, `StreamLine` |
| `Schematic`, `AreaBanner`, `OverlayCard` | `schematic.jsx` markers, zones, callouts, tooltip, `MetCard` | + area banner, collapsible card | — |
| `Matrix` | — | — | `EnvironmentMatrix`, `MatrixCell` |
| `EntityTable` | — | — | (new) |
| `toolkit.css` | tokens, status colours, marker styles | + scene-neutral parts | layout breakpoints, drawer width, stream conventions |

## What stayed in the apps

These are domain-specific, so they belong in each app's configuration or
main view rather than the toolkit:

- **Drawings.** The platform jacket and topsides, and the well pad with its
  wellbore and aquifer cutaway, become the `background` of a `Schematic`.
- **Scene animations:** waves, flare, plunger, combustor, vehicles, gas
  drift. These would go in `background` or `overlay`.
- **Derived rules:** helideck and crane limits, well control, muster,
  emissions, neighbours, pending promotions. These become `derived()`
  functions.
- **Catalogues and scenarios:** sensor types, zones, placements and the
  scripted events. These become entities, groups and simulator scenarios.
- **Release-specific drawer sections:** stages, test results, the
  environment timeline, tool links, notes and comments. These become
  `DetailDrawer extra` sections.
- **The release dashboard's summary layout:** impediments, wait times,
  friction, burn-down and capacity charts. That is a second main view; the
  toolkit has no chart components beyond `Sparkline` yet.

## Deliberate differences

| Topic | Prototype | Toolkit | Why |
|---|---|---|---|
| Event-type colours | Release dashboard colours each event family | Kind shown as a word tag | One colour rule across products: colour = severity |
| View hash | Release dashboard: tenant + promotion-path-aware canonical form, server-authoritative | FNV-1a of canonical filters + layout | Generic; a tenant-aware hash can replace `viewHash` per app |
| Status vocabulary | Each app's own (`NORMAL`, `Running`, `Rolled back`) | `severity` for rules, `status` for display | Lets sensors and events share alerts, filters and the stream |
| Click an area | Monitors: pin the banner, then filter | Same | Kept |
| Distribution | No-build UMD (monitors), SvelteKit (release dashboard) | TypeScript source for Vite apps | Type safety and tree-shaking; a prebuilt bundle can follow |

## Moving the prototypes onto the toolkit

**Offshore platform and well site** (React already):
1. Add Vite and replace in-browser Babel.
2. Express `catalog.jsx` and `platform.jsx` / `site.jsx` as entities,
   groups and simulator scenarios. The `sim` fields map one to one.
3. Replace `api.jsx` with `createSimulator()`, or with `createSource()`
   once there's a service.
4. Move each `deriveOps()` into `derived()`.
5. Keep `schematic.jsx`'s drawing and scene layers as the `background` and
   `overlay` of `<Schematic>`. Delete its markers, zones, callouts and
   tooltip.
6. Replace the rail, strip, alerts, drawer, feed, views and banner with
   `DashboardApp`.

**Release dashboard** (Svelte):
1. Use `src/core` directly. `Dashboard` is an external store, so a
   Svelte 5 wrapper is a few lines with `$state` plus `subscribe`.
2. Map CloudEvents with `cloudEventMapper()`. Use the relay or `sseSource`
   for the event feed.
3. Keep the Svelte components, or adopt the React ones for new screens.

## Refactoring later

- Lift the scene-agnostic parts of the monitors' drawings (markers, zones,
  callouts) out of the apps once both use `Schematic`.
- Make derived rules data (thresholds in config) instead of functions, so a
  server can evaluate them too.
- Add a charts module for summary layouts, built with the dataviz rules the
  monitors already follow.
