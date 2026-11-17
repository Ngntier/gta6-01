// The world: all game state in one object, the player on foot and behind the
// wheel, entering and stealing cars, talking to the city (missions, the gun
// shop, the hospital), and the one step function that runs every system.
import { STEP, WORLD, PLAYER, PISTOL, CAR, WANTED, PLACES, CLOCK } from './config.js';
import { generateCity, collideCircle, randomRoadPoint } from './city.js';
import { createCar, driveCar, updateTraffic, updateWrecks, resolveCarCollisions, nearestCar, carType, spawnParkedCars } from './vehicles.js';
import { updatePeds, hitPed, createPed } from './pedestrians.js';
import { updatePolice, addWanted } from './police.js';
import { playerShoot, updateBullets, updateGang, spawnPickups, updatePickups } from './combat.js';
import { startMission, updateMission, nextMission } from './missions.js';
import { updateParticles } from './fx.js';

/** A fresh world: the city, the player at the garage, parked cars, pickups. */
export function createWorld(rng, seed) {
  const city = generateCity(rng);
  const state = {
    rng, seed, time: 0,
    city,
    cars: [], peds: [], cops: [], gang: [], bullets: [],
    particles: [], skids: [], pickups: [],
    player: {
      x: PLACES.garage.x + 60, y: PLACES.garage.y + 40,
      vx: 0, vy: 0, angle: 0, aimAngle: 0,
      health: PLAYER.health, armor: 0, money: PLAYER.startMoney,
      wanted: 0, ammo: PISTOL.startAmmo, reserve: PISTOL.startReserve,
      reloadTimer: 0, fireTimer: 0, car: null, busted: false, wasted: false,
    },
    camera: { x: PLACES.garage.x, y: PLACES.garage.y, zoom: 1, shake: 0 },
    clock: CLOCK.startMinutes,
    mission: null, missionsDone: [],
    stats: { gangKills: 0, postcards: 0, postcardIds: [], missionsStarted: 0, carsStolen: 0 },
    alarm: null, message: null, dialogue: null,
    missionFail: null, missionComplete: null,
    unseenTimer: 0, sprayCooldown: 0, ramCooldown: 0, hurtFlash: 0,
    needSave: false, over: null,
  };
  spawnParkedCars(state);
  spawnPickups(state);
  for (let i = 0; i < 8; i += 1) {
    const p = randomRoadPoint(rng, state.player.x, state.player.y, 250, 900);
    const dir = rng() < 0.5 ? 1 : -1;
    const angle = p.axis === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : dir === 1 ? 0 : Math.PI;
    const car = createCar(rng, { x: p.x, y: p.y, angle, kind: 'traffic', axis: p.axis, road: p.axis === 'v' ? p.x : p.y, dir });
    car.speed = car.cruise;
    state.cars.push(car);
  }
  for (let i = 0; i < 12; i += 1) {
    const p = { x: state.player.x + (rng() - 0.5) * 900, y: state.player.y + (rng() - 0.5) * 900 };
    const fixed = collideCircle(city, p.x, p.y, 12);
    state.peds.push(createPed(state, fixed.x, fixed.y));
  }
  return state;
}

/** Move the player on foot: WASD, sprint, aim at the mouse, collide. */
function stepOnFoot(state, input, dt) {
  const player = state.player;
  const move = input.move();
  const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.vx = move.x * speed;
  player.vy = move.y * speed;
  const nx = player.x + player.vx * dt;
  const ny = player.y + player.vy * dt;
  const fixed = collideCircle(state.city, nx, ny, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  if (input.firing()) player.angle = player.aimAngle;
  else if (move.x !== 0 || move.y !== 0) player.angle = Math.atan2(move.y, move.x);
}

/** Drive the player's car with the arcade physics. */
function stepInCar(state, input, dt, audio) {
  const player = state.player;
  const car = player.car;
  driveCar(state, car, dt, input.throttle(), input.steer(), input.handbrake(), audio);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.vx = Math.cos(car.angle) * car.speed;
  player.vy = Math.sin(car.angle) * car.speed;
  if (audio) audio.engine(Math.min(1, Math.abs(car.speed) / carType(car.type).maxSpeed), true);
}

/** Cars the player left rolling slow down on their own. */
function stepLooseCars(state, dt) {
  for (const car of state.cars) {
    if (car === state.player.car) continue;
    if (car.kind === 'traffic' || car.kind === 'police' || car.wrecked) continue;
    if (Math.abs(car.speed) > 1) driveCar(state, car, dt, 0, 0, false, null);
  }
}

/** The E key: enter or leave a car, start a mission, shop, heal. */
export function interact(state, audio) {
  const player = state.player;
  if (player.car) {
    exitCar(state);
    return;
  }
  const car = nearestCar(state, player.x, player.y, PLAYER.enterRange, (c) => !c.wrecked);
  if (car) {
    enterCar(state, car, audio);
    return;
  }
  const near = (place, r) => Math.hypot(player.x - place.x, player.y - place.y) < r;
  if (near(PLACES.garage, 110) && !state.mission) {
    const next = nextMission(state);
    if (next) {
      startMission(state, next, audio);
    } else {
      state.message = { text: 'Story complete — Solmara is yours. Free roam!', t: 3, color: '#ffd23f' };
    }
    return;
  }
  if (near(PLACES.gunshop, 95)) {
    if (player.money >= 50) {
      player.money -= 50;
      player.reserve += 24;
      state.message = { text: 'Ammo +24 — $50. Stay safe out there.', t: 2.5, color: '#7ee787' };
      if (audio) audio.cash();
    } else {
      state.message = { text: 'Ammo costs $50 — you\'re short.', t: 2.5, color: '#ff5a4e' };
    }
    return;
  }
  if (near(PLACES.hospital, 95)) {
    if (player.health >= 100) {
      state.message = { text: 'You\'re already at full health.', t: 2, color: '#7ee787' };
    } else if (player.money >= 100) {
      player.money -= 100;
      player.health = 100;
      state.message = { text: 'Patched up — $100. Full health.', t: 2.5, color: '#7ee787' };
      if (audio) audio.pickup();
    } else {
      state.message = { text: 'Treatment costs $100 — you\'re short.', t: 2.5, color: '#ff5a4e' };
    }
  }
}

/** Get in a car: parked cars are free, moving ones are a carjacking. */
function enterCar(state, car, audio) {
  const player = state.player;
  const wasTraffic = car.kind === 'traffic' || car.kind === 'police';
  if (wasTraffic) {
    // The driver bails and runs.
    const ped = createPed(state, car.x + 26, car.y + 26);
    ped.state = 'flee';
    ped.fleeTimer = 4;
    ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
    state.peds.push(ped);
    addWanted(state, car.kind === 'police' ? 2 : WANTED.gain.carjack, audio);
    state.stats.carsStolen += 1;
    state.message = { text: car.kind === 'police' ? 'You stole a cop car! Bold.' : 'Carjacked! Hope nobody saw that.', t: 2.5, color: '#ffd23f' };
  }
  car.kind = 'player';
  car.driver = true;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  if (audio) audio.click();
}

/** Step out of the car, beside it. */
function exitCar(state) {
  const player = state.player;
  const car = player.car;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 40;
  player.y = car.y + Math.sin(side) * 40;
  const fixed = collideCircle(state.city, player.x, player.y, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.vx = 0;
  player.vy = 0;
  player.car = null;
}

/** Wasted or busted: lose money, clear the heat, wake up somewhere safe. */
export function respawnPlayer(state, reason) {
  const player = state.player;
  const fine = reason === 'busted' ? WANTED.bustedFine : WANTED.wastedFine;
  player.money = Math.max(0, player.money - fine);
  if (reason === 'busted') player.ammo = Math.max(0, Math.floor(player.ammo / 2));
  player.health = 100;
  player.armor = 0;
  player.wanted = 0;
  player.car = null;
  player.busted = false;
  player.wasted = false;
  state.over = null;
  state.cops = [];
  state.bullets = [];
  const spot = reason === 'busted' ? PLACES.police : PLACES.hospital;
  player.x = spot.x + 40;
  player.y = spot.y + 40;
  state.camera.x = player.x;
  state.camera.y = player.y;
  if (state.mission) {
    state.mission = null;
    state.gang = [];
    state.missionFail = { text: reason === 'busted' ? 'MISSION FAILED — Busted' : 'MISSION FAILED — Wasted', t: 4 };
  }
  state.message = { text: reason === 'busted' ? `Busted! The PD took $${fine}.` : `Wasted! The hospital took $${fine}.`, t: 4, color: '#ff5a4e' };
}

/** Ramming a police car at speed draws the heat. */
function checkRamCop(state, audio) {
  state.ramCooldown = Math.max(0, state.ramCooldown - STEP);
  const car = state.player.car;
  if (!car || state.ramCooldown > 0) return;
  for (const other of state.cars) {
    if (other.kind !== 'police') continue;
    if (Math.hypot(other.x - car.x, other.y - car.y) < 58 && Math.abs(car.speed) > 220) {
      state.ramCooldown = 3;
      addWanted(state, WANTED.gain.ramCop, audio);
      break;
    }
  }
}

/** Cars running over pedestrians. */
function checkPedHits(state, audio) {
  for (const car of state.cars) {
    if (Math.abs(car.speed) < 80) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < CAR.radius + 8) {
        hitPed(state, ped, car === state.player.car, audio);
      }
    }
  }
}

/** One fixed step of the whole simulation. */
export function stepWorld(state, input, audio, dt) {
  const player = state.player;
  state.time += dt;
  state.clock = (state.clock + dt * (24 * 60 / CLOCK.dayLength)) % (24 * 60);
  if (state.alarm) {
    state.alarm.t -= dt;
    if (state.alarm.t <= 0) state.alarm = null;
  }
  if (state.message) {
    state.message.t -= dt;
    if (state.message.t <= 0) state.message = null;
  }
  if (state.dialogue) {
    state.dialogue.t -= dt;
    if (state.dialogue.t <= 0) {
      state.dialogue.i += 1;
      state.dialogue.t = 4;
      if (state.dialogue.i >= state.dialogue.lines.length) state.dialogue = null;
    }
  }
  if (state.missionFail) {
    state.missionFail.t -= dt;
    if (state.missionFail.t <= 0) state.missionFail = null;
  }
  if (state.missionComplete) {
    state.missionComplete.t -= dt;
    if (state.missionComplete.t <= 0) state.missionComplete = null;
  }
  state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2);
  player.fireTimer = Math.max(0, player.fireTimer - dt);

  // Reload: an empty magazine refills from the reserve.
  if (player.ammo === 0 && player.reserve > 0) {
    player.reloadTimer += dt;
    if (player.reloadTimer > 0.9) {
      player.reloadTimer = 0;
      const take = Math.min(PISTOL.magSize, player.reserve);
      player.ammo = take;
      player.reserve -= take;
    }
  } else {
    player.reloadTimer = 0;
  }

  if (state.over) return; // Wasted/busted: the world waits for the respawn.

  if (player.car) stepInCar(state, input, dt, audio);
  else {
    stepOnFoot(state, input, dt);
    if (audio) audio.engine(0, false);
    if (input.firing()) playerShoot(state, audio);
  }
  stepLooseCars(state, dt);
  updateTraffic(state, dt, audio);
  updatePeds(state, dt);
  updatePolice(state, dt, audio);
  updateGang(state, dt, audio);
  updateBullets(state, dt, audio);
  updatePickups(state, audio);
  updateWrecks(state, dt, audio);
  resolveCarCollisions(state, audio, dt);
  checkRamCop(state, audio);
  checkPedHits(state, audio);
  updateMission(state, dt, audio);
  updateParticles(state, dt);

  // Wasted or busted?
  if (player.health <= 0) {
    player.health = 0;
    player.wasted = true;
    state.over = 'wasted';
    if (audio) audio.wasted();
  } else if (player.busted) {
    state.over = 'busted';
    if (audio) audio.wasted();
  }

  // Camera: follow the player with a look-ahead, zoom out in a car.
  const cam = state.camera;
  const lookX = player.x + player.vx * 0.22;
  const lookY = player.y + player.vy * 0.22;
  const k = 1 - Math.exp(-4.5 * dt);
  cam.x += (lookX - cam.x) * k;
  cam.y += (lookY - cam.y) * k;
  const targetZoom = player.car ? 0.8 : 1;
  cam.zoom += (targetZoom - cam.zoom) * (1 - Math.exp(-2.5 * dt));
  cam.shake = Math.max(0, cam.shake - dt * 22);
}
