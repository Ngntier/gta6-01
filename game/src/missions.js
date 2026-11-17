// The story: four missions for Marisol Vega, from a first delivery to the big
// score. Each mission is a list of objectives — go somewhere, steal a car,
// survive the heat, clear the gang — with dialogue, a timer where it counts,
// a reward, and a fail state the player can retry.
import { PLACES } from './config.js';
import { createGangMember } from './combat.js';

export const MISSIONS = [
  {
    id: 'delivery',
    title: 'First Delivery',
    giver: 'Marisol Vega',
    reward: 300,
    intro: [
      'MARISOL: Kai! You owe me, kid — time to work it off.',
      'MARISOL: Take this package to the Marina. Ninety seconds. No questions.',
    ],
    objectives: [
      { type: 'goto', loc: 'marina', text: 'Deliver the package to the Marina docks', timer: 90 },
    ],
    outro: 'MARISOL: Not bad. Maybe you\'re not useless after all.',
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    giver: 'Marisol Vega',
    reward: 500,
    intro: [
      'MARISOL: A Comet GT is parked at The Palms. Yellow. You can\'t miss it.',
      'MARISOL: Bring it to the garage. If the cops notice, lose them — or pay the spray shop.',
    ],
    objectives: [
      { type: 'goto', loc: 'hotel', text: 'Find the Comet GT at The Palms Hotel' },
      { type: 'steal', carId: 'comet', text: 'Steal the Comet GT' },
      { type: 'deliver', loc: 'garage', text: 'Bring the Comet GT to Vega\'s Garage', inCar: 'comet' },
    ],
    outro: 'MARISOL: Beautiful. The buyer pays Friday. You get your cut.',
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Marisol Vega',
    reward: 700,
    intro: [
      'MARISOL: The deal went south — the whole PD is on us!',
      'MARISOL: Survive sixty seconds, then get to the safehouse. GO!',
    ],
    objectives: [
      { type: 'survive', seconds: 60, text: 'Survive the heat for 60 seconds', wanted: 2 },
      { type: 'goto', loc: 'safehouse', text: 'Reach the safehouse' },
    ],
    outro: 'MARISOL: You made it. The Vipers won\'t forget this — and neither will I.',
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    giver: 'Marisol Vega',
    reward: 1500,
    intro: [
      'MARISOL: The Vipers took my money. It\'s in their warehouse — with six of them guarding it.',
      'MARISOL: Take it back, Kai. All of it. Then Solmara is ours.',
    ],
    objectives: [
      { type: 'goto', loc: 'warehouse', text: 'Get to the old warehouse' },
      { type: 'kill', count: 6, text: 'Clear out the Vipers (0/6)' },
      { type: 'pickup', kind: 'cash', text: 'Grab the cash' },
      { type: 'deliver', loc: 'garage', text: 'Get the money back to Vega\'s Garage' },
    ],
    outro: 'MARISOL: The King of Solmara. That\'s you now, Kai. That\'s you.',
  },
];

/** Queue subtitle lines for the dialogue bar. */
export function say(state, lines) {
  state.dialogue = { lines, i: 0, t: 4 };
}

/** The next mission the player has not finished, or null when the story is done. */
export function nextMission(state) {
  for (const m of MISSIONS) {
    if (!state.missionsDone.includes(m.id)) return m;
  }
  return null;
}

/** Begin a mission: set up its world state and open with its intro lines. */
export function startMission(state, def, audio) {
  const mission = { def, step: 0, timer: 0, kills: 0, failed: false, done: false, banner: 0 };
  state.mission = mission;
  state.stats.missionsStarted += 1;
  if (def.id === 'getaway') {
    state.player.wanted = 2;
  }
  if (def.id === 'bigscore') {
    // Six Vipers guard the warehouse; the cash waits inside.
    const w = PLACES.warehouse;
    const spots = [[-70, -40], [60, -60], [0, 50], [-90, 60], [90, 20], [20, -90]];
    for (const [dx, dy] of spots) state.gang.push(createGangMember(state, w.x + dx, w.y + dy));
    state.pickups.push({ x: w.x, y: w.y, kind: 'cash', value: 0, missionCash: true, bob: 0 });
  }
  say(state, def.intro);
  state.message = { text: `MISSION: ${def.title} — $${def.reward}`, t: 4, color: '#ffd23f' };
  armFirstObjective(state);
  if (audio) audio.missionStart();
}

/** Fail the active mission with a reason. */
export function failMission(state, reason, audio) {
  if (!state.mission) return;
  state.mission.failed = true;
  state.missionFail = { text: `MISSION FAILED — ${reason}`, t: 4 };
  state.mission = null;
  state.gang = [];
  if (audio) audio.missionFail();
}

/** Complete the active mission: pay out, unlock the next, autosave. */
function completeMission(state, audio) {
  const def = state.mission.def;
  state.missionsDone.push(def.id);
  state.player.money += def.reward;
  state.mission = null;
  state.missionComplete = { text: `MISSION PASSED — ${def.title}  +$${def.reward}`, t: 5 };
  say(state, [def.outro]);
  state.needSave = true;
  if (audio) audio.missionComplete();
}

/** The current objective of the active mission, or null. */
export function currentObjective(state) {
  if (!state.mission) return null;
  return state.mission.def.objectives[state.mission.step] ?? null;
}

/** Where the current objective points (for the minimap and the road arrow). */
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.type === 'goto' || obj.type === 'deliver') return PLACES[obj.loc];
  if (obj.type === 'steal') {
    const car = state.cars.find((c) => c.id === obj.carId);
    return car ? { x: car.x, y: car.y, label: 'Comet GT', short: 'CAR' } : null;
  }
  if (obj.type === 'kill' || obj.type === 'pickup') return PLACES.warehouse;
  return null;
}

/** The objective line the HUD shows, with live progress. */
export function missionText(state) {
  const obj = currentObjective(state);
  if (!obj || !state.mission) return null;
  if (obj.type === 'kill') return `Clear out the Vipers (${state.mission.kills}/${obj.count})`;
  if (obj.type === 'survive') return `${obj.text} — ${Math.ceil(state.mission.timer)}s left`;
  if (obj.timer && state.mission.timer > 0) return `${obj.text} — ${Math.ceil(state.mission.timer)}s`;
  return obj.text;
}

/** Advance the mission one step; returns true when the mission is over. */
function advance(state, audio) {
  state.mission.step += 1;
  if (state.mission.step >= state.mission.def.objectives.length) {
    completeMission(state, audio);
    return true;
  }
  const obj = currentObjective(state);
  state.mission.timer = obj.timer ?? (obj.type === 'survive' ? obj.seconds : 0);
  if (obj.type === 'survive' && obj.wanted) state.player.wanted = Math.max(state.player.wanted, obj.wanted);
  return false;
}

/** Check the current objective each step; timers tick down here. */
export function updateMission(state, dt, audio) {
  const mission = state.mission;
  if (!mission) return;
  const obj = currentObjective(state);
  if (!obj) return;
  const player = state.player;

  // The getaway car must survive: lose the Comet and the job is blown.
  if (mission.def.id === 'hotwheels' && mission.step >= 1) {
    const comet = state.cars.find((c) => c.id === 'comet');
    if (!comet || comet.wrecked) {
      failMission(state, 'The Comet GT is wrecked', audio);
      return;
    }
  }

  if (obj.type === 'goto' || obj.type === 'deliver') {
    if (obj.timer !== undefined || obj.type === 'goto') {
      if (mission.timer > 0) {
        mission.timer -= dt;
        if (mission.timer <= 0) {
          failMission(state, 'Out of time', audio);
          return;
        }
      }
    }
    const loc = PLACES[obj.loc];
    const near = Math.hypot(player.x - loc.x, player.y - loc.y) < 95;
    if (obj.type === 'deliver' && obj.inCar && player.car?.id !== obj.inCar) {
      // Must arrive in the right car.
    } else if (near) {
      advance(state, audio);
    }
  } else if (obj.type === 'steal') {
    if (player.car && player.car.id === obj.carId) advance(state, audio);
  } else if (obj.type === 'survive') {
    mission.timer -= dt;
    if (mission.timer <= 0) advance(state, audio);
  } else if (obj.type === 'kill') {
    if (mission.kills >= obj.count) advance(state, audio);
  } else if (obj.type === 'pickup') {
    // The cash pickup at the warehouse completes it when collected.
    const cash = state.pickups.find((p) => p.missionCash);
    if (!cash) advance(state, audio);
  }
}

/** The first objective's timer starts when the mission starts. */
export function armFirstObjective(state) {
  if (!state.mission) return;
  const obj = currentObjective(state);
  state.mission.timer = obj.timer ?? (obj.type === 'survive' ? obj.seconds : 0);
}
