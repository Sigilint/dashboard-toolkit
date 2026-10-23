// Well pad example — a beam pumping unit ("pumpjack") drawn side-on, the
// way you see them from the road. The linkage is solved for real: the crank
// turns, the pitman arms pull the tail of the walking beam, the beam rocks
// on the samson post, and the horsehead winds the bridle so the polished rod
// moves straight up and down over the wellhead.
//
// PumpjackArt draws the machine only, in a 640-wide space with the ground
// at y = 300, so the game-cam scenes can reuse it with their own sky.

import { useEffect, useRef, useState } from "react";

const GROUND = 300;
const O = { x: 300, y: 112 };   // saddle bearing on top of the samson post
const A = 190;                  // bearing → horsehead face (arc radius)
const B = 150;                  // bearing → tail bearing
const C = { x: 476, y: 194 };   // crank shaft (gearbox output)
const R = 32;                   // crank radius
const L = 86;                   // pitman arm length
const WX = O.x - A;             // the bridle hangs here, over the wellhead
const ARC = (20 * Math.PI) / 180;

/** Beam tail position for a crank angle: intersect circle(O, B) with circle(pin, L) */
function solve(theta: number) {
  const P = { x: C.x + R * Math.cos(theta), y: C.y + R * Math.sin(theta) };
  const dx = P.x - O.x, dy = P.y - O.y, d = Math.hypot(dx, dy);
  const along = (B * B - L * L + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, B * B - along * along));
  const mx = O.x + (along * dx) / d, my = O.y + (along * dy) / d;
  const c1 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  const c2 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const T = c1.y < c2.y ? c1 : c2; // the tail sits above the crank
  return { P, T, phi: Math.atan2(T.y - O.y, T.x - O.x) };
}

const PHI_MID = (() => {
  const phis = Array.from({ length: 72 }, (_, i) => solve((i / 72) * 2 * Math.PI).phi);
  return (Math.min(...phis) + Math.max(...phis)) / 2;
})();

const hx = -A * Math.cos(ARC), hy = A * Math.sin(ARC);

export interface PumpjackArtProps {
  theta: number;
  labels?: boolean;
  /** Draw the ground cut away below the wellhead: casing, rods, downhole pump */
  cutaway?: boolean;
}

export function PumpjackArt({ theta, labels = false, cutaway = false }: PumpjackArtProps) {
  const { P, T, phi } = solve(theta);
  const deg = (phi * 180) / Math.PI;
  const carrier = O.y + 82 - A * (phi - PHI_MID);
  const stroke = (carrier - (O.y + 82)) / 2; // downhole plunger follows the rod
  return (
    <g className="pj">
      {cutaway && (
        <g className="pj-under">
          <rect x="0" y={GROUND} width="640" height="130" className="pj-earth" />
          <path d={`M0,${GROUND + 40} C200,${GROUND + 34} 420,${GROUND + 52} 640,${GROUND + 44}`} className="pj-strata" />
          <path d={`M0,${GROUND + 82} C180,${GROUND + 90} 460,${GROUND + 76} 640,${GROUND + 86}`} className="pj-strata" />
          <rect x={WX - 12} y={GROUND} width="24" height="130" className="pj-casing" />
          <rect x={WX - 6} y={GROUND} width="12" height="130" className="pj-tubing" />
          <line x1={WX} y1={GROUND} x2={WX} y2={GROUND + 130} className="pj-rods" />
          <path d={`M${WX - 20},${GROUND + 58} l10,-6 l20,12 l10,-6 M${WX - 20},${GROUND + 66} l10,-6 l20,12 l10,-6`} className="pj-break" />
          <rect x={WX - 6} y={GROUND + 92} width="12" height="34" className="pj-barrel" />
          <rect x={WX - 4} y={GROUND + 100 + stroke * 0.25} width="8" height="12" className="pj-plunger" />
          <path d={`M${WX + 22},${GROUND + 120} v-46 m-5,8 l5,-8 l5,8`} className="pj-flow" />
        </g>
      )}

      {/* concrete pad and steel base */}
      <rect x="132" y={GROUND - 4} width="510" height="8" className="pj-concrete" />
      <rect x="150" y={GROUND - 16} width="480" height="13" className="pj-base" />

      {/* motor and belt guard */}
      <path d={`M${C.x + 18},${C.y - 30} L606,${GROUND - 66} L606,${GROUND - 42} L${C.x + 18},${C.y + 22} Z`} className="pj-guard" />
      <rect x="572" y={GROUND - 54} width="54" height="38" rx="6" className="pj-motor" />
      {[0, 1, 2, 3].map(i => <line key={i} x1={578 + i * 12} y1={GROUND - 50} x2={578 + i * 12} y2={GROUND - 20} className="pj-fins" />)}

      {/* gearbox on its pedestal */}
      <path d={`M${C.x - 40},${GROUND - 16} L${C.x - 30},${C.y + 20} L${C.x + 30},${C.y + 20} L${C.x + 40},${GROUND - 16} Z`} className="pj-paint dark" />
      <rect x={C.x - 46} y={C.y - 36} width="92" height="62" rx="14" className="pj-paint" />
      <line x1={C.x - 46} y1={C.y - 4} x2={C.x + 46} y2={C.y - 4} className="pj-seam" />

      {/* samson post: A-frame with ladder and brace */}
      <path d={`M${O.x - 56},${GROUND - 16} L${O.x - 5},${O.y + 10} M${O.x + 56},${GROUND - 16} L${O.x + 5},${O.y + 10}`} className="pj-leg" />
      <path d={`M${O.x - 40},${GROUND - 60} L${O.x + 40},${GROUND - 60}`} className="pj-brace" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => {
        const y = GROUND - 30 - i * 22, t = (GROUND - 16 - y) / (GROUND - 16 - O.y - 10);
        return <line key={i} x1={O.x - 56 + 51 * t - 9} y1={y} x2={O.x - 56 + 51 * t + 9} y2={y} className="pj-rung" />;
      })}

      {/* crank arm + counterweight, turning on the gearbox shaft */}
      <g transform={`translate(${C.x} ${C.y}) rotate(${(theta * 180) / Math.PI})`}>
        <path d="M-50,-14 L46,-9 L46,9 L-50,14 Z" className="pj-paint dark" />
        <rect x="-82" y="-35" width="50" height="70" rx="14" className="pj-weight" />
        <line x1="-78" y1="0" x2="-38" y2="0" className="pj-seam" />
        <circle cx={R} cy="0" r="6" className="pj-pin" />
      </g>
      <circle cx={C.x} cy={C.y} r="9" className="pj-hub" />

      {/* pitman arm from the crank pin to the equalizer at the beam's tail */}
      <line x1={P.x} y1={P.y} x2={T.x} y2={T.y} className="pj-pitman" />

      {/* walking beam and horsehead, rocking on the saddle bearing */}
      <g transform={`translate(${O.x} ${O.y}) rotate(${deg})`}>
        <path d={`M${hx},${-hy} A${A},${A} 0 0 0 ${hx},${hy} L${-A * 0.79},${hy * 0.62} L${-A * 0.77},0 L${-A * 0.79},${-hy * 0.62} Z`} className="pj-head" />
        <path d={`M${hx + 4},${-hy + 8} A${A - 6},${A - 6} 0 0 0 ${hx + 4},${hy - 8}`} className="pj-head-edge" />
        <rect x={-A * 0.8} y="-9" width={A * 0.8 + B + 14} height="18" className="pj-beam" />
        <line x1={-A * 0.78} y1="0" x2={B + 12} y2="0" className="pj-web" />
        <rect x={B - 8} y="6" width="16" height="12" className="pj-paint dark" />
      </g>
      <rect x={O.x - 10} y={O.y + 4} width="20" height="12" className="pj-paint dark" />
      <circle cx={O.x} cy={O.y} r="5" className="pj-hub" />

      {/* bridle, carrier bar, polished rod */}
      <line x1={WX - 3} y1={O.y} x2={WX - 3} y2={carrier} className="pj-cable" />
      <line x1={WX + 3} y1={O.y} x2={WX + 3} y2={carrier} className="pj-cable" />
      <rect x={WX - 14} y={carrier} width="28" height="6" className="pj-paint dark" />
      <rect x={WX - 2} y={carrier - 14} width="4" height={GROUND - 48 - carrier + 14} className="pj-rod" />

      {/* wellhead: stuffing box, flow tee with valve, tubing head, casing head */}
      <rect x={WX - 8} y={GROUND - 50} width="16" height="14" className="pj-well" />
      <rect x={WX - 10} y={GROUND - 36} width="20" height="12" className="pj-well" />
      <path d={`M${WX + 10},${GROUND - 30} H${WX + 70} V${GROUND}`} className="pj-pipe" />
      <circle cx={WX + 36} cy={GROUND - 42} r="8" className="pj-wheel" />
      <line x1={WX + 36} y1={GROUND - 34} x2={WX + 36} y2={GROUND - 30} className="pj-pipe thin" />
      <rect x={WX - 14} y={GROUND - 24} width="28" height="10" className="pj-well" />
      <rect x={WX - 20} y={GROUND - 14} width="40" height="12" className="pj-well" />

      {labels && (
        <g className="pj-labels">
          {([
            ["Horsehead", WX - 6, 40, WX + 4, O.y - 40],
            ["Walking beam", 360, 40, 360, O.y - 4],
            ["Samson post", 210, 190, O.x - 30, 200],
            ["Pitman arm", 560, 120, (P.x + T.x) / 2 + 4, (P.y + T.y) / 2],
            ["Crank & counterweight", 452, 324, C.x - 30, C.y + 34],
            ["Gearbox", 360, 262, C.x - 34, C.y + 20],
            ["Motor", 600, 220, 598, GROUND - 54],
            ["Bridle & polished rod", 12, 140, WX - 4, 200],
            ["Wellhead", 12, 250, WX - 14, GROUND - 30],
          ] as [string, number, number, number, number][]).map(([t, x, y, px, py]) => (
            <g key={t}>
              <line x1={x + (x < px ? t.length * 6.3 : 0)} y1={y - 4} x2={px} y2={py} />
              <text x={x} y={y}>{t}</text>
            </g>
          ))}
          {cutaway && (
            <>
              <text x={WX + 34} y={GROUND + 22}>Casing & tubing, cemented in the hole</text>
              <text x={WX + 34} y={GROUND + 64}>≈ 9,000 ft of steel sucker rods</text>
              <text x={WX + 34} y={GROUND + 112}>Downhole pump: oil & water rise up the tubing</text>
            </>
          )}
        </g>
      )}
    </g>
  );
}

/** Sky and pasture behind the unit, for the drawer diagram */
function Backdrop() {
  return (
    <g>
      <defs>
        <linearGradient id="pj-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fb9dc" /><stop offset="1" stopColor="#e6eef0" /></linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height={GROUND} fill="url(#pj-sky)" />
      <path d={`M0,232 C80,226 150,236 240,230 S420,224 520,232 S610,228 640,230 V${GROUND} H0 Z`} fill="#b7ad86" />
      <path d={`M0,262 C120,256 260,266 400,258 S560,262 640,258 V${GROUND} H0 Z`} fill="#c9b98f" />
      {[[40, 226, 14], [70, 230, 9], [560, 226, 12], [610, 229, 8]].map(([x, y, r], i) => (
        <g key={i}><rect x={x - 1.5} y={y} width="3" height="8" fill="#5c5236" /><ellipse cx={x} cy={y - 2} rx={r} ry={r * 0.6} fill="#76814f" /></g>
      ))}
      <path d="M560,238 L566,200 L572,238 M562,212 H570 M561,224 H571" stroke="#6b6a63" strokeWidth="1.2" fill="none" />
    </g>
  );
}

/** Animated, labelled side view for the well drawer. Turns at the live strokes per minute. */
export function PumpjackDiagram({ spm }: { spm: number }) {
  const [theta, setTheta] = useState(0.9);
  const [labels, setLabels] = useState(true);
  const spmRef = useRef(spm);
  spmRef.current = spm;
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (spmRef.current > 0.5) setTheta(t => t - (dt * spmRef.current * 2 * Math.PI) / 60);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pj-wrap">
      <svg viewBox="0 0 640 430" className="wp-device" role="img"
           aria-label="Side view of a pumpjack: motor, gearbox, crank and counterweight, pitman arm, walking beam on a samson post, horsehead lifting the polished rod at the wellhead, and rods down to a pump below ground">
        <Backdrop />
        <PumpjackArt theta={theta} labels={labels} cutaway />
      </svg>
      <label className="dt-toggle mini pj-toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} /> labels</label>
      <div className="mono muted pj-spm">{spm > 0.5 ? `${spm.toFixed(1)} strokes / min` : "idle: pump-off controller"}</div>
    </div>
  );
}

export const pumpjackCss = `
  .pj-wrap { position: relative; }
  .pj-toggle { position: absolute; top: 6px; right: 8px; background: rgba(255,255,255,0.8); color: #1d2226; padding: 1px 6px; }
  .pj-spm { font-size: 10.5px; margin-top: 4px; }
  .pj .pj-concrete { fill: #b9b4a8; }
  .pj .pj-base { fill: #3d4246; }
  .pj .pj-paint { fill: #4a5258; stroke: #2a2f33; stroke-width: 1; }
  .pj .pj-paint.dark { fill: #343a3f; }
  .pj .pj-seam { stroke: #2a2f33; stroke-width: 1; }
  .pj .pj-guard { fill: #c9a227; stroke: #6d5812; stroke-width: 1; }
  .pj .pj-motor { fill: #5f7f9b; stroke: #2e4558; stroke-width: 1.2; }
  .pj .pj-fins { stroke: #2e4558; stroke-width: 1; }
  .pj .pj-leg { stroke: #3c4348; stroke-width: 9; stroke-linecap: square; fill: none; }
  .pj .pj-brace { stroke: #3c4348; stroke-width: 4; }
  .pj .pj-rung { stroke: #5b6369; stroke-width: 2; }
  .pj .pj-weight { fill: #8a3b2c; stroke: #4d1f17; stroke-width: 1.2; }
  .pj .pj-pin, .pj .pj-hub { fill: #c8ccce; stroke: #2a2f33; stroke-width: 1.2; }
  .pj .pj-pitman { stroke: #2f3539; stroke-width: 8; stroke-linecap: round; }
  .pj .pj-beam { fill: #3a4146; stroke: #22272a; stroke-width: 1; }
  .pj .pj-web { stroke: #565e64; stroke-width: 1.2; }
  .pj .pj-head { fill: #3a4146; stroke: #22272a; stroke-width: 1.2; }
  .pj .pj-head-edge { fill: none; stroke: #6b747a; stroke-width: 2; }
  .pj .pj-cable { stroke: #1b1e20; stroke-width: 1.6; }
  .pj .pj-rod { fill: #e3e7ea; stroke: #8a9399; stroke-width: 0.8; }
  .pj .pj-well { fill: #8f989e; stroke: #3c4348; stroke-width: 1; }
  .pj .pj-pipe { stroke: #7d868c; stroke-width: 6; fill: none; }
  .pj .pj-pipe.thin { stroke-width: 3; }
  .pj .pj-wheel { fill: none; stroke: #b03a2e; stroke-width: 3; }
  .pj .pj-earth { fill: #8a6f4d; }
  .pj .pj-strata { stroke: #6f583b; stroke-width: 1.5; fill: none; stroke-dasharray: 8 5; }
  .pj .pj-casing { fill: #bfc4c6; }
  .pj .pj-tubing { fill: #3d3426; }
  .pj .pj-rods { stroke: #e3e7ea; stroke-width: 2; }
  .pj .pj-break { stroke: #f1ece2; stroke-width: 2; fill: none; }
  .pj .pj-barrel { fill: #9aa2a7; stroke: #3c4348; }
  .pj .pj-plunger { fill: #e0b04a; }
  .pj .pj-flow { stroke: #f0b53c; stroke-width: 2; fill: none; }
  .pj .pj-labels text { font: 600 11px var(--dt-sans, system-ui, sans-serif); fill: #14181b; paint-order: stroke; stroke: rgba(255,255,255,0.85); stroke-width: 3px; }
  .pj .pj-labels line { stroke: #14181b; stroke-width: 0.8; opacity: 0.7; }
`;
