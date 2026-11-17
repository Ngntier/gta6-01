// Drawing only: the world's state in, pixels out. A smooth camera follows the
// player, the sun-soaked city is drawn layer by layer (ground, roads, blocks,
// props, cars, people, effects), and a warm tint follows the time of day.
// The HUD and menus live in hud.js and draw on top of this.
import { WORLD, ROADS, PALETTE, FONT, PLACES, CAR } from './config.js';
import { missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_HELP = 'help';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Screen pixels to world coordinates, through the camera. */
  function toWorld(state, sx, sy) {
    const cam = state.camera;
    return {
      x: cam.x + (sx - width / 2) / cam.zoom,
      y: cam.y + (sy - height / 2) / cam.zoom,
    };
  }

  function drawGround(state) {
    const cam = state.camera;
    const vw = width / cam.zoom;
    const vh = height / cam.zoom;
    const x0 = cam.x - vw / 2 - 50;
    const y0 = cam.y - vh / 2 - 50;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, vw + 100, vh + 100);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const startY = Math.floor(y0 / stripe) * stripe;
    for (let y = startY; y < y0 + vh + 100; y += stripe * 2) {
      if (y + stripe < WORLD.beachY) ctx.fillRect(x0, y, vw + 100, stripe);
    }
    // Beach and sea along the south edge.
    if (y0 + vh > WORLD.beachY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x0, WORLD.beachY, vw + 100, WORLD.seaY - WORLD.beachY);
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(x0, WORLD.seaY, vw + 100, WORLD.height - WORLD.seaY + 100);
      // Wave lines, drifting with time.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const wy = WORLD.seaY + 14 + i * 26;
        ctx.beginPath();
        for (let x = x0; x < x0 + vw + 100; x += 24) {
          const yy = wy + Math.sin(x / 60 + state.time * 1.4 + i) * 3;
          if (x === x0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
    // Palm Park's lawn and the plaza's pavement.
    const park = PLACES.park;
    ctx.fillStyle = '#6da354';
    ctx.fillRect(park.x - 130, park.y - 130, 260, 260);
    const plaza = PLACES.plaza;
    ctx.fillStyle = '#cfc8b4';
    ctx.beginPath();
    ctx.arc(plaza.x, plaza.y, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sea;
    ctx.beginPath();
    ctx.arc(plaza.x, plaza.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8f4f8';
    ctx.beginPath();
    ctx.arc(plaza.x, plaza.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRoads() {
    const half = ROADS.width / 2;
    ctx.fillStyle = PALETTE.road;
    for (const x of ROADS.vertical) ctx.fillRect(x - half, 0, ROADS.width, WORLD.beachY);
    for (const y of ROADS.horizontal) ctx.fillRect(0, y - half, WORLD.width, ROADS.width);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS.vertical) {
      ctx.fillRect(x - half - ROADS.sidewalk, 0, ROADS.sidewalk, WORLD.beachY);
      ctx.fillRect(x + half, 0, ROADS.sidewalk, WORLD.beachY);
    }
    for (const y of ROADS.horizontal) {
      ctx.fillRect(0, y - half - ROADS.sidewalk, WORLD.width, ROADS.sidewalk);
      ctx.fillRect(0, y + half, WORLD.width, ROADS.sidewalk);
    }
    // Centre dashes.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const x of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.beachY);
      ctx.stroke();
    }
    for (const y of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const x of ROADS.vertical) {
      for (const y of ROADS.horizontal) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(x - half - 4, y + i * 12 - 3, 8, 6);
          ctx.fillRect(x + half - 4, y + i * 12 - 3, 8, 6);
          ctx.fillRect(x + i * 12 - 3, y - half - 4, 6, 8);
          ctx.fillRect(x + i * 12 - 3, y + half - 4, 6, 8);
        }
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      // Shadow, cast to the south-east by the afternoon sun.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + b.hgt * 0.5, b.y + b.hgt * 0.6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Rooftop detail: AC units and a skylight.
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < b.ac; i += 1) {
        ctx.fillRect(b.x + 10 + i * 22, b.y + 10, 14, 14);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
    }
  }

  function drawPalm(p) {
    ctx.fillStyle = PALETTE.trunk;
    ctx.fillRect(p.x - 2 * p.s, p.y - 2 * p.s, 4 * p.s, 10 * p.s);
    ctx.fillStyle = PALETTE.palm;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * 9 * p.s, p.y - 4 * p.s + Math.sin(a) * 9 * p.s, 11 * p.s, 4.5 * p.s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(p.x + 4 * p.s, p.y + 8 * p.s, 10 * p.s, 4 * p.s, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawProps(state) {
    for (const lamp of state.city.lamps) {
      ctx.fillStyle = '#3a3f4a';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of state.city.palms) drawPalm(p);
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -26 + 3, -13 + 4, 52, 26, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#15181d';
    ctx.fillRect(-20, -15, 12, 5);
    ctx.fillRect(-20, 10, 12, 5);
    ctx.fillRect(10, -15, 12, 5);
    ctx.fillRect(10, 10, 12, 5);
    // Body, darkening with damage.
    const dmg = 1 - car.health / car.maxHealth;
    ctx.fillStyle = car.wrecked ? '#2a2d33' : shade(car.color, 1 - dmg * 0.55);
    roundRect(ctx, -26, -13, 52, 26, 8);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = car.wrecked ? '#1c1e22' : '#20242c';
    roundRect(ctx, -8, -10, 18, 20, 4);
    ctx.fill();
    ctx.fillStyle = car.wrecked ? '#1c1e22' : '#9fc4d8';
    roundRect(ctx, 6, -9, 8, 18, 3);
    ctx.fill();
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(23, -10, 3, 5);
    ctx.fillRect(23, 5, 3, 5);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#f2d230';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = '#15181d';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 11);
    }
    if (car.kind === 'police') {
      // White doors.
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-14, -13, 16, 26);
      // Flashing light bar.
      const phase = Math.floor(time * 6 + car.sirenPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a6bff';
      ctx.fillRect(-2, -12, 7, 7);
      ctx.fillStyle = phase ? '#2a6bff' : '#ff2a2a';
      ctx.fillRect(-2, 5, 7, 7);
    }
    ctx.restore();
  }

  /** Darken a hex colour by factor f (0..1). */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.floor(((n >> 16) & 255) * f);
    const g = Math.floor(((n >> 8) & 255) * f);
    const b = Math.floor((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  function drawPerson(x, y, angle, shirt, pants, bob, down, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bounce = Math.sin(bob) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    // Legs.
    ctx.fillStyle = pants;
    ctx.fillRect(-4, -7 + bounce, 8, 5);
    ctx.fillRect(-4, 2 - bounce, 8, 5);
    // Body.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // Gun in hand when the player aims.
    if (isPlayer) {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(8, -1.5, 12, 3);
    }
    ctx.restore();
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      const bobY = Math.sin(p.bob) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bobY);
      if (p.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#e83a3a';
        ctx.fillRect(-2.5, -7, 5, 14);
        ctx.fillRect(-7, -2.5, 14, 5);
      } else if (p.kind === 'ammo') {
        ctx.fillStyle = '#3a3f4a';
        ctx.fillRect(-9, -7, 18, 14);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(-6, -4, 3, 8);
        ctx.fillRect(-1, -4, 3, 8);
        ctx.fillRect(4, -4, 3, 8);
      } else if (p.kind === 'postcard') {
        ctx.fillStyle = '#ff8fb3';
        ctx.fillRect(-10, -7, 20, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-8, -5, 8, 10);
        ctx.fillStyle = '#2fa8b8';
        ctx.fillRect(-7, -4, 6, 5);
      } else {
        // Cash: green bills with a glow.
        ctx.fillStyle = 'rgba(126,231,135,0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e9e4f';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#d6ffd9';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
      }
      ctx.restore();
    }
  }

  function drawMissionMarker(state) {
    const m = missionMarker(state);
    if (!m) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    // Light pillar.
    const grad = ctx.createLinearGradient(0, m.y - 140, 0, m.y);
    grad.addColorStop(0, 'rgba(255,210,63,0)');
    grad.addColorStop(1, 'rgba(255,210,63,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 10, m.y - 140, 20, 140);
    // Ground ring + diamond.
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(m.x, m.y - 40);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
    const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    drawGround(state);
    drawRoads();
    drawBuildings(state);
    drawProps(state);
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.4)';
    ctx.lineWidth = 4;
    for (const s of state.skids) {
      ctx.globalAlpha = Math.min(1, s.life / 2);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
      ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawPickups(state);
    drawMissionMarker(state);
    // Garage mission marker when no mission is active.
    if (!state.mission) {
      const g = PLACES.garage;
      const pulse = 1 + Math.sin(state.time * 3) * 0.2;
      ctx.fillStyle = '#ffd23f';
      ctx.font = `bold ${Math.floor(26 * pulse)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('M', g.x, g.y - 30);
    }
    for (const car of state.cars) drawCar(car, state.time);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.walkPhase, ped.state === 'down', false);
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, '#2b4f9e', '#1c2f5e', state.time * 10, cop.state === 'down', false);
    for (const g of state.gang) drawPerson(g.x, g.y, g.angle, '#8a2f2f', '#2e2a2a', state.time * 10, g.state === 'down', false);
    const player = state.player;
    if (!player.car) {
      drawPerson(player.x, player.y, player.angle, '#ffd23f', '#2e3440', state.time * 10, false, true);
    }
    // Bullets as short tracers.
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Time-of-day tint: golden morning, bright noon, warm evening, blue night.
    const h = state.clock / 60;
    let tint = null;
    if (h >= 6 && h < 10) tint = ['rgba(255,190,90,0.10)'];
    else if (h >= 16 && h < 19) tint = ['rgba(255,140,60,0.14)'];
    else if (h >= 19 || h < 6) tint = ['rgba(20,40,90,0.28)'];
    if (tint) {
      ctx.fillStyle = tint[0];
      ctx.fillRect(0, 0, width, height);
    }
    // Hurt vignette.
    if (state.hurtFlash > 0) {
      const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, `rgba(255,0,0,${0.45 * state.hurtFlash})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  return {
    draw(state, screen) {
      drawWorld(state);
    },
    resize,
    toWorld,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
  };
}
