// Well pad example — drawings. The overhead site plan that sits under the
// schematic markers, and the illustrations shown in the detail drawer: a
// cutaway of an emissions node, the gateway mast, and a side view of the
// pumping unit. All plain SVG, coloured from CSS so they follow the theme.

import { useDashboardState } from "../../src";
import { GATEWAY, NODES } from "./site";

// ---------- helpers ----------

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/** Seconds since an entity's last record arrived (simulator time tracks the wall clock) */
const age = (ts?: string) => (ts ? (Date.now() - new Date(ts).getTime()) / 1000 : Infinity);

/** Strokes-per-minute → animation timing for the pumping unit */
export const strokeStyle = (spm: number) =>
  ({ "--stroke": `${(60 / Math.max(spm, 0.5)).toFixed(2)}s`, "--play": spm > 0.5 ? "running" : "paused" }) as React.CSSProperties;

const TREES: [number, number, number][] = [
  [80, 90, 16], [110, 120, 11], [60, 250, 14], [150, 300, 10], [860, 120, 15], [900, 160, 10], [930, 320, 13],
  [880, 380, 9], [820, 560, 12], [380, 540, 13], [420, 565, 9], [640, 540, 14], [960, 470, 11], [40, 380, 12],
];

// ---------- overhead site plan ----------

export function SitePlan() {
  const s = useDashboardState();
  const v = (id: string, fallback = 0) => s.latest[id]?.value ?? fallback;
  const spm = v("WELL", 8.4);
  const gateOpen = v("GATE") >= 0.5;
  const from = v("WX-DIR", 185), heading = (from + 180) % 360;
  const excess = Math.max(...NODES.map(n => v(n.id, 2) - 2));
  const plume = Math.max(0, Math.min(1, (excess - 1.5) / 20));
  const wellhead = { x: 432, y: 252 };

  return (
    <g className="wp-plan">
      <defs>
        <pattern id="wp-grass" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="5" r="0.9" className="wp-grass-dot" /><circle cx="13" cy="13" r="0.7" className="wp-grass-dot" />
        </pattern>
        <radialGradient id="wp-plume" cx="0" cy="0.5" r="1">
          <stop offset="0" className="wp-plume-a" /><stop offset="1" className="wp-plume-b" />
        </radialGradient>
      </defs>
      <rect x="-40" y="-20" width="1080" height="700" className="wp-pasture" />
      <rect x="-40" y="-20" width="1080" height="700" fill="url(#wp-grass)" />

      {/* property line, stock tank, county road, lease road */}
      <rect x="22" y="22" width="956" height="550" className="wp-property" />
      <text x="34" y="40" className="wp-label">PRIVATE PROPERTY · HARGROVE RANCH · SURFACE OWNER</text>
      <ellipse cx="870" cy="500" rx="58" ry="34" className="wp-water" />
      <text x="870" y="503" className="wp-label mid" textAnchor="middle">STOCK TANK</text>
      <rect x="-40" y="588" width="1080" height="30" className="wp-road" />
      <text x="40" y="607" className="wp-label">COUNTY ROAD 214</text>
      <path d="M512,588 L512,470 M532,588 L532,470" className="wp-road-edge" />
      <rect x="512" y="452" width="20" height="136" className="wp-caliche" />
      <path d="M512,572 h20 M512,576 h20 M512,580 h20" className="wp-thin" />
      <text x="540" y="560" className="wp-label">LEASE ROAD</text>
      <text x="540" y="574" className="wp-label dim">cattle guard</text>

      {/* landowner's house, barn and the gateway mast */}
      <rect x="70" y="440" width="64" height="44" className="wp-building" />
      <path d="M70,462 H134 M102,440 V484" className="wp-thin" />
      <text x="102" y="500" className="wp-label" textAnchor="middle">HOUSE</text>
      <rect x="150" y="470" width="80" height="56" className="wp-building" />
      <path d="M150,498 H230" className="wp-thin" />
      <text x="190" y="542" className="wp-label" textAnchor="middle">BARN</text>
      <circle cx={GATEWAY.x} cy={GATEWAY.y} r="5" className="wp-mast" />
      <path d={`M${GATEWAY.x},${GATEWAY.y} L${GATEWAY.x + 35},${GATEWAY.y + 20}`} className="wp-thin" />
      <path d="M102,484 L102,520 L150,520 M205,437 L205,470" className="wp-power" />

      {TREES.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} className="wp-tree" />)}

      {/* radio links: every node and the gate to the gateway; flash when a packet lands */}
      {[...NODES.map(n => ({ id: n.id, x: n.x, y: n.y })), { id: "GATE", x: 548, y: 450 }].map(n => (
        <line key={n.id} x1={n.x} y1={n.y} x2={GATEWAY.x} y2={GATEWAY.y}
              className={`wp-link ${s.latest[n.id]?.value === null ? "down" : age(s.latest[n.id]?.ts) < 1.2 ? "tx" : ""}`} />
      ))}

      {/* fenced pad */}
      <rect x="320" y="130" width="420" height="300" className="wp-caliche" />
      <path d="M500,450 H300 V110 H760 V450 H540" className="wp-fence" />
      {[...Array(24)].map((_, i) => <circle key={i} cx={300 + (i % 12) * 41.8} cy={i < 12 ? 110 : 450} r="1.6" className="wp-post" />)}
      <g transform="translate(500 450)">
        <line x1="0" y1="0" x2="40" y2="0" className={`wp-gate ${gateOpen ? "open" : ""}`} />
      </g>
      <text x="456" y="466" className="wp-label">GATE</text>
      <text x="306" y="124" className="wp-label dim">PAD FENCE · 4-STRAND BARBED + PIPE GATE</text>

      {/* power pole + transformer, flowline */}
      <circle cx="575" cy="300" r="5" className="wp-pole" />
      <rect x="569" y="308" width="12" height="9" className="wp-equip" />
      <path d="M575,300 L560,268 M575,317 L575,430 L574,588" className="wp-power" />
      <path d="M432,252 C470,320 560,330 650,262" className="wp-flowline" />
      <text x="470" y="330" className="wp-label dim">FLOWLINE</text>

      {/* pumping unit, seen from above: horsehead over the wellhead, beam, samson post, gearbox, motor */}
      <g style={strokeStyle(spm)} className="wp-unit">
        <rect x="420" y="236" width="150" height="32" rx="2" className="wp-slab" />
        <circle cx={wellhead.x} cy={wellhead.y} r="9" className="wp-equip" />
        <circle cx={wellhead.x} cy={wellhead.y} r="3" className="wp-rod" />
        <g className="wp-beam"><rect x="436" y="247" width="92" height="10" className="wp-steel" /><path d="M436,245 Q426,252 436,259" className="wp-steel-line" /></g>
        <path d="M478,238 L485,252 L478,266 M492,238 L485,252 L492,266" className="wp-steel-line" />
        <rect x="520" y="242" width="20" height="20" className="wp-equip" />
        <g className="wp-cranks"><rect x="515" y="236" width="10" height="5" className="wp-weight" /><rect x="515" y="263" width="10" height="5" className="wp-weight" /></g>
        <rect x="546" y="246" width="18" height="12" rx="3" className="wp-equip" />
        <path d="M540,252 H546" className="wp-thin" />
      </g>
      <text x="420" y="285" className="wp-label">WELL No. 2 · PUMPING UNIT</text>

      {/* tank battery: berm, separator/heater-treater, two oil tanks, water tank, load line */}
      <rect x="600" y="150" width="120" height="180" rx="6" className="wp-berm" />
      <circle cx="650" cy="262" r="12" className="wp-equip" />
      <text x="650" y="265" className="wp-label tiny" textAnchor="middle">SEP</text>
      {[[636, 186, "T1", "TANK-1"], [690, 186, "T2", "TANK-2"], [690, 240, "WTR", "TANK-W"]].map(([x, y, label, id]) => {
        const lvl = v(id as string, 0);
        return (
          <g key={id as string}>
            <circle cx={x as number} cy={y as number} r="22" className="wp-tank" />
            <circle cx={x as number} cy={y as number} r={Math.max(2, (lvl / 20) * 22)} className="wp-tank-fill" />
            <text x={x as number} y={(y as number) + 34} className="wp-label tiny" textAnchor="middle">{label} · {lvl.toFixed(1)} ft</text>
          </g>
        );
      })}
      <path d="M650,274 V310 M640,310 H700" className="wp-flowline" />
      <text x="606" y="324" className="wp-label tiny">TRUCK LOAD-OUT</text>
      <text x="606" y="144" className="wp-label">TANK BATTERY</text>

      {/* emissions plume from the wellhead, drifting downwind */}
      {plume > 0.02 && (
        <path d="M0,0 C60,-14 170,-52 290,-44 Q320,0 290,44 C170,52 60,14 0,0Z" fill="url(#wp-plume)"
              transform={`translate(${wellhead.x} ${wellhead.y}) rotate(${heading - 90})`}
              style={{ opacity: 0.25 + plume * 0.6 }} className="wp-plume" />
      )}

      {/* wind arrow + north arrow + scale */}
      <g transform="translate(905 75)">
        <circle r="34" className="wp-compass" />
        {["N", "E", "S", "W"].map((d, i) => (
          <text key={d} x={Math.sin((i * Math.PI) / 2) * 26} y={-Math.cos((i * Math.PI) / 2) * 26 + 3} className="wp-label tiny" textAnchor="middle">{d}</text>
        ))}
        <g transform={`rotate(${heading})`}><path d="M0,16 L0,-14 M-6,-6 L0,-15 L6,-6" className="wp-wind" /></g>
        <text y="50" className="wp-label" textAnchor="middle">AIR HEADING {compass(heading)}</text>
      </g>
      <g transform="translate(800 618)">
        <path d="M0,-6 V0 H100 V-6 M50,-3 V0" className="wp-thin" />
        <text x="104" y="0" className="wp-label tiny">50 m</text>
      </g>
    </g>
  );
}

// ---------- emissions node, cutaway ----------

export function NodeDevice({ transmitting, solar = 4 }: { transmitting: boolean; solar?: number }) {
  return (
    <svg viewBox="0 0 420 300" className="wp-device" role="img"
         aria-label="Cutaway of an emissions node: solar panel, ESP32 board, LoRa radio, batteries, gas sensors behind a vented port">
      <rect x="0" y="0" width="420" height="300" className="wp-dev-bg" />
      {/* pole and solar panel */}
      <rect x="64" y="40" width="9" height="260" className="wp-dev-pole" />
      <path d="M68,52 L112,108" className="wp-dev-wire" />
      <polygon points="20,40 168,16 178,62 30,90" className="wp-dev-panel" style={{ opacity: 0.55 + Math.min(solar, 5) * 0.09 }} />
      {[1, 2, 3, 4, 5].map(i => <line key={i} x1={20 + i * 24.7} y1={40 - i * 4} x2={30 + i * 24.7} y2={90 - i * 4.7} className="wp-dev-cell" />)}
      <line x1="25" y1="65" x2="173" y2="39" className="wp-dev-cell" />

      {/* antenna */}
      <line x1="318" y1="112" x2="318" y2="22" className="wp-dev-antenna" />
      <circle cx="318" cy="20" r="3" className="wp-dev-antenna-tip" />
      {transmitting && <g className="wp-dev-waves"><path d="M330,30 q8,10 0,20" /><path d="M338,24 q14,16 0,32" /></g>}

      {/* enclosure, door cut away */}
      <rect x="104" y="108" width="236" height="148" rx="8" className="wp-dev-box" />
      <rect x="112" y="116" width="220" height="132" rx="4" className="wp-dev-inside" />
      {/* PCB with ESP32-S3 module, LoRa radio, MPPT charger, status LED */}
      <rect x="120" y="124" width="132" height="84" rx="3" className="wp-dev-pcb" />
      <rect x="128" y="132" width="56" height="42" rx="2" className="wp-dev-can" />
      <path d="M131,137 h8 v-3 h8 v3 h8 v-3 h8 v3 h8" className="wp-dev-trace" />
      <text x="156" y="160" className="wp-dev-chip" textAnchor="middle">ESP32-S3</text>
      <rect x="192" y="132" width="52" height="24" rx="2" className="wp-dev-can" />
      <text x="218" y="148" className="wp-dev-chip" textAnchor="middle">SX1262</text>
      <path d="M244,140 C280,140 300,130 318,112" className="wp-dev-coax" />
      <rect x="192" y="164" width="52" height="22" rx="2" className="wp-dev-board2" />
      <text x="218" y="179" className="wp-dev-chip" textAnchor="middle">MPPT</text>
      <circle cx="136" cy="196" r="4" className={`wp-dev-led ${transmitting ? "on" : ""}`} />
      <text x="146" y="199" className="wp-dev-chip small">TX</text>
      {/* LiFePO4 cells */}
      {[262, 292].map(x => (
        <g key={x}>
          <rect x={x} y="124" width="26" height="84" rx="9" className="wp-dev-cellbat" />
          <rect x={x + 9} y="120" width="8" height="5" className="wp-dev-cellbat" />
        </g>
      ))}
      <text x="290" y="170" className="wp-dev-chip" textAnchor="middle" transform="rotate(-90 290 170)">LiFePO₄ × 2</text>
      {/* sensor bay */}
      <rect x="120" y="214" width="204" height="30" rx="3" className="wp-dev-bay" />
      <circle cx="146" cy="229" r="10" className="wp-dev-can" /><circle cx="146" cy="229" r="6" className="wp-dev-mesh" />
      <circle cx="190" cy="229" r="11" className="wp-dev-ec" />
      <rect x="222" y="221" width="16" height="16" rx="2" className="wp-dev-can" />
      <rect x="252" y="224" width="10" height="10" rx="1" className="wp-dev-can" />
      {/* ePTFE vent plug on the side wall, cable gland on top-left */}
      <rect x="340" y="170" width="10" height="16" rx="2" className="wp-dev-vent" />
      <rect x="112" y="102" width="12" height="8" rx="2" className="wp-dev-vent" />
      {/* louvred sun shield over the sensor port */}
      {[0, 1, 2].map(i => <path key={i} d={`M${150 - i * 6},${262 + i * 8} H${296 + i * 6}`} className="wp-dev-louvre" />)}

      {/* callouts */}
      <g className="wp-dev-callouts">
        <text x="186" y="14">6 W solar panel</text>
        <text x="330" y="16">LoRa antenna</text>
        <text x="352" y="166">ePTFE</text><text x="352" y="177">breathable</text><text x="352" y="188">vent</text>
        <path d="M146,240 L60,280" /><text x="12" y="292">CH₄ (MOx)</text>
        <path d="M190,240 L170,290" /><text x="146" y="298">H₂S cell</text>
        <path d="M230,237 L250,290" /><text x="232" y="298">VOC</text>
        <path d="M257,236 L320,282" /><text x="300" y="292">BME280</text>
      </g>
    </svg>
  );
}

// ---------- gateway mast ----------

export function GatewayDevice({ transmitting }: { transmitting: boolean }) {
  return (
    <svg viewBox="0 0 420 260" className="wp-device" role="img" aria-label="Gateway mast with omni antenna, weather sensors and a box holding a Raspberry Pi, LoRa board and LTE modem">
      <rect x="0" y="0" width="420" height="260" className="wp-dev-bg" />
      <rect x="96" y="30" width="8" height="230" className="wp-dev-pole" />
      <rect x="96" y="2" width="8" height="30" rx="4" className="wp-dev-omni" />
      {transmitting && <g className="wp-dev-waves"><path d="M112,6 q8,10 0,20" /><path d="M120,0 q14,16 0,32" /><path d="M88,6 q-8,10 0,20" /></g>}
      {/* weather arm: cups and vane */}
      <path d="M104,58 H180 M30,58 H96" className="wp-dev-wire" />
      {[-12, 0, 12].map(dx => <circle key={dx} cx={180 + dx} cy={50} r="5" className="wp-dev-can" />)}
      <path d="M180,50 V58" className="wp-dev-wire" />
      <path d="M30,58 V48 L18,44 L42,44 Z" className="wp-dev-can" />
      <rect x="80" y="80" width="40" height="34" className="wp-dev-shield" />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M80,${86 + i * 8} H120`} className="wp-dev-louvre" />)}
      {/* enclosure with Pi + HAT + modem */}
      <path d="M100,140 C130,140 140,150 150,150" className="wp-dev-coax" />
      <rect x="150" y="130" width="230" height="110" rx="8" className="wp-dev-box" />
      <rect x="158" y="138" width="214" height="94" rx="4" className="wp-dev-inside" />
      <rect x="166" y="150" width="120" height="74" rx="4" className="wp-dev-pcb" />
      <rect x="172" y="146" width="108" height="26" rx="2" className="wp-dev-board2" />
      <text x="226" y="163" className="wp-dev-chip" textAnchor="middle">LoRa HAT · SX1302</text>
      <rect x="176" y="186" width="30" height="30" rx="2" className="wp-dev-can" />
      <text x="191" y="204" className="wp-dev-chip small" textAnchor="middle">SoC</text>
      <rect x="250" y="190" width="30" height="26" rx="1" className="wp-dev-can" />
      <text x="232" y="230" className="wp-dev-chip small" textAnchor="middle">Raspberry Pi 4</text>
      <rect x="298" y="150" width="64" height="40" rx="3" className="wp-dev-board2" />
      <text x="330" y="174" className="wp-dev-chip" textAnchor="middle">LTE modem</text>
      <line x1="350" y1="150" x2="350" y2="118" className="wp-dev-antenna" />
      <line x1="312" y1="150" x2="312" y2="122" className="wp-dev-antenna" />
      <rect x="298" y="198" width="64" height="28" rx="3" className="wp-dev-cellbat" />
      <text x="330" y="216" className="wp-dev-chip small" textAnchor="middle">UPS + 12 V</text>
      <g className="wp-dev-callouts">
        <text x="118" y="14">5.8 dBi omni (LoRa)</text>
        <text x="196" y="44">anemometer</text>
        <text x="2" y="36">vane</text>
        <text x="4" y="100">temp / RH /</text><text x="4" y="111">pressure</text>
        <text x="362" y="112">LTE</text>
      </g>
    </svg>
  );
}

// ---------- pumping unit, side view ----------

export function PumpjackDiagram({ spm }: { spm: number }) {
  return (
    <svg viewBox="0 0 420 250" className="wp-device wp-unit" style={strokeStyle(spm)} role="img"
         aria-label="Side view of a beam pumping unit lifting sucker rods from a pump far below ground">
      <rect x="0" y="0" width="420" height="250" className="wp-dev-bg" />
      <rect x="0" y="150" width="420" height="100" className="wp-dev-ground" />
      <line x1="0" y1="150" x2="420" y2="150" className="wp-dev-wire" />
      {/* wellbore */}
      <rect x="72" y="150" width="16" height="100" className="wp-dev-hole" />
      <line x1="80" y1="150" x2="80" y2="250" className="wp-dev-rodline" />
      <text x="96" y="196" className="wp-dev-chip lft">casing &amp; tubing</text>
      <text x="96" y="208" className="wp-dev-chip lft dim">sucker rods ↓ to pump</text>
      <text x="96" y="238" className="wp-dev-chip lft">≈ 9,000 ft below</text>
      {/* base, samson post, gearbox, motor */}
      <rect x="60" y="140" width="290" height="10" className="wp-dev-can" />
      <path d="M190,140 L210,62 L230,140" className="wp-dev-steel" />
      <rect x="276" y="104" width="38" height="36" rx="3" className="wp-dev-board2" />
      <rect x="324" y="116" width="26" height="22" rx="4" className="wp-dev-can" />
      <text x="337" y="132" className="wp-dev-chip small" textAnchor="middle">M</text>
      {/* crank + counterweight rotating about the gearbox */}
      <g className="wp-crank"><line x1="295" y1="114" x2="295" y2="80" className="wp-dev-steel" /><rect x="282" y="72" width="26" height="14" rx="3" className="wp-dev-weight" /></g>
      {/* walking beam, horsehead, bridle and polished rod (rocks about the samson post bearing) */}
      <g className="wp-rock">
        <rect x="74" y="58" width="226" height="8" className="wp-dev-steel-fill" />
        <path d="M84,46 Q62,62 80,96 L92,96 Q78,62 96,46 Z" className="wp-dev-steel-fill" />
        <line x1="290" y1="66" x2="295" y2="96" className="wp-dev-steel" />
      </g>
      <g className="wp-polish"><line x1="80" y1="96" x2="80" y2="146" className="wp-dev-polished" /></g>
      <rect x="72" y="140" width="16" height="10" className="wp-dev-can" />
      <circle cx="210" cy="62" r="4" className="wp-dev-can" />
      <g className="wp-dev-callouts">
        <text x="4" y="40">horsehead</text>
        <text x="216" y="40">walking beam</text>
        <text x="236" y="110">samson post</text>
        <text x="300" y="66">counterweight</text>
        <text x="4" y="128">polished rod</text>
        <text x="286" y="160">gearbox · motor</text>
      </g>
    </svg>
  );
}
