# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ngntier/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ngntier/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMARA** — an original open-world crime game in the spirit of GTA 6. Kai
Duarte owes Marisol Vega, and in the sun-soaked coastal city of Solmara debts
are paid in jobs. Explore a living city on foot and by car: traffic and
pedestrians fill the streets, cars wait to be stolen, the police answer a
five-star wanted level, and four story missions — a timed delivery, a stolen
Comet GT, a getaway, and a warehouse shootout — stand between Kai and freedom.

- A complete open world: a grid city with a beach, a park, a plaza, a marina
  and a hotel; traffic that follows the roads, pedestrians who flee gunfire.
- Cars to steal (parked cars are free, carjacking draws the heat), arcade
  driving with handbrake drifts, damage, smoke and explosions.
- A wanted system: stars bring police cars and foot cops who chase, shoot and
  arrest; hide to cool off, or pay the spray shop for a clean record.
- Four missions with dialogue, objectives, timers and rewards, plus side
  content: 10 sunset postcards, cash pickups, a gun shop and a hospital.
- HUD with a live minimap, health and armour, money, a clock, a day/night
  cycle, mission objectives and an off-screen marker arrow.
- Title, pause and help screens, save/load in localStorage, wasted/busted
  respawns, and synthesised Web Audio sound — no audio files, no network
  requests, fully offline from its own static files.
- Deterministic: `?seed=N` replays the same city, and
  `?shot=chase|drive|city|mission&seed=N` stages the screenshot scenes.

## Run it

```sh
node main.ts            # writes game/ + screenshots/ + dossier.json to /output
```

Play it locally from the repository root:

```sh
node serve.ts           # serves game/ on http://localhost:8080
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html` in a
desktop browser. No build step, no network requests.

Controls: WASD move & drive · mouse aim · click shoot · E enter car /
interact · Space handbrake · Shift sprint · P pause · M mute · R restart.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`.
- `game/index.html` — the page; `game/src/` holds the game, one file per job:
  `config.js` (tuning, city layout, palette), `random.js` (seeded RNG),
  `city.js` (city generation + collision), `input.js` (keyboard + mouse),
  `audio.js` (synth SFX + music), `fx.js` (particles + skid marks),
  `vehicles.js` (car physics + traffic), `pedestrians.js` (ped AI),
  `police.js` (wanted level + cops), `combat.js` (shooting, gang, pickups),
  `missions.js` (story missions), `world.js` (simulation),
  `render.js` (canvas drawing), `hud.js` (HUD, minimap, menus),
  `save.js` (localStorage saves), `shots.js` (screenshot staging),
  `main.js` (boot + game loop).
- `screenshots/` — four real renders of the game running.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
