/*
 * constants.js — Constantes del juego (fuente de verdad local).
 *
 * IMPORTANTE (confiabilidad): todo lo que aquí se marca como "verificable"
 * también lo extrae scripts/update-data.mjs del Game Master de Niantic y lo
 * COMPARA contra estos valores. Si difieren, la actualización se bloquea y
 * se emite un aviso (ver scripts/lib/validate.mjs). Así un cambio de Niantic
 * nunca se cuela en silencio.
 */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;

  // ---------------------------------------------------------------------
  // CP Multiplier (CPM) por nivel ENTERO. Los medios niveles se derivan:
  //   cpm(L+0.5) = sqrt((cpm(L)^2 + cpm(L+1)^2) / 2)
  // Índice 0 = nivel 1 … índice 50 = nivel 51 (Mejor Compañero).
  // ---------------------------------------------------------------------
  const CPM_WHOLE = [
    0.094, 0.16639787, 0.21573247, 0.25572005, 0.29024988,   // 1-5
    0.3210876, 0.34921268, 0.37523559, 0.39956728, 0.4225,    // 6-10
    0.44310755, 0.46279839, 0.48168495, 0.49985844, 0.51739395, // 11-15
    0.53435433, 0.55079269, 0.56675452, 0.58227891, 0.5974,   // 16-20
    0.61215729, 0.62656713, 0.64065295, 0.65443563, 0.667934,  // 21-25
    0.68116492, 0.69414365, 0.70688421, 0.71939909, 0.7317,   // 26-30
    0.73776948, 0.74378943, 0.74976104, 0.75568551, 0.76156384, // 31-35
    0.76739717, 0.7731865, 0.77893275, 0.78463697, 0.7903,    // 36-40
    0.7953, 0.8003, 0.8053, 0.8103, 0.8153,                   // 41-45
    0.8203, 0.8253, 0.8303, 0.8353, 0.8403,                   // 46-50
    0.8453                                                     // 51
  ];
  const MAX_LEVEL_HARD = 51;

  /** Lista de todos los niveles posibles (1, 1.5, … 51). */
  const LEVELS = [];
  for (let l = 1; l <= MAX_LEVEL_HARD; l += 0.5) LEVELS.push(l);

  function cpmWhole(level, table) {
    const t = table || CPM_WHOLE;
    return t[level - 1];
  }
  /** CPM para cualquier nivel (entero o .5). `table` permite inyectar la del Game Master. */
  function cpm(level, table) {
    const t = table || CPM_WHOLE;
    if (level < 1 || level > t.length) throw new RangeError('Nivel fuera de rango: ' + level);
    const lo = Math.floor(level);
    if (level === lo) return t[lo - 1];
    return Math.sqrt((t[lo - 1] * t[lo - 1] + t[lo] * t[lo]) / 2);
  }

  // ---------------------------------------------------------------------
  // Tipos y efectividades (Pokémon GO usa 1.6 / 0.625 / 0.390625)
  // ---------------------------------------------------------------------
  const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
    'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

  const TYPE_ES = {
    normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
    fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico',
    bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada'
  };

  const TYPE_COLOR = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C', grass: '#7AC74C',
    ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65', flying: '#A98FF3',
    psychic: '#F95587', bug: '#A6B91A', rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC',
    dark: '#705746', steel: '#B7B7CE', fairy: '#D685AD'
  };

  const EFF = { SE: 1.6, NVE: 0.625, IMMUNE: 0.390625 }; // en GO la inmunidad = doble resistencia

  const _CHART_SRC = {
    normal:   { nve: ['rock', 'steel'], imm: ['ghost'] },
    fire:     { se: ['grass', 'ice', 'bug', 'steel'], nve: ['fire', 'water', 'rock', 'dragon'] },
    water:    { se: ['fire', 'ground', 'rock'], nve: ['water', 'grass', 'dragon'] },
    electric: { se: ['water', 'flying'], nve: ['electric', 'grass', 'dragon'], imm: ['ground'] },
    grass:    { se: ['water', 'ground', 'rock'], nve: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
    ice:      { se: ['grass', 'ground', 'flying', 'dragon'], nve: ['fire', 'water', 'ice', 'steel'] },
    fighting: { se: ['normal', 'ice', 'rock', 'dark', 'steel'], nve: ['poison', 'flying', 'psychic', 'bug', 'fairy'], imm: ['ghost'] },
    poison:   { se: ['grass', 'fairy'], nve: ['poison', 'ground', 'rock', 'ghost'], imm: ['steel'] },
    ground:   { se: ['fire', 'electric', 'poison', 'rock', 'steel'], nve: ['grass', 'bug'], imm: ['flying'] },
    flying:   { se: ['grass', 'fighting', 'bug'], nve: ['electric', 'rock', 'steel'] },
    psychic:  { se: ['fighting', 'poison'], nve: ['psychic', 'steel'], imm: ['dark'] },
    bug:      { se: ['grass', 'psychic', 'dark'], nve: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
    rock:     { se: ['fire', 'ice', 'flying', 'bug'], nve: ['fighting', 'ground', 'steel'] },
    ghost:    { se: ['psychic', 'ghost'], nve: ['dark'], imm: ['normal'] },
    dragon:   { se: ['dragon'], nve: ['steel'], imm: ['fairy'] },
    dark:     { se: ['psychic', 'ghost'], nve: ['fighting', 'dark', 'fairy'] },
    steel:    { se: ['ice', 'rock', 'fairy'], nve: ['fire', 'water', 'electric', 'steel'] },
    fairy:    { se: ['fighting', 'dragon', 'dark'], nve: ['fire', 'poison', 'steel'] }
  };

  /** TYPE_CHART[atacante][defensor] = multiplicador (1 por defecto). */
  const TYPE_CHART = {};
  TYPES.forEach(a => {
    TYPE_CHART[a] = {};
    TYPES.forEach(d => { TYPE_CHART[a][d] = 1; });
    const s = _CHART_SRC[a];
    (s.se || []).forEach(d => { TYPE_CHART[a][d] = EFF.SE; });
    (s.nve || []).forEach(d => { TYPE_CHART[a][d] = EFF.NVE; });
    (s.imm || []).forEach(d => { TYPE_CHART[a][d] = EFF.IMMUNE; });
  });

  // ---------------------------------------------------------------------
  // Multiplicadores de combate
  // ---------------------------------------------------------------------
  const MULT = {
    STAB: 1.2,
    WEATHER: 1.2,
    SHADOW_ATK: 1.2,
    SHADOW_DEF: 5 / 6,        // 0.8333…
    PVP_BONUS: 1.3,           // multiplicador global de daño en combates de entrenadores
    DODGE: 0.25,              // daño recibido tras esquivar (incursiones)
    ENERGY_PER_HP: 0.5        // energía ganada por PS perdido (incursiones)
  };

  // ---------------------------------------------------------------------
  // Ligas de PvP (tope de PC)
  // ---------------------------------------------------------------------
  const LEAGUES = {
    little: { id: 'little', name: 'Liga Copa Pequeña', cap: 500 },
    great:  { id: 'great',  name: 'Liga Grande',       cap: 1500 },
    ultra:  { id: 'ultra',  name: 'Liga Ultra',        cap: 2500 },
    master: { id: 'master', name: 'Liga Máster',       cap: Infinity }
  };

  // ---------------------------------------------------------------------
  // IV: suelos mínimos por origen (verificado en GO Hub, sep-2026)
  // ---------------------------------------------------------------------
  const IV_SOURCES = [
    { id: 'wild',    label: 'Salvaje (sin clima)',                 floor: 0 },
    { id: 'weather', label: 'Salvaje con clima potenciado',        floor: 4 },
    { id: 'raid',    label: 'Incursión / Huevo / Investigación',   floor: 10 },
    { id: 'lucky',   label: 'Pokémon Lucky',                       floor: 12 },
    { id: 'trade1',  label: 'Intercambio · Buen amigo',            floor: 1 },
    { id: 'trade2',  label: 'Intercambio · Gran amigo',            floor: 2 },
    { id: 'trade3',  label: 'Intercambio · Ultra amigo',           floor: 3 },
    { id: 'trade5',  label: 'Intercambio · Mejor amigo',           floor: 5 }
  ];
  const PURIFY_IV_BONUS = 2; // purificar suma +2 a cada IV (máx. 15)

  // ---------------------------------------------------------------------
  // Evaluación (appraisal) del juego
  // ---------------------------------------------------------------------
  const APPRAISAL_OVERALL = [ // por suma total de IV (0-45)
    { id: 0, label: '0 estrellas (0–48,9 %)',      min: 0,  max: 22 },
    { id: 1, label: '1 estrella (51,1–64,4 %)',    min: 23, max: 29 },
    { id: 2, label: '2 estrellas (66,7–80 %)',     min: 30, max: 36 },
    { id: 3, label: '3 estrellas (82,2–97,8 %)',   min: 37, max: 44 },
    { id: 4, label: '4 estrellas (100 %)',         min: 45, max: 45 }
  ];
  const APPRAISAL_BAR = [ // por IV individual
    { id: 0, label: 'Barra 1 (0–5)',    min: 0,  max: 5 },
    { id: 1, label: 'Barra 2 (6–10)',   min: 6,  max: 10 },
    { id: 2, label: 'Barra 3 (11–14)',  min: 11, max: 14 },
    { id: 3, label: 'Barra completa (15)', min: 15, max: 15 }
  ];

  // ---------------------------------------------------------------------
  // Polvo estelar por potenciación (coste al subir DESDE ese nivel).
  // Verificado en GO Hub (tabla de costes). Niveles ≥ 40 los aporta el
  // Game Master (upgrades.json); si no están, la calculadora pide el nivel.
  // ---------------------------------------------------------------------
  const DUST_STEPS = [ // [desdeNivel, hastaNivel, polvo]
    [1, 2.5, 200], [3, 4.5, 400], [5, 6.5, 600], [7, 8.5, 800], [9, 10.5, 1000],
    [11, 12.5, 1300], [13, 14.5, 1600], [15, 16.5, 1900], [17, 18.5, 2200], [19, 20.5, 2500],
    [21, 22.5, 3000], [23, 24.5, 3500], [25, 26.5, 4000], [27, 28.5, 4500], [29, 30.5, 5000],
    [31, 32.5, 6000], [33, 34.5, 7000], [35, 36.5, 8000], [37, 38.5, 9000], [39, 39.5, 10000]
  ];

  /** Devuelve un mapa polvo -> [niveles] a partir de una tabla (por defecto la incluida). */
  function dustToLevels(steps) {
    const map = {};
    (steps || DUST_STEPS).forEach(([from, to, dust]) => {
      for (let l = from; l <= to + 1e-9; l += 0.5) {
        (map[dust] = map[dust] || []).push(l);
      }
    });
    return map;
  }

  const api = {
    CPM_WHOLE, MAX_LEVEL_HARD, LEVELS, cpm, cpmWhole,
    TYPES, TYPE_ES, TYPE_COLOR, TYPE_CHART, EFF, MULT,
    LEAGUES, IV_SOURCES, PURIFY_IV_BONUS, APPRAISAL_OVERALL, APPRAISAL_BAR,
    DUST_STEPS, dustToLevels
  };
  if (isNode) module.exports = api; else { root.PoGo = root.PoGo || {}; root.PoGo.constants = api; }
})(typeof window !== 'undefined' ? window : globalThis);
