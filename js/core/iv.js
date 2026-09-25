/*
 * iv.js — Calculadora de IV.
 *
 * Método (exacto, sin heurísticas): se enumeran TODAS las combinaciones
 * (nivel, IV ataque, IV defensa, IV PS) compatibles con la PC y los PS que
 * muestra el juego, y se filtran con los datos opcionales (polvo estelar,
 * suelo de IV por origen, evaluación con estrellas/barras). Lo que sobrevive
 * es el conjunto COMPLETO de posibilidades: si hay una sola, es el IV real.
 *
 * Coste: ≤ 101 niveles × 16 PS × 256 = 413 k evaluaciones (<10 ms).
 */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./constants.js') : root.PoGo.constants;

  /**
   * @param {object} q
   *  base {atk,def,hp}; cp, hp  (enteros mostrados en el juego)
   *  levels?  lista de niveles candidatos (p. ej. deducidos del polvo)
   *  maxLevel? tope de nivel si no hay `levels` (por defecto 40)
   *  floor?   suelo mínimo de IV (0-15) por origen
   *  purified? true → cada IV actual ≥ 2 (purificar suma +2)
   *  appraisal? {overall: id|null, atk: id|null, def: id|null, hp: id|null}
   *  cpmTable? tabla CPM (del Game Master) opcional
   */
  function solveIVs(q) {
    const { base, cp, hp } = q;
    const cpmT = q.cpmTable;
    const floor = Math.max(0, q.floor || 0) + 0;
    const minIV = q.purified ? Math.max(floor, C.PURIFY_IV_BONUS) : floor;
    const maxL = q.maxLevel || 40;
    const levels = (q.levels && q.levels.length ? q.levels : C.LEVELS.filter(l => l <= maxL))
      .filter(l => l >= 1 && l <= (cpmT ? cpmT.length : C.MAX_LEVEL_HARD));
    const ap = q.appraisal || {};
    // overall admite un id (0-4, como en la IU manual) o un rango {min,max} ya resuelto (p. ej. al leer
    // "3 estrellas" desde una foto, que en el juego es ambiguo entre el id 3 y el id 4 "perfecto").
    const ovr = ap.overall == null ? null : (typeof ap.overall === 'object' ? ap.overall : C.APPRAISAL_OVERALL.find(x => x.id === ap.overall));
    const bar = (k) => (ap[k] != null ? C.APPRAISAL_BAR.find(x => x.id === ap[k]) : null);
    const bA = bar('atk'), bD = bar('def'), bH = bar('hp');

    const out = [];
    for (const level of levels) {
      const m = C.cpm(level, cpmT);
      const m2 = m * m;
      for (let s = minIV; s <= 15; s++) {
        if (bH && (s < bH.min || s > bH.max)) continue;
        if (Math.max(10, Math.floor((base.hp + s) * m)) !== hp) continue;
        const sq_s = Math.sqrt(base.hp + s);
        for (let a = minIV; a <= 15; a++) {
          if (bA && (a < bA.min || a > bA.max)) continue;
          for (let d = minIV; d <= 15; d++) {
            if (bD && (d < bD.min || d > bD.max)) continue;
            const tot = a + d + s;
            if (ovr && (tot < ovr.min || tot > ovr.max)) continue;
            const c = Math.max(10, Math.floor(((base.atk + a) * Math.sqrt(base.def + d) * sq_s * m2) / 10));
            if (c === cp) out.push({ level, atk: a, def: d, hp: s, total: tot, percent: (tot / 45) * 100 });
          }
        }
      }
    }
    return out;
  }

  /** Resumen estadístico del conjunto de candidatos. */
  function summarize(cands) {
    if (!cands.length) return null;
    const ivKey = (c) => c.atk + '/' + c.def + '/' + c.hp;
    const uniqIV = new Set(cands.map(ivKey));
    const uniqLevel = new Set(cands.map(c => c.level));
    const pcts = cands.map(c => c.percent);
    const mean = (f) => cands.reduce((s, c) => s + f(c), 0) / cands.length;
    return {
      count: cands.length,
      uniqueIVs: uniqIV.size,
      uniqueLevels: uniqLevel.size,
      minPct: Math.min(...pcts), maxPct: Math.max(...pcts), meanPct: mean(c => c.percent),
      mean: { atk: mean(c => c.atk), def: mean(c => c.def), hp: mean(c => c.hp) },
      min: { atk: Math.min(...cands.map(c => c.atk)), def: Math.min(...cands.map(c => c.def)), hp: Math.min(...cands.map(c => c.hp)) },
      max: { atk: Math.max(...cands.map(c => c.atk)), def: Math.max(...cands.map(c => c.def)), hp: Math.max(...cands.map(c => c.hp)) },
      exact: uniqIV.size === 1
    };
  }

  const barOf = (v) => C.APPRAISAL_BAR.find(b => v >= b.min && v <= b.max).id;
  const starOf = (tot) => C.APPRAISAL_OVERALL.find(o => tot >= o.min && tot <= o.max).id;

  /**
   * ¿Qué dato de la evaluación conviene mirar a continuación?
   * Para cada característica se calcula el nº ESPERADO de IV distintas que
   * quedarían (Σ n_g² / N sobre los grupos que produce). Menor = mejor.
   */
  function bestNextAppraisal(cands) {
    const ivs = new Map();
    cands.forEach(c => ivs.set(c.atk + '/' + c.def + '/' + c.hp, c));
    const uniq = [...ivs.values()];
    const N = uniq.length;
    if (N <= 1) return null;
    const feats = {
      overall: (c) => starOf(c.total),
      atk: (c) => barOf(c.atk), def: (c) => barOf(c.def), hp: (c) => barOf(c.hp)
    };
    const res = [];
    for (const [k, f] of Object.entries(feats)) {
      const g = {};
      uniq.forEach(c => { const key = f(c); g[key] = (g[key] || 0) + 1; });
      const expected = Object.values(g).reduce((s, n) => s + n * n, 0) / N;
      res.push({ feature: k, expected, groups: Object.keys(g).length });
    }
    res.sort((a, b) => a.expected - b.expected);
    return res;
  }

  const api = { solveIVs, summarize, bestNextAppraisal, barOf, starOf };
  if (isNode) module.exports = api; else { root.PoGo = root.PoGo || {}; root.PoGo.iv = api; }
})(typeof window !== 'undefined' ? window : globalThis);
