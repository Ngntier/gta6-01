// The city of Solmara: a grid of roads, blocks of pastel buildings, a park, a
// plaza, a hotel car park and a beach. Generated once from the seed, then fixed.
// Also the collision and road queries every moving thing in the game uses.
import { WORLD, ROADS, PALETTE } from './config.js';
import { range, int, pick, chance } from './random.js';

const MARGIN = ROADS.width / 2 + ROADS.sidewalk; // road edge to block edge

/** The blocks between the roads, as column and row spans. */
export function blockGrid() {
  const cols = [];
  let x0 = 16;
  for (const x of ROADS.vertical) {
    cols.push({ x0, x1: x - MARGIN });
    x0 = x + MARGIN;
  }
  cols.push({ x0, x1: WORLD.width - 16 });
  const rows = [];
  let y0 = 16;
  for (const y of ROADS.horizontal) {
    rows.push({ y0, y1: y - MARGIN });
    y0 = y + MARGIN;
  }
  rows.push({ y0, y1: WORLD.beachY - 8 });
  return { cols, rows };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Build the whole city from the seeded rng. */
export function generateCity(rng) {
  const { cols, rows } = blockGrid();
  const buildings = [];
  const palms = [];
  const lamps = [];
  for (let c = 0; c < cols.length; c += 1) {
    for (let r = 0; r < rows.length; r += 1) {
      const b = { x0: cols[c].x0, x1: cols[c].x1, y0: rows[r].y0, y1: rows[r].y1 };
      const w = b.x1 - b.x0;
      const h = b.y1 - b.y0;
      if (r === rows.length - 1) {
        // Beachfront strip: palms only.
        for (let i = 0; i < 5; i += 1) palms.push({ x: b.x0 + rng() * w, y: b.y0 + 5 + rng() * Math.max(4, h - 10), s: 0.8 + rng() * 0.5 });
        continue;
      }
      if (c === 4 && r === 3) {
        // Palm Park: open grass with scattered palms.
        for (let i = 0; i < 15; i += 1) palms.push({ x: b.x0 + 14 + rng() * (w - 28), y: b.y0 + 14 + rng() * (h - 28), s: 0.9 + rng() * 0.6 });
        continue;
      }
      if (c === 2 && r === 1) {
        // Plaza del Sol: a ring of palms around the fountain.
        const cx = (b.x0 + b.x1) / 2;
        const cy = (b.y0 + b.y1) / 2;
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2;
          palms.push({ x: cx + Math.cos(a) * 72, y: cy + Math.sin(a) * 72, s: 1 });
        }
        continue;
      }
      if (c === 5 && r === 1) continue; // Hotel car park: open asphalt, parked cars.
      // Ordinary block: one big building, or four small ones.
      if (chance(rng, 0.5)) {
        const bw = range(rng, w * 0.55, w * 0.8);
        const bh = range(rng, h * 0.55, h * 0.8);
        buildings.push({
          x: b.x0 + (w - bw) / 2, y: b.y0 + (h - bh) / 2, w: bw, h: bh,
          color: pick(rng, PALETTE.buildingRoof), hgt: int(rng, 10, 26), ac: int(rng, 0, 3),
        });
      } else {
        const gw = w / 2;
        const gh = h / 2;
        for (let gx = 0; gx < 2; gx += 1) {
          for (let gy = 0; gy < 2; gy += 1) {
            const bw = range(rng, gw * 0.6, gw * 0.85);
            const bh = range(rng, gh * 0.6, gh * 0.85);
            buildings.push({
              x: b.x0 + gx * gw + (gw - bw) / 2, y: b.y0 + gy * gh + (gh - bh) / 2, w: bw, h: bh,
              color: pick(rng, PALETTE.buildingRoof), hgt: int(rng, 8, 20), ac: int(rng, 0, 2),
            });
          }
        }
      }
      // A palm or two on a block's corner.
      if (chance(rng, 0.6)) palms.push({ x: b.x0 + 10 + rng() * 20, y: b.y0 + 10 + rng() * 20, s: 0.8 + rng() * 0.4 });
    }
  }
  // Street lamps at every intersection.
  for (const x of ROADS.vertical) {
    for (const y of ROADS.horizontal) lamps.push({ x: x + ROADS.width / 2 + 8, y: y + ROADS.width / 2 + 8 });
  }
  // Palms along the beach.
  for (let i = 0; i < 42; i += 1) palms.push({ x: 20 + rng() * (WORLD.width - 40), y: WORLD.beachY + 10 + rng() * 110, s: 0.9 + rng() * 0.7 });
  return { buildings, palms, lamps, cols, rows };
}

/** Push a circle out of every building and the world bounds (and out of the sea). */
export function collideCircle(city, x, y, r) {
  x = clamp(x, r, WORLD.width - r);
  y = clamp(y, r, WORLD.seaY - r);
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // Centre inside the building: push out along the smallest penetration.
      const pl = x - b.x;
      const pr = b.x + b.w - x;
      const pt = y - b.y;
      const pb = b.y + b.h - y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = b.x - r;
      else if (m === pr) x = b.x + b.w + r;
      else if (m === pt) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  return { x, y };
}

/** True when a point is on a road (including its sidewalks). */
export function isOnRoad(x, y) {
  const half = ROADS.width / 2 + ROADS.sidewalk;
  for (const vx of ROADS.vertical) if (Math.abs(x - vx) <= half) return true;
  for (const hy of ROADS.horizontal) if (Math.abs(y - hy) <= half) return true;
  return false;
}

/** The nearest point on any road centre line. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bd = Infinity;
  for (const vx of ROADS.vertical) {
    const d = Math.abs(x - vx);
    if (d < bd) {
      bd = d;
      best = { x: vx, y, axis: 'v', road: vx };
    }
  }
  for (const hy of ROADS.horizontal) {
    const d = Math.abs(y - hy);
    if (d < bd) {
      bd = d;
      best = { x, y: hy, axis: 'h', road: hy };
    }
  }
  return best;
}

/** A random point on a road, between minD and maxD from (cx, cy). */
export function randomRoadPoint(rng, cx, cy, minD, maxD) {
  for (let i = 0; i < 24; i += 1) {
    let p;
    if (chance(rng, 0.5)) {
      p = { x: pick(rng, ROADS.vertical), y: range(rng, 60, WORLD.beachY - 60), axis: 'v' };
    } else {
      p = { x: range(rng, 60, WORLD.width - 60), y: pick(rng, ROADS.horizontal), axis: 'h' };
    }
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d >= minD && d <= maxD) return p;
  }
  return { x: pick(rng, ROADS.vertical), y: range(rng, 60, WORLD.beachY - 60), axis: 'v' };
}

/** A random point on a sidewalk, between minD and maxD from (cx, cy). */
export function randomSidewalkPoint(rng, cx, cy, minD, maxD) {
  for (let i = 0; i < 24; i += 1) {
    const p = randomRoadPoint(rng, cx, cy, minD, maxD);
    const off = ROADS.width / 2 + ROADS.sidewalk / 2;
    if (p.axis === 'v') p.x += chance(rng, 0.5) ? off : -off;
    else p.y += chance(rng, 0.5) ? off : -off;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d >= minD * 0.8 && d <= maxD * 1.2) return p;
  }
  return { x: cx + minD, y: cy, axis: 'v' };
}
