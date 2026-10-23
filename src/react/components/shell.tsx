// Layout and chrome: AppShell, Header (title, meta, live toggle, unack badge,
// clock, theme), ThemeToggle and StatusBar.

import { useEffect, useState, type ReactNode } from "react";
import { useDashboard, useDashboardState, useNow } from "../context";
import { SEVERITY_RANK } from "../../core/severity";
import type { AlertPriority } from "../../core/types";
import { StatusIcon } from "./glyphs";

export type StreamSize = "collapsed" | "normal" | "expanded";

export interface AppShellProps {
  header: ReactNode;
  strip?: ReactNode;
  rail?: ReactNode;
  main: ReactNode;
  side?: ReactNode;
  /** Rendered over the main area, next to the side column */
  drawer?: ReactNode;
  stream?: ReactNode;
  streamSize?: StreamSize;
  statusbar?: ReactNode;
}

/**
 * Full-height grid: header / strip / [rail | main | side] / stream / status
 * bar. Below 1100 px it becomes one scrolling column.
 */
export function AppShell({ header, strip, rail, main, side, drawer, stream, streamSize = "normal", statusbar }: AppShellProps) {
  const { live } = useDashboardState();
  return (
    <div className={`dt-app stream-${streamSize} ${live ? "" : "paused"} ${rail ? "" : "no-rail"} ${side ? "" : "no-side"}`}>
      {header}
      {strip}
      <div className="dt-main">
        {rail}
        <section className="dt-stage">{main}</section>
        {side && <div className="dt-side">{side}</div>}
        {drawer}
      </div>
      {stream}
      {statusbar}
    </div>
  );
}

// ---------- theme ----------

export type Theme = "light" | "dark";

/** Reads ?theme=, then the saved choice, then the given default */
export function useTheme(storageKey = "dt-theme", fallback: Theme = "dark"): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const p = new URLSearchParams(location.search).get("theme");
    if (p === "light" || p === "dark") return p;
    try { return (localStorage.getItem(storageKey) as Theme) || fallback; } catch { return fallback; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(storageKey, theme); } catch { /* storage unavailable */ }
  }, [theme, storageKey]);
  return [theme, setTheme];
}

export function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <button className="dt-btn small" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
      {theme === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}

// ---------- header ----------

export function LiveToggle() {
  const d = useDashboard();
  const { live, queued } = useDashboardState();
  return (
    <button className={`dt-btn small dt-live ${live ? "is-live" : "is-paused"}`} aria-pressed={!live}
            onClick={() => d.setLive(!live)}
            title={live ? "Freeze the display; data keeps arriving in the background" : "Apply queued data and resume"}>
      <span className="dt-live-dot" aria-hidden="true" />
      {live ? "Live" : `Paused${queued ? ` · ${queued.toLocaleString()} queued` : ""}`}
    </button>
  );
}

export function UnackBadge() {
  const { alerts } = useDashboardState();
  const unacked = alerts.filter(a => !a.acked).length;
  const worstP = alerts.reduce<AlertPriority | "normal">(
    (w, a) => (a.state === "active" && SEVERITY_RANK[a.priority] > SEVERITY_RANK[w] ? a.priority : w), "normal");
  return (
    <span className={`dt-unack mono st-${worstP === "fault" ? "offline" : worstP}`}>
      {worstP !== "normal" && <StatusIcon status={worstP} size={11} />} {unacked} UNACK
    </span>
  );
}

export function Clock({ utc = true }: { utc?: boolean }) {
  const { clock } = useDashboardState();
  useNow(1000);
  const t = clock ? new Date(clock) : new Date();
  const text = utc ? `${t.toISOString().slice(11, 19)}Z` : t.toLocaleTimeString();
  return <span className="dt-clock mono">{text}</span>;
}

export interface HeaderProps {
  /** Brand block; defaults to the sigilint mark */
  brand?: ReactNode;
  /** Extra controls before the theme toggle */
  actions?: ReactNode;
  theme?: Theme;
  setTheme?: (t: Theme) => void;
}

export function Header({ brand, actions, theme, setTheme }: HeaderProps) {
  const { header } = useDashboardState();
  return (
    <header className="dt-topbar">
      {brand ?? <Brand />}
      <div className="dt-site mono">
        <span className="dt-site-name">{header.title}</span>
        {header.subtitle && <><span className="dt-sep">//</span><span>{header.subtitle}</span></>}
        {(header.meta || []).map((m, i) => (
          <span key={i} className={m.hideBelow ? `hide-${m.hideBelow}` : ""} title={m.title}>
            <span className="dt-sep">//</span> {m.label && <span className="muted">{m.label} </span>}{m.value}
          </span>
        ))}
      </div>
      <div className="dt-topbar-right">
        <LiveToggle />
        <UnackBadge />
        <Clock />
        {actions}
        {theme && setTheme && <ThemeToggle theme={theme} setTheme={setTheme} />}
      </div>
    </header>
  );
}

export function Brand({ name = "sigilint", sub = "sigil watch" }: { name?: string; sub?: string }) {
  return (
    <div className="dt-brand">
      <div className="dt-brand-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 22 22">
          <path d="M 11 2 L 20 19 L 2 19 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="11" cy="13" r="2" fill="currentColor" />
        </svg>
      </div>
      <div>
        <div className="dt-brand-name">{name}</div>
        <div className="dt-brand-sub mono">{sub}</div>
      </div>
    </div>
  );
}

// ---------- status bar ----------

export function StatusBar({ children, disclaimer }: { children?: ReactNode; disclaimer?: ReactNode }) {
  const { status, error, entities, latest, rate, live, records } = useDashboardState();
  const offline = entities.filter(e => latest[e.id]?.severity === "offline").length;
  const label = { idle: "IDLE", loading: "LOADING", connected: "CONNECTED", reconnecting: "RECONNECTING", error: "ERROR" }[status];
  const cls = status === "connected" ? "st-text-ok" : status === "reconnecting" ? "st-text-warning" : status === "error" ? "st-text-alarm" : "";
  return (
    <footer className="dt-statusbar mono">
      <span title={error}>SOURCE: <b className={cls}>{label}</b></span>
      <span>REPORTING {entities.length - offline}/{entities.length}</span>
      <span className="hide-sm">{Math.round(rate * 60).toLocaleString()}/MIN</span>
      <span className="hide-sm">BUFFER {records.length.toLocaleString()}</span>
      {!live && <span className="st-text-warning">DISPLAY PAUSED</span>}
      {children}
      {disclaimer && <span className="dt-disclaimer">{disclaimer}</span>}
    </footer>
  );
}
