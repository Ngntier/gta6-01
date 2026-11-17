// SOLMARA — every tuning number, colour and name in one place. The world is a
// fixed 3100x2300 logical city; the renderer scales it to the window, so no rule
// below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** World size in pixels. The beach and sea sit along the south edge. */
export const WORLD = { width: 3100, height: 2300, beachY: 2060, seaY: 2210 };

/** Roads: verticals and horizontals form the city grid; cars and peds travel on them. */
export const ROADS = {
  vertical: [350, 750, 1150, 1550, 1950, 2350, 2750],
  horizontal: [350, 750, 1150, 1550, 1950],
  width: 110,
  sidewalk: 18,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 235,
  sprintSpeed: 350,
  health: 100,
  armor: 0,
  startMoney: 250,
  enterRange: 78,
  punchDamage: 12,
};

export const PISTOL = { name: 'P9 Pistol', damage: 34, range: 520, fireDelay: 0.22, magSize: 12, startAmmo: 12, startReserve: 48, spread: 0.045 };

export const CAR = {
  radius: 26,
  health: 100,
  enterRange: 78,
  types: {
    sedan:   { name: 'Solstice',  maxSpeed: 560, accel: 330, reverse: 200, grip: 2.6, color: '#c94f3d' },
    sport:   { name: 'Comet GT',  maxSpeed: 760, accel: 470, reverse: 220, grip: 3.1, color: '#f2c230' },
    taxi:    { name: 'Cab',       maxSpeed: 540, accel: 320, reverse: 200, grip: 2.6, color: '#f2d230' },
    van:     { name: 'Hauler',    maxSpeed: 470, accel: 260, reverse: 180, grip: 2.2, color: '#7a8a99' },
    truck:   { name: 'Mule',      maxSpeed: 430, accel: 230, reverse: 170, grip: 2.0, color: '#5d7a4f' },
    police:  { name: 'Interceptor', maxSpeed: 700, accel: 460, reverse: 230, grip: 3.0, color: '#20242c' },
    classic: { name: 'Bel Air',   maxSpeed: 500, accel: 300, reverse: 190, grip: 2.4, color: '#3d7ac9' },
  },
  palette: ['#c94f3d', '#3d7ac9', '#e8e4da', '#5d7a4f', '#7a5da8', '#c97a3d', '#4fa8a0', '#a03d5d', '#8a8f96', '#2e6b4f'],
};

export const TRAFFIC = { maxCars: 14, cruiseMin: 170, cruiseMax: 250, spawnMin: 850, spawnMax: 1250, despawn: 1500, turnChance: 0.3 };
export const PEDS = { max: 26, walkMin: 55, walkMax: 95, fleeSpeed: 200, spawnMin: 650, spawnMax: 1100, despawn: 1300 };
export const COPS = { maxCars: 5, footSpeed: 300, shootRange: 380, shootDelay: 0.7, bustRange: 30, bustTime: 1.4, chaseSpeed: 620 };

/** Wanted stars: gain, decay and what each level brings. */
export const WANTED = {
  max: 5,
  decayDelay: 8,
  decayEvery: 6,
  gain: { carjack: 1, killPed: 1, shootCop: 2, killCop: 2, ramCop: 1, shootNearCop: 1 },
  copCars: [0, 2, 3, 4, 5, 5],
  resprayCost: 150,
  bustedFine: 200,
  wastedFine: 150,
};

export const MONEY = { postcard: 50, killGang: 25, missionBonus: 0 };

/** Fixed places in the city, by name. Each is a point the minimap and missions use. */
export const PLACES = {
  garage:    { x: 470,  y: 560,  label: "Vega's Garage",  short: 'GARAGE' },
  marina:    { x: 2600, y: 1980, label: 'Solmara Marina', short: 'MARINA' },
  hotel:     { x: 2280, y: 470,  label: 'The Palms Hotel', short: 'HOTEL' },
  warehouse: { x: 1480, y: 1700, label: 'Old Warehouse',  short: 'WAREHOUSE' },
  safehouse: { x: 560,  y: 1780, label: 'Safehouse',      short: 'SAFEHOUSE' },
  respray:   { x: 1150, y: 1010, label: 'Spray Shop',     short: 'SPRAY' },
  gunshop:   { x: 1950, y: 1010, label: 'Solmara Arms',   short: 'GUNS' },
  hospital:  { x: 700,  y: 1480, label: 'Solmara General', short: 'HOSPITAL' },
  police:    { x: 1550, y: 560,  label: 'Solmara PD',     short: 'POLICE' },
  plaza:     { x: 950,  y: 550,  label: 'Plaza del Sol',  short: 'PLAZA' },
  park:      { x: 1750, y: 1350, label: 'Palm Park',      short: 'PARK' },
  beach:     { x: 1550, y: 2130, label: 'Solmara Beach',  short: 'BEACH' },
};

/** Sun-soaked palette: warm sand, turquoise sea, pastel buildings. */
export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#74a258',
  sand: '#ecd9a0',
  sea: '#2fa8b8',
  seaDeep: '#1f7f96',
  road: '#3a3f4a',
  roadEdge: '#2e323c',
  lane: '#e8e0b0',
  sidewalk: '#b9b3a4',
  curb: '#9a937f',
  buildingRoof: ['#d96b4f', '#e8a34f', '#7fb3d9', '#c9d6df', '#b98ad4', '#8fc97a', '#e87a9a', '#f2e3c9'],
  buildingEdge: '#00000033',
  palm: '#3d8a4f',
  trunk: '#8a6a45',
  player: '#ffd23f',
  playerSkin: '#e8b88a',
  cop: '#2b4f9e',
  gang: '#8a2f2f',
  panel: '#14181fdd',
  panelEdge: '#f2c230',
  text: '#f4f1e6',
  muted: '#b8b2a0',
  money: '#7ee787',
  danger: '#ff5a4e',
  star: '#ffd23f',
  marker: '#ffd23f',
  policeBlip: '#ff4757',
  hud: '#ffffff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Game clock: a full day passes in 12 real minutes; the sun tint follows it. */
export const CLOCK = { dayLength: 720, startMinutes: 10 * 60 + 20 };

/** Where the save game is kept between visits (this browser only). */
export const SAVE_KEY = 'solmara.save.v1';

export const GAME_NAME = 'SOLMARA';
export const GAME_TAGLINE = 'Sun, sand and sin — an open-world crime story';
