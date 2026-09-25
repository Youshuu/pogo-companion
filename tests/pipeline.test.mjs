import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePvpokeGamemaster, parsePvpokeRanking } from '../scripts/lib/parse-pvpoke.mjs';
import { parseNianticGM } from '../scripts/lib/parse-niantic.mjs';
import { validateAll } from '../scripts/lib/validate.mjs';
import { diffData } from '../scripts/lib/diff.mjs';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../js/core/constants.js');

// ---- Fixtures sintéticos con la FORMA documentada de cada fuente
const pvpokeGM = () => ({
  pokemon: [
    { dex: 150, speciesId: 'mewtwo', speciesName: 'Mewtwo', baseStats: { atk: 300, def: 182, hp: 214 }, types: ['psychic', 'none'], fastMoves: ['CONFUSION'], chargedMoves: ['PSYCHIC'], tags: ['legendary'] },
    { dex: 184, speciesId: 'azumarill', speciesName: 'Azumarill', baseStats: { atk: 112, def: 152, hp: 225 }, types: ['water', 'fairy'], fastMoves: ['BUBBLE'], chargedMoves: ['ICE_BEAM'] },
    { dex: 379, speciesId: 'registeel', speciesName: 'Registeel', baseStats: { atk: 143, def: 285, hp: 190 }, types: ['steel'], fastMoves: [], chargedMoves: [] },
    { dex: 149, speciesId: 'dragonite', speciesName: 'Dragonite', baseStats: { atk: 263, def: 198, hp: 209 }, types: ['dragon', 'flying'], fastMoves: [], chargedMoves: [] },
    { dex: 184, speciesId: 'azumarill_shadow', speciesName: 'Azumarill (Shadow)', baseStats: { atk: 112, def: 152, hp: 225 }, types: ['water', 'fairy'], tags: ['shadow'], fastMoves: [], chargedMoves: [] }
  ],
  moves: [
    { moveId: 'CONFUSION', name: 'Confusion', type: 'psychic', power: 16, energy: 0, energyGain: 12, cooldown: 1500 },
    { moveId: 'PSYCHIC', name: 'Psychic', type: 'psychic', power: 90, energy: 55, energyGain: 0, cooldown: 500, buffs: [0, -1], buffTarget: 'opponent', buffApplyChance: '0.1' }
  ]
});
const nianticGM = () => ([
  { templateId: 'V0150_POKEMON_MEWTWO', data: { pokemonSettings: { pokemonId: 'MEWTWO', type: 'POKEMON_TYPE_PSYCHIC', stats: { baseStamina: 214, baseAttack: 300, baseDefense: 182 }, quickMoves: ['CONFUSION_FAST'], cinematicMoves: ['PSYCHIC'], eliteCinematicMove: ['FOCUS_BLAST'], shadow: {}, tempEvoOverrides: [{ tempEvoId: 'TEMP_EVOLUTION_MEGA_X', stats: { baseStamina: 214, baseAttack: 412, baseDefense: 222 }, typeOverride1: 'POKEMON_TYPE_PSYCHIC', typeOverride2: 'POKEMON_TYPE_FIGHTING' }] } } },
  { templateId: 'V0227_MOVE_CONFUSION_FAST', data: { moveSettings: { movementId: 'CONFUSION_FAST', pokemonType: 'POKEMON_TYPE_PSYCHIC', power: 16, durationMs: 1600, energyDelta: 12, damageWindowStartMs: 800 } } },
  { templateId: 'V0100_MOVE_PSYCHIC', data: { moveSettings: { movementId: 'PSYCHIC', pokemonType: 'POKEMON_TYPE_PSYCHIC', power: 90, durationMs: 2800, energyDelta: -50, damageWindowStartMs: 1000 } } },
  { templateId: 'COMBAT_V0100_MOVE_PSYCHIC', data: { combatMove: { uniqueId: 'PSYCHIC', type: 'POKEMON_TYPE_PSYCHIC', power: 90, durationTurns: 0, energyDelta: -55 } } },
  { templateId: 'PLAYER_LEVEL_SETTINGS', data: { playerLevel: { cpMultiplier: C.CPM_WHOLE.slice() } } },
  { templateId: 'BATTLE_SETTINGS', data: { battleSettings: { sameTypeAttackBonusMultiplier: 1.2, energyDeltaPerHealthLost: 0.5, shadowPokemonAttackBonusMultiplier: 1.2, shadowPokemonDefenseBonusMultiplier: 0.8333333 } } }
]);

test('PvPoke: normaliza especies y movimientos', () => {
  const r = parsePvpokeGamemaster(pvpokeGM());
  assert.equal(r.species.length, 5);
  assert.deepEqual(r.species[0].types, ['psychic']);           // "none" descartado
  assert.equal(r.species[4].shadow, true);
  assert.equal(r.moves.CONFUSION.kind, 'fast'); assert.equal(r.moves.CONFUSION.pvp.turns, 3);
  assert.equal(r.moves.PSYCHIC.kind, 'charged'); assert.equal(r.moves.PSYCHIC.pvp.buffApplyChance, 0.1);
  assert.throws(() => parsePvpokeGamemaster({}), /formato inesperado/);
});

test('PvPoke: ranking compacto y ordenado', () => {
  const r = parsePvpokeRanking([{ speciesId: 'a', score: 80.44, moveset: ['X'] }, { speciesId: 'b', score: 95.06 }]);
  assert.deepEqual(r.map(x => x.id), ['b', 'a']); assert.equal(r[1].score, 80.4);
});

test('Niantic: movimientos PvE, especies, megas, CPM y constantes', () => {
  const g = parseNianticGM(nianticGM());
  assert.deepEqual(g.moves.CONFUSION_FAST.pve, { power: 16, durationMs: 1600, energy: 12, dwsMs: 800 });
  assert.equal(g.moves.CONFUSION_FAST.kind, 'fast'); assert.equal(g.moves.PSYCHIC.kind, 'charged'); assert.equal(g.moves.PSYCHIC.pve.energy, 50);
  assert.equal(g.pvpMoves.PSYCHIC.energy, 55);
  const m = g.species.find(s => s.id === 'mewtwo');
  assert.deepEqual(m.charged.sort(), ['FOCUS_BLAST', 'PSYCHIC']); assert.equal(m.hasShadow, true);
  const mega = g.species.find(s => s.id === 'mega_mewtwo_x');
  assert.ok(mega && mega.base.atk === 412 && mega.tags.includes('mega') && mega.types.includes('fighting'));
  assert.equal(g.cpm.length, 51); assert.equal(g.battle.stab, 1.2);
  assert.throws(() => parseNianticGM({}), /formato inesperado/);
});

const okInputs = () => {
  const pv = parsePvpokeGamemaster(pvpokeGM());
  // relleno para superar los mínimos de conteo
  for (let i = 0; i < 900; i++) pv.species.push({ id: 'x' + i, base: { atk: 100, def: 100, hp: 100 }, types: ['normal'] });
  for (let i = 0; i < 300; i++) pv.moves['M' + i] = { id: 'M' + i, pvp: { power: 1, energy: 0, energyGain: 1, turns: 1 } };
  return { pvpoke: pv, niantic: parseNianticGM(nianticGM()), rankings: { great: [{}] }, ages: {}, staleDays: {} };
};

test('Validación: datos sanos pasan (con avisos por lo no verificable)', () => {
  const r = validateAll(okInputs());
  assert.equal(r.ok, true, JSON.stringify(r.issues.filter(i => i.level === 'error')));
});
test('Validación: CPM alterado BLOQUEA', () => {
  const i = okInputs(); i.niantic.cpm[39] = 0.8;
  const r = validateAll(i); assert.equal(r.ok, false); assert.ok(r.issues.some(x => x.code === 'cpm.mismatch'));
});
test('Validación: stats ancla alterados BLOQUEAN', () => {
  const i = okInputs(); i.pvpoke.species[0].base.atk = 301;
  assert.equal(validateAll(i).ok, false);
});
test('Validación: multiplicador Sombrío distinto BLOQUEA; descarga truncada BLOQUEA', () => {
  const i = okInputs(); i.niantic.battle.shadowAtk = 1.25; assert.equal(validateAll(i).ok, false);
  const j = okInputs(); j.pvpoke.species.length = 10; assert.equal(validateAll(j).ok, false);
});
test('Validación: rezago de PvPoke y fuente vieja generan aviso, no bloqueo', () => {
  const i = okInputs(); i.pvpoke.moves.PSYCHIC.pvp.energy = 60; i.ages = { niantic: 100 }; i.staleDays = { niantic: 30 };
  const r = validateAll(i); assert.equal(r.ok, true);
  assert.ok(r.issues.some(x => x.code === 'stale.niantic'));
});

test('Diff: detecta cambios de PvP/PvE, movimientos nuevos y movepools', () => {
  const prev = { moves: { A: { name: 'A', pvp: { power: 45, energy: 35 }, pve: { power: 10 } }, B: { name: 'B', pvp: {} } }, species: [{ id: 's', fast: ['A'], charged: [] }] };
  const next = { moves: { A: { name: 'A', type: 'x', pvp: { power: 60, energy: 40 }, pve: { power: 10 } }, C: { name: 'C' } }, species: [{ id: 's', fast: ['A', 'C'], charged: [] }, { id: 'n', name: 'N' }] };
  const d = diffData(prev, next);
  assert.equal(d.moves[0].changes.length, 2); assert.equal(d.newMoves[0].id, 'C'); assert.equal(d.removedMoves[0].id, 'B');
  assert.deepEqual(d.movepool[0].added, ['C']); assert.equal(d.newSpecies[0].id, 'n');
});
