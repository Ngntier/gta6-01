// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, help and (inside play) wasted/busted.
//
// ?seed=N fixes the city. ?shot=chase|drive|city|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, GAME_NAME } from './config.js';
import { createRandom } from './random.js';
import { createWorld, stepWorld, interact, respawnPlayer } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_RESTART, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_HELP } from './render.js';
import { createHud, layoutButtons } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

/** Input that does nothing: the title screen's living backdrop. */
const IDLE_INPUT = {
  move: () => ({ x: 0, y: 0 }),
  throttle: () => 0,
  steer: () => 0,
  sprint: () => false,
  handbrake: () => false,
  firing: () => false,
  mouse: () => ({ x: 0, y: 0 }),
};

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
let world = createWorld(rng, seed);
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen);
    hud.draw(world, scene.screen, { mouse: { x: 640, y: 300 }, buttons: [], hasSave: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let prevScreen = SCREEN_TITLE;
  let saved = hasSave();
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function buttons() {
    return layoutButtons(screen, window.innerWidth, window.innerHeight, saved);
  }

  function startNewGame() {
    const freshRng = createRandom(seed);
    world = createWorld(freshRng, seed);
    screen = SCREEN_PLAY;
    accumulator = 0;
    audio.start();
    announce(`${GAME_NAME}. Playing. Get to the yellow M at Vega's Garage to start the first mission.`);
  }

  function continueGame() {
    const data = loadSave();
    if (!data) return;
    const freshRng = createRandom(data.seed ?? seed);
    world = createWorld(freshRng, data.seed ?? seed);
    applySave(world, data);
    screen = SCREEN_PLAY;
    accumulator = 0;
    audio.start();
    announce(`${GAME_NAME}. Continued.`);
  }

  function doSave() {
    if (saveGame(world)) {
      saved = true;
      world.message = { text: 'Game saved.', t: 2.5, color: '#7ee787' };
      audio.pickup();
    } else {
      world.message = { text: 'Could not save (storage unavailable).', t: 2.5, color: '#ff5a4e' };
    }
  }

  function handleButton(id) {
    audio.click();
    if (id === 'new') startNewGame();
    else if (id === 'continue') continueGame();
    else if (id === 'help') {
      prevScreen = screen;
      screen = SCREEN_HELP;
    } else if (id === 'back') {
      screen = prevScreen === SCREEN_HELP ? SCREEN_TITLE : prevScreen;
    } else if (id === 'resume') {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (id === 'save') {
      doSave();
    } else if (id === 'quit') {
      screen = SCREEN_TITLE;
      saved = hasSave();
      announce(`${GAME_NAME}. Title screen.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      world.message = { text: audio.isMuted() ? 'Muted.' : 'Sound on.', t: 1.5, color: '#f4f1e6' };
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startNewGame();
    } else if (screen === SCREEN_PLAY) {
      if (world.over) {
        if (actions & ACTION_CONFIRM) {
          respawnPlayer(world, world.over);
          announce('Playing.');
        }
        return;
      }
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_INTERACT) {
        interact(world, audio);
      } else if (actions & ACTION_RESTART) {
        startNewGame();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_HELP) {
      if (actions & ACTION_PAUSE) screen = prevScreen === SCREEN_HELP ? SCREEN_TITLE : prevScreen;
    }
    const click = input.takeClick();
    if (click) {
      for (const b of buttons()) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          handleButton(b.id);
          break;
        }
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Living backdrop: traffic and pedestrians move, the camera drifts.
      stepWorld(world, IDLE_INPUT, null, STEP);
      titleTime += STEP;
      const cx = 1550 + Math.cos(titleTime * 0.07) * 500;
      const cy = 1150 + Math.sin(titleTime * 0.05) * 350;
      world.camera.x += (cx - world.camera.x) * 0.01;
      world.camera.y += (cy - world.camera.y) * 0.01;
      world.camera.zoom += (0.75 - world.camera.zoom) * 0.01;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    // Aim follows the mouse.
    const m = input.mouse();
    const wpos = renderer.toWorld(world, m.x, m.y);
    world.player.aimAngle = Math.atan2(wpos.y - world.player.y, wpos.x - world.player.x);
    stepWorld(world, input, audio, STEP);
    if (world.needSave) {
      world.needSave = false;
      saveGame(world);
      saved = true;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen);
    hud.draw(world, screen, { mouse: input.mouse(), buttons: buttons(), hasSave: saved });
  }

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // For playtests and debugging: the live state, the screen and the save.
  window.__solmara = {
    get screen() {
      return screen;
    },
    get state() {
      return world;
    },
    get saved() {
      return saved;
    },
    save: () => saveGame(world),
    load: () => loadSave(),
  };

  announce(`${GAME_NAME}. Press Enter or click New Game to start.`);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
