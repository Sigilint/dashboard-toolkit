// Well pad example — the site's data: one oil well on a rod pump, on a
// landowner's private property, with a fenced pad, a gate sensor, four
// solar ESP32 emissions nodes on the fenceline and a Raspberry Pi gateway
// at the barn. Everything here is synthetic: the well, the operator, the
// landowner and every reading are made up for teaching.
//
// The plan is drawn in a 1000 × 640 viewBox, north up.

import type { Category, Group, SimEntity, SimParams, Scenario } from "../../src";

export const categories: Category[] = [
  { key: "production", label: "Production", code: "P", shape: "square", description: "The well and its pumping unit, from the operator's controller" },
  { key: "emissions", label: "Emissions", code: "E", shape: "hexagon", description: "Gas readings at the fenceline" },
  { key: "security", label: "Security", code: "S", shape: "circle", description: "Gate and fence" },
  { key: "network", label: "Network", code: "N", shape: "diamond", description: "Radio links and the gateway" },
  { key: "device", label: "Device health", code: "D", shape: "triangle", description: "Batteries, solar and enclosure conditions" },
  { key: "weather", label: "Weather", code: "W", shape: "invtriangle", description: "Wind, temperature and pressure at the mast" },
];

export const NODES = [
  { id: "N1", side: "north", x: 530, y: 110, rssi: -82, serial: "WPN-0418", installed: "2026-04-12", mount: "Fence T-post, 1.5 m" },
  { id: "N2", side: "east", x: 760, y: 280, rssi: -87, serial: "WPN-0421", installed: "2026-04-12", mount: "Fence corner post, 1.5 m" },
  { id: "N3", side: "south-east", x: 700, y: 450, rssi: -79, serial: "WPN-0419", installed: "2026-04-13", mount: "Fence T-post, 1.5 m" },
  { id: "N4", side: "west", x: 300, y: 300, rssi: -71, serial: "WPN-0422", installed: "2026-05-02", mount: "Pipe stand, 1.8 m" },
] as const;

export const GATEWAY = { x: 205, y: 432 };

const box = (x: number, y: number, r = 22): [number, number, number, number] => [x - r, y - r, 2 * r, 2 * r];

export const groups: Group[] = [
  { key: "WELL", label: "Well & pumping unit", description: "Hargrove Ranch No. 2: a rod-pumped oil well, watched by the operator's pump-off controller", rect: [395, 182, 190, 106] },
  { key: "BAT", label: "Tank battery", description: "Separator, oil and water tanks inside a dirt berm. Trucks haul from here", rect: [598, 148, 124, 184] },
  { key: "GATE", label: "Gate & fence", description: "Pipe-rail gate on the lease road with a magnetic gate sensor", rect: [482, 430, 92, 40] },
  ...NODES.map(n => ({ key: n.id, label: `Node ${n.id} (${n.side})`, description: `Landowner's solar emissions node on the ${n.side} fenceline`, rect: box(n.x, n.y) })),
  { key: "GW", label: "Gateway & weather mast", description: "Raspberry Pi gateway at the barn: an ESP32 bridge hears the nodes over ESP-NOW and the Pi sends the data out over LTE", rect: [168, 398, 100, 72] },
];

// ---------- teaching notes, by sensor type ----------

const NOTES: Record<string, { description: string; insights: string[] }> = {
  CH4: {
    description: "Methane is the main ingredient of natural gas. Outdoor air already holds about 1.9 ppm everywhere on Earth, so the node watches for readings above that background. A fenceline sensor only sees gas when the wind carries it there, so read every methane value next to the wind direction.",
    insights: [
      "One node rising while the others stay flat points to a source upwind of that node.",
      "Methane traps about 80 times more heat than CO₂ over 20 years, which is why small leaks matter.",
      "This node uses a metal-oxide (MOx) sensor: cheap and sensitive, but it drifts with heat and humidity, so the firmware corrects it with the enclosure sensor.",
    ],
  },
  H2S: {
    description: "Hydrogen sulfide is the rotten-egg gas found in 'sour' oil and gas. People can smell it below 0.01 ppm, but above about 100 ppm it deadens the sense of smell, so a nose is not a safety device. In Texas, wells with H₂S fall under RRC Statewide Rule 36.",
    insights: [
      "This well produces sweet crude (little or no H₂S), so the reading sits near zero.",
      "The electrochemical cell inside makes a tiny current proportional to the gas, and the cell wears out in about 2 to 3 years.",
    ],
  },
  VOC: {
    description: "Volatile organic compounds are vapours that evaporate off crude oil and condensate, such as benzene, toluene and hexane. Tanks and loading lines are the usual sources, and VOCs help form ground-level ozone on hot days.",
    insights: [
      "VOC and methane rising together usually means hydrocarbon vapour, not a sensor fault.",
      "Reported in parts per billion, as an isobutylene equivalent.",
    ],
  },
  ENC_T: {
    description: "Temperature inside the node's housing. Electronics and gas sensors both have working ranges, and a box in the West Texas sun can run 20 °C above the air.",
    insights: ["A louvred shield over the sensor port and a light-coloured box keep this down."],
  },
  ENC_RH: {
    description: "Humidity inside the housing. A fully sealed box 'breathes' as it heats and cools, pulling in damp air that condenses on the circuit board. The node uses a breathable ePTFE membrane vent: it passes air and water vapour, but not liquid water or dust.",
    insights: ["If this ever climbed and stayed near 100 %, the vent would be clogged or the seal broken."],
  },
  BAT: {
    description: "Battery voltage. Each node runs on two LiFePO₄ cells charged by its solar panel. LiFePO₄ holds a very flat 3.2 to 3.3 V for most of its charge, so a drop toward 3.1 V means it is nearly empty.",
    insights: [
      "The ESP32 spends about 85 % of its life in deep sleep at a few microamps. The average draw is about 12 mA, almost all of it the methane sensor's heater, so a full battery lasts about 3 weeks with no sun.",
      "LiFePO₄ is chosen over ordinary lithium-ion because it tolerates heat and won't go into thermal runaway.",
    ],
  },
  SOL: {
    description: "Power coming in from the node's 6 W solar panel. On a clear day the panel makes many times what the node uses. Dust, bird droppings or shade cut it quickly.",
    insights: ["A battery that slowly sags while the solar input is low means the panel needs cleaning."],
  },
  RSSI: {
    description: "Received signal strength of this node at the gateway, in dBm. The nodes use ESP-NOW in the ESP32's long-range mode, which trades speed for reach. A packet is only a few hundred bytes, so the slow rate doesn't matter. Around −90 dBm is comfortable; below about −96 dBm, packets start to drop.",
    insights: [
      "ESP-NOW skips joining a Wi-Fi network. The node wakes and sends straight to the gateway's radio address, so the radio is on for milliseconds, not seconds.",
      "Each packet is acknowledged. If the ack doesn't come, the node keeps the reading in its RTC memory, which survives deep sleep, and sends it with the next one.","Wet mesquite, a parked truck or a tank between node and gateway can each cost a few dB."],
  },
  SPM: {
    description: "Strokes per minute of the pumping unit. An electric motor turns a crank, the walking beam rocks, and the horsehead lifts a string of steel 'sucker' rods up and down inside the well. On each upstroke a pump at the bottom, about 9,000 ft down, lifts oil to the surface.",
    insights: [
      "The operator's pump-off controller (POC) slows or idles the unit when the pump isn't filling, to stop it hammering the fluid.",
      "A pause here is often the controller doing its job, not a breakdown.",
    ],
  },
  FILL: {
    description: "Pump fillage: how full the downhole pump barrel gets on each stroke, worked out by the controller from rod load and position (a 'dynamometer card'). 100 % means the well is giving all the fluid the pump can lift.",
    insights: ["Low fillage means 'fluid pound': the plunger hits fluid partway down, which wears out rods and pump."],
  },
  AMP: { description: "Motor current. It rises when the unit is out of balance or the pump is working hard, and drops to zero when the unit stops.", insights: [] },
  TP: { description: "Tubing pressure at the wellhead: the pressure of the oil, water and gas coming up the production tubing toward the separator.", insights: [] },
  CP: { description: "Casing pressure: gas collecting in the space between the tubing and the casing. It is vented to the flowline, so it stays fairly steady.", insights: [] },
  TANK: {
    description: "Fluid level in the tank, read by a radar gauge on the tank's roof. Oil tanks fill until a truck hauls a load, and each load is recorded on a run ticket.",
    insights: ["A 400-bbl tank holds about 20 bbl per foot of height."],
  },
  GATE: {
    description: "A magnetic reed switch on the gate post tells whether the gate is open. The contract pumper opens it on the daily route, and an opening at another time is worth a look.",
    insights: [
      "Inside the box is an ESP32-C3 in deep sleep, with the reed switch wired to a wake-up pin. Moving the gate wakes it instantly, it sends one ESP-NOW packet and goes back to sleep.",
      "Because it only wakes when something happens, two AA lithium cells last about two years.",
    ],
  },
  GW: {
    description: "The gateway is a Raspberry Pi with an LTE modem, plus an ESP32 'bridge' plugged into it by USB, on a mast at the barn. A Pi can't speak ESP-NOW itself, so the bridge ESP32 listens for the nodes' packets and hands them to the Pi over serial. The nodes can't reach the internet themselves; their packets go to the Pi, which time-stamps and stores them, then forwards them over the cell network. If the cell link drops, it holds the data and sends it later ('store and forward').",
    insights: ["This value is how many of the four nodes reported in the last cycle."],
  },
  WIND: {
    description: "Wind speed at the 6 m mast. Wind spreads a leak out (high wind) or lets it pool near the ground (calm nights), so it changes what the fenceline nodes can see.",
    insights: ["The arrow on the site plan shows where the air is heading, so the node it points at is downwind."],
  },
};

const note = (k: string) => NOTES[k] || { description: "", insights: [] };

// ---------- entities ----------

const e = (id: string, name: string, type: string, typeLabel: string, category: string, group: string, unit: string, dp: number,
           limits: SimEntity["limits"], sim: SimEntity["sim"], extra: Partial<SimEntity> = {}): SimEntity => {
  const n = note(type);
  return { id, name, type, typeLabel, category, group, unit, dp, limits, sim, description: n.description, insights: n.insights, tags: {}, ...extra };
};

const nodeEntities = (n: typeof NODES[number]): SimEntity[] => {
  const tags = { node: n.id, link: "ESP-NOW 2.4 GHz", owner: "landowner" };
  const ch = (suffix: string, name: string, type: string, label: string, cat: string, unit: string, dp: number, limits: SimEntity["limits"], sim: SimParams) =>
    e(`${n.id}-${suffix}`, `${n.id} ${name}`, type, label, cat, n.id, unit, dp, limits, { period: 6, ...sim }, { tags, meta: { kind: "channel", node: n.id } });
  return [
    // the node itself: its marker, carrying the headline methane reading
    e(n.id, `Emissions node ${n.id}`, "CH4", "ESP32 solar emissions node · methane", "emissions", n.id, "ppm", 1,
      { hi: [5, 20] }, { base: 2.0, noise: 0.12, period: 6 },
      { position: { x: n.x, y: n.y }, tags: { ...tags, serial: n.serial }, meta: { kind: "node", node: n.id } }),
    ch("H2S", "hydrogen sulfide", "H2S", "Electrochemical H₂S cell", "emissions", "ppm", 2, { hi: [1, 5] }, { base: 0.08, noise: 0.03 }),
    ch("VOC", "VOCs", "VOC", "MOx VOC sensor", "emissions", "ppb", 0, { hi: [300, 1000] }, { base: 40, noise: 7 }),
    ch("TEMP", "enclosure temp", "ENC_T", "Enclosure temperature", "device", "°C", 1, { hi: [60, 70] }, { base: 31 + (n.id === "N2" ? 3 : 0), noise: 0.6 }),
    ch("RH", "enclosure humidity", "ENC_RH", "Enclosure humidity", "device", "%", 0, { hi: [80, 92] }, { base: 34, noise: 1.5 }),
    ch("BAT", "battery", "BAT", "LiFePO₄ battery", "device", "V", 2, { lo: [3.1, 3.0] }, { base: 3.31, noise: 0.01 }),
    ch("SOL", "solar input", "SOL", "6 W solar panel", "device", "W", 1, undefined, { base: 4.2, noise: 0.5 }),
    ch("RSSI", "link signal", "RSSI", "ESP-NOW link at gateway", "network", "dBm", 0, { lo: [-90, -96] }, { base: n.rssi, noise: 2.5 }),
  ];
};

const well = (id: string, name: string, type: string, label: string, unit: string, dp: number, limits: SimEntity["limits"], sim: SimParams, extra: Partial<SimEntity> = {}) =>
  e(id, name, type, label, "production", "WELL", unit, dp, limits, { period: 4, ...sim }, { tags: { source: "operator POC (shared)" }, meta: { kind: "well" }, ...extra });

const wx = (id: string, name: string, type: string, unit: string, dp: number, limits: SimEntity["limits"], sim: SimParams, extra: Partial<SimEntity> = {}) =>
  e(id, name, type, name, "weather", "GW", unit, dp, limits, { period: 5, ...sim }, { tags: { source: "gateway mast" }, meta: { kind: "weather" }, ...extra });

export const entities: SimEntity[] = [
  well("WELL", "Hargrove Ranch No. 2", "SPM", "Pumping unit · strokes per minute", "SPM", 1, undefined, { base: 8.4, noise: 0.08 },
       { position: { x: 432, y: 252 }, meta: { kind: "well" } }),
  well("WELL-FILL", "Pump fillage", "FILL", "Downhole pump fillage", "%", 0, { lo: [70, 50] }, { base: 93, noise: 2 }),
  well("WELL-AMP", "Motor current", "AMP", "Motor current", "A", 0, { hi: [70, 85] }, { base: 42, noise: 3 }),
  well("WELL-TP", "Tubing pressure", "TP", "Tubing pressure", "psi", 0, { hi: [250, 400] }, { base: 85, noise: 3 }),
  well("WELL-CP", "Casing pressure", "CP", "Casing pressure", "psi", 0, { hi: [300, 450] }, { base: 140, noise: 2 }),
  e("TANK-1", "Oil tank 1 level", "TANK", "Oil tank · radar gauge", "production", "BAT", "ft", 2, { hi: [17, 19] }, { base: 9.2, noise: 0.01, period: 6 },
    { position: { x: 636, y: 182 }, tags: { source: "operator POC (shared)" }, meta: { kind: "well" } }),
  e("TANK-2", "Oil tank 2 level", "TANK", "Oil tank · radar gauge", "production", "BAT", "ft", 2, { hi: [17, 19] }, { base: 3.4, noise: 0.01, period: 6 },
    { tags: { source: "operator POC (shared)" }, meta: { kind: "well" } }),
  e("TANK-W", "Water tank level", "TANK", "Produced water tank · radar gauge", "production", "BAT", "ft", 2, { hi: [17, 19] }, { base: 6.1, noise: 0.01, period: 6 },
    { tags: { source: "operator POC (shared)" }, meta: { kind: "well" } }),
  e("GATE", "Lease road gate", "GATE", "Magnetic gate sensor", "security", "GATE", "", 0, { hi: [0.5, 9] }, { base: 0, period: 2 },
    { binary: ["CLOSED", "OPEN"], position: { x: 548, y: 450 }, tags: { link: "ESP-NOW 2.4 GHz", owner: "landowner" }, meta: { kind: "gate" } }),
  e("GW", "Gateway · nodes reporting", "GW", "Raspberry Pi ESP-NOW/LTE gateway", "network", "GW", "of 4", 0, { lo: [3.5, 1.5] }, { base: 4, period: 5 },
    { position: { x: GATEWAY.x, y: GATEWAY.y }, tags: { owner: "landowner", uplink: "LTE Cat-M1" }, meta: { kind: "gateway" } }),
  e("GW-LTE", "Gateway LTE signal", "LTE", "Cell uplink signal", "network", "GW", "dBm", 0, { lo: [-105, -115] }, { base: -88, noise: 2, period: 5 },
    { description: "Signal strength of the cell connection that carries the data off the property.", meta: { kind: "gateway" } }),
  e("GW-CPU", "Gateway CPU temp", "CPU", "Raspberry Pi CPU temperature", "device", "GW", "°C", 0, { hi: [75, 82] }, { base: 52, noise: 1.5, period: 5 },
    { description: "The Pi lives in a vented box at the barn, and above 80 °C it slows itself down.", meta: { kind: "gateway" } }),
  e("GW-BAT", "Gateway backup battery", "BATG", "12 V AGM backup", "device", "GW", "V", 2, { lo: [12.0, 11.6] }, { base: 13.15, noise: 0.03, period: 5 },
    { description: "Backup battery that keeps the gateway running through a barn power outage, for about 30 hours.", meta: { kind: "gateway" } }),
  wx("WX-WIND", "Wind speed", "WIND", "mph", 0, { hi: [30, 45] }, { base: 9, noise: 1.5 }, { position: { x: 240, y: 452 } }),
  wx("WX-GUST", "Wind gust", "WIND", "mph", 0, { hi: [40, 55] }, { base: 14, noise: 2.5 }),
  wx("WX-DIR", "Wind from", "WDIR", "°", 0, undefined, { base: 185, noise: 6 },
     { description: "The compass direction the wind blows from: 180° is a south wind, carrying air north." }),
  wx("WX-TEMP", "Air temperature", "TEMP", "°F", 0, { hi: [100, 108] }, { base: 74, noise: 0.5 }),
  wx("WX-RH", "Relative humidity", "RH", "%", 0, undefined, { base: 31, noise: 1 }),
  wx("WX-BARO", "Barometric pressure", "BARO", "inHg", 2, undefined, { base: 29.92, noise: 0.01 },
     { description: "Falling pressure usually comes before a front, and the wind shift that comes with it changes which fenceline nodes see the pad." }),
  ...NODES.flatMap(nodeEntities),
];

// ---------- scenarios: stories that play out on a 6-minute loop ----------

const n4 = entities.filter(x => x.group === "N4").map(x => ({ entityId: x.id, kind: "offline" as const }));

export const scenarios: Scenario[] = [
  {
    id: "pumper", title: "Pumper's morning visit", window: [15, 75],
    story: "The contract pumper opens the gate, gauges the tanks, checks the unit and leaves. The gate sensor logs both openings. A visit on schedule isn't an alarm, but it is a record.",
    effects: [
      { entityId: "GATE", kind: "plateau", delta: 1, rise: 1, at: [18, 26] },
      { entityId: "GATE", kind: "plateau", delta: 1, rise: 1, at: [64, 72] },
    ],
  },
  {
    id: "leak", title: "Stuffing box leak", window: [90, 215],
    story: "The packing around the polished rod (the shiny rod moving in and out of the wellhead) wears and starts to weep gas. With a south wind the plume drifts north, so N1 lights up first while the other nodes stay at background. That pattern alone tells you the source is south of N1.",
    effects: [
      { entityId: "N1", kind: "plateau", delta: 34, rise: 25, at: [90, 188] },
      { entityId: "N1-VOC", kind: "plateau", delta: 420, rise: 25, at: [90, 188] },
      { entityId: "N1-H2S", kind: "plateau", delta: 0.35, rise: 25, at: [90, 188] },
      { entityId: "N2", kind: "plateau", delta: 3, rise: 20, at: [100, 180] },
      { entityId: "N3", kind: "plateau", delta: 22, rise: 12, at: [180, 215] },
      { entityId: "N3-VOC", kind: "plateau", delta: 260, rise: 12, at: [180, 215] },
      { entityId: "N2", kind: "plateau", delta: 7, rise: 12, at: [180, 215] },
    ],
  },
  {
    id: "front", title: "Cold front & wind shift", window: [170, 300],
    story: "A front moves through: pressure dips, the wind swings from south to north-west and gusts up, and the temperature drops. The leak hasn't moved, but the plume has, so readings jump from N1 to N3 and N2 on the opposite fence.",
    effects: [
      { entityId: "WX-DIR", kind: "plateau", delta: 130, rise: 25 },
      { entityId: "WX-WIND", kind: "plateau", delta: 12, rise: 25 },
      { entityId: "WX-GUST", kind: "plateau", delta: 20, rise: 25 },
      { entityId: "WX-TEMP", kind: "plateau", delta: -15, rise: 40 },
      { entityId: "WX-RH", kind: "plateau", delta: 22, rise: 40 },
      { entityId: "WX-BARO", kind: "plateau", delta: -0.14, rise: 30, at: [150, 260] },
    ],
  },
  {
    id: "entry", title: "Gate opened after hours", window: [225, 240],
    story: "The gate opens outside the pumper's schedule. It might be the operator's crew, a hunter or someone who shouldn't be there. The sensor can't tell which, but it gives the landowner a time to check against.",
    effects: [{ entityId: "GATE", kind: "plateau", delta: 1, rise: 1, at: [226, 238] }],
  },
  {
    id: "pumpoff", title: "Pump-off: controller idles the unit", window: [255, 330],
    story: "The well delivers less fluid than the pump can lift. Fillage falls and the motor load gets choppy ('fluid pound'). The operator's pump-off controller stops the unit for a while to let fluid build up around the pump, then restarts it. This is routine.",
    effects: [
      { entityId: "WELL-FILL", kind: "plateau", delta: -42, rise: 25, at: [255, 300] },
      { entityId: "WELL-AMP", kind: "plateau", delta: 16, rise: 15, at: [262, 296] },
      { entityId: "WELL", kind: "plateau", delta: -8.4, rise: 3, at: [296, 330] },
      { entityId: "WELL-AMP", kind: "plateau", delta: -42, rise: 3, at: [296, 330] },
      { entityId: "WELL-TP", kind: "plateau", delta: -50, rise: 10, at: [296, 330] },
    ],
  },
  {
    id: "solar", title: "N3's solar panel gets dirty", window: [120, 360],
    story: "Dust and droppings build up on N3's panel. Solar input falls while the battery slowly sags toward empty. No gas reading is wrong yet, but within a couple of weeks this node would go dark. A dashboard that watches device health catches it early.",
    effects: [
      { entityId: "N3-SOL", kind: "plateau", delta: -3.3, rise: 40 },
      { entityId: "N3-BAT", kind: "ramp", delta: -0.25 },
    ],
  },
  {
    id: "radio", title: "N4 radio dropout", window: [300, 345],
    story: "A hay trailer parks between N4 and the barn and blocks the radio path. The gateway stops hearing N4, its readings go to NO DATA, and the network count drops to 3 of 4. Missing data is flagged rather than silently filled in.",
    effects: [...n4, { entityId: "GW", kind: "plateau", delta: -1, rise: 1 }],
  },
];

export const LOOP_SECONDS = 360;

// ---------- public-record style reference info (synthetic) ----------

export const WELL_INFO = {
  lease: "Hargrove Ranch", wellNo: "2", api: "42-227-39xxx (synthetic)", leaseId: "51874", district: "08 (Midland)",
  county: "Howard County, TX", field: "Spraberry (Trend Area)", type: "Oil", status: "Producing",
  permit: "8xxxxx (synthetic)", spud: "2014-03-11", completed: "2014-05-02", depth: "9,850 ft TD", formation: "Spraberry / Dean",
  lift: "Rod pump · C-320D-256-120 beam unit", survey: "Sec. 14, Blk 33, T-1-N, T&P RR Co Survey",
  location: "32.19xx° N, 101.43xx° W (synthetic)", lastTest: "W-10 oil well status test · 2026-03-18",
  lastInspection: "2026-06-18 · no violations",
  production: { month: "Sep 2026", oil: 412, gas: 1960, water: 1180 },
};

export const OPERATOR = {
  name: "Caprock Mesa Operating, LLC (fictitious)", p5: "130847", p5Status: "Active · renews Feb 2027",
  assurance: "Blanket bond, $250,000", office: "Midland, TX", fieldOffice: "Big Spring, TX",
  emergency: "(432) 555-0142", pumper: "Contract pumper, Route 6 · daily ≈ 9 a.m.",
  surfaceOwner: "Hargrove family (landowner)",
};

// What each record means, for the well drawer's glossary
export const GLOSSARY: [string, string][] = [
  ["RRC", "Railroad Commission of Texas: the state agency that regulates oil and gas, despite its name."],
  ["API number", "A unique ID for every well drilled in the US. 42 = Texas, then the county code, then the well's number."],
  ["Lease / ID no.", "The RRC's number for the lease. Production is reported per lease, not per well."],
  ["P-5", "The operator's organization report. An active P-5 and financial assurance are required to operate wells in Texas."],
  ["Financial assurance", "A bond or letter of credit so the state can plug the well if the operator can't."],
  ["W-10", "The annual oil well status test, which reports how much the well produces in 24 hours."],
  ["Run ticket", "The record made each time a truck hauls oil from the tanks."],
];

export const NODE_SPECS = {
  board: [
    ["Microcontroller", "ESP32-S3-WROOM-1U: dual-core 240 MHz, 8 MB flash, u.FL connector for an external antenna"],
    ["Radio", "ESP-NOW on 2.4 GHz, long-range (LR) mode · 5 dBi antenna · encrypted, acknowledged packets"],
    ["Sleep", "Deep sleep between samples (≈ 8 µA): CPU and radio off, only the RTC timer and RTC memory stay powered"],
    ["Duty cycle", "Every 5 min: wake → heat gas sensors 45 s → sample 2 s → ESP-NOW send (≈ 1 ms on air) → back to sleep"],
    ["Store & retry", "Unacknowledged readings stay in RTC memory, up to 12, and go with the next send"],
    ["Firmware", "wpnode 1.4.2 · signed OTA updates through the gateway"],
  ],
  power: [
    ["Solar", "6 W monocrystalline, 6 V, tilted 32° south"],
    ["Charger", "MPPT solar charger with LiFePO₄ profile"],
    ["Battery", "2 × 3.2 V 6 Ah LiFePO₄ in parallel · ≈ 3 weeks with no sun"],
    ["Heater switch", "MOSFET cuts power to the gas-sensor heaters while the node sleeps"],
  ],
  housing: [
    ["Enclosure", "IP66 UV-stable polycarbonate, 200 × 150 × 90 mm, light grey"],
    ["Breathing", "M12 ePTFE membrane vent: equalises pressure, lets vapour out, keeps water and dust out"],
    ["Sensor port", "Hydrophobic membrane under a louvred sun shield, facing down"],
    ["Mount", "Stainless band clamps on fence or pipe stand"],
  ],
};

// One row per sensor in a node, for the sensor table
export const NODE_SENSORS: { suffix: string; label: string; part: string; method: string; range: string }[] = [
  { suffix: "", label: "Methane (CH₄)", part: "MOx gas sensor, TGS2611-class", method: "Heated tin-oxide bead whose resistance drops when methane is present", range: "1–10,000 ppm · ±20 % after calibration" },
  { suffix: "-H2S", label: "Hydrogen sulfide", part: "Electrochemical cell", method: "H₂S reacts at an electrode and makes a current proportional to the gas", range: "0–100 ppm · 0.05 ppm resolution" },
  { suffix: "-VOC", label: "VOCs", part: "MOx VOC sensor, SGP-class", method: "Multi-pixel metal-oxide film; reported as isobutylene-equivalent ppb", range: "0–10,000 ppb" },
  { suffix: "-TEMP", label: "Enclosure temperature", part: "BME280", method: "Digital temperature, humidity and pressure, used to correct the gas sensors", range: "−40–85 °C" },
  { suffix: "-RH", label: "Enclosure humidity", part: "BME280", method: "Capacitive humidity", range: "0–100 % RH" },
  { suffix: "-BAT", label: "Battery", part: "ADC on the ESP32", method: "Voltage divider into the ESP32's analog input", range: "2.5–3.65 V" },
  { suffix: "-SOL", label: "Solar input", part: "INA219", method: "Current-sense resistor on the panel lead", range: "0–8 W" },
  { suffix: "-RSSI", label: "Link signal", part: "Measured at gateway", method: "Signal strength of each packet as the gateway receives it", range: "−130 to −30 dBm" },
];

export const GATEWAY_SPECS: [string, string][] = [
  ["Computer", "Raspberry Pi 4 Model B, 4 GB, industrial microSD"],
  ["ESP-NOW bridge", "ESP32-S3 on USB: listens on a fixed channel, acks each node, passes packets to the Pi over serial"],
  ["Antenna", "9 dBi 2.4 GHz fibreglass omni on a 6 m mast · line of sight to the fence"],
  ["Uplink", "LTE Cat-M1 modem; buffers to disk if the cell link drops"],
  ["Power", "Barn 120 V with UPS board and 12 V AGM backup"],
  ["Weather", "Cup anemometer, vane, and temp/humidity/pressure sensor on the same mast"],
];

// ---------- guided tour ----------

export interface TourStep { title: string; body: string; select?: string; seek?: number; pin?: string }

export const TOUR: TourStep[] = [
  { title: "A well pad from above", body: "This is one oil well on a ranch, seen from overhead. The operator owns the well and the equipment; the landowner owns the land. The landowner has put up their own sensors to keep an eye on the pad. Everything here is simulated." },
  { title: "The pumpjack", body: "The 'nodding donkey' rocks a beam that lifts steel rods up and down about 8 times a minute, working a pump about 9,000 ft below. The operator's controller shares its numbers: strokes, motor current, fillage and pressures.", select: "WELL", pin: "WELL" },
  { title: "Public records", body: "Every Texas well has public records at the Railroad Commission: its API number, lease, operator, tests and inspections. The well panel shows what those records say and what each term means.", select: "WELL" },
  { title: "Fenceline emissions nodes", body: "Four small solar-powered boxes on the fence sniff the air for methane, hydrogen sulfide and VOCs. Each has an ESP32 microcontroller that wakes, samples, radios its readings and goes back to sleep.", select: "N1", pin: "N1" },
  { title: "Getting data off the ranch", body: "The nodes can't reach the internet. Each node wakes from deep sleep, takes its readings and fires one short ESP-NOW packet, with no Wi-Fi network to join. An ESP32 at the barn catches it and hands it to a Raspberry Pi, which forwards it over the cell network to this dashboard.", select: "GW", pin: "GW" },
  { title: "Wind decides who sees what", body: "Jumping to a leak: with a south wind the plume drifts north and N1 lights up while the other nodes stay quiet. The blue arrow shows where the air is heading. Watch the plume swing when the front arrives.", seek: 120, select: "N1" },
  { title: "Gate and access", body: "A magnet on the gate tells when it opens. The pumper's daily visit is expected. An opening after hours is flagged so the landowner can check it.", seek: 220, select: "GATE", pin: "GATE" },
  { title: "Watching the watchers", body: "Sensors need care too. Battery, solar, enclosure humidity and radio signal show a node about to fail days ahead, like N3 with its dirty panel.", seek: 300, select: "N3-BAT" },
  { title: "Your turn", body: "Click any marker or area, try a story under Scenarios, filter by category, or open the raw feed below to see every reading as it arrives." },
];
