// DashboardApp: the standard composition — header, summary strip, views and
// filter rail, a main view, alerts, detail drawer, event stream and status
// bar — wired to the dashboard in context. Every piece is also exported on
// its own for apps that need a different arrangement.

import type { ReactNode } from "react";
import { usePreference } from "../context";
import { AppShell, Header, StatusBar, useTheme, type StreamSize } from "./shell";
import { SummaryStrip } from "./summary";
import { FilterRail } from "./filters";
import { AlertList } from "./alerts";
import { DetailDrawer, type DetailDrawerProps } from "./drawer";
import { EventStream, type StreamColumn } from "./stream";
import { useAreaFocus, type AreaFocus } from "./schematic";

export interface DashboardAppProps {
  /** The main view; a function receives the shared area focus (for Schematic + AreaBanner) */
  main: ReactNode | ((focus: AreaFocus) => ReactNode);
  brand?: ReactNode;
  headerActions?: ReactNode;
  /** Show the category tiles in the summary strip; default true */
  categoryTiles?: boolean;
  railBottom?: ReactNode;
  searchPlaceholder?: string;
  streamTitle?: string;
  streamColumns?: StreamColumn[];
  drawer?: DetailDrawerProps;
  statusExtra?: ReactNode;
  disclaimer?: ReactNode;
  /** Default theme; default "dark" */
  defaultTheme?: "light" | "dark";
  /** Hide the alerts column */
  noAlerts?: boolean;
}

export function DashboardApp(p: DashboardAppProps) {
  const [theme, setTheme] = useTheme(undefined, p.defaultTheme ?? "dark");
  const [streamSize, setStreamSize] = usePreference<StreamSize>("stream-size", "normal");
  const [showAreas, setShowAreas] = usePreference("show-areas", false);
  const focus = useAreaFocus();
  const main = typeof p.main === "function" ? p.main({ ...focus, showAreas }) : p.main;

  return (
    <AppShell
      header={<Header brand={p.brand} actions={p.headerActions} theme={theme} setTheme={setTheme} />}
      strip={<SummaryStrip showCategories={p.categoryTiles ?? true} />}
      rail={
        <FilterRail
          bottom={p.railBottom} searchPlaceholder={p.searchPlaceholder} onHoverGroup={focus.setHover}
          groupTitleExtra={typeof p.main === "function" ? (
            <label className="dt-toggle mini"><input type="checkbox" checked={showAreas} onChange={e => setShowAreas(e.target.checked)} /> outline</label>
          ) : undefined}
        />
      }
      main={main}
      side={p.noAlerts ? undefined : <AlertList />}
      drawer={<DetailDrawer {...p.drawer} />}
      stream={<EventStream title={p.streamTitle} columns={p.streamColumns} size={streamSize} setSize={setStreamSize} />}
      streamSize={streamSize}
      statusbar={<StatusBar disclaimer={p.disclaimer}>{p.statusExtra}</StatusBar>}
    />
  );
}
