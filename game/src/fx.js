// Particles and skid marks: smoke, sparks, muzzle flashes, explosions, cash
// sparkles. Pure data — the renderer draws them; this module spawns and ages them.
import { range } from './random.js';

function push(state, p) {
  if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
  state.particles.push(p);
}

export function spawnSmoke(state, x, y, n = 1) {
  for (let i = 0; i < n; i += 1) {
    push(state, {
      x: x + range(state.rng, -8, 8), y: y + range(state.rng, -8, 8),
      vx: range(state.rng, -12, 12), vy: range(state.rng, -42, -18),
      life: range(state.rng, 0.5, 1.1), maxLife: 1.1,
      size: range(state.rng, 6, 12), color: '#8a8a8a', fade: true,
    });
  }
}

export function spawnSparks(state, x, y, n = 6) {
  for (let i = 0; i < n; i += 1) {
    const a = range(state.rng, 0, Math.PI * 2);
    const s = range(state.rng, 60, 260);
    push(state, {
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(state.rng, 0.15, 0.4), maxLife: 0.4,
      size: range(state.rng, 2, 4), color: '#ffd23f', fade: true,
    });
  }
}

export function spawnMuzzle(state, x, y, angle) {
  push(state, {
    x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
    life: 0.07, maxLife: 0.07, size: 9, color: '#ffe066', fade: false,
  });
}

export function spawnHit(state, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const a = range(state.rng, 0, Math.PI * 2);
    const s = range(state.rng, 40, 160);
    push(state, {
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(state.rng, 0.2, 0.45), maxLife: 0.45,
      size: range(state.rng, 2, 5), color: '#ff5a4e', fade: true,
    });
  }
}

export function spawnExplosion(state, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const a = range(state.rng, 0, Math.PI * 2);
    const s = range(state.rng, 60, 340);
    push(state, {
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(state.rng, 0.3, 0.8), maxLife: 0.8,
      size: range(state.rng, 5, 14), color: i % 3 === 0 ? '#ff8c1a' : '#ffd23f', fade: true,
    });
  }
  for (let i = 0; i < 10; i += 1) spawnSmoke(state, x, y, 1);
}

export function spawnCash(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = range(state.rng, 0, Math.PI * 2);
    const s = range(state.rng, 30, 120);
    push(state, {
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
      life: range(state.rng, 0.4, 0.8), maxLife: 0.8,
      size: range(state.rng, 3, 5), color: '#7ee787', fade: true,
    });
  }
}

/** A fading tyre mark left by a drifting or handbraking car. */
export function addSkid(state, x, y, angle) {
  if (state.skids.length > 200) state.skids.splice(0, state.skids.length - 200);
  state.skids.push({ x, y, angle, life: 4 });
}

export function updateParticles(state, dt) {
  const parts = state.particles;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
  }
  const skids = state.skids;
  for (let i = skids.length - 1; i >= 0; i -= 1) {
    skids[i].life -= dt;
    if (skids[i].life <= 0) skids.splice(i, 1);
  }
}
