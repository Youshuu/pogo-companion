'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/core/scan.js');

test('parseCP: lee texto real de OCR (con y sin ruido)', () => {
  assert.equal(S.parseCP('PC822'), 822);
  assert.equal(S.parseCP('PC 1,234'), 1234);
  assert.equal(S.parseCP('poC94'), 94);
  assert.equal(S.parseCP('   '), null);
  assert.equal(S.parseCP('PC99999'), null); // fuera de rango razonable
});

test('parseHP: exige cur === max para considerarla fiable', () => {
  assert.deepEqual(S.parseHP('113/113 PS'), { cur: 113, max: 113, full: true });
  assert.deepEqual(S.parseHP('84 / 84'), { cur: 84, max: 84, full: true });
  assert.deepEqual(S.parseHP('50/84 PS'), { cur: 50, max: 84, full: false });
  assert.equal(S.parseHP('ruido'), null);
});

test('matchSpecies: exacto, con ruido de OCR, y ambiguo', () => {
  const list = [{ id: 'gible', name: 'Gible' }, { id: 'gabite', name: 'Gabite' }, { id: 'garchomp', name: 'Garchomp' }, { id: 'azumarill', name: 'Azumarill' }];
  assert.equal(S.matchSpecies('Gible', list).species.id, 'gible');
  assert.equal(S.matchSpecies('G1ble', list).species.id, 'gible'); // 1 en vez de i
  assert.equal(S.matchSpecies('Gibie', list).species.id, 'gible');
  assert.equal(S.matchSpecies('xyzxyz', list), null);
  const amb = S.matchSpecies('Gabile', list); // a mitad de camino entre Gible y Gabite
  assert.ok(amb && ['gible', 'gabite'].includes(amb.species.id));
});

test('barFractionToBucket: cubos y zona de duda cerca de los límites', () => {
  assert.equal(S.barFractionToBucket(0.1), 0);
  assert.equal(S.barFractionToBucket(0.5), 1);
  assert.equal(S.barFractionToBucket(0.8), 2);
  assert.equal(S.barFractionToBucket(0.98), 3);
  assert.equal(S.barFractionToBucket(10 / 15), null); // justo en el límite 1|2
  assert.equal(S.barFractionToBucket(0.881), 2); // caso real medido en vídeo (11-14)
  assert.equal(S.barFractionToBucket(0.817), 2); // caso real medido en vídeo
  assert.equal(S.barFractionToBucket(null), null);
});

test('sameCard/groupReadings: el PC corrompido con un dígito de más se fusiona SOLO si los PS coinciden', () => {
  // Caso real observado: "894" se lee a veces como 1894/5894/9894 en fotogramas de la MISMA tarjeta.
  const hp113 = { cur: 113, max: 113, full: true };
  const readings = [
    { cp: 894, hp: hp113, nameText: 'Gible' },
    { cp: 1894, hp: hp113, nameText: 'Gibie' },
    { cp: 9894, hp: hp113, nameText: 'Gible' },
    { cp: 894, hp: hp113, nameText: 'Gible' },
  ];
  const g = S.groupReadings(readings);
  assert.equal(g.length, 1, 'las 4 lecturas son la misma tarjeta y deben quedar en un solo grupo');
  assert.equal(g[0].cp, 894, 'se debe preferir el PC más corto (sin el dígito de más)');
});

test('sameCard: NUNCA fusiona dos Pokémon distintos aunque el PC coincida por casualidad en las últimas cifras', () => {
  const a = { cp: 894, hp: { cur: 113, max: 113, full: true }, nameText: 'Gible' };
  const b = { cp: 1894, hp: { cur: 88, max: 88, full: true }, nameText: 'Gible' }; // PS distinto: otro individuo
  assert.equal(S.sameCard(a, b), false);
  const readings = [a, b];
  const g = S.groupReadings(readings);
  assert.equal(g.length, 2, 'con PS distinto deben quedar como dos tarjetas separadas');
});

test('sameCard: exige PC exacto cuando no hay PS fiable en alguna de las dos lecturas', () => {
  const a = { cp: 894, hp: null, nameText: 'Gible' };
  const b = { cp: 1894, hp: null, nameText: 'Gible' };
  assert.equal(S.sameCard(a, b), false); // sin PS, no se aplica la tolerancia del dígito de más
  assert.equal(S.sameCard({ cp: 894, hp: null }, { cp: 894, hp: null }), true);
});

test('groupReadings: colapsa fotogramas repetidos del mismo Pokémon y se queda con la mejor lectura', () => {
  const readings = [
    { cp: 822, hp: { cur: 113, max: 113, full: true }, nameText: 'Gibie', speciesMatch: null },
    { cp: 822, hp: { cur: 113, max: 113, full: true }, nameText: 'Gible', speciesMatch: { species: { id: 'gible' } } },
    { cp: 636, hp: { cur: 102, max: 102, full: true }, nameText: 'Gible', speciesMatch: { species: { id: 'gible' } } }
  ];
  const g = S.groupReadings(readings);
  assert.equal(g.length, 2);
  assert.equal(g[0].nameText, 'Gible'); // de las dos lecturas de PC822 se queda con la que sí reconoció la especie
  assert.equal(g[1].cp, 636);
});

test('groupReadings: el PC más corto gana aunque no sea el más frecuente en el grupo', () => {
  // Caso real observado con un Gible: 3 fotogramas leyeron "6430" (con dígito de más) y solo 1 leyó
  // el valor correcto "430" — debe ganar igualmente, porque más corto siempre es más fiable.
  const hp = { cur: 98, max: 98, full: true };
  const readings = [
    { cp: 6430, hp, nameText: 'Gible', speciesMatch: { species: { id: 'gible' } } },
    { cp: 430, hp, nameText: 'Gible', speciesMatch: { species: { id: 'gible' } } },
    { cp: 6430, hp, nameText: 'Gible', speciesMatch: { species: { id: 'gible' } } },
    { cp: 6430, hp, nameText: 'Gible', speciesMatch: { species: { id: 'gible' } } },
  ];
  const g = S.groupReadings(readings);
  assert.equal(g.length, 1);
  assert.equal(g[0].cp, 430);
});
