// Pedestrians: the city's people. They stroll the sidewalks, turn at
// intersections, and run for their lives when shots are fired or a car bears
// down on them. Knocked down by a car, they stay down — and the police notice.
import { PEDS, ROADS, WANTED } from './config.js';
import { range, pick, chance } from './random.js';
import { collideCircle, randomSidewalkPoint, nearestRoadPoint } from './city.js';

const SHIRTS = ['#e85d75', '#5d8fe8', '#e8b25d', '#5dbb7a', '#9a5de8', '#e8e8e8', '#5dc4e8', '#e85da8'];
const PANTS = ['#2e3440', '#4a3b2a', '#3a4a6b', '#5a5a5a'];

/** Make a pedestrian strolling a sidewalk near the camera. */
export function createPed(state, x, y) {
  const p = nearestRoadPoint(x, y);
  return {
    x, y,
    angle: state.rng() * Math.PI * 2,
    speed: range(state.rng, PEDS.walkMin, PEDS.walkMax),
    state: 'walk',
    shirt: pick(state.rng, SHIRTS),
    pants: pick(state.rng, PANTS),
    walkPhase: state.rng() * Math.PI * 2,
    fleeTimer: 0,
    downTimer: 0,
    axis: p.axis,
    road: p.road,
    dir: chance(state.rng, 0.5) ? 1 : -1,
  };
}

/** Keep the sidewalks near the camera populated. */
export function updatePeds(state, dt) {
  const cam = state.camera;
  const alive = state.peds.filter((p) => p.state !== 'down');
  if (alive.length < PEDS.max) {
    const p = randomSidewalkPoint(state.rng, cam.x, cam.y, PEDS.spawnMin, PEDS.spawnMax);
    state.peds.push(createPed(state, p.x, p.y));
  }
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      continue;
    }
    // A fresh alarm (gunfire, explosion) near a ped sends it running.
    const alarm = state.alarm;
    if (alarm && alarm.t > 0 && Math.hypot(ped.x - alarm.x, ped.y - alarm.y) < 420) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
      ped.angle = Math.atan2(ped.y - alarm.y, ped.x - alarm.x);
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const nx = ped.x + Math.cos(ped.angle) * PEDS.fleeSpeed * dt;
      const ny = ped.y + Math.sin(ped.angle) * PEDS.fleeSpeed * dt;
      const fixed = collideCircle(state.city, nx, ny, 12);
      ped.x = fixed.x;
      ped.y = fixed.y;
      ped.walkPhase += dt * 14;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        const p = nearestRoadPoint(ped.x, ped.y);
        ped.axis = p.axis;
        ped.road = p.road;
        ped.dir = chance(state.rng, 0.5) ? 1 : -1;
      }
      continue;
    }
    // Stroll the sidewalk: follow the lane, turn at intersections sometimes.
    const off = ROADS.width / 2 + ROADS.sidewalk / 2;
    let tx;
    let ty;
    if (ped.axis === 'v') {
      tx = ped.road + (ped.dir === 1 ? off : -off);
      ty = ped.y + ped.dir * 60;
    } else {
      tx = ped.x + ped.dir * 60;
      ty = ped.road + (ped.dir === 1 ? off : -off);
    }
    const cross = ped.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
    const along = ped.axis === 'v' ? ped.y : ped.x;
    for (const c of cross) {
      if (Math.abs(along - c) < 10 && chance(state.rng, 0.02)) {
        ped.axis = ped.axis === 'v' ? 'h' : 'v';
        ped.road = c;
        ped.dir = chance(state.rng, 0.5) ? 1 : -1;
        break;
      }
    }
    const desired = Math.atan2(ty - ped.y, tx - ped.x);
    let diff = desired - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    const fixed = collideCircle(state.city, nx, ny, 12);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.walkPhase += dt * 8;
  }
  // The down fade away; the far away are recycled.
  state.peds = state.peds.filter((p) => {
    if (p.state === 'down') return p.downTimer > 0;
    return Math.hypot(p.x - cam.x, p.y - cam.y) < PEDS.despawn;
  });
}

/** A car hit a pedestrian: they go down, and the law takes note. */
export function hitPed(state, ped, byPlayer, audio) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 9;
  if (byPlayer) {
    state.player.wanted = Math.min(WANTED.max, state.player.wanted + WANTED.gain.killPed);
    state.message = { text: 'Pedestrian down! The cops are coming.', t: 3, color: '#ff5a4e' };
    if (audio) audio.crash(false);
  }
}
