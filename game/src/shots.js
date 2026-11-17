// The screenshot scenes behind ?shot=chase|drive|city|mission. Each one sets
// the world up from a fresh seeded state — the player driving, the police in
// pursuit, a mission running — then plays the real rules forward for a few
// seconds with a scripted driver, so the frame is what the game really looks
// like and the same seed always gives the same frame.
import { STEP, ROADS, PLACES } from './config.js';
import { stepWorld } from './world.js';
import { createCar } from './vehicles.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY } from './render.js';

/** A scripted driver: throttle, steering and (on foot) firing, fixed per scene. */
function scriptInput(opts) {
  return {
    move: () => opts.move ?? { x: 0, y: 0 },
    throttle: () => opts.throttle ?? 0,
    steer: () => opts.steer ?? 0,
    sprint: () => opts.sprint ?? false,
    handbrake: () => opts.handbrake ?? false,
    firing: () => opts.firing ?? false,
    mouse: () => ({ x: 640, y: 300 }),
  };
}

/** Run the world forward for `seconds` with the given scripted input. */
function playFor(state, seconds, input) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(state, input, null, STEP);
}

/** Steer a car toward a road line while holding the throttle. */
function roadDriver(state, roadY) {
  return {
    move: () => ({ x: 0, y: 0 }),
    throttle: () => 1,
    steer: () => {
      const car = state.player.car;
      if (!car) return 0;
      const dy = roadY - car.y;
      // Steer toward the road centre, and keep the heading east.
      let s = dy * 0.01;
      let dh = 0 - car.angle;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      s += dh * 1.5;
      return Math.max(-1, Math.min(1, s));
    },
    sprint: () => false,
    handbrake: () => false,
    firing: () => false,
    mouse: () => ({ x: 640, y: 300 }),
  };
}

/** The cover: a three-star police chase down the main drag, mid-mission. */
function stageChase(state) {
  const roadY = 1150;
  const car = createCar(state.rng, { x: 750, y: roadY + 26, angle: 0, kind: 'player', type: 'sport', color: '#f2c230' });
  car.speed = 420;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  // Three police cars in pursuit, one cutting in ahead.
  const spots = [
    { x: 550, y: roadY - 26 },
    { x: 430, y: roadY + 26 },
    { x: 280, y: roadY - 26 },
    { x: 1300, y: roadY - 26 },
  ];
  for (const s of spots) {
    const cop = createCar(state.rng, { x: s.x, y: s.y, angle: 0, kind: 'police', type: 'police' });
    cop.speed = 480;
    state.cars.push(cop);
  }
  // Traffic to weave through.
  for (const s of [{ x: 1100, y: roadY + 26 }, { x: 1600, y: roadY - 26 }]) {
    const t = createCar(state.rng, { x: s.x, y: s.y, angle: 0, kind: 'traffic', axis: 'h', road: roadY, dir: 1 });
    t.speed = t.cruise;
    state.cars.push(t);
  }
  // The Getaway, mid-survival: objective + timer on the HUD.
  const def = { id: 'getaway', title: 'The Getaway', giver: 'Marisol Vega', reward: 700,
    intro: ['MARISOL: The deal went south — the whole PD is on us!'],
    objectives: [{ type: 'survive', seconds: 60, text: 'Survive the heat for 60 seconds', wanted: 2 }],
    outro: '' };
  startMission(state, def, null);
  state.mission.timer = 41;
  state.player.wanted = 3;
  state.dialogue = null;
  state.camera.x = car.x;
  state.camera.y = car.y;
  playFor(state, 2.6, roadDriver(state, roadY));
}

/** Cruising the city in traffic, a delivery on the clock. */
function stageDrive(state) {
  const roadX = 1550;
  const car = createCar(state.rng, { x: roadX + 26, y: 320, angle: Math.PI / 2, kind: 'player', type: 'sedan', color: '#3d7ac9' });
  car.speed = 380;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  for (const s of [
    { x: roadX - 26, y: 900, axis: 'v', road: roadX, dir: -1, angle: -Math.PI / 2 },
    { x: roadX + 26, y: 1300, axis: 'v', road: roadX, dir: 1, angle: Math.PI / 2 },
    { x: 1150, y: 750 + 26, axis: 'h', road: 750, dir: 1, angle: 0 },
  ]) {
    const t = createCar(state.rng, { x: s.x, y: s.y, angle: s.angle, kind: 'traffic', axis: s.axis, road: s.road, dir: s.dir });
    t.speed = t.cruise;
    state.cars.push(t);
  }
  const def = { id: 'delivery', title: 'First Delivery', giver: 'Marisol Vega', reward: 300,
    intro: ['MARISOL: Take this package to the Marina. Ninety seconds.'],
    objectives: [{ type: 'goto', loc: 'marina', text: 'Deliver the package to the Marina docks', timer: 90 }],
    outro: '' };
  startMission(state, def, null);
  state.mission.timer = 62;
  state.dialogue = null;
  state.camera.x = car.x;
  state.camera.y = car.y;
  const driver = {
    move: () => ({ x: 0, y: 0 }),
    throttle: () => 1,
    steer: () => {
      const c = state.player.car;
      if (!c) return 0;
      const dx = roadX + 26 - c.x;
      let dh = Math.PI / 2 - c.angle;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      return Math.max(-1, Math.min(1, dx * 0.01 + dh * 1.5));
    },
    sprint: () => false,
    handbrake: () => false,
    firing: () => false,
    mouse: () => ({ x: 640, y: 300 }),
  };
  playFor(state, 2.2, driver);
}

/** On foot in the city: the plaza, the people, the parked cars. */
function stageCity(state) {
  const plaza = PLACES.plaza;
  state.player.x = plaza.x - 60;
  state.player.y = plaza.y + 40;
  state.player.angle = 0.4;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  playFor(state, 2, scriptInput({}));
}

/** The Big Score: a gunfight at the warehouse, one Viper already down. */
function stageMission(state) {
  const w = PLACES.warehouse;
  const def = { id: 'bigscore', title: 'The Big Score', giver: 'Marisol Vega', reward: 1500,
    intro: ['MARISOL: The Vipers took my money. Take it back, Kai. All of it.'],
    objectives: [
      { type: 'goto', loc: 'warehouse', text: 'Get to the old warehouse' },
      { type: 'kill', count: 6, text: 'Clear out the Vipers (0/6)' },
      { type: 'pickup', kind: 'cash', text: 'Grab the cash' },
      { type: 'deliver', loc: 'garage', text: 'Get the money back to Vega\'s Garage' },
    ],
    outro: '' };
  startMission(state, def, null);
  state.mission.step = 1;
  state.mission.kills = 1;
  // One Viper down, the rest in combat.
  if (state.gang[0]) {
    state.gang[0].state = 'down';
    state.gang[0].downTimer = 12;
  }
  for (const g of state.gang) if (g.state !== 'down') g.state = 'combat';
  state.player.x = w.x - 190;
  state.player.y = w.y + 60;
  state.player.health = 82;
  state.player.ammo = 9;
  state.player.aimAngle = Math.atan2(w.y - state.player.y, w.x - state.player.x);
  state.player.angle = state.player.aimAngle;
  state.camera.x = state.player.x + 60;
  state.camera.y = state.player.y;
  state.dialogue = { lines: ['MARISOL: Take it back, Kai. All of it.'], i: 0, t: 4 };
  // A few shots fired for muzzle flashes and tracers.
  playFor(state, 1.6, scriptInput({ firing: true }));
}

/**
 * Set `state` to the named scene (chase, drive, city or mission; any other
 * name is city) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'chase') stageChase(state);
  else if (name === 'drive') stageDrive(state);
  else if (name === 'mission') stageMission(state);
  else stageCity(state);
  return { screen: SCREEN_PLAY };
}
