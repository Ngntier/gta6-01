// Everything drawn in screen space: the HUD (money, wanted stars, health,
// ammo, the mission objective), the minimap, the dialogue subtitles, the
// banners, and the title, pause and help menus with their clickable buttons.
import { FONT, PALETTE, PLACES, WORLD, ROADS, GAME_NAME, GAME_TAGLINE } from './config.js';
import { missionMarker, missionText, currentObjective } from './missions.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_HELP } from './render.js';

const BUTTON_W = 300;
const BUTTON_H = 52;
const BUTTON_GAP = 16;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The buttons of a menu screen, laid out for this window size. */
export function layoutButtons(screen, w, h, hasSave) {
  const cx = w / 2 - BUTTON_W / 2;
  const list = [];
  if (screen === SCREEN_TITLE) {
    let y = h * 0.52;
    list.push({ id: 'new', x: cx, y, w: BUTTON_W, h: BUTTON_H, label: 'NEW GAME' });
    y += BUTTON_H + BUTTON_GAP;
    if (hasSave) {
      list.push({ id: 'continue', x: cx, y, w: BUTTON_W, h: BUTTON_H, label: 'CONTINUE' });
      y += BUTTON_H + BUTTON_GAP;
    }
    list.push({ id: 'help', x: cx, y, w: BUTTON_W, h: BUTTON_H, label: 'HOW TO PLAY' });
  } else if (screen === SCREEN_PAUSED) {
    let y = h * 0.38;
    for (const [id, label] of [['resume', 'RESUME'], ['save', 'SAVE GAME'], ['help', 'HOW TO PLAY'], ['quit', 'QUIT TO TITLE']]) {
      list.push({ id, x: cx, y, w: BUTTON_W, h: BUTTON_H, label });
      y += BUTTON_H + BUTTON_GAP;
    }
  } else if (screen === SCREEN_HELP) {
    list.push({ id: 'back', x: cx, y: h - 110, w: BUTTON_W, h: BUTTON_H, label: 'BACK' });
  }
  return list;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,63,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawButton(b, hover) {
    ctx.fillStyle = hover ? '#f2c230' : '#1d2330ee';
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = hover ? '#14181f' : '#f4f1e6';
    ctx.font = `bold 19px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function drawStars(x, y, wanted) {
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x + i * 28, y);
    }
  }

  function drawBar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = color;
      roundRect(ctx, x, y, w * Math.max(0, Math.min(1, frac)), h, 5);
      ctx.fill();
    }
  }

  function clockText(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function drawMinimap(state, w, h) {
    const mw = 186;
    const mh = 140;
    const mx = w - mw - 16;
    const my = h - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    panel(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.save();
    roundRect(ctx, mx, my, mw, mh, 6);
    ctx.clip();
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(mx, my, mw, mh);
    // Sea.
    ctx.fillStyle = '#2fa8b8';
    ctx.fillRect(mx, my + WORLD.seaY * sy, mw, mh - WORLD.seaY * sy);
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(mx, my + WORLD.beachY * sy, mw, (WORLD.seaY - WORLD.beachY) * sy);
    // Roads.
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 5;
    for (const x of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(mx + x * sx, my);
      ctx.lineTo(mx + x * sx, my + WORLD.beachY * sy);
      ctx.stroke();
    }
    for (const y of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(mx, my + y * sy);
      ctx.lineTo(mx + mw, my + y * sy);
      ctx.stroke();
    }
    // Park + plaza.
    ctx.fillStyle = '#6da354';
    ctx.fillRect(mx + (PLACES.park.x - 130) * sx, my + (PLACES.park.y - 130) * sy, 260 * sx, 260 * sy);
    const X = (wx) => mx + wx * sx;
    const Y = (wy) => my + wy * sy;
    // Mission marker, pulsing.
    const m = missionMarker(state);
    if (m) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.3;
      ctx.fillStyle = '#ffd23f';
      ctx.save();
      ctx.translate(X(m.x), Y(m.y));
      ctx.rotate(Math.PI / 4);
      const s = 5 * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    } else if (!state.mission) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('M', X(PLACES.garage.x), Y(PLACES.garage.y) + 4);
    }
    // Police blips, flashing.
    const flash = Math.floor(state.time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4757' : '#2a6bff';
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      ctx.beginPath();
      ctx.arc(X(car.x), Y(car.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of state.cops) {
      if (cop.state !== 'chase') continue;
      ctx.beginPath();
      ctx.arc(X(cop.x), Y(cop.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(X(state.player.x), Y(state.player.y));
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#14181f';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#f4f1e6';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', mx + 4, my + 12);
  }

  function drawPlayHud(state, w, h, mouse) {
    const player = state.player;
    // Top-right: money, clock, wanted stars.
    ctx.textAlign = 'right';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = PALETTE.money;
    ctx.fillText(`$${player.money.toLocaleString('en-US')}`, w - 20, 40);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(clockText(state.clock), w - 20, 64);
    drawStars(w - 160, 96, player.wanted);

    // Top-left: health + armor bars, weapon.
    drawBar(20, 20, 200, 16, player.health / 100, '#7ee787', 'rgba(0,0,0,0.5)');
    if (player.armor > 0) drawBar(20, 42, 200, 10, player.armor / 100, '#7ab8ff', 'rgba(0,0,0,0.5)');
    ctx.textAlign = 'left';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    if (player.car) {
      const car = player.car;
      ctx.fillText(`${car.name}  —  ${Math.round(Math.abs(car.speed) * 0.14)} mph`, 20, 76);
      drawBar(20, 84, 200, 10, car.health / car.maxHealth, '#ffb454', 'rgba(0,0,0,0.5)');
    } else {
      const reloading = player.ammo === 0 && player.reserve > 0;
      ctx.fillText(reloading ? 'RELOADING…' : `P9 Pistol  ${player.ammo} / ${player.reserve}`, 20, 76);
    }

    // Mission objective panel.
    const obj = currentObjective(state);
    if (obj) {
      const text = missionText(state);
      panel(20, 110, 340, 64);
      ctx.fillStyle = PALETTE.star;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(state.mission.def.title.toUpperCase(), 34, 134);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `15px ${FONT}`;
      ctx.fillText(text, 34, 158);
    }

    // Message toast.
    if (state.message) {
      ctx.font = `bold 19px ${FONT}`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(state.message.text).width;
      panel(w / 2 - tw / 2 - 18, 18, tw + 36, 38);
      ctx.fillStyle = state.message.color;
      ctx.fillText(state.message.text, w / 2, 44);
    }

    // Mission banners.
    if (state.missionComplete) {
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('MISSION PASSED', w / 2, h * 0.3);
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.missionComplete.text.replace('MISSION PASSED — ', ''), w / 2, h * 0.3 + 34);
    }
    if (state.missionFail) {
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5a4e';
      ctx.fillText('MISSION FAILED', w / 2, h * 0.3);
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.missionFail.text.replace('MISSION FAILED — ', ''), w / 2, h * 0.3 + 34);
    }

    // Dialogue subtitles.
    if (state.dialogue) {
      const line = state.dialogue.lines[state.dialogue.i];
      ctx.font = `19px ${FONT}`;
      ctx.textAlign = 'center';
      const tw = Math.min(w - 80, ctx.measureText(line).width);
      panel(w / 2 - tw / 2 - 18, h - 120, tw + 36, 40);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(line, w / 2, h - 93);
    }

    // Contextual hint, bottom-left.
    let hint = 'WASD move · SHIFT sprint · Mouse aim · Click shoot · E interact · P pause · M mute';
    if (player.car) hint = 'W/S drive · A/D steer · SPACE handbrake · E exit car · P pause';
    else {
      const nearCar = state.cars.some((c) => !c.wrecked && Math.hypot(c.x - player.x, c.y - player.y) < 80);
      if (nearCar) hint = 'E — GET IN THE CAR';
      else if (!state.mission && Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y) < 110) hint = 'E — TALK TO MARISOL (start mission)';
      else if (Math.hypot(player.x - PLACES.gunshop.x, player.y - PLACES.gunshop.y) < 95) hint = 'E — BUY AMMO ($50)';
      else if (Math.hypot(player.x - PLACES.hospital.x, player.y - PLACES.hospital.y) < 95) hint = 'E — GET TREATED ($100)';
    }
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(244,241,230,0.85)';
    ctx.fillText(hint, 20, h - 20);

    // Crosshair on foot.
    if (!player.car) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouse.x - 14, mouse.y);
      ctx.lineTo(mouse.x - 6, mouse.y);
      ctx.moveTo(mouse.x + 6, mouse.y);
      ctx.lineTo(mouse.x + 14, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 14);
      ctx.lineTo(mouse.x, mouse.y - 6);
      ctx.moveTo(mouse.x, mouse.y + 6);
      ctx.lineTo(mouse.x, mouse.y + 14);
      ctx.stroke();
    }

    // Off-screen mission arrow.
    const m = missionMarker(state);
    if (m) {
      const dx = m.x - player.x;
      const dy = m.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 500) {
        const a = Math.atan2(dy, dx);
        const ax = w / 2 + Math.cos(a) * Math.min(w / 2 - 60, 260);
        const ay = h / 2 + Math.sin(a) * Math.min(h / 2 - 60, 260);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd23f';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(dist)}m`, ax, ay + 26);
      }
    }

    drawMinimap(state, w, h);

    // Wasted / busted overlay.
    if (state.over) {
      ctx.fillStyle = 'rgba(10,10,14,0.55)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `bold 84px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = state.over === 'wasted' ? '#ff5a4e' : '#7ab8ff';
      ctx.fillText(state.over === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h / 2 - 20);
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText('Press ENTER to continue', w / 2, h / 2 + 30);
    }
  }

  function drawTitle(state, w, h, buttons, mouse, hasSave) {
    ctx.fillStyle = 'rgba(10,14,22,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold ${Math.min(110, w * 0.11)}px ${FONT}`;
    ctx.fillText(GAME_NAME, w / 2, h * 0.26);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `italic 24px ${FONT}`;
    ctx.fillText(GAME_TAGLINE, w / 2, h * 0.26 + 40);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Kai Duarte owes Marisol Vega — and in Solmara, debts are paid in jobs.', w / 2, h * 0.26 + 78);
    ctx.fillText('Drive, steal, shoot and survive: four missions stand between Kai and freedom.', w / 2, h * 0.26 + 104);
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(b, hover);
    }
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = 'rgba(244,241,230,0.7)';
    ctx.fillText('WASD move & drive · Mouse aim · Click shoot · E enter car / interact · P pause · M mute', w / 2, h - 36);
    ctx.fillText('An original game — its city, characters, story and music are all its own.', w / 2, h - 16);
  }

  function drawPaused(state, w, h, buttons, mouse) {
    ctx.fillStyle = 'rgba(10,14,22,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('PAUSED', w / 2, h * 0.26);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const done = state.missionsDone.length;
    ctx.fillText(`$${state.player.money.toLocaleString('en-US')}  ·  Missions ${done}/4  ·  Postcards ${state.stats.postcards}/10  ·  Cars stolen ${state.stats.carsStolen}`, w / 2, h * 0.26 + 36);
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(b, hover);
    }
  }

  function drawHelp(w, h, buttons, mouse) {
    ctx.fillStyle = 'rgba(10,14,22,0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText('HOW TO PLAY', w / 2, 90);
    const lines = [
      ['WASD / Arrows', 'Move on foot, drive in a car'],
      ['SHIFT', 'Sprint on foot'],
      ['Mouse + Click', 'Aim and shoot the pistol'],
      ['E', 'Enter / exit a car · start a mission · shop'],
      ['SPACE', 'Handbrake (drift the car)'],
      ['P / ESC', 'Pause'],
      ['M', 'Mute'],
      ['R', 'Restart the run'],
      ['', ''],
      ['GOAL', 'Work off Kai\'s debt: 4 missions for Marisol Vega.'],
      ['START', 'Walk to the yellow M at Vega\'s Garage and press E.'],
      ['WANTED', 'Stars bring the cops. Hide, or pay the spray shop $150.'],
      ['MONEY', 'Missions, postcards (10) and cash pickups pay.'],
      ['SHOPS', 'Solmara Arms sells ammo; the hospital patches you up.'],
    ];
    ctx.font = `18px ${FONT}`;
    let y = 150;
    for (const [k, v] of lines) {
      if (!k) {
        y += 12;
        continue;
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(k, w / 2 - 20, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(v, w / 2 + 20, y);
      y += 32;
    }
    for (const b of buttons) {
      const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      drawButton(b, hover);
    }
  }

  return {
    draw(state, screen, ui) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = ui.mouse ?? { x: -100, y: -100 };
      if (screen === SCREEN_TITLE) {
        drawTitle(state, w, h, ui.buttons, mouse, ui.hasSave);
      } else if (screen === SCREEN_PAUSED) {
        drawPlayHud(state, w, h, mouse);
        drawPaused(state, w, h, ui.buttons, mouse);
      } else if (screen === SCREEN_HELP) {
        drawHelp(w, h, ui.buttons, mouse);
      } else {
        drawPlayHud(state, w, h, mouse);
      }
      // The canvas hides the OS cursor: draw one on the menu screens.
      if (screen !== SCREEN_PLAY && mouse.x >= 0) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(mouse.x + 16, mouse.y + 16);
        ctx.lineTo(mouse.x + 9, mouse.y + 17);
        ctx.lineTo(mouse.x + 12, mouse.y + 24);
        ctx.lineTo(mouse.x + 8, mouse.y + 25);
        ctx.lineTo(mouse.x + 5, mouse.y + 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
  };
}
