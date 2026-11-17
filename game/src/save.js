// Save games in localStorage: the player's position, money, health, the
// missions finished, the postcards found and the time of day. The city itself
// is rebuilt from the seed, so a save is small and always loads.
import { SAVE_KEY } from './config.js';

/** The save data of the current run, or null when there is none. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

/** Write the current run to localStorage. */
export function saveGame(state) {
  const p = state.player;
  const data = {
    version: 1,
    seed: state.seed,
    x: Math.round(p.x),
    y: Math.round(p.y),
    health: Math.round(p.health),
    armor: Math.round(p.armor),
    money: p.money,
    ammo: p.ammo,
    reserve: p.reserve,
    missionsDone: state.missionsDone.slice(),
    postcards: state.stats.postcards,
    postcardIds: state.stats.postcardIds.slice(),
    carsStolen: state.stats.carsStolen,
    clock: state.clock,
    time: Math.round(state.time),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Apply a loaded save to a fresh world. */
export function applySave(state, data) {
  const p = state.player;
  p.x = data.x;
  p.y = data.y;
  p.health = data.health;
  p.armor = data.armor ?? 0;
  p.money = data.money;
  p.ammo = data.ammo ?? 12;
  p.reserve = data.reserve ?? 48;
  p.wanted = 0;
  p.car = null;
  state.missionsDone = (data.missionsDone ?? []).slice();
  state.stats.postcards = data.postcards ?? 0;
  state.stats.postcardIds = (data.postcardIds ?? []).slice();
  state.stats.carsStolen = data.carsStolen ?? 0;
  state.clock = data.clock ?? state.clock;
  state.time = data.time ?? 0;
  state.camera.x = p.x;
  state.camera.y = p.y;
  // Postcards already found are gone from the world (by their own id).
  if (state.stats.postcardIds.length > 0) {
    const gone = new Set(state.stats.postcardIds);
    state.pickups = state.pickups.filter((pk) => !(pk.kind === 'postcard' && gone.has(pk.pid)));
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear then.
  }
}
