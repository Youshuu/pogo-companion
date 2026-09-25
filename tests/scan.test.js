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
