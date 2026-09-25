/*
 * stats.js — Fórmulas de estadísticas.
 *
 *   Atk = (baseAtk + ivAtk) · CPM
 *   Def = (baseDef + ivDef) · CPM
 *   HP  = max(10, floor((baseSta + ivSta) · CPM))
 *   CP  = max(10, floor( (baseAtk+ivAtk) · √(baseDef+ivDef) · √(baseSta+ivSta) · CPM² / 10 ))
 */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./constants.js') : root.PoGo.constants;

  /** base = {atk, def, hp}   iv = {atk, def, hp} (0-15)   */
  function computeCP(base, iv, level, cpmTable) {
    const m = C.cpm(level, cpmTable);
    const a = base.atk + iv.atk;
    const d = base.def + iv.def;
    const s = base.hp + iv.hp;
    return Math.max(10, Math.floor((a * Math.sqrt(d) * Math.sqrt(s) * m * m) / 10));
  }

  function computeHP(base, iv, level, cpmTable) {
    const m = C.cpm(level, cpmTable);
    return Math.max(10, Math.floor((base.hp + iv.hp) * m));
  }

  /** Estadísticas efectivas en combate (sin multiplicadores de Sombrío). */
  function battleStats(base, iv, level, cpmTable) {
    const m = C.cpm(level, cpmTable);
    return {
      atk: (base.atk + iv.atk) * m,
      def: (base.def + iv.def) * m,
      hp: Math.max(10, Math.floor((base.hp + iv.hp) * m)),
      cpm: m
    };
  }

  const statProduct = (s) => s.atk * s.def * s.hp;
  const ivTotal = (iv) => iv.atk + iv.def + iv.hp;
  const ivPercent = (iv) => (ivTotal(iv) / 45) * 100;

  /**
   * Nivel más alto (paso de 0.5) tal que CP <= cap. Búsqueda binaria (CP es monótono con el nivel).
   * Devuelve null si ni siquiera el nivel 1 cabe bajo el tope.
   */
  function maxLevelUnderCap(base, iv, cap, maxLevel, cpmTable) {
    const top = Math.min(maxLevel || 50, cpmTable ? cpmTable.length : C.MAX_LEVEL_HARD);
    if (!isFinite(cap)) return top;
    let lo = 1, hi = top;        // en pasos de 0.5
    if (computeCP(base, iv, lo, cpmTable) > cap) return null;
    if (computeCP(base, iv, hi, cpmTable) <= cap) return hi;
    let loI = 0, hiI = Math.round((hi - 1) * 2); // índices de medio nivel
    while (hiI - loI > 1) {
      const mid = (loI + hiI) >> 1;
      if (computeCP(base, iv, 1 + mid / 2, cpmTable) <= cap) loI = mid; else hiI = mid;
    }
    return 1 + loI / 2;
  }

  const api = { computeCP, computeHP, battleStats, statProduct, ivTotal, ivPercent, maxLevelUnderCap };
  if (isNode) module.exports = api; else { root.PoGo = root.PoGo || {}; root.PoGo.stats = api; }
})(typeof window !== 'undefined' ? window : globalThis);
