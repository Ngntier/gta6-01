// Keyboard and mouse input. Held keys give a movement vector; one-shot presses
// (confirm, pause, interact, restart, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
// The mouse gives an aim point in screen pixels and a held fire button.
import { STEP } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = null;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code) || SPRINT.has(code) || BRAKE.has(code)) {
      keys.add(code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(code)) actions |= ACTION_INTERACT;
    else if (RESTART.has(code)) actions |= ACTION_RESTART;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(codeOf(event)));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    const rect = target.getBoundingClientRect();
    clicked = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function held(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector from held keys, normalised, in world axes (x right, y down). */
    move() {
      const x = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
      const y = (held(DOWN) ? 1 : 0) - (held(UP) ? 1 : 0);
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    /** -1 back, 0 coast, 1 throttle. */
    throttle() {
      return (held(UP) ? 1 : 0) - (held(DOWN) ? 1 : 0);
    },
    /** -1 left, 0 straight, 1 right. */
    steer() {
      return (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
    },
    sprint() {
      return held(SPRINT);
    },
    handbrake() {
      return held(BRAKE);
    },
    /** Mouse position in canvas pixels. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown;
    },
    /** The last click (canvas pixels) since the last call, or null. */
    takeClick() {
      const c = clicked;
      clicked = null;
      return c;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Held-key state, for the autopilot to drive from: same shape as a frame of input. */
    snapshot() {
      return {
        move: this.move(),
        throttle: this.throttle(),
        steer: this.steer(),
        sprint: this.sprint(),
        handbrake: this.handbrake(),
        mouse: this.mouse(),
        firing: this.firing(),
        dt: STEP,
      };
    },
  };
}
