// Well pad example — "photos". Static, photo-style SVG renderings: game-cam
// stills of the well, tank battery and gate (daylight and infrared night
// frames, with the info strip trail cameras print), and a bench shot of an
// emissions node's parts. They are illustrations, not photographs; give a
// frame a `src` to show a real image instead.

import { useId, useState, type ReactNode } from "react";
import { PumpjackArt } from "./pumpjack";

// ---------- frame: grain, vignette, IR, trail-cam info strip ----------

interface Stamp { cam: string; date: string; time: string; tempF: number; trigger: "MOTION" | "TIME-LAPSE"; ir?: boolean }

function Moon({ x, y }: { x: number; y: number }) {
  return <g><circle cx={x} cy={y} r="6" fill="#fff" /><circle cx={x + 3} cy={y - 1} r="5.5" fill="#000" /></g>;
}

export function CamFrame({ stamp, children }: { stamp: Stamp; children: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = Math.round(((stamp.tempF - 32) * 5) / 9);
  return (
    <svg viewBox="0 0 640 360" className="ph" role="img" aria-label={`${stamp.cam} ${stamp.ir ? "infrared night" : "daylight"} frame, ${stamp.date} ${stamp.time}`}>
      <defs>
        <filter id={`${id}g`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={stamp.time.length * 7} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <filter id={`${id}ir`}><feColorMatrix type="matrix" values="0.36 0.4 0.24 0 0.04  0.36 0.4 0.24 0 0.05  0.36 0.4 0.24 0 0.04  0 0 0 1 0" /></filter>
        <filter id={`${id}day`}><feColorMatrix type="saturate" values="0.82" /></filter>
        <radialGradient id={`${id}f`} cx="0.5" cy="0.62" r="0.55">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}v`} cx="0.5" cy="0.48" r="0.75">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={stamp.ir ? 0.85 : 0.4} />
        </radialGradient>
      </defs>
      <g filter={`url(#${id}${stamp.ir ? "ir" : "day"})`}>{children}</g>
      {stamp.ir && <rect width="640" height="336" fill={`url(#${id}f)`} />}
      <rect width="640" height="336" fill={`url(#${id}v)`} />
      <rect width="640" height="336" filter={`url(#${id}g)`} opacity={stamp.ir ? 0.28 : 0.12} style={{ mixBlendMode: "overlay" }} />
      <rect y="336" width="640" height="24" fill="#000" />
      <g className="ph-strip">
        <text x="10" y="352">{stamp.cam}</text>
        <text x="120" y="352">{stamp.trigger}</text>
        <Moon x={268} y={348} />
        <text x="284" y="352">{stamp.tempF}°F {c}°C</text>
        <text x="630" y="352" textAnchor="end">{stamp.date} {stamp.time}</text>
      </g>
      {stamp.ir && <text x="630" y="22" textAnchor="end" className="ph-ir">IR</text>}
    </svg>
  );
}

// ---------- scenery ----------

const Sky = ({ night, horizon }: { night?: boolean; horizon: number }) => (
  <rect width="640" height={horizon + 2} fill={night ? "#0c0f10" : "#9ec3df"} />
);

function Land({ horizon, night }: { horizon: number; night?: boolean }) {
  return (
    <g>
      <path d={`M0,${horizon} C120,${horizon - 6} 260,${horizon + 4} 380,${horizon - 3} S560,${horizon + 2} 640,${horizon - 2} V336 H0 Z`} fill={night ? "#3c3d36" : "#b9ad84"} />
      {[[30, 0.9], [92, 0.6], [520, 1], [600, 0.7], [440, 0.5]].map(([x, s], i) => (
        <g key={i} transform={`translate(${x} ${horizon - 2}) scale(${s})`}>
          <rect x="-2" y="-6" width="4" height="10" fill="#4a4230" />
          <ellipse cx="0" cy="-10" rx="18" ry="9" fill={night ? "#2a2c26" : "#6f7b4a"} />
        </g>
      ))}
    </g>
  );
}

function Pickup({ x, y, s = 1, color = "#eceff1" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,-14 L4,-27 L32,-31 L44,-52 L78,-52 L84,-31 L124,-31 L124,-14 Z" fill={color} stroke="#4b5257" strokeWidth="1.2" />
      <path d="M47,-49 L61,-49 L61,-34 L39,-34 Z M64,-49 L76,-49 L81,-34 L64,-34 Z" fill="#33424d" />
      <rect x="2" y="-24" width="6" height="4" fill="#f4e7b0" />
      <rect x="118" y="-26" width="5" height="6" fill="#b3352a" />
      {[26, 100].map(cx => <g key={cx}><circle cx={cx} cy="-10" r="11" fill="#1d1f20" /><circle cx={cx} cy="-10" r="4.5" fill="#9aa1a5" /></g>)}
    </g>
  );
}

function PickupFront({ x, y, s = 1, lights }: { x: number; y: number; s?: number; lights?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {lights && [-24, 24].map(dx => <ellipse key={dx} cx={dx} cy="-22" rx="60" ry="26" fill="#fff" opacity="0.35" />)}
      <path d="M-26,-54 L26,-54 L31,-32 L-31,-32 Z" fill={lights ? "#1a1c1d" : "#e9ecee"} stroke="#4b5257" />
      <path d="M-22,-50 L22,-50 L26,-35 L-26,-35 Z" fill="#2c3a44" />
      <rect x="-36" y="-32" width="72" height="22" rx="3" fill={lights ? "#1a1c1d" : "#e9ecee"} stroke="#4b5257" />
      <rect x="-14" y="-28" width="28" height="12" fill="#3a3f42" />
      {[-26, 26].map(dx => <circle key={dx} cx={dx} cy="-22" r="5" fill={lights ? "#fff" : "#f4e7b0"} />)}
      <rect x="-35" y="-10" width="11" height="10" fill="#111" /><rect x="24" y="-10" width="11" height="10" fill="#111" />
    </g>
  );
}

function Tanker({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,-14 L0,-46 L10,-62 L46,-62 L52,-14 Z" fill="#c23b2e" stroke="#5a1c16" />
      <path d="M12,-58 L30,-58 L30,-44 L8,-44 Z" fill="#2c3a44" />
      <rect x="56" y="-62" width="190" height="42" rx="20" fill="#d9dde0" stroke="#7a8287" />
      <rect x="56" y="-24" width="190" height="10" fill="#4a5054" />
      {[100, 150, 200].map(cx => <rect key={cx} x={cx} y="-68" width="14" height="6" fill="#8d959a" />)}
      <path d="M60,-20 C40,-10 30,-6 20,-4" stroke="#222" strokeWidth="4" fill="none" />
      {[22, 44, 186, 210, 232].map(cx => <g key={cx}><circle cx={cx} cy="-10" r="10" fill="#1d1f20" /><circle cx={cx} cy="-10" r="4" fill="#9aa1a5" /></g>)}
    </g>
  );
}

function Deer({ x, y, s = 1, eyes }: { x: number; y: number; s?: number; eyes?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#7b6a55">
      <ellipse cx="0" cy="-40" rx="27" ry="12" />
      <path d="M-18,-46 L-30,-70 L-21,-72 L-8,-48 Z" />
      <ellipse cx="-33" cy="-71" rx="10" ry="5.5" transform="rotate(20 -33 -71)" />
      <path d="M-28,-76 l-6,-9 l5,1 Z M-24,-75 l2,-10 l3,8 Z" />
      {[-18, -10, 12, 20].map(lx => <rect key={lx} x={lx} y="-32" width="3.4" height="32" />)}
      <path d="M26,-44 l7,-5 l-2,8 Z" fill="#eee" />
      {eyes && <><circle cx="-38" cy="-73" r="3" fill="#fff" /><circle cx="-38" cy="-73" r="7" fill="#fff" opacity="0.35" /></>}
    </g>
  );
}

function Cow({ x, y, s = 1, face = 1 }: { x: number; y: number; s?: number; face?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s * face} ${s})`} fill="#1e1c1b">
      <rect x="-32" y="-50" width="62" height="30" rx="12" />
      <rect x="-46" y="-50" width="18" height="16" rx="5" />
      {[-26, -16, 16, 24].map(lx => <rect key={lx} x={lx} y="-24" width="6" height="24" />)}
      <path d="M30,-44 q8,8 2,22" stroke="#1e1c1b" strokeWidth="2" fill="none" />
    </g>
  );
}

const Person = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#2b3a52">
    <circle cx="0" cy="-34" r="4" fill="#d9b48c" />
    <path d="M-5,-38 h10 l-1,-3 h-8 Z" fill="#e8e2c8" />
    <path d="M-6,-29 h12 l1,14 h-14 Z" fill="#c45a2a" />
    <path d="M-6,-15 h5 l-1,15 h-4 Z M1,-15 h5 l0,15 h-4 Z" />
  </g>
);

// ---------- scenes ----------

function WellScene({ night, truck, theta }: { night?: boolean; truck?: boolean; theta: number }) {
  return (
    <g>
      <Sky night={night} horizon={150} />
      <Land horizon={150} night={night} />
      <rect y="200" width="640" height="136" fill={night ? "#4a4a43" : "#d1c29a"} />
      {/* distant tank battery */}
      {[470, 500].map(x => <g key={x}><rect x={x} y="128" width="24" height="44" fill={night ? "#6b6d68" : "#a9a299"} /><ellipse cx={x + 12} cy="128" rx="12" ry="3" fill={night ? "#7b7d78" : "#bdb6ab"} /></g>)}
      <g transform="translate(-48 50) scale(0.9)"><PumpjackArt theta={theta} /></g>
      {truck && <Pickup x={508} y={326} s={1.0} />}
      {/* foreground grass */}
      {Array.from({ length: 70 }, (_, i) => (
        <path key={i} d={`M${i * 9.3},336 l${(i % 3) - 1},-${10 + ((i * 37) % 14)}`} stroke={night ? "#5d5d55" : "#8a8a55"} strokeWidth="1.5" />
      ))}
    </g>
  );
}

function Tank({ x, w, top, bottom, fill, hatch }: { x: number; w: number; top: number; bottom: number; fill: string; hatch?: boolean }) {
  const id = `t${x}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.25" /><stop offset="0.35" stopColor="#fff" stopOpacity="0.18" /><stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect x={x} y={top} width={w} height={bottom - top} fill={fill} />
      <rect x={x} y={top} width={w} height={bottom - top} fill={`url(#${id})`} />
      <ellipse cx={x + w / 2} cy={top} rx={w / 2} ry="7" fill={fill} stroke="#00000033" />
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={x} x2={x + w} y1={top + (bottom - top) * f} y2={top + (bottom - top) * f} stroke="#00000022" />)}
      {hatch && <rect x={x + w / 2 - 6} y={top - 10} width="12" height="6" fill="#5a5f63" />}
    </g>
  );
}

function TankScene({ night, truck, person }: { night?: boolean; truck?: boolean; person?: boolean }) {
  const steel = night ? "#9a9c97" : "#b8b2a6";
  return (
    <g>
      <Sky night={night} horizon={170} />
      <Land horizon={170} night={night} />
      <rect y="230" width="640" height="106" fill={night ? "#4a4a43" : "#d4c59e"} />
      {/* separator / heater-treater with stack */}
      <rect x="70" y="120" width="40" height="120" rx="14" fill={night ? "#8a8c88" : "#9fa5a8"} />
      <rect x="84" y="80" width="8" height="42" fill="#5a5f63" />
      <Tank x={150} w={110} top={70} bottom={240} fill={steel} hatch />
      <Tank x={276} w={110} top={70} bottom={240} fill={steel} hatch />
      <Tank x={402} w={96} top={96} bottom={240} fill={night ? "#a3a08f" : "#c8b27a"} hatch />
      {/* stairs and walkway with railing */}
      <path d="M520,240 L498,62" stroke="#4b5257" strokeWidth="5" />
      {Array.from({ length: 10 }, (_, i) => <line key={i} x1={519 - i * 2.2} y1={226 - i * 17} x2={531 - i * 2.2} y2={226 - i * 17} stroke="#4b5257" strokeWidth="2" />)}
      <rect x="150" y="60" width="370" height="5" fill="#5a5f63" />
      <path d="M150,60 V44 H520 V60 M200,44 V60 M260,44 V60 M320,44 V60 M380,44 V60 M440,44 V60" stroke="#5a5f63" strokeWidth="2" fill="none" />
      {person && <Person x={300} y={60} s={1} />}
      {/* sign */}
      <rect x="548" y="190" width="56" height="30" fill="#fff" stroke="#333" />
      <text x="576" y="203" textAnchor="middle" className="ph-sign red">DANGER</text>
      <text x="576" y="214" textAnchor="middle" className="ph-sign">NO SMOKING</text>
      <rect x="574" y="220" width="4" height="22" fill="#555" />
      {/* load line */}
      <path d="M260,226 H300 V268 H560" stroke="#6d7479" strokeWidth="5" fill="none" />
      <circle cx="560" cy="268" r="6" fill="#b03a2e" />
      {/* berm */}
      <path d="M0,262 C120,246 520,246 640,262 V292 H0 Z" fill={night ? "#57534a" : "#b39b70"} />
      {truck && <Tanker x={330} y={330} s={1.1} />}
    </g>
  );
}

function GateScene({ night, open, truck, lights, deer, cows }: { night?: boolean; open?: boolean; truck?: boolean; lights?: boolean; deer?: boolean; cows?: boolean }) {
  const pipe = night ? "#c9cbc6" : "#6f8f5a";
  return (
    <g>
      <Sky night={night} horizon={150} />
      <Land horizon={150} night={night} />
      {/* lease road in perspective toward the county road */}
      <path d="M180,336 L300,152 L340,152 L460,336 Z" fill={night ? "#77756c" : "#e2d6b8"} />
      <path d="M0,152 H640" stroke={night ? "#555" : "#9a9078"} strokeWidth="2" />
      {/* cattle guard */}
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1={210 + i * 1} y1={300 - i * 4.4} x2={430 - i * 1} y2={300 - i * 4.4} stroke="#3f4447" strokeWidth="2.2" />)}
      {/* fence lines: posts and wire receding both ways */}
      {[-1, 1].map(side => (
        <g key={side}>
          {[0, 1, 2, 3].map(w => <line key={w} x1={side < 0 ? 0 : 640} y1={190 + w * 16} x2={side < 0 ? 230 : 410} y2={196 + w * 9} stroke="#55534c" strokeWidth="1" />)}
          {[0, 1, 2].map(i => { const px = side < 0 ? 40 + i * 70 : 600 - i * 70; return <rect key={i} x={px} y={176 + i * 6} width="5" height={86 - i * 12} fill="#5a4a36" />; })}
        </g>
      ))}
      {/* H-brace gate posts */}
      <rect x="222" y="170" width="10" height="98" fill="#6b6f72" />
      <rect x="408" y="170" width="10" height="98" fill="#6b6f72" />
      {/* the gate: closed spans the road, open swings toward the camera */}
      {open
        ? [0, 1, 2, 3, 4].map(i => <line key={i} x1="410" y1={182 + i * 16} x2="520" y2={200 + i * 22} stroke={pipe} strokeWidth="5" />)
        : [0, 1, 2, 3, 4].map(i => <line key={i} x1="232" y1={182 + i * 16} x2="408" y2={182 + i * 16} stroke={pipe} strokeWidth="5" />)}
      {!open && <path d="M232,182 L408,246 M320,182 V246" stroke={pipe} strokeWidth="3" />}
      {/* the camera's box on the gate post, and the gate sensor */}
      <rect x="402" y="236" width="10" height="16" fill="#e9e9e2" stroke="#333" />
      {/* lease sign (RRC Rule 3) */}
      <rect x="80" y="180" width="110" height="62" fill="#f3f1ea" stroke="#333" />
      {[["CAPROCK MESA OPERATING", 192], ["HARGROVE RANCH #2", 204], ["RRC 08-51874 · HOWARD CO", 216], ["EMERG (432) 555-0142", 230]].map(([t, y]) => (
        <text key={t as string} x="135" y={y as number} textAnchor="middle" className="ph-sign">{t}</text>
      ))}
      <rect x="132" y="242" width="5" height="40" fill="#555" />
      {truck && <PickupFront x={320} y={226} s={0.95} lights={lights} />}
      {deer && <Deer x={470} y={290} s={1.25} eyes={night} />}
      {cows && <><Cow x={500} y={300} s={1.3} /><Cow x={140} y={316} s={1.1} face={-1} /></>}
    </g>
  );
}

// ---------- cameras ----------

export interface CamShot { stamp: Stamp; caption: string; scene: ReactNode; src?: string }
export interface Camera { id: string; title: string; mount: string; shots: CamShot[] }

const D = "10/23/2026";
export const CAMERAS: Record<string, Camera> = {
  well: {
    id: "CAM-W1", title: "Well camera", mount: "T-post 30 m north-west of the unit, facing the wellhead",
    shots: [
      { stamp: { cam: "CAM-W1", date: D, time: "09:21:07", tempF: 66, trigger: "MOTION" }, caption: "Pumper's pickup at the unit: daily check of the stuffing box, belts and controller.", scene: <WellScene truck theta={1.2} /> },
      { stamp: { cam: "CAM-W1", date: D, time: "13:00:00", tempF: 77, trigger: "TIME-LAPSE" }, caption: "Hourly time-lapse. The unit is mid-upstroke and the horsehead is rising.", scene: <WellScene theta={2.4} /> },
      { stamp: { cam: "CAM-W1", date: D, time: "02:14:00", tempF: 51, trigger: "TIME-LAPSE", ir: true }, caption: "Night frame under the infrared illuminator. Pumping units run around the clock.", scene: <WellScene night theta={4.4} /> },
    ],
  },
  tanks: {
    id: "CAM-T1", title: "Tank battery camera", mount: "Pole south of the berm, facing north at the tanks",
    shots: [
      { stamp: { cam: "CAM-T1", date: D, time: "09:34:52", tempF: 68, trigger: "MOTION" }, caption: "Pumper on the walkway, gauging the oil tanks by hand to check the radar gauges.", scene: <TankScene person /> },
      { stamp: { cam: "CAM-T1", date: "10/21/2026", time: "15:48:10", tempF: 81, trigger: "MOTION" }, caption: "Crude hauler loading from tank 1. The driver writes a run ticket for every load.", scene: <TankScene truck /> },
      { stamp: { cam: "CAM-T1", date: D, time: "23:30:00", tempF: 55, trigger: "TIME-LAPSE", ir: true }, caption: "Night time-lapse: nobody on site. The thief hatches are closed.", scene: <TankScene night /> },
    ],
  },
  gate: {
    id: "CAM-G1", title: "Gate camera", mount: "On the gate post, facing south down the lease road",
    shots: [
      { stamp: { cam: "CAM-G1", date: D, time: "09:02:31", tempF: 64, trigger: "MOTION" }, caption: "Pumper arriving. The gate sensor logged the opening at the same second.", scene: <GateScene open truck /> },
      { stamp: { cam: "CAM-G1", date: "10/22/2026", time: "21:47:12", tempF: 59, trigger: "MOTION", ir: true }, caption: "After-hours vehicle with headlights on, gate still closed. Compare against the gate log before calling it in.", scene: <GateScene night truck lights /> },
      { stamp: { cam: "CAM-G1", date: D, time: "04:16:45", tempF: 49, trigger: "MOTION", ir: true }, caption: "White-tailed doe at the cattle guard: the most common game-cam trigger on any ranch.", scene: <GateScene night deer /> },
      { stamp: { cam: "CAM-G1", date: "10/22/2026", time: "16:40:03", tempF: 79, trigger: "MOTION" }, caption: "The landowner's cattle grazing by the gate. The cattle guard keeps them off the pad.", scene: <GateScene cows /> },
    ],
  },
};

export function CamViewer({ camera }: { camera: Camera }) {
  const [i, setI] = useState(0);
  const shot = camera.shots[i];
  return (
    <div className="ph-viewer">
      <div className="ph-main">{shot.src ? <img src={shot.src} alt={shot.caption} /> : <CamFrame stamp={shot.stamp}>{shot.scene}</CamFrame>}</div>
      <p className="wp-caption">{shot.caption}</p>
      <div className="ph-thumbs" role="tablist" aria-label={`${camera.title} frames`}>
        {camera.shots.map((s, n) => (
          <button key={n} role="tab" aria-selected={n === i} className={n === i ? "on" : ""} onClick={() => setI(n)}
                  aria-label={`${s.stamp.time} ${s.stamp.ir ? "night" : "day"} frame`}>
            <CamFrame stamp={s.stamp}>{s.scene}</CamFrame>
          </button>
        ))}
      </div>
      <p className="wp-caption dim">{camera.id} · {camera.mount}. Cellular trail camera: it sends a still on motion and once an hour. Illustrated stills.</p>
    </div>
  );
}

// ---------- bench photo of a node's parts ----------

function Pins({ x, y, n, dx = 10.4 }: { x: number; y: number; n: number; dx?: number }) {
  return <g>{Array.from({ length: n }, (_, i) => <g key={i}><rect x={x + i * dx} y={y} width="6" height="6" fill="#c9a43a" /><rect x={x + i * dx + 2} y={y + 2} width="2" height="2" fill="#5a4a17" /></g>)}</g>;
}

function Tag({ x, y, tx, ty, text }: { x: number; y: number; tx: number; ty: number; text: string }) {
  const w = text.length * 5.6 + 10;
  return (
    <g className="ph-tag">
      <line x1={x} y1={y} x2={tx} y2={ty} />
      <rect x={tx - 2} y={ty - 10} width={w} height="15" rx="2" />
      <text x={tx + 3} y={ty + 1}>{text}</text>
    </g>
  );
}

export function BenchPhoto({ labels = true }: { labels?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 640 400" className="ph" role="img"
         aria-label="Bench photo of a node's parts: ESP32-S3 board with external antenna, methane, H2S, VOC and BME280 sensors, solar charger, LiFePO4 cells and a breathable vent plug">
      <defs>
        <filter id={`${id}s`} x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.5" /></filter>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eef1f3" /><stop offset="0.5" stopColor="#b9c0c5" /><stop offset="1" stopColor="#dfe4e7" /></linearGradient>
        <radialGradient id={`${id}can`} cx="0.35" cy="0.35" r="0.8"><stop offset="0" stopColor="#f5f7f8" /><stop offset="1" stopColor="#8d969c" /></radialGradient>
        <linearGradient id={`${id}cell`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b8fd6" /><stop offset="0.45" stopColor="#2f63b0" /><stop offset="1" stopColor="#1b3f78" /></linearGradient>
        <pattern id={`${id}mesh`} width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.8" fill="#6b747a" /></pattern>
        <filter id={`${id}g`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" /><feColorMatrix type="saturate" values="0" /></filter>
        <radialGradient id={`${id}v`} cx="0.5" cy="0.45" r="0.8"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.45" /></radialGradient>
      </defs>
      {/* cutting mat */}
      <rect width="640" height="400" fill="#1f5a45" />
      {Array.from({ length: 33 }, (_, i) => <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="400" stroke="#2f7058" strokeWidth={i % 5 ? 0.5 : 1.2} />)}
      {Array.from({ length: 21 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 20} x2="640" y2={i * 20} stroke="#2f7058" strokeWidth={i % 5 ? 0.5 : 1.2} />)}

      {/* antenna and pigtail */}
      <g filter={`url(#${id}s)`}>
        <path d="M236,70 C270,40 300,40 330,52" stroke="#151515" strokeWidth="2.5" fill="none" />
        <polygon points="330,46 342,46 346,52 342,58 330,58 326,52" fill="#d2ad4a" />
        <path d="M346,52 L600,26" stroke="#141414" strokeWidth="13" strokeLinecap="round" />
        {[0, 1, 2, 3, 4].map(i => <line key={i} x1={352 + i * 6} y1={44 - i * 0.6} x2={352 + i * 6} y2={60 - i * 0.6} stroke="#2a2a2a" strokeWidth="2" />)}
      </g>

      {/* ESP32-S3 dev board */}
      <g filter={`url(#${id}s)`} transform="translate(30 56)">
        <rect width="252" height="98" rx="4" fill="#1b1c1e" />
        <Pins x={14} y={4} n={22} /><Pins x={14} y={88} n={22} />
        <rect x="-6" y="22" width="18" height="13" rx="4" fill={`url(#${id}m)`} /><rect x="-6" y="62" width="18" height="13" rx="4" fill={`url(#${id}m)`} />
        <rect x="40" y="18" width="128" height="62" rx="2" fill={`url(#${id}m)`} stroke="#8a9399" />
        <text x="104" y="40" textAnchor="middle" className="ph-print dark">ESP32-S3-WROOM-1U</text>
        <text x="104" y="52" textAnchor="middle" className="ph-print dark small">N8R8 · 2.4 GHz · Wi-Fi / BLE</text>
        <rect x="168" y="30" width="26" height="38" fill="#173040" />
        <circle cx="186" cy="38" r="4" fill="#d2ad4a" />
        <rect x="204" y="16" width="14" height="10" rx="1" fill="#d8d8d8" /><text x="211" y="34" textAnchor="middle" className="ph-print small">BOOT</text>
        <rect x="204" y="70" width="14" height="10" rx="1" fill="#d8d8d8" /><text x="211" y="66" textAnchor="middle" className="ph-print small">RST</text>
        <rect x="18" y="42" width="14" height="14" fill="#0e0e0f" />
        <circle cx="234" cy="49" r="4" fill="#f2f2f2" />
      </g>

      {/* sensors */}
      <g filter={`url(#${id}s)`}>
        <rect x="30" y="182" width="88" height="78" rx="3" fill="#1d4f9b" />
        <Pins x={38} y={250} n={6} dx={12} />
        <circle cx="74" cy="214" r="26" fill={`url(#${id}can)`} stroke="#6b747a" />
        <circle cx="74" cy="214" r="16" fill={`url(#${id}mesh)`} stroke="#8d969c" />
        <ellipse cx="166" cy="244" rx="30" ry="9" fill="#9c9a92" />
        <rect x="136" y="196" width="60" height="48" fill="#e7e4dc" />
        <ellipse cx="166" cy="196" rx="30" ry="9" fill="#f4f2ec" stroke="#b9b5aa" />
        <circle cx="166" cy="196" r="2.2" fill="#222" />
        <text x="166" y="226" textAnchor="middle" className="ph-print dark">H2S · 100</text>
        <rect x="216" y="196" width="48" height="36" rx="2" fill="#111" /><rect x="235" y="207" width="11" height="11" fill="#8e9599" />
        <Pins x={220} y={226} n={4} dx={10} />
        <rect x="280" y="196" width="46" height="36" rx="2" fill="#5b2d8c" /><rect x="298" y="206" width="10" height="10" fill={`url(#${id}m)`} /><circle cx="303" cy="211" r="1.4" fill="#222" />
        <Pins x={284} y={226} n={4} dx={10} />
        <rect x="342" y="192" width="58" height="42" rx="2" fill="#2346a0" /><rect x="358" y="204" width="24" height="9" fill="#111" /><text x="370" y="211" textAnchor="middle" className="ph-print small">R100</text>
        <rect x="414" y="196" width="42" height="32" rx="2" fill="#20603e" /><rect x="428" y="204" width="14" height="10" fill="#111" />
      </g>

      {/* MPPT charger, cells, vent plug, solar panel corner */}
      <g filter={`url(#${id}s)`}>
        <rect x="300" y="282" width="112" height="72" rx="3" fill="#1f4f73" />
        <rect x="318" y="296" width="28" height="28" rx="3" fill="#2a2a2a" />
        <rect x="364" y="290" width="40" height="14" fill="#2f8f4a" /><rect x="364" y="332" width="40" height="14" fill="#2f8f4a" />
        {[0, 1].map(i => (
          <g key={i} transform={`translate(30 ${284 + i * 54})`}>
            <rect width="230" height="44" rx="10" fill={`url(#${id}cell)`} />
            <rect x="230" y="14" width="8" height="16" rx="2" fill="#c7ccd0" />
            <text x="115" y="27" textAnchor="middle" className="ph-print">LiFePO₄ 3.2V 6000mAh</text>
          </g>
        ))}
        <polygon points="460,300 482,288 504,300 504,324 482,336 460,324" fill="#2b2b2b" />
        <circle cx="482" cy="312" r="13" fill="#3a3a3a" stroke="#555" />
        <circle cx="482" cy="312" r="7" fill="#ece9e1" />
        <g transform="translate(540 262) rotate(-12)">
          <rect width="150" height="150" fill="#1e3550" stroke="#c9ccce" strokeWidth="4" />
          {[0, 1, 2, 3].map(i => <line key={i} x1={i * 37} y1="0" x2={i * 37} y2="150" stroke="#8fb2d6" strokeWidth="0.8" />)}
          {[0, 1, 2, 3].map(i => <line key={i} x1="0" y1={i * 37} x2="150" y2={i * 37} stroke="#8fb2d6" strokeWidth="0.8" />)}
        </g>
      </g>

      {labels && (
        <g>
          <Tag x={134} y={74} tx={70} ty={30} text="ESP32-S3 module (CPU + radio)" />
          <Tag x={216} y={94} tx={292} ty={118} text="u.FL antenna port" />
          <Tag x={470} y={38} tx={430} ty={92} text="2.4 GHz antenna (ESP-NOW)" />
          <Tag x={74} y={214} tx={20} ty={176} text="CH₄ · MOx" />
          <Tag x={166} y={200} tx={126} ty={276} text="H₂S cell" />
          <Tag x={240} y={214} tx={210} ty={176} text="VOC" />
          <Tag x={303} y={211} tx={280} ty={176} text="BME280" />
          <Tag x={370} y={210} tx={346} ty={176} text="INA219 solar meter" />
          <Tag x={435} y={210} tx={420} ty={250} text="heater MOSFET" />
          <Tag x={356} y={318} tx={420} ty={276} text="MPPT charger" />
          <Tag x={482} y={312} tx={452} ty={364} text="ePTFE vent" />
          <Tag x={150} y={356} tx={150} ty={394} text="LiFePO₄ cells" />
        </g>
      )}
      <rect width="640" height="400" fill={`url(#${id}v)`} />
      <rect width="640" height="400" filter={`url(#${id}g)`} opacity="0.1" style={{ mixBlendMode: "overlay" }} />
    </svg>
  );
}

export const photoCss = `
  .ph { width: 100%; height: auto; display: block; background: #000; }
  .ph-strip text { font: 600 11px var(--dt-mono, ui-monospace, monospace); fill: #fff; letter-spacing: 0.04em; }
  .ph-ir { font: 700 12px var(--dt-mono, ui-monospace, monospace); fill: #fff; opacity: 0.8; }
  .ph-sign { font: 700 6.5px var(--dt-sans, system-ui, sans-serif); fill: #222; } .ph-sign.red { fill: #c0281c; font-size: 8px; }
  .ph-print { font: 600 8px var(--dt-mono, ui-monospace, monospace); fill: #f2f2f2; } .ph-print.dark { fill: #3d4549; } .ph-print.small { font-size: 6px; }
  .ph-tag line { stroke: #fff; stroke-width: 1; opacity: 0.85; }
  .ph-tag rect { fill: #fbf8ec; stroke: #00000055; }
  .ph-tag text { font: 600 9px var(--dt-sans, system-ui, sans-serif); fill: #1b1e20; }
  .ph-viewer .ph-main { border: 1px solid var(--dt-rule); }
  .ph-thumbs { display: flex; gap: 6px; margin-top: 8px; }
  .ph-thumbs button { all: unset; cursor: pointer; flex: 1; max-width: 25%; border: 2px solid transparent; opacity: 0.7; }
  .ph-thumbs button.on { border-color: var(--dt-accent); opacity: 1; }
  .ph-thumbs button:focus-visible { outline: 2px solid var(--dt-accent); }
  .wp-caption.dim { color: var(--dt-ink-3); font-size: 10.5px; }
  .wp-tabs { display: flex; gap: 4px; margin-bottom: 6px; }
`;
