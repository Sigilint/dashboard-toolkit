// Category shapes and status icons. Category is shape + letter, never
// colour; colour is reserved for warning and alarm (ISA-101).

import type { AlertPriority, Category, Severity, Shape } from "../../core/types";
import { SEVERITY_LABEL } from "../../core/severity";

const SHAPE_PATHS: Record<Exclude<Shape, "circle">, string> = {
  diamond: "M0,-8.5 L8.5,0 L0,8.5 L-8.5,0 Z",
  square: "M-6.5,-6.5 H6.5 V6.5 H-6.5 Z",
  triangle: "M0,-8.5 L8,6 L-8,6 Z",
  hexagon: "M7.5,0 L3.75,6.5 L-3.75,6.5 L-7.5,0 L-3.75,-6.5 L3.75,-6.5 Z",
  invtriangle: "M-8,-6 L8,-6 L0,8.5 Z",
};
const LETTER_DY: Partial<Record<Shape, number>> = { triangle: 2, invtriangle: -1.5 };

/** SVG shape centred at 0,0 — use inside a <g transform> */
export function ShapePath({ shape, className }: { shape: Shape; className?: string }) {
  if (shape === "circle") return <circle r="7" className={className} />;
  return <path d={SHAPE_PATHS[shape]} className={className} />;
}

export function ShapeLetter({ shape, code }: { shape: Shape; code: string }) {
  return (
    <text className="dt-mk-letter" textAnchor="middle" dominantBaseline="central" y={LETTER_DY[shape] || 0}>{code}</text>
  );
}

export function CategoryIcon({ category, size = 16 }: { category?: Category; size?: number }) {
  if (!category) return null;
  return (
    <svg className="dt-cat-icon" width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <ShapePath shape={category.shape} className="dt-cat-icon-shape" />
      <ShapeLetter shape={category.shape} code={category.code} />
    </svg>
  );
}

/** Shape differs by severity so it never relies on colour alone */
export function StatusIcon({ status, size = 12 }: { status: Severity | AlertPriority; size?: number }) {
  const label = SEVERITY_LABEL[status];
  if (status === "alarm") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="dt-st-icon st-alarm" role="img" aria-label={label}>
        <path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" />
        <path d="M6 3 V6.6 M6 8.2 V8.9" className="dt-st-mark" />
      </svg>
    );
  }
  if (status === "warning") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="dt-st-icon st-warning" role="img" aria-label={label}>
        <path d="M6 0.8 L11.6 11 L0.4 11 Z" />
        <path d="M6 4.2 V7.6 M6 9 V9.6" className="dt-st-mark" />
      </svg>
    );
  }
  if (status === "offline" || status === "fault") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="dt-st-icon st-offline" role="img" aria-label={label}>
        <rect x="1" y="1" width="10" height="10" />
        <path d="M3.5 3.5 L8.5 8.5 M8.5 3.5 L3.5 8.5" className="dt-st-mark" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className="dt-st-icon st-normal" role="img" aria-label={label}>
      <circle cx="6" cy="6" r="4" />
    </svg>
  );
}

export function StatusPill({ status, label }: { status: Severity | AlertPriority; label?: string }) {
  return (
    <span className={`dt-pill st-${status === "fault" ? "offline" : status}`}>
      <StatusIcon status={status} size={10} /> {label ?? SEVERITY_LABEL[status]}
    </span>
  );
}

/** Severity counts as icons, e.g. ◆2 ▲3 */
export function SeverityCounts({ counts }: { counts: Partial<Record<Severity, number>> }) {
  return (
    <>
      {(["alarm", "warning", "offline"] as const).map(k => (counts[k] ? (
        <span key={k} className={`dt-cnt st-${k}`}><StatusIcon status={k} size={10} />{counts[k]}</span>
      ) : null))}
    </>
  );
}
