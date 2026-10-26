# dashboard-toolkit

A client-side React toolkit for live monitoring and event dashboards,
extracted from three Sigilint prototypes:

| Prototype | What it contributed |
|---|---|
| [`offshore-platform-monitor`](../offshore-platform-monitor) | Schematic with sensor markers, status-only colour, alert lifecycle, raw feed, derived-state tiles, simulator |
| [`well-site-monitor`](../well-site-monitor) | Area banner, collapsible overlay card, binary sensors, detail drawer, saved views, live/paused |
| [`release-dashboard`](../../releasedashboard/releasedashboard-prototype-c1) | Environment matrix, event stream conventions, view hash, CloudEvents, filter facets, multiple layouts |

The prototypes are unchanged. This is a separate library to build new
dashboards on, and to refactor the prototypes onto later. See
[docs/EXTRACTION.md](docs/EXTRACTION.md).

## What's in it

- **Core** (`src/core`, plain TypeScript, no framework):
  - **Data model:** entities, records, alerts.
  - **Data sources:** simulator, REST polling, Server-Sent Events,
    WebSocket, webhooks through a relay, and a manual push source.
  - **The `Dashboard` store:** search and facet filters, saved views,
    client-side alert engine, live/paused queueing, derived summary tiles,
    and an editable header.
- **React** (`src/react`):
  - **Hooks:** a provider plus hooks over the store, built on
    `useSyncExternalStore`.
  - **Components:** app shell, header, summary strip, filter rail with
    saved views, alert list, detail drawer with trend chart, event stream,
    schematic with area banner, matrix, entity table, and `DashboardApp`,
    which composes all of them.
- **Styles** (`src/styles/toolkit.css`): design tokens for light and dark,
  and every component's styles. All classes are prefixed `dt-`.
- **Relay** (`server/relay.mjs`): a dependency-free Node server that
  accepts webhooks and serves them to dashboards.

No Next.js and no server rendering: it runs entirely in the browser, built
with Vite.

## Quick start

```sh
npm install
npm test               # core, relay and source tests (Vitest)
npm run dev            # examples on http://127.0.0.1:5180/
npm run mock-server    # mock service for the live-service example (port 8790)
```

| Example | Shows |
|---|---|
| `/sensor-site/` | A drawn site with sensors, scenarios on the simulator, derived tiles, weather card, area banner |
| `/well-pad/` | Overhead view of one well on private land: fenceline ESP32 emissions nodes, gate sensor, ESP-NOW gateway, game-cam stills, RRC and operator records, guided tour |
| `/release-matrix/` | Builds, deployments and test runs in a components × environments matrix |
| `/live-service/?source=polling` (or `sse`, `webhook`, `simulator`) | The same dashboard fed by a real HTTP service, including test webhooks |

## A dashboard in one file

```tsx
import { createRoot } from "react-dom/client";
import "@sigilint/dashboard-toolkit/styles.css";
import { createDashboard, createSource, localViewStorage,
         DashboardProvider, DashboardApp, EntityTable } from "@sigilint/dashboard-toolkit";

const dashboard = createDashboard({
  // swap "polling" for "sse", "webhook" or a simulator spec; the UI doesn't change
  source: createSource({ kind: "polling", baseUrl: "/api", managesAlerts: true }),
  categories: [
    { key: "process", label: "Process", code: "P", shape: "square" },
    { key: "safety", label: "Safety", code: "S", shape: "circle" },
  ],
  groups: [{ key: "PUMPS", label: "Pump room", description: "Duty and standby pumps" }],
  header: { title: "LIFT STATION 7", subtitle: "Live" },
  views: { storage: localViewStorage("lift-views") },
  derived: ({ value }) => [
    { key: "flow", label: "Flow", value: `${value("FT-101")} gpm`, severity: value("FT-101") < 300 ? "warning" : "normal" },
  ],
});

createRoot(document.getElementById("root")!).render(
  <DashboardProvider dashboard={dashboard} storageKey="lift">
    <DashboardApp main={<EntityTable />} />
  </DashboardProvider>,
);
```

## Documentation

| Document | Covers |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Layers, data model, the Dashboard store, React bindings, folder layout, design decisions |
| [Data sources](docs/DATA_SOURCES.md) | Simulator, polling, SSE, WebSocket, webhooks and the relay, manual push; the wire protocol; writing a source |
| [Core API](docs/CORE.md) | `createDashboard`, state, actions and queries; filters, views, alerts, severity, formatting |
| [Components](docs/COMPONENTS.md) | Hooks and every component's props; composing your own layout |
| [Design](docs/DESIGN.md) | Tokens, colour and shape encoding, layout and breakpoints, accessibility, theming |
| [Extraction](docs/EXTRACTION.md) | What came from which prototype, what stayed behind, and how each prototype could move onto the toolkit |
| [Roadmap](docs/ROADMAP.md) | Known gaps and next steps |

## Status

Version 0.1, private. The core and relay have a test suite (22 tests). The
React components have been checked in headless Chrome through the three
examples but have no component tests yet. The package ships as TypeScript
source, so consuming apps compile it with their own bundler; there's no
prebuilt library bundle yet.

## Deployment

Live at **https://toolkit.sigilint.com**, also served at `https://sigilint-dashboard-toolkit.netlify.app`. It is the Netlify site `sigilint-dashboard-toolkit`, which deploys automatically on every push to `main` of `Sigilint/dashboard-toolkit`. Build settings are in `netlify.toml`: `npm ci && npm run build` on Node 24, publishing `dist/examples`. The live-service example needs the mock server, so it shows no data there. See `DEPLOYMENT.md` in `Sigilint/sigilint-web` for how all the Sigilint sites are hosted.
