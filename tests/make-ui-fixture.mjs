// Genera datos SINTÉTICOS (no reales) con la forma exacta de data/*.json para probar la interfaz en modo "completo".
// Uso: node tests/make-ui-fixture.mjs <directorio-destino>/data
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../data/starter.js');
const S = globalThis.PoGo.STARTER.species;
const out = process.argv[2] || '/tmp/fixture-data';
fs.mkdirSync(out, { recursive: true });

const moves = {
  CONFUSION: { id: 'CONFUSION', name: 'Confusion', type: 'psychic', kind: 'fast', pvp: { power: 16, energy: 0, energyGain: 12, cooldown: 1500, turns: 3 }, pve: { power: 16, durationMs: 1600, energy: 12, dwsMs: 800 } },
  COUNTER: { id: 'COUNTER', name: 'Counter', type: 'fighting', kind: 'fast', pvp: { power: 8, energy: 0, energyGain: 7, cooldown: 1000, turns: 2 }, pve: { power: 12, durationMs: 900, energy: 8, dwsMs: 500 } },
  BUBBLE: { id: 'BUBBLE', name: 'Bubble', type: 'water', kind: 'fast', pvp: { power: 3, energy: 0, energyGain: 8, cooldown: 1500, turns: 3 }, pve: { power: 10, durationMs: 1200, energy: 14, dwsMs: 700 } },
  PSYCHIC: { id: 'PSYCHIC', name: 'Psychic', type: 'psychic', kind: 'charged', pvp: { power: 90, energy: 55, energyGain: 0, cooldown: 500, turns: 1, buffs: [0, -1], buffTarget: 'opponent', buffApplyChance: 0.1 }, pve: { power: 90, durationMs: 2800, energy: 50, dwsMs: 1000 } },
  CROSS_CHOP: { id: 'CROSS_CHOP', name: 'Cross Chop', type: 'fighting', kind: 'charged', pvp: { power: 50, energy: 35, energyGain: 0, cooldown: 500, turns: 1 }, pve: { power: 50, durationMs: 1500, energy: 50, dwsMs: 600 } },
  ICE_BEAM: { id: 'ICE_BEAM', name: 'Ice Beam', type: 'ice', kind: 'charged', pvp: { power: 90, energy: 55, energyGain: 0, cooldown: 500, turns: 1 }, pve: { power: 90, durationMs: 3300, energy: 50, dwsMs: 1800 } },
  HYDRO_PUMP: { id: 'HYDRO_PUMP', name: 'Hydro Pump', type: 'water', kind: 'charged', pvp: { power: 130, energy: 75, energyGain: 0, cooldown: 500, turns: 1 }, pve: { power: 130, durationMs: 3300, energy: 100, dwsMs: 1500 } }
};
const pick = (t) => ({ fast: t.includes('psychic') ? ['CONFUSION'] : t.includes('fighting') ? ['COUNTER'] : ['BUBBLE'], charged: t.includes('psychic') ? ['PSYCHIC'] : t.includes('fighting') ? ['CROSS_CHOP'] : ['ICE_BEAM', 'HYDRO_PUMP'] });
const base = S.map(s => ({ ...s, ...pick(s.types), elite: [], legacy: [], tags: [], released: true, shadow: false }));
const species = base.concat(base.slice(0, 40).map(s => ({ ...s, id: s.id + '_shadow', name: s.name + ' (Shadow)', tags: ['shadow'], shadow: true })));
const rk = (n) => species.slice(0, n).map((s, i) => ({ id: s.id, score: +(96 - i * 0.7).toFixed(1), moveset: [s.fast[0], s.charged[0], s.charged[1] || s.charged[0]] }));
const pveMoves = {}; Object.values(moves).forEach(m => { pveMoves[m.id === 'CONFUSION' || m.id === 'COUNTER' || m.id === 'BUBBLE' ? m.id + '_FAST' : m.id] = { id: m.id, name: m.name, type: m.type, kind: m.kind, pve: m.pve }; });
const pveSpecies = species.map(s => ({ id: s.id, dex: s.dex, name: s.name, types: s.types, base: s.base, fast: s.fast.map(f => f + '_FAST'), charged: s.charged, elite: [], tags: [], hasShadow: true }));
const w = (n, o) => fs.writeFileSync(path.join(out, n), JSON.stringify(o));
w('species.json', species); w('moves.json', moves);
w('rankings.json', { great: rk(40), ultra: rk(30), master: rk(30), little: rk(10), cups: { retro: rk(25) } });
w('pve.json', { species: pveSpecies, moves: pveMoves, battle: { shadowAtk: 1.2, shadowDef: 0.8333333 } });
w('meta.json', { schema: 1, generatedAt: new Date().toISOString(), hash: 'fixture', counts: { species: species.length, moves: 7, pveSpecies: pveSpecies.length },
  sources: { pvpoke: { ageDays: 1 }, niantic: { mirror: 'fixture', ageDays: 1 } }, checks: [{ level: 'warn', code: 'battle.unverified', msg: 'Ejemplo de aviso' }], validated: true });
w('changes.json', { generatedAt: new Date().toISOString(), moves: [{ id: 'PSYCHIC', name: 'Psychic', type: 'psychic', changes: [{ mode: 'pvp', field: 'power', from: 90, to: 85 }] }], newMoves: [{ id: 'X', name: 'Nuevo' }], removedMoves: [], newSpecies: [], movepool: [] });
console.log('fixture escrito en', out);
