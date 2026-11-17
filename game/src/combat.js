// Combat: the player's pistol, every bullet in the world, the rival gang that
// guards the warehouse, and the pickups scattered around Solmara — health,
// ammo, cash and the ten sunset postcards.
import { PISTOL, CAR, WANTED, MONEY } from './config.js';
import { range } from './random.js';
import { damageCar } from './vehicles.js';
import { spawnMuzzle, spawnSparks, spawnHit, spawnCash } from './fx.js';
import { addWanted } from './police.js';

/** Is a point inside any building (bullets stop at walls)? */
function inBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** The player fires the pistol toward the aim angle. */
export function playerShoot(state, audio) {
  const player = state.player;
  if (player.car || player.fireTimer > 0) return;
  player.fireTimer = PISTOL.fireDelay;
  if (player.ammo <= 0) {
    state.message = { text: 'Out of ammo — visit Solmara Arms (GUNS on the map).', t: 3, color: '#ff5a4e' };
    if (audio) audio.click();
    return;
  }
  player.ammo -= 1;
  const a = player.aimAngle + (state.rng() - 0.5) * PISTOL.spread;
  state.bullets.push({
    x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
    life: PISTOL.range / 900, from: 'player', damage: PISTOL.damage,
  });
  spawnMuzzle(state, player.x, player.y, a);
  state.alarm = { x: player.x, y: player.y, t: 1.5 };
  state.camera.shake = Math.max(state.camera.shake, 1.5);
  // Firing in sight of the law draws the heat.
  const copNear = state.cops.some((c) => c.state === 'chase' && Math.hypot(player.x - c.x, player.y - c.y) < 480)
    || state.cars.some((c) => c.kind === 'police' && Math.hypot(player.x - c.x, player.y - c.y) < 480);
  if (copNear && player.wanted === 0) addWanted(state, WANTED.gain.shootNearCop, audio);
  if (audio) audio.shoot();
}

/** Move every bullet and resolve what it hits. */
export function updateBullets(state, dt, audio) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && inBuilding(state.city, b.x, b.y)) {
      spawnSparks(state, b.x, b.y, 3);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const ped of state.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 15) {
          ped.state = 'down';
          ped.downTimer = 9;
          addWanted(state, WANTED.gain.killPed, audio);
          spawnHit(state, ped.x, ped.y);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const cop of state.cops) {
        if (cop.state !== 'down' && Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
          cop.health -= b.damage;
          spawnHit(state, cop.x, cop.y);
          dead = true;
          if (cop.health <= 0) {
            cop.state = 'down';
            cop.downTimer = 9;
            addWanted(state, WANTED.gain.killCop, audio);
          } else {
            addWanted(state, WANTED.gain.shootCop, audio);
          }
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const g of state.gang) {
        if (g.state !== 'down' && Math.hypot(g.x - b.x, g.y - b.y) < 15) {
          g.health -= b.damage;
          spawnHit(state, g.x, g.y);
          dead = true;
          if (g.health <= 0) {
            g.state = 'down';
            g.downTimer = 12;
            player.money += MONEY.killGang;
            state.stats.gangKills += 1;
            if (state.mission) state.mission.kills += 1;
            state.message = { text: `Viper down! +$${MONEY.killGang}`, t: 1.5, color: '#7ee787' };
          }
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < CAR.radius) {
          damageCar(state, car, b.damage * 0.25, audio);
          spawnSparks(state, b.x, b.y, 3);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from !== 'player' && !player.car) {
      if (Math.hypot(player.x - b.x, player.y - b.y) < 15) {
        hurtPlayer(state, b.damage, audio);
        spawnHit(state, player.x, player.y);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Damage the player: armor soaks it first, then health. */
export function hurtPlayer(state, amount, audio) {
  const player = state.player;
  if (player.armor > 0) {
    const soaked = Math.min(player.armor, amount);
    player.armor -= soaked;
    amount -= soaked;
  }
  player.health -= amount;
  state.hurtFlash = 1;
  state.camera.shake = Math.max(state.camera.shake, 3);
}

/** A Viper gang member, guarding the warehouse during The Big Score. */
export function createGangMember(state, x, y) {
  return { x, y, angle: 0, health: 60, state: 'idle', shootTimer: range(state.rng, 0.3, 1), downTimer: 0 };
}

/** Gang AI: idle until the player is near, then shoot. */
export function updateGang(state, dt, audio) {
  const player = state.player;
  for (const g of state.gang) {
    if (g.state === 'down') {
      g.downTimer -= dt;
      continue;
    }
    const d = Math.hypot(player.x - g.x, player.y - g.y);
    if (d < 480) g.state = 'combat';
    if (g.state !== 'combat') continue;
    g.angle = Math.atan2(player.y - g.y, player.x - g.x);
    // Close in if far, hold ground if near.
    if (d > 300) {
      g.x += Math.cos(g.angle) * 130 * dt;
      g.y += Math.sin(g.angle) * 130 * dt;
    }
    g.shootTimer -= dt;
    if (g.shootTimer <= 0 && d < 460) {
      g.shootTimer = 0.8 + state.rng() * 0.5;
      const a = g.angle + (state.rng() - 0.5) * 0.24;
      state.bullets.push({
        x: g.x + Math.cos(a) * 18, y: g.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        life: 0.8, from: 'gang', damage: 8,
      });
      spawnMuzzle(state, g.x, g.y, a);
      if (audio) audio.shoot();
    }
  }
  state.gang = state.gang.filter((g) => !(g.state === 'down' && g.downTimer <= 0));
}

/** Postcard spots: ten scenic corners of the city. */
const POSTCARDS = [
  [290, 2140], [900, 2160], [1550, 2140], [2200, 2150], [2900, 2120],
  [950, 550], [1750, 1350], [2600, 1980], [470, 560], [2280, 470],
];

/** Health, ammo, cash and postcards, placed at boot. */
export function spawnPickups(state) {
  const rng = state.rng;
  const spots = [
    ['health', 700, 1480], ['health', 1550, 560], ['health', 1150, 1010],
    ['health', 2600, 1980], ['health', 560, 1780], ['health', 2280, 470],
    ['ammo', 1950, 1010], ['ammo', 470, 560], ['ammo', 1480, 1700],
    ['ammo', 950, 550], ['ammo', 1750, 1350], ['ammo', 2600, 1980],
  ];
  for (const [kind, x, y] of spots) {
    state.pickups.push({ x: x + range(rng, -30, 30), y: y + range(rng, -30, 30), kind, value: kind === 'health' ? 50 : 24, bob: rng() * 6 });
  }
  for (let i = 0; i < 8; i += 1) {
    state.pickups.push({
      x: range(rng, 100, 3000), y: range(rng, 100, 2000), kind: 'cash',
      value: 25 + Math.floor(rng() * 4) * 25, bob: rng() * 6,
    });
  }
  for (let i = 0; i < POSTCARDS.length; i += 1) {
    const [x, y] = POSTCARDS[i];
    state.pickups.push({ x, y, kind: 'postcard', value: MONEY.postcard, bob: rng() * 6, pid: i });
  }
}

/** The player walks over a pickup: collect it. */
export function updatePickups(state, audio) {
  const player = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.pickups[i];
    p.bob += 0.06;
    if (player.car) continue;
    if (Math.hypot(player.x - p.x, player.y - p.y) > 30) continue;
    if (p.kind === 'health') {
      if (player.health >= 100) continue;
      player.health = Math.min(100, player.health + p.value);
      state.message = { text: `Health +${p.value}`, t: 2, color: '#7ee787' };
    } else if (p.kind === 'ammo') {
      player.reserve += p.value;
      state.message = { text: `Ammo +${p.value}`, t: 2, color: '#7ee787' };
    } else if (p.kind === 'cash') {
      if (p.missionCash) {
        state.message = { text: "The Vipers' cash — get it to the garage!", t: 3, color: '#ffd23f' };
      } else {
        player.money += p.value;
        state.message = { text: `Found $${p.value}!`, t: 2, color: '#7ee787' };
      }
      spawnCash(state, p.x, p.y);
    } else if (p.kind === 'postcard') {
      player.money += p.value;
      state.stats.postcards += 1;
      if (typeof p.pid === 'number') state.stats.postcardIds.push(p.pid);
      spawnCash(state, p.x, p.y);
      state.message = { text: `Postcard ${state.stats.postcards}/10 — +$${p.value}`, t: 2.5, color: '#ffd23f' };
    }
    if (audio) audio.pickup();
    state.pickups.splice(i, 1);
  }
}
