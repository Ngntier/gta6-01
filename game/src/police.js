// The law: wanted stars, the police cars that chase the player, the foot cops
// who shoot and arrest, and the spray shop that makes the heat go away.
import { COPS, WANTED, PLACES, ROADS } from './config.js';
import { chance } from './random.js';
import { randomRoadPoint, nearestRoadPoint } from './city.js';
import { createCar, driveCar, nearestCar } from './vehicles.js';

/** Raise the wanted level, with a message when it goes up. */
export function addWanted(state, n, audio) {
  const before = state.player.wanted;
  state.player.wanted = Math.min(WANTED.max, before + n);
  if (state.player.wanted > before) {
    state.message = {
      text: state.player.wanted >= 3 ? `WANTED — ${state.player.wanted} STARS! Lose the cops!` : `Wanted level ${state.player.wanted}`,
      t: 3, color: '#ff5a4e',
    };
  }
}

/** A foot cop: runs the player down, shoots, and arrests on foot. */
export function createCop(state, x, y) {
  return {
    x, y, angle: 0, health: 50, state: 'chase',
    shootTimer: 0.5, bustTimer: 0, downTimer: 0,
  };
}

/** The whole police system, run once a step. */
export function updatePolice(state, dt, audio) {
  const player = state.player;
  const wanted = player.wanted;
  const policeCars = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);

  // Spawn police cars up to the wanted level's count.
  const want = wanted > 0 ? WANTED.copCars[wanted] : 0;
  if (policeCars.length < want && state.rng() < 0.5) {
    const p = randomRoadPoint(state.rng, player.x, player.y, 800, 1150);
    const car = createCar(state.rng, { x: p.x, y: p.y, angle: 0, kind: 'police', type: 'police' });
    car.angle = Math.atan2(player.y - p.y, player.x - p.x);
    car.speed = 300;
    state.cars.push(car);
  }

  // Police cars chase the player and ram; near a player on foot, a cop gets out.
  let sirenNear = false;
  for (const car of policeCars) {
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d < 750) sirenNear = true;
    if (wanted === 0) {
      // Heat's off: drive away, then leave.
      driveCar(state, car, dt, 1, 0, false, null);
      if (d > 700) car.gone = true;
      continue;
    }
    const lead = 0.35;
    const px = player.x + (player.car ? Math.cos(player.car.angle) * player.car.speed * lead : 0);
    const py = player.y + (player.car ? Math.sin(player.car.angle) * player.car.speed * lead : 0);
    const desired = Math.atan2(py - car.y, px - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const throttle = d > 60 ? 1 : 0.4;
    driveCar(state, car, dt, throttle, steer, false, audio);
    // Drop a foot cop beside a player on foot.
    if (!player.car && d < 170 && state.cops.filter((c) => c.state === 'chase').length < 3 && chance(state.rng, dt * 0.8)) {
      const cop = createCop(state, car.x + 30, car.y + 30);
      state.cops.push(cop);
    }
  }

  // Foot cops: chase, shoot, arrest.
  for (const cop of state.cops) {
    if (cop.state === 'down') {
      cop.downTimer -= dt;
      continue;
    }
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (wanted === 0 || (player.car && d > 500)) {
      cop.state = 'leaving';
    }
    if (cop.state === 'leaving') {
      // Walk off to the nearest road, then vanish.
      const p = nearestRoadPoint(cop.x, cop.y);
      cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.x += Math.cos(cop.angle) * 200 * dt;
      cop.y += Math.sin(cop.angle) * 200 * dt;
      if (d > 600) cop.gone = true;
      continue;
    }
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    const speed = player.car ? COPS.footSpeed * 0.9 : COPS.footSpeed;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    // Shoot at the player from range.
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0 && d < COPS.shootRange && d > 40) {
      cop.shootTimer = COPS.shootDelay;
      const spread = (state.rng() - 0.5) * 0.22;
      const a = cop.angle + spread;
      state.bullets.push({
        x: cop.x + Math.cos(a) * 18, y: cop.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        life: 0.8, from: 'cop', damage: 7,
      });
      if (audio) audio.shoot();
    }
    // Arrest: close and slow on foot.
    if (!player.car && d < COPS.bustRange) {
      const playerSpeed = Math.hypot(player.vx, player.vy);
      if (playerSpeed < 60) {
        cop.bustTimer += dt;
        if (cop.bustTimer > COPS.bustTime) player.busted = true;
      } else {
        cop.bustTimer = 0;
      }
    } else {
      cop.bustTimer = 0;
    }
  }
  state.cops = state.cops.filter((c) => !c.gone && !(c.state === 'down' && c.downTimer <= 0));

  // Wanted decay: unseen for a while, the heat cools off one star at a time.
  const seen = policeCars.some((c) => Math.hypot(player.x - c.x, player.y - c.y) < 480)
    || state.cops.some((c) => c.state === 'chase' && Math.hypot(player.x - c.x, player.y - c.y) < 480);
  if (wanted > 0) {
    if (seen) {
      state.unseenTimer = 0;
    } else {
      state.unseenTimer += dt;
      if (state.unseenTimer > WANTED.decayDelay) {
        state.unseenTimer = WANTED.decayDelay - WANTED.decayEvery;
        player.wanted -= 1;
        state.message = { text: player.wanted > 0 ? `Heat cooling off — ${player.wanted} star${player.wanted === 1 ? '' : 's'} left` : 'You lost the cops!', t: 2.5, color: '#7ee787' };
      }
    }
  }

  // The spray shop: drive in, pay up, come out clean.
  const spray = PLACES.respray;
  const inSpray = player.car && Math.hypot(player.x - spray.x, player.y - spray.y) < 80;
  if (inSpray && wanted > 0 && state.sprayCooldown <= 0) {
    if (player.money >= WANTED.resprayCost) {
      player.money -= WANTED.resprayCost;
      player.wanted = 0;
      player.car.color = '#4fa8a0';
      player.car.health = player.car.maxHealth;
      state.sprayCooldown = 5;
      state.message = { text: 'Fresh paint, clean record. -$150', t: 3, color: '#7ee787' };
      if (audio) audio.cash();
    } else {
      state.sprayCooldown = 5;
      state.message = { text: `The spray shop wants $${WANTED.resprayCost} — you're short.`, t: 3, color: '#ff5a4e' };
    }
  }
  state.sprayCooldown = Math.max(0, state.sprayCooldown - dt);

  if (audio) audio.siren(sirenNear && wanted > 0);
}
