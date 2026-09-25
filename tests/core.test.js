'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core/constants.js');
const S = require('../js/core/stats.js');
const IV = require('../js/core/iv.js');
const PVP = require('../js/core/pvp.js');
const PVE = require('../js/core/pve.js');

const MEWTWO = { atk: 300, def: 182, hp: 214 };
const DRAGONITE = { atk: 263, def: 198, hp: 209 };
const AZUMARILL = { atk: 112, def: 152, hp: 225 };
const REGISTEEL = { atk: 143, def: 285, hp: 190 };
const HUNDO = { atk: 15, def: 15, hp: 15 };

test('CPM: valores clave y medios niveles', () => {
  assert.equal(C.cpm(1), 0.094);
  assert.equal(C.cpm(40), 0.7903);
  assert.equal(C.cpm(50), 0.8403);
  assert.ok(Math.abs(C.cpm(1.5) - 0.135137432) < 1e-8);
  for (let l = 1; l < 51; l += 0.5) assert.ok(C.cpm(l + 0.5) > C.cpm(l), 'CPM debe crecer: ' + l);
  assert.equal(C.CPM_WHOLE.length, 51);
});

test('CP: anclas publicadas (Mewtwo hundo L40=4178, L50=4724; Dragonite L40=3792)', () => {
  assert.equal(S.computeCP(MEWTWO, HUNDO, 40), 4178);
  assert.equal(S.computeCP(MEWTWO, HUNDO, 50), 4724);
  assert.equal(S.computeCP(DRAGONITE, HUNDO, 40), 3792);
});

test('CP: mínimo 10 y HP mínimo 10', () => {
  assert.equal(S.computeCP({ atk: 1, def: 1, hp: 1 }, { atk: 0, def: 0, hp: 0 }, 1), 10);
  assert.equal(S.computeHP({ atk: 1, def: 1, hp: 1 }, { atk: 0, def: 0, hp: 0 }, 1), 10);
});

test('Polvo: coste acumulado nivel 1→40 = 270.000', () => {
  const total = C.DUST_STEPS.reduce((s, [f, t, d]) => s + d * ((t - f) * 2 + 1), 0);
  assert.equal(total, 270000);
  const map = C.dustToLevels();
  assert.deepEqual(map[1000], [9, 9.5, 10, 10.5]);
});

test('IV: ida y vuelta aleatoria (siempre contiene el IV real)', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const dustMap = C.dustToLevels();
  for (let i = 0; i < 200; i++) {
    const base = { atk: 50 + Math.floor(rnd() * 250), def: 50 + Math.floor(rnd() * 250), hp: 50 + Math.floor(rnd() * 250) };
    const iv = { atk: Math.floor(rnd() * 16), def: Math.floor(rnd() * 16), hp: Math.floor(rnd() * 16) };
    const level = 1 + Math.floor(rnd() * 78) / 2; // 1..40
    const cp = S.computeCP(base, iv, level), hp = S.computeHP(base, iv, level);
    const dust = Object.keys(dustMap).find(d => dustMap[d].includes(level));
    const cands = IV.solveIVs({ base, cp, hp, levels: dustMap[dust] });
    assert.ok(cands.some(c => c.level === level && c.atk === iv.atk && c.def === iv.def && c.hp === iv.hp), 'falta el IV real');
    // sin polvo también debe contenerlo
    const all = IV.solveIVs({ base, cp, hp, maxLevel: 40 });
    assert.ok(all.some(c => c.level === level && c.atk === iv.atk && c.def === iv.def && c.hp === iv.hp));
  }
});

test('IV: suelos y evaluación filtran correctamente', () => {
  const cp = S.computeCP(MEWTWO, { atk: 12, def: 13, hp: 14 }, 25), hp = S.computeHP(MEWTWO, { atk: 12, def: 13, hp: 14 }, 25);
  const base = IV.solveIVs({ base: MEWTWO, cp, hp, levels: [25] });
  const floored = IV.solveIVs({ base: MEWTWO, cp, hp, levels: [25], floor: 10 });
  assert.ok(floored.length <= base.length);
  floored.forEach(c => assert.ok(c.atk >= 10 && c.def >= 10 && c.hp >= 10));
  const ap = IV.solveIVs({ base: MEWTWO, cp, hp, levels: [25], appraisal: { overall: 3, atk: 2 } });
  ap.forEach(c => { assert.ok(c.total >= 37 && c.total <= 44); assert.ok(c.atk >= 11 && c.atk <= 14); });
  assert.ok(ap.some(c => c.atk === 12 && c.def === 13 && c.hp === 14));
});

test('IV: overall admite un rango {min,max} (para no excluir un hundo al leer "3 estrellas" en una foto)', () => {
  const iv15 = { atk: 15, def: 15, hp: 15 };
  const hp = S.computeHP(MEWTWO, iv15, 50), cp = S.computeCP(MEWTWO, iv15, 50);
  const withId3 = IV.solveIVs({ base: MEWTWO, cp, hp, levels: [50], appraisal: { overall: 3 } });
  const withRange = IV.solveIVs({ base: MEWTWO, cp, hp, levels: [50], appraisal: { overall: { min: 37, max: 45 } } });
  assert.equal(withId3.length, 0, 'el id 3 (37-44) excluye erróneamente al hundo (45)');
  assert.ok(withRange.some(c => c.atk === 15 && c.def === 15 && c.hp === 15));
});

test('IV: recomendación de qué evaluar reduce candidatos', () => {
  const cands = IV.solveIVs({ base: MEWTWO, cp: 2000, hp: 120, maxLevel: 40 });
  if (cands.length > 1) {
    const r = IV.bestNextAppraisal(cands);
    assert.ok(r && r.length === 4);
    assert.ok(r[0].expected <= r[3].expected);
  }
});

test('PvP: rango 1 Liga Grande coincide con datos independientes (PokeXperience, sep-2026)', () => {
  const az = PVP.buildRankTable(AZUMARILL, 1500, 50).best;
  assert.deepEqual([az.atk, az.def, az.hp, az.level, az.cp], [0, 15, 15, 45.5, 1499]);
  const rg = PVP.buildRankTable(REGISTEEL, 1500, 50).best;
  assert.deepEqual([rg.atk, rg.def, rg.hp, rg.level, rg.cp], [0, 8, 15, 24, 1500]);
});

test('PvP: tabla completa, orden, porcentajes y Máster', () => {
  const t = PVP.buildRankTable(AZUMARILL, 1500, 50);
  assert.equal(t.count, 4096);
  assert.equal(t.rows[0].rank, 1);
  assert.ok(t.rows.every((r, i) => i === 0 || t.rows[i - 1].sp >= r.sp));
  assert.ok(t.rows.every(r => r.cp <= 1500));
  assert.equal(PVP.evaluate(AZUMARILL, HUNDO, 1500, 50).of, 4096);
  const m = PVP.buildRankTable(MEWTWO, Infinity, 50);
  assert.deepEqual([m.best.atk, m.best.def, m.best.hp], [15, 15, 15]);
  const h = PVP.histogram(t, 20);
  assert.equal(h.bins.reduce((s, b) => s + b.n, 0), 4096);
});

test('PvP: tope de nivel 40 vs 50 cambia el óptimo pero respeta el tope', () => {
  const t40 = PVP.buildRankTable(AZUMARILL, 1500, 40);
  assert.ok(t40.rows.every(r => r.level <= 40 && r.cp <= 1500));
});

test('PvP: daño y puntos de quiebre coherentes', () => {
  const o = { power: 3, atk: 150.2, def: 130.7, stab: true, eff: 1.6 };
  const d = PVP.pvpDamage(o);
  const bp = PVP.breakpoint(o);
  assert.equal(bp.damage, d);
  assert.equal(PVP.pvpDamage({ ...o, atk: bp.atkNeeded + 1e-9 }), d + 1);
  assert.equal(PVP.pvpDamage({ ...o, atk: bp.atkNeeded - 1e-6 }), d);
  const bk = PVP.bulkpoint({ power: 12, atk: 120, def: 100, stab: false, eff: 1 });
  if (bk.defNeeded) {
    const after = PVP.pvpDamage({ power: 12, atk: 120, def: bk.defNeeded + 1e-6, stab: false, eff: 1 });
    assert.equal(after, bk.damage - 1);
  }
});

test('PvP: métricas de movimientos', () => {
  const fast = { power: 4, energyGain: 5, cooldown: 1000 };
  assert.deepEqual(PVP.fastMetrics(fast), { turns: 2, dpt: 2, ept: 2.5 });
  assert.equal(PVP.turnsToCharge(fast, { energy: 55 }), 22);
  assert.equal(PVP.STAGE(1), 1.25); assert.equal(PVP.STAGE(-1), 0.8); assert.equal(PVP.STAGE(4), 2); assert.equal(PVP.STAGE(-4), 0.5);
});

test('Tipos: apilado de efectividades (fuentes: GO Hub / Gamepress)', () => {
  const m = (a, d) => PVE.typeEff(a, d);
  assert.ok(Math.abs(m('electric', ['water', 'flying']) - 2.56) < 1e-12);            // Gyarados
  assert.ok(Math.abs(m('electric', ['ground', 'dragon']) - 0.390625 * 0.625) < 1e-12); // Flygon
  assert.equal(m('normal', ['ghost']), 0.390625);
  assert.ok(Math.abs(m('fire', ['grass', 'ice']) - 2.56) < 1e-12);
  assert.equal(C.TYPES.length, 18);
});

test('PvE: fórmula de daño (ejemplo GO Hub = 168)', () => {
  const mult = 1.2 * 1.4;
  assert.equal(PVE.pveDamage(180, 1.109375, 1, mult), 168);
});

test('PvE: DPS sin daño entrante = DPS0 y con daño entrante sube si el cargado es más eficiente', () => {
  const inp = { FDmg: 10, CDmg: 100, FE: 8, CE: 50, FDur: 1, CDur: 2.5, CDWS: 1.5, HP: 150, y: 0 };
  const r0 = PVE.comprehensiveDPS(inp);
  assert.ok(Math.abs(r0.dps - r0.dps0) < 1e-12);
  assert.equal(r0.tdo, Infinity);
  const r1 = PVE.comprehensiveDPS({ ...inp, y: 30 });
  assert.ok(r1.dps > r0.dps);
  assert.ok(Math.abs(r1.tdo - r1.dps * 150 / 30) < 1e-9);
});

test('PvE: conservación de energía del modelo (simulación por ciclos ≈ fórmula)', () => {
  // Con y=0 el ciclo es: n fast por cargado, n=CE/FE (continuo)
  const i = { FDmg: 12, CDmg: 90, FE: 9, CE: 45, FDur: 1.0, CDur: 2.2, CDWS: 1, HP: 200, y: 0 };
  const n = i.CE / i.FE;
  const cycle = (n * i.FDmg + i.CDmg) / (n * i.FDur + i.CDur);
  assert.ok(Math.abs(PVE.comprehensiveDPS(i).dps - cycle) < 1e-9);
});

test('PvE: eDPS < DPS, crece con TDO', () => {
  assert.ok(PVE.eDPS(20, 400, 10) < 20);
  assert.ok(PVE.eDPS(20, 800, 10) > PVE.eDPS(20, 400, 10));
  assert.equal(PVE.eDPS(20, Infinity, 10), 20);
});

test('PvE: performance() de extremo a extremo con jefe', () => {
  const att = { base: MEWTWO, iv: HUNDO, level: 40, types: ['psychic'] };
  const fast = { type: 'psychic', power: 16, durationMs: 1600, energy: 12 };
  const charged = { type: 'psychic', power: 90, durationMs: 2000, energy: 50, dwsMs: 1200 };
  const boss = { atk: 250, def: 200, types: ['fighting'], fast: { type: 'fighting', power: 8, durationMs: 1000, energy: 8 }, charged: [{ type: 'fighting', power: 100, durationMs: 2500, energy: 50 }] };
  const p = PVE.performance(att, fast, charged, boss, {});
  assert.ok(p.dps > 0 && p.tdo > 0 && p.edps > 0 && p.edps < p.dps);
  const shadow = PVE.performance({ ...att, isShadow: true }, fast, charged, boss, {});
  assert.ok(shadow.dps > p.dps, 'Sombrío debe pegar más');
  assert.ok(shadow.timeAlive < p.timeAlive, 'Sombrío debe sobrevivir menos tiempo');
});

test('Copas: reglas de tipos y prohibiciones (Retro Cup, Willpower Cup)', () => {
  const retro = { excludeTypes: ['dark', 'steel', 'fairy'] };
  assert.equal(PVP.cupEligibility({ id: 'azumarill', name: 'Azumarill', types: ['water', 'fairy'] }, retro).ok, false);
  assert.equal(PVP.cupEligibility({ id: 'medicham', name: 'Medicham', types: ['fighting', 'psychic'] }, retro).ok, true);
  const will = { includeTypes: ['fighting', 'psychic', 'dark'], bannedNames: ['Gardevoir'] };
  assert.equal(PVP.cupEligibility({ id: 'gardevoir', name: 'Gardevoir', types: ['psychic', 'fairy'] }, will).ok, false);
  assert.equal(PVP.cupEligibility({ id: 'machamp', name: 'Machamp', types: ['fighting'] }, will).ok, true);
  assert.equal(PVP.cupEligibility({ id: 'mewtwo', name: 'Mewtwo', types: ['psychic'], tags: ['legendary'] }, { allowLegendary: false }).ok, false);
});
