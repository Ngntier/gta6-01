// SOLMARA — a gta6-01 entry (Node 22, standard library only). The game is this
// directory's game/ folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library, no network request). This
// program hands it in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// The game itself is an original open-world crime game: the sun-soaked city of
// Solmara, drivable on foot and by car, with traffic and pedestrians, cars to
// steal, a wanted level and police, four story missions, combat, a HUD with a
// minimap, a start screen and a save. Play it with `node serve.ts`, then open
// http://localhost:8080.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a clear message when the entry is incomplete, rather than
// handing the scorer a dossier built from a half-missing game.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing: the game cannot be entered without it');
}
if (!existsSync(join(here, 'screenshots')) || readdirSync(join(here, 'screenshots')).filter((f) => !f.startsWith('.')).length === 0) {
  throw new Error('screenshots/ holds no screenshots: the entry needs 3 or 4');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line receipt, so a local run shows what it handed in.
const shotCount = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')).length;
console.log(
  `SOLMARA handed in to ${out}: game/ (${readdirSync(join(out, 'game')).length} top-level entries), ` +
  `${shotCount} screenshots, dossier.json ${statSync(join(out, 'dossier.json')).size} bytes`,
);
