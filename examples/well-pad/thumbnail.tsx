// Well pad example — project thumbnail (1500 × 1000, 3:2). The pumpjack at
// dusk, an ESP32 board in the foreground, and the fenceline map floating in
// the sky with a plume reaching the downwind node. Open
// /well-pad/thumbnail.html on the dev server and screenshot it at 1500 × 1000.

import { createRoot } from "react-dom/client";
import { PumpjackArt, pumpjackCss } from "./pumpjack";

const W = 1500, H = 1000, HORIZON = 700;

// ---------- the map, in plan coordinates (600 × 420), tipped into isometric ----------

const MAP = { cx: 1112, cy: 318, scale: 0.9, squash: 0.58, turn: -35 };
const mapTransform = `translate(${MAP.cx} ${MAP.cy}) scale(1 ${MAP.squash}) rotate(${MAP.turn}) scale(${MAP.scale}) translate(-300 -210)`;

/** Plan point → screen point, matching mapTransform */
function iso(x: number, y: number) {
  const a = (MAP.turn * Math.PI) / 180;
  const px = (x - 300) * MAP.scale, py = (y - 210) * MAP.scale;
  return { x: MAP.cx + px * Math.cos(a) - py * Math.sin(a), y: MAP.cy + (px * Math.sin(a) + py * Math.cos(a)) * MAP.squash };
}

const WELL = { x: 250, y: 215 };
const GATEWAY = { x: 70, y: 370 };
const NODES = [
  { id: "N1", x: 330, y: 100, alarm: true },
  { id: "N2", x: 460, y: 220 },
  { id: "N3", x: 420, y: 330 },
  { id: "N4", x: 140, y: 240 },
];

function MapCard() {
  const hot = NODES.find(n => n.alarm)!;
  const plumeAngle = (Math.atan2(hot.y - WELL.y, hot.x - WELL.x) * 180) / Math.PI;
  return (
    <g>
      {/* drop shadow and glow under the floating card */}
      <g transform={mapTransform}>
        <rect x="-6" y="14" width="612" height="420" rx="22" fill="#000" opacity="0.45" filter="url(#blur-lg)" />
        <rect x="0" y="0" width="600" height="420" rx="18" fill="#12171b" stroke="#5aa2ec" strokeOpacity="0.55" strokeWidth="2" />
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={50 + i * 50} y1="10" x2={50 + i * 50} y2="410" stroke="#5aa2ec" strokeOpacity="0.08" />)}
        {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="10" y1={60 + i * 50} x2="590" y2={60 + i * 50} stroke="#5aa2ec" strokeOpacity="0.08" />)}

        {/* county road, lease road, pad, fence */}
        <rect x="0" y="388" width="600" height="18" fill="#22272b" />
        <rect x="292" y="330" width="16" height="64" fill="#2c2a24" />
        <rect x="140" y="100" width="320" height="230" rx="4" fill="#2a2721" />
        <rect x="140" y="100" width="320" height="230" rx="4" fill="none" stroke="#b4bcbc" strokeWidth="2" strokeDasharray="9 4" />

        {/* tank battery and flowline */}
        <rect x="360" y="122" width="82" height="110" rx="6" fill="none" stroke="#808b8f" strokeWidth="3" opacity="0.6" />
        {[[382, 150], [420, 150], [420, 198]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="15" fill="#1a1f23" stroke="#b4bcbc" strokeWidth="2" />)}
        <path d={`M${WELL.x},${WELL.y} C290,280 350,270 382,215`} fill="none" stroke="#808b8f" strokeWidth="2.5" strokeDasharray="6 4" />

        {/* radio links back to the landowner's gateway */}
        {NODES.map(n => <line key={n.id} x1={n.x} y1={n.y} x2={GATEWAY.x} y2={GATEWAY.y} stroke="#5aa2ec" strokeWidth="1.6" strokeDasharray="3 6" opacity="0.55" />)}
        <rect x={GATEWAY.x - 9} y={GATEWAY.y - 9} width="18" height="18" rx="3" fill="#14181b" stroke="#5aa2ec" strokeWidth="2.5" />

        {/* the plume, from the wellhead to the downwind fence */}
        <g transform={`translate(${WELL.x} ${WELL.y}) rotate(${plumeAngle})`} filter="url(#blur-sm)">
          <path d="M0,0 C60,-34 180,-96 300,-80 Q360,0 300,80 C180,96 60,34 0,0Z" fill="url(#plume)" />
          <path d="M0,0 C40,-14 110,-36 190,-28 Q214,0 190,28 C110,36 40,14 0,0Z" fill="url(#plume-core)" />
        </g>

        {/* wellhead */}
        <circle cx={WELL.x} cy={WELL.y} r="16" fill="#ff8c28" opacity="0.25" />
        <circle cx={WELL.x} cy={WELL.y} r="8" fill="#14181b" stroke="#e8ebea" strokeWidth="3" />

        {/* fenceline nodes */}
        {NODES.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.alarm ? 44 : 26} fill="none" stroke={n.alarm ? "#ff5a4e" : "#4cc38a"} strokeWidth="2" opacity="0.35" />
            {n.alarm && <circle cx={n.x} cy={n.y} r="28" fill="none" stroke="#ff5a4e" strokeWidth="2.5" opacity="0.7" />}
            <circle cx={n.x} cy={n.y} r="11" fill={n.alarm ? "#ff5a4e" : "#4cc38a"} stroke="#0d1012" strokeWidth="3" />
          </g>
        ))}
      </g>

      {/* labels stay upright: placed at the projected points */}
      {NODES.map(n => {
        const p = iso(n.x, n.y);
        return n.alarm ? (
          <g key={n.id} transform={`translate(${p.x} ${p.y - 26})`}>
            <line x1="0" y1="10" x2="0" y2="-30" stroke="#ff5a4e" strokeWidth="2" />
            <rect x="-96" y="-74" width="192" height="46" rx="8" fill="#2a1414" stroke="#ff5a4e" strokeWidth="2" />
            <text x="0" y="-55" textAnchor="middle" className="mono" fontSize="13" fill="#ffb0a8" letterSpacing="1.5">N1 · NORTH FENCE</text>
            <text x="0" y="-36" textAnchor="middle" className="mono" fontSize="17" fontWeight="600" fill="#fff">CH₄ 46 ppm ▲</text>
          </g>
        ) : (
          <text key={n.id} x={p.x + 18} y={p.y + 5} className="mono" fontSize="14" fontWeight="600" fill="#9fe3c0">{n.id}</text>
        );
      })}
      {(() => {
        const p = iso(WELL.x, WELL.y);
        return <text x={p.x + 4} y={p.y + 30} textAnchor="middle" className="mono" fontSize="13" fill="#e8ebea" letterSpacing="1.5">WELLHEAD</text>;
      })()}
      {(() => {
        const p = iso(GATEWAY.x, GATEWAY.y);
        return <text x={p.x - 16} y={p.y + 6} textAnchor="end" className="mono" fontSize="13" fill="#9cc7f3" letterSpacing="1.5">GATEWAY</text>;
      })()}
    </g>
  );
}

// ---------- ESP32 dev board, top view ----------

function Esp32() {
  const pins = Array.from({ length: 19 }, (_, i) => 34 + i * 21.5);
  return (
    <g>
      <rect x="6" y="22" width="460" height="210" rx="12" fill="#000" opacity="0.55" filter="url(#blur-lg)" />
      {/* PCB */}
      <rect x="0" y="0" width="460" height="210" rx="12" fill="#1b1f24" stroke="#3a424a" strokeWidth="2" />
      <rect x="4" y="4" width="452" height="202" rx="10" fill="none" stroke="#2b3138" />
      {[[16, 16], [444, 16], [16, 194], [444, 194]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill="#0d1012" stroke="#b08d3c" strokeWidth="2.5" />)}

      {/* header pins along both long edges */}
      {pins.map((x, i) => (
        <g key={i}>
          <rect x={x - 7} y="10" width="14" height="14" rx="2" fill="#c9a45a" />
          <circle cx={x} cy="17" r="3.4" fill="#2a2418" />
          <rect x={x - 7} y="186" width="14" height="14" rx="2" fill="#c9a45a" />
          <circle cx={x} cy="193" r="3.4" fill="#2a2418" />
        </g>
      ))}

      {/* WROOM module: PCB antenna meander + shield can */}
      <rect x="22" y="42" width="236" height="126" rx="4" fill="#111418" />
      <path d="M34,56 h40 v12 h-34 v12 h34 v12 h-34 v12 h34 v12 h-34 v12 h34 v12 h-40" fill="none" stroke="#c9a45a" strokeWidth="3" strokeLinejoin="round" />
      <rect x="92" y="48" width="160" height="114" rx="4" fill="url(#can)" stroke="#8a949b" strokeWidth="1.5" />
      <rect x="98" y="54" width="148" height="102" rx="3" fill="none" stroke="#ffffff" strokeOpacity="0.35" />
      <text x="172" y="96" textAnchor="middle" className="mono" fontSize="15" fontWeight="600" fill="#4a5258">ESP32-WROOM-32</text>
      <text x="172" y="116" textAnchor="middle" className="mono" fontSize="10.5" fill="#5f686f">Wi-Fi · BT · ESP-NOW</text>
      <path d="M150,132 l10,-8 l10,8 l10,-8 l10,8" fill="none" stroke="#5f686f" strokeWidth="1.5" />

      {/* USB-UART chip, regulator, buttons, LEDs, USB-C */}
      <rect x="292" y="86" width="40" height="40" rx="3" fill="#0e1013" stroke="#3a424a" />
      {[0, 1, 2, 3, 4].map(i => <g key={i}><rect x={296 + i * 7} y="80" width="3" height="6" fill="#9aa2a7" /><rect x={296 + i * 7} y="126" width="3" height="6" fill="#9aa2a7" /></g>)}
      <rect x="300" y="146" width="30" height="18" rx="2" fill="#0e1013" stroke="#3a424a" />
      {[[372, 62, "EN"], [372, 150, "BOOT"]].map(([x, y, t]) => (
        <g key={t as string}>
          <rect x={(x as number) - 14} y={(y as number) - 12} width="28" height="24" rx="3" fill="#cfd4d6" />
          <circle cx={x as number} cy={y as number} r="7" fill="#2a2f33" />
          <text x={x as number} y={(y as number) + 26} textAnchor="middle" className="mono" fontSize="10" fill="#e8ebea">{t}</text>
        </g>
      ))}
      <circle cx="356" cy="106" r="5" fill="#ff4a3c" filter="url(#glow)" />
      <circle cx="356" cy="106" r="3" fill="#ffd0c8" />
      <circle cx="384" cy="106" r="5" fill="#5aa2ec" filter="url(#glow)" />
      <circle cx="384" cy="106" r="3" fill="#e0f0ff" />
      <rect x="420" y="78" width="52" height="54" rx="10" fill="url(#usb)" stroke="#6b747a" strokeWidth="1.5" />
      <rect x="434" y="96" width="30" height="18" rx="9" fill="#2a2f33" />
      <text x="190" y="184" textAnchor="middle" className="mono" fontSize="10" fill="#c8ccce" opacity="0.8" letterSpacing="1">GND 23 22 TX RX 21 GND 19 18 5</text>
    </g>
  );
}

// ---------- scene ----------

function Thumbnail() {
  const board = { x: 940, y: 720, rot: -7 };
  const antenna = { x: board.x + 54, y: board.y - 14 }; // board edge over the PCB antenna, after rotation
  const gw = iso(GATEWAY.x, GATEWAY.y);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      <style>{pumpjackCss + `.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }`}</style>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1220" /><stop offset="0.55" stopColor="#1d2a44" />
          <stop offset="0.82" stopColor="#7a4a52" /><stop offset="1" stopColor="#f08a3e" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd38a" stopOpacity="0.95" /><stop offset="0.25" stopColor="#ffa24a" stopOpacity="0.55" /><stop offset="1" stopColor="#ff7a2e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2219" /><stop offset="1" stopColor="#0d0c0a" />
        </linearGradient>
        <radialGradient id="plume" cx="0" cy="0.5" r="1">
          <stop offset="0" stopColor="#ff8c28" stopOpacity="0.9" /><stop offset="0.6" stopColor="#ff6a28" stopOpacity="0.45" /><stop offset="1" stopColor="#ff5a28" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="plume-core" cx="0" cy="0.5" r="1">
          <stop offset="0" stopColor="#ffd08a" stopOpacity="0.9" /><stop offset="1" stopColor="#ff9a40" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="can" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1f2" /><stop offset="0.5" stopColor="#c3c9cc" /><stop offset="1" stopColor="#9aa3a8" />
        </linearGradient>
        <linearGradient id="usb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3e7ea" /><stop offset="1" stopColor="#9aa2a7" />
        </linearGradient>
        <filter id="blur-sm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="blur-lg" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      {/* dusk sky, sun on the horizon, stars */}
      <rect width={W} height={HORIZON} fill="url(#sky)" />
      <ellipse cx="520" cy={HORIZON} rx="420" ry="230" fill="url(#sun)" />
      {[[620, 60], [760, 140], [1440, 40], [700, 30], [520, 330], [1360, 610], [880, 50], [1250, 30]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} fill="#fff" opacity="0.6" />
      ))}

      {/* far ridge, ground, fenceline */}
      <path d={`M0,${HORIZON - 14} C160,${HORIZON - 26} 300,${HORIZON - 8} 470,${HORIZON - 18} S800,${HORIZON - 30} 1000,${HORIZON - 12} S1350,${HORIZON - 22} 1500,${HORIZON - 14} V${HORIZON} H0 Z`} fill="#3a2c26" />
      <rect y={HORIZON} width={W} height={H - HORIZON} fill="url(#ground)" />
      <path d={`M0,${HORIZON + 46} L1500,${HORIZON + 20} M0,${HORIZON + 64} L1500,${HORIZON + 34}`} stroke="#5a4a3a" strokeWidth="1.5" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 30 + i * 96, top = HORIZON + 22 - i * 1.6;
        return <rect key={i} x={x} y={top} width="5" height={58 - i * 0.5} fill="#2a2018" />;
      })}

      {/* an emissions node on a fence post: pole, solar panel, enclosure, antenna */}
      <g transform={`translate(818 ${HORIZON - 104})`} style={{ filter: "brightness(0.85)" }}>
        <rect x="-3" y="0" width="6" height="134" fill="#4a5258" />
        <polygon points="-34,10 30,0 34,18 -30,30" fill="#24406a" stroke="#8fa7c4" strokeWidth="1.2" />
        <path d="M-18,8 L-14,27 M-2,5 L2,24 M14,3 L18,21" stroke="#8fa7c4" strokeWidth="0.8" />
        <rect x="-15" y="44" width="30" height="38" rx="3" fill="#d9dcd6" stroke="#6b747a" />
        <path d="M-9,84 h18 M-7,88 h14" stroke="#6b747a" strokeWidth="1.5" />
        <line x1="10" y1="44" x2="10" y2="18" stroke="#2a2f33" strokeWidth="2" />
        <circle cx="0" cy="62" r="2.5" fill="#4cc38a" />
      </g>

      {/* the pumpjack, side-on at dusk */}
      <g transform={`translate(40 ${HORIZON - 1.08 * 300 + 6}) scale(1.08)`} style={{ filter: "brightness(0.82) saturate(0.95)" }}>
        <PumpjackArt theta={2.2} />
      </g>
      <ellipse cx="420" cy={HORIZON + 10} rx="330" ry="14" fill="#000" opacity="0.4" filter="url(#blur-sm)" />

      {/* title */}
      <g transform="translate(72 104)">
        <g transform="translate(0 -62) scale(3.4)">
          <path d="M 11 2 L 20 19 L 2 19 Z" fill="none" stroke="#5aa2ec" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="11" cy="13" r="2" fill="#5aa2ec" />
        </g>
        <text x="94" y="0" fontFamily="'Space Grotesk', Inter, sans-serif" fontWeight="700" fontSize="104" fill="#f3f5f4" letterSpacing="-2">sigilint</text>
        <text x="4" y="60" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="34" fill="#dfe6ea">Fenceline air watch for the</text>
        <text x="4" y="102" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="34" fill="#dfe6ea">oil well next door.</text>
        {["ESP32 · ESP-NOW", "CH₄ · H₂S · VOC", "LIVE MAP"].map((t, i, a) => {
          const x = a.slice(0, i).reduce((s, u) => s + u.length * 10.6 + 46, 4);
          return (
            <g key={t} transform={`translate(${x} 136)`}>
              <rect width={t.length * 10.6 + 30} height="36" rx="18" fill="#0d1012" fillOpacity="0.55" stroke="#5aa2ec" strokeOpacity="0.6" />
              <text x="15" y="24" className="mono" fontSize="16" fontWeight="500" fill="#cfe4fa" letterSpacing="1">{t}</text>
            </g>
          );
        })}
      </g>

      <MapCard />

      {/* radio hop: board antenna up to the gateway on the map */}
      <path d={`M${antenna.x},${antenna.y - 10} C${antenna.x - 120},${antenna.y - 160} ${gw.x - 60},${gw.y + 140} ${gw.x},${gw.y + 14}`}
            fill="none" stroke="#5aa2ec" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" opacity="0.9" />

      {/* the microcontroller, in the foreground, radiating */}
      <g transform={`translate(${board.x} ${board.y}) rotate(${board.rot})`}><Esp32 /></g>
      {[0, 1, 2].map(i => {
        const r = 22 + i * 18, a0 = (-150 * Math.PI) / 180, a1 = (-40 * Math.PI) / 180;
        return <path key={i} d={`M${antenna.x + r * Math.cos(a0)},${antenna.y + r * Math.sin(a0)} A${r},${r} 0 0 1 ${antenna.x + r * Math.cos(a1)},${antenna.y + r * Math.sin(a1)}`}
                     fill="none" stroke="#5aa2ec" strokeWidth="3.5" strokeLinecap="round" opacity={0.95 - i * 0.28} />;
      })}
    </svg>
  );
}

createRoot(document.getElementById("root")!).render(<Thumbnail />);
