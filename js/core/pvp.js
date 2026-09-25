/*
 * pvp.js — Motor de PvP (Liga Grande / Ultra / Máster / Copas).
 *
 * 1) Ranking de IV por "stat product" (Atk × Def × PS al mejor nivel bajo el tope de PC).
 *    Se evalúan las 4096 combinaciones de IV; rango 1 = mayor stat product.
 * 2) Métricas de movimientos (DPT, EPT, DPE, turnos hasta cargar).
 * 3) Daño de PvP: floor(poder · 1.3 · STAB · efectividad · Atk/Def) + 1
 *    y cálculo de puntos de quiebre (breakpoints / bulkpoints).
 * 4) Reglas de copas (tipos permitidos/prohibidos, prohibiciones puntuales).
 *
 * El "mejor moveset" NO se calcula aquí: se toma del simulador de PvPoke
 * (rankings) porque requiere simular batallas completas con escudos y baits.
 */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./constants.js') : root.PoGo.constants;
  const S = isNode ? require('./stats.js') : root.PoGo.stats;

  const _cache = new Map();

  /**
   * Tabla de las 4096 combinaciones de IV para una especie y un tope de PC.
   * Devuelve { rows, get(a,d,s), best, count, valid }.
   */
  function buildRankTable(base, cap, maxLevel, cpmTable) {
    maxLevel = maxLevel || 50;
    const key = [base.atk, base.def, base.hp, cap, maxLevel, cpmTable ? cpmTable.length : 0].join('|');
    if (_cache.has(key)) return _cache.get(key);

    const rows = [];
    for (let a = 0; a <= 15; a++) for (let d = 0; d <= 15; d++) for (let s = 0; s <= 15; s++) {
      const iv = { atk: a, def: d, hp: s };
      const level = S.maxLevelUnderCap(base, iv, cap, maxLevel, cpmTable);
      if (level == null) continue; // ni el nivel 1 cabe bajo el tope
      const st = S.battleStats(base, iv, level, cpmTable);
      rows.push({
        atk: a, def: d, hp: s, level,
        cp: S.computeCP(base, iv, level, cpmTable),
        sAtk: st.atk, sDef: st.def, sHp: st.hp,
        sp: st.atk * st.def * st.hp
      });
    }
    rows.sort((x, y) => y.sp - x.sp);
    // Ranking de competición (los empates comparten puesto)
    let prev = null, prevRank = 0;
    rows.forEach((r, i) => {
      if (prev !== null && Math.abs(r.sp - prev) <= 1e-9 * prev) r.rank = prevRank;
      else { r.rank = i + 1; prevRank = r.rank; }
      prev = r.sp;
    });
    const best = rows[0] || null;
    rows.forEach(r => { r.pct = best ? (r.sp / best.sp) * 100 : 0; });
    const idx = new Map(rows.map(r => [r.atk * 256 + r.def * 16 + r.hp, r]));
    const table = {
      rows, best, count: rows.length, valid: rows.length > 0,
      get: (a, d, s) => idx.get(a * 256 + d * 16 + s) || null
    };
    if (_cache.size > 400) _cache.clear();
    _cache.set(key, table);
    return table;
  }

  /** Evalúa un IV concreto en una liga. */
  function evaluate(base, iv, cap, maxLevel, cpmTable) {
    const t = buildRankTable(base, cap, maxLevel, cpmTable);
    if (!t.valid) return { valid: false };
    const r = t.get(iv.atk, iv.def, iv.hp);
    if (!r) return { valid: false, reason: 'No cabe bajo el tope ni en nivel 1.' };
    return { valid: true, ...r, of: t.count, best: t.best, table: t };
  }

  /** Histograma del stat product (para gráficos): n intervalos entre min y max. */
  function histogram(table, bins) {
    bins = bins || 40;
    const rows = table.rows;
    if (!rows.length) return { bins: [], min: 0, max: 0 };
    const max = rows[0].sp, min = rows[rows.length - 1].sp;
    const w = (max - min) / bins || 1;
    const arr = Array.from({ length: bins }, (_, i) => ({ from: min + i * w, to: min + (i + 1) * w, n: 0 }));
    rows.forEach(r => { arr[Math.min(bins - 1, Math.floor((r.sp - min) / w))].n++; });
    return { bins: arr, min, max };
  }

  // ---------------------------------------------------------------------
  // Movimientos de PvP (formato PvPoke: cooldown en ms; turno = 500 ms)
  // ---------------------------------------------------------------------
  const TURN_MS = 500;

  function fastMetrics(m) {
    const turns = m.turns || Math.round((m.cooldown || 500) / TURN_MS);
    return { turns, dpt: m.power / turns, ept: m.energyGain / turns };
  }
  function chargedMetrics(m) {
    return { dpe: m.power / m.energy, energy: m.energy };
  }
  /** Turnos que tarda un ataque rápido en cargar un movimiento cargado. */
  function turnsToCharge(fast, charged) {
    const f = fastMetrics(fast);
    return Math.ceil(charged.energy / fast.energyGain) * f.turns;
  }

  const STAGE = (n) => (n >= 0 ? (4 + n) / 4 : 4 / (4 - n)); // multiplicador por escalón de buff

  /** Daño de un movimiento en PvP. atk/def = estadísticas efectivas (ya con CPM). */
  function pvpDamage(o) {
    const stab = o.stab ? C.MULT.STAB : 1;
    const eff = o.eff == null ? 1 : o.eff;
    return Math.floor(o.power * C.MULT.PVP_BONUS * stab * eff * (o.atk / o.def)) + 1;
  }

  /** Multiplicador de tipo de un movimiento contra un defensor (uno o dos tipos). */
  function typeMult(moveType, defTypes, chart) {
    const ch = chart || C.TYPE_CHART;
    return (defTypes || []).reduce((m, t) => m * (ch[moveType] && ch[moveType][t] != null ? ch[moveType][t] : 1), 1);
  }

  /**
   * Punto de quiebre ofensivo: Atk efectivo necesario para +1 de daño.
   * @returns {damage, nextDamage, atkNeeded, delta}
   */
  function breakpoint(o) {
    const stab = o.stab ? C.MULT.STAB : 1;
    const k = o.power * C.MULT.PVP_BONUS * stab * (o.eff == null ? 1 : o.eff) / o.def;
    const damage = Math.floor(k * o.atk) + 1;
    const atkNeeded = damage / k; // (floor+1)/k
    return { damage, nextDamage: damage + 1, atkNeeded, delta: atkNeeded - o.atk };
  }

  /** Punto de resistencia: Def efectiva necesaria para recibir 1 menos de daño. */
  function bulkpoint(o) {
    const stab = o.stab ? C.MULT.STAB : 1;
    const num = o.power * C.MULT.PVP_BONUS * stab * (o.eff == null ? 1 : o.eff) * o.atk;
    const damage = Math.floor(num / o.def) + 1;
    if (damage <= 1) return { damage, defNeeded: null, delta: null };
    const defNeeded = num / (damage - 1); // hace falta def > defNeeded... (estricto)
    return { damage, defNeeded, delta: defNeeded - o.def };
  }

  // ---------------------------------------------------------------------
  // Reglas de copas
  // ---------------------------------------------------------------------
  /**
   * cup = { id, name, cap, includeTypes?:[], excludeTypes?:[], bannedIds?:[], bannedNames?:[],
   *         allowMega?:bool, allowLegendary?:bool (false = prohibidos), littleCup?:bool }
   * species = { id, name, types:[], tags:[] }
   */
  function cupEligibility(species, cup) {
    const types = species.types || [];
    const tags = species.tags || [];
    const isMega = tags.includes('mega') || /(^|_)mega/.test(species.id || '');
    if (isMega && cup.allowMega === false) return { ok: false, reason: 'Mega no permitido' };
    if (isMega && cup.allowMega === undefined && cup.requireMegaAllowed) return { ok: false, reason: 'Mega no permitido' };
    if (cup.includeTypes && cup.includeTypes.length && !types.some(t => cup.includeTypes.includes(t)))
      return { ok: false, reason: 'Tipo no permitido' };
    if (cup.excludeTypes && types.some(t => cup.excludeTypes.includes(t)))
      return { ok: false, reason: 'Tipo prohibido (' + types.filter(t => cup.excludeTypes.includes(t)).map(t => C.TYPE_ES[t]).join(', ') + ')' };
    if (cup.bannedIds && cup.bannedIds.includes(species.id)) return { ok: false, reason: 'Prohibido por la copa' };
    if (cup.bannedNames && cup.bannedNames.some(n => n.toLowerCase() === (species.name || '').toLowerCase()))
      return { ok: false, reason: 'Prohibido por la copa' };
    if (cup.allowLegendary === false && (tags.includes('legendary') || tags.includes('mythical') || tags.includes('ultrabeast')))
      return { ok: false, reason: 'Legendario/Mítico/Ultraente no permitido' };
    return { ok: true };
  }

  const api = {
    buildRankTable, evaluate, histogram,
    TURN_MS, fastMetrics, chargedMetrics, turnsToCharge, STAGE,
    pvpDamage, typeMult, breakpoint, bulkpoint, cupEligibility
  };
  if (isNode) module.exports = api; else { root.PoGo = root.PoGo || {}; root.PoGo.pvp = api; }
})(typeof window !== 'undefined' ? window : globalThis);
