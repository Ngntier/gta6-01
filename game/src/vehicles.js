// Cars: arcade driving physics, parked cars to steal, and the traffic that
// fills the roads. Traffic cars follow their lane, brake for what is ahead and
// turn at intersections; police cars are made here too and driven by police.js.
import { CAR, TRAFFIC, ROADS, WORLD, PLACES } from './config.js';
import { range, pick, chance } from './random.js';
import { collideCircle, randomRoadPoint } from './city.js';
import { spawnSmoke, spawnSparks, spawnExplosion, addSkid } from './fx.js';

let nextCarId = 1;

export function carType(type) {
  return CAR.types[type] ?? CAR.types.sedan;
}

/** Make a car. kind: 'traffic' | 'police' | 'parked' | 'player' | 'mission'. */
export function createCar(rng, opts) {
  const type = opts.type ?? pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'truck', 'classic']);
  const spec = carType(type);
  const car = {
    id: nextCarId,
    type,
    name: spec.name,
    color: opts.color ?? (type === 'taxi' ? '#f2d230' : type === 'police' ? '#20242c' : pick(rng, CAR.palette)),
    x: opts.x, y: opts.y, angle: opts.angle ?? 0, speed: 0,
    health: CAR.health, maxHealth: CAR.health,
    kind: opts.kind ?? 'traffic',
    driver: opts.kind !== 'parked',
    axis: opts.axis ?? 'h', road: opts.road ?? 0, dir: opts.dir ?? 1,
    cruise: range(rng, TRAFFIC.cruiseMin, TRAFFIC.cruiseMax),
    wrecked: false, burnTimer: 0, smokeTimer: 0, honkTimer: 0, hitCooldown: 0,
    sirenPhase: rng() * Math.PI * 2,
  };
  nextCarId += 1;
  return car;
}

/** Parked cars along the curbs and the hotel lot — including the Comet GT. */
export function spawnParkedCars(state) {
  const rng = state.rng;
  const spots = [];
  for (let i = 0; i < 12; i += 1) {
    if (chance(rng, 0.5)) {
      const road = pick(rng, ROADS.vertical);
      spots.push({ x: road + (chance(rng, 0.5) ? 1 : -1) * (ROADS.width / 2 - 22), y: range(rng, 120, WORLD.beachY - 120), angle: chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2 });
    } else {
      const road = pick(rng, ROADS.horizontal);
      spots.push({ x: range(rng, 120, WORLD.width - 120), y: road + (chance(rng, 0.5) ? 1 : -1) * (ROADS.width / 2 - 22), angle: chance(rng, 0.5) ? 0 : Math.PI });
    }
  }
  // The hotel car park: two rows, the yellow Comet GT among them.
  const lotX = 2020;
  const lotY = 430;
  for (let i = 0; i < 5; i += 1) {
    spots.push({ x: lotX + i * 56, y: lotY, angle: Math.PI / 2 });
  }
  for (const s of spots) {
    const car = createCar(rng, { ...s, kind: 'parked' });
    state.cars.push(car);
  }
  const comet = createCar(rng, { x: lotX + 2 * 56, y: lotY + 60, angle: Math.PI / 2, kind: 'mission', type: 'sport', color: '#f2c230' });
  comet.id = 'comet';
  state.cars.push(comet);
}

/** Keep the roads full: spawn traffic near the camera, despawn it far away. */
export function updateTraffic(state, dt, audio) {
  const cam = state.camera;
  const traffic = state.cars.filter((c) => c.kind === 'traffic');
  if (traffic.length < TRAFFIC.maxCars) {
    const p = randomRoadPoint(state.rng, cam.x, cam.y, TRAFFIC.spawnMin, TRAFFIC.spawnMax);
    const dir = chance(state.rng, 0.5) ? 1 : -1;
    const angle = p.axis === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : dir === 1 ? 0 : Math.PI;
    const car = createCar(state.rng, { x: p.x, y: p.y, angle, kind: 'traffic', axis: p.axis, road: p.axis === 'v' ? p.x : p.y, dir });
    car.speed = car.cruise;
    state.cars.push(car);
  }
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    const d = Math.hypot(car.x - cam.x, car.y - cam.y);
    if (d > TRAFFIC.despawn) {
      car.gone = true;
      continue;
    }
    driveTrafficCar(state, car, dt);
  }
  state.cars = state.cars.filter((c) => !c.gone);
}

/** One traffic car's brain: follow the lane, brake for trouble, turn sometimes. */
function driveTrafficCar(state, car, dt) {
  const lane = 26;
  // The lane centre ahead of the car.
  let tx;
  let ty;
  if (car.axis === 'v') {
    tx = car.road + (car.dir === 1 ? lane : -lane);
    ty = car.y + car.dir * 140;
  } else {
    tx = car.x + car.dir * 140;
    ty = car.road + (car.dir === 1 ? lane : -lane);
  }
  // At an intersection, sometimes turn onto the crossing road.
  const cross = car.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
  const along = car.axis === 'v' ? car.y : car.x;
  for (const c of cross) {
    if (Math.abs(along - c) < 14 && chance(state.rng, 0.02)) {
      car.axis = car.axis === 'v' ? 'h' : 'v';
      car.road = c;
      car.dir = chance(state.rng, 0.5) ? 1 : -1;
      break;
    }
  }
  // Brake for a car or a pedestrian straight ahead.
  let blocked = false;
  const aheadX = car.x + Math.cos(car.angle) * 70;
  const aheadY = car.y + Math.sin(car.angle) * 70;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 46) {
      blocked = true;
      break;
    }
  }
  if (!blocked) {
    for (const ped of state.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - aheadX, ped.y - aheadY) < 34) {
        blocked = true;
        break;
      }
    }
  }
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const throttle = blocked ? 0 : car.speed < car.cruise ? 1 : 0;
  const brake = blocked && car.speed > 30;
  driveCar(state, car, dt, brake ? -1 : throttle, steer, false, null);
}

/**
 * Arcade car physics: throttle, steering that bites less at speed, drag, and a
 * handbrake that slides the car. Moves the car and resolves building hits.
 * Returns the impact speed of any building hit (0 when none).
 */
export function driveCar(state, car, dt, throttle, steer, handbrake, audio) {
  const spec = carType(car.type);
  if (car.wrecked) {
    car.speed *= 1 - 3 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    return 0;
  }
  if (throttle !== 0 && Math.sign(throttle) !== Math.sign(car.speed) && Math.abs(car.speed) > 24) {
    // Throttle against the motion is a brake.
    car.speed -= Math.sign(car.speed) * 760 * dt;
  } else if (throttle > 0) {
    car.speed += spec.accel * dt;
  } else if (throttle < 0) {
    car.speed -= spec.reverse * 2.4 * dt;
  }
  car.speed -= car.speed * (handbrake ? 1.7 : 0.32) * dt;
  if (car.speed > spec.maxSpeed) car.speed = spec.maxSpeed;
  if (car.speed < -spec.reverse) car.speed = -spec.reverse;
  const sf = car.speed >= 0 ? 1 : -1;
  const speedFactor = Math.min(1, Math.abs(car.speed) / 230);
  car.angle += steer * spec.grip * speedFactor * sf * dt * (handbrake ? 1.6 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideCircle(state.city, nx, ny, CAR.radius);
  const impact = Math.hypot(nx - fixed.x, ny - fixed.y) > 0.5 ? Math.abs(car.speed) : 0;
  car.x = fixed.x;
  car.y = fixed.y;
  if (impact > 0) {
    car.speed *= 0.35;
    // Damage at most once per half second: grinding along a wall is one crash.
    if (car.hitCooldown <= 0) {
      car.hitCooldown = 0.5;
      damageCar(state, car, impact * 0.055, audio);
      if (impact > 120) {
        spawnSparks(state, car.x, car.y, 8);
        if (audio) audio.crash(impact > 300);
      }
    }
  }
  if (handbrake && Math.abs(car.speed) > 200 && state.rng() < 0.5) {
    addSkid(state, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, car.angle);
  }
  return impact;
}

/** Damage a car; at zero health it becomes a wreck, then burns and explodes. */
export function damageCar(state, car, amount, audio) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.burnTimer = 4;
    car.speed *= 0.3;
    spawnSmoke(state, car.x, car.y, 8);
    if (state.player.car === car) {
      // The player's car died under them: step out.
      state.player.car = null;
      state.player.x = car.x + 40;
      state.player.y = car.y + 40;
    }
  }
}

/** Burning wrecks smoke, then explode and hurt whatever is near. */
export function updateWrecks(state, dt, audio) {
  for (const car of state.cars) {
    if (!car.wrecked) continue;
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      spawnSmoke(state, car.x, car.y, 1);
    }
    if (car.burnTimer > 0) {
      car.burnTimer -= dt;
      if (car.burnTimer <= 0) {
        car.burnTimer = -1;
        spawnExplosion(state, car.x, car.y);
        state.camera.shake = Math.max(state.camera.shake, 10);
        if (audio) audio.explosion();
        // Blast hurts the player and nearby peds.
        if (Math.hypot(state.player.x - car.x, state.player.y - car.y) < 130) {
          state.player.health -= 45;
        }
        for (const ped of state.peds) {
          if (Math.hypot(ped.x - car.x, ped.y - car.y) < 130) ped.state = 'down';
        }
      }
    }
  }
  // Burnt-out wrecks fade away once far from the camera.
  state.cars = state.cars.filter((c) => {
    if (!c.wrecked || c.burnTimer > 0) return true;
    return Math.hypot(c.x - state.camera.x, c.y - state.camera.y) < 900;
  });
}

/** Circle-vs-circle collisions between cars: bounce, damage, sparks. */
export function resolveCarCollisions(state, audio, dt) {
  const cars = state.cars;
  for (const car of cars) car.hitCooldown = Math.max(0, (car.hitCooldown ?? 0) - dt);
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = CAR.radius * 2 - 6;
      if (d >= min || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (min - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const relSpeed = Math.abs(a.speed - b.speed);
      const push = 60 + relSpeed * 0.25;
      a.speed -= push * 0.5;
      b.speed += push * 0.5;
      // Damage at most once per 0.6 s per car: a shove is one hit, not sixty.
      if (relSpeed > 90 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
        a.hitCooldown = 0.6;
        b.hitCooldown = 0.6;
        damageCar(state, a, relSpeed * 0.03, audio);
        damageCar(state, b, relSpeed * 0.03, audio);
        spawnSparks(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 5);
        if (audio) audio.crash(relSpeed > 260);
      }
    }
  }
}

/** The nearest car to a point, within maxD, optionally filtered. */
export function nearestCar(state, x, y, maxD, filter) {
  let best = null;
  let bd = maxD;
  for (const car of state.cars) {
    if (filter && !filter(car)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) {
      bd = d;
      best = car;
    }
  }
  return best;
}
