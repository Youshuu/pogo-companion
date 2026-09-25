/*
 * pve.js — Motor de incursiones / gimnasios (PvE).
 *
 * Daño:   floor(0.5 · poder · Atk/Def · multiplicador) + 1
 *         multiplicador = STAB(1.2) · efectividad(1.6/0.625/0.390625) · clima(1.2) · extra
 *         Sombrío: Atk × 1.2 y Def × 0.8333 (valores reales se leen del Game Master).
 *
 * DPS/TDO: modelo "Comprehensive DPS" (GamePress / PokéBase), que incluye la
 *   energía que se gana al RECIBIR daño (0,5 por PS perdido):
 *
 *      DPS0 = (FDPS·CEPS + CDPS·FEPS) / (CEPS + FEPS)
 *      DPS  = DPS0 + (CDPS − FDPS)/(CEPS + FEPS) · (0,5 − x/HP) · y
 *      Para ataques cargados de 1 barra (coste 100):  CEPS' = (CE + 0,5·FE + 0,5·y·CDWS)/CDur
 *      TDO  = DPS · HP / y                       (tiempo vivo = HP / y)
 *      eDPS = 1 / (1/DPS + R/TDO)                (R = tiempo de re-lobby tras caer)
 *
 *   x = energía sobrante al caer (por defecto CE/2), y = DPS entrante del jefe.
 *
 * Supuestos declarados (ver docs/FORMULAS.md): sin esquivas salvo que se indique,
 * jefe con pausa entre ataques configurable, sin bonos de equipo/Mega/amistad.
 */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./constants.js') : root.PoGo.constants;
  const S = isNode ? require('./stats.js') : root.PoGo.stats;

  const DEFAULTS = {
    bossDelaySec: 2.0,     // pausa media del jefe entre ataques (supuesto, ajustable)
    relobbySec: 10,        // tiempo de re-lobby tras caer (supuesto de la comunidad)
    dodge: 0,              // fracción de daño evitada por esquivar (0-1)
    shadow: { atk: C.MULT.SHADOW_ATK, def: C.MULT.SHADOW_DEF }
  };

  function pveDamage(power, atk, def, mult) {
    return Math.floor(0.5 * power * (atk / def) * mult) + 1;
  }

  function typeEff(moveType, defTypes, chart) {
    const ch = chart || C.TYPE_CHART;
    return (defTypes || []).reduce((m, t) => m * ((ch[moveType] && ch[moveType][t] != null) ? ch[moveType][t] : 1), 1);
  }

  /** Multiplicador total de un movimiento. */
  function moveMultiplier(o) {
    let m = 1;
    if (o.attackerTypes && o.attackerTypes.includes(o.moveType)) m *= C.MULT.STAB;
    if (o.effOverride) m *= o.effOverride(o.moveType);
    else m *= typeEff(o.moveType, o.defenderTypes, o.chart);
    if (o.weatherTypes && o.weatherTypes.includes(o.moveType)) m *= C.MULT.WEATHER;
    if (o.extra) m *= o.extra;
    return m;
  }

  /** Estadísticas de un combatiente de PvE (aplica Sombrío). */
  function fighterStats(base, iv, level, opts) {
    opts = opts || {};
    const st = S.battleStats(base, iv, level, opts.cpmTable);
    const sh = (opts.shadow || DEFAULTS.shadow);
    return {
      atk: st.atk * (opts.isShadow ? sh.atk : 1),
      def: st.def * (opts.isShadow ? sh.def : 1),
      hp: st.hp, cpm: st.cpm
    };
  }

  /**
   * Modelo Comprehensive DPS.
   * in: {FDmg, CDmg, FE, CE, FDur, CDur, CDWS, HP, x, y}  (tiempos en segundos)
   */
  function comprehensiveDPS(i) {
    const FDPS = i.FDmg / i.FDur, FEPS = i.FE / i.FDur;
    const CDPS = i.CDmg / i.CDur;
    const y = Math.max(0, i.y || 0);
    let CEPS = i.CE / i.CDur;
    if (i.CE >= 100) CEPS = (i.CE + 0.5 * i.FE + 0.5 * y * (i.CDWS || 0)) / i.CDur; // ataque de 1 barra
    const x = i.x == null ? i.CE / 2 : i.x;
    const DPS0 = (FDPS * CEPS + CDPS * FEPS) / (CEPS + FEPS);
    const dps = DPS0 + ((CDPS - FDPS) / (CEPS + FEPS)) * (0.5 - x / i.HP) * y;
    const tdo = y > 0 ? dps * (i.HP / y) : Infinity;
    return { dps, dps0: DPS0, tdo, timeAlive: y > 0 ? i.HP / y : Infinity };
  }

  const eDPS = (dps, tdo, relobby) => (isFinite(tdo) ? 1 / (1 / dps + (relobby ?? DEFAULTS.relobbySec) / tdo) : dps);

  /**
   * DPS entrante del jefe sobre un defensor.
   * boss: {atk, types, fast:{type,power,durationMs,energy}, charged:[{type,power,durationMs,energy}]}
   * def : {def, types}
   */
  function bossIncomingDps(boss, def, opts) {
    opts = opts || {};
    const delay = opts.bossDelaySec ?? DEFAULTS.bossDelaySec;
    const dodge = opts.dodge ?? DEFAULTS.dodge;
    const f = boss.fast;
    const fm = moveMultiplier({ moveType: f.type, attackerTypes: boss.types, defenderTypes: def.types, chart: opts.chart });
    const FDmg = pveDamage(f.power, boss.atk, def.def, fm);
    const FDur = f.durationMs / 1000 + delay;
    const chs = (boss.charged && boss.charged.length) ? boss.charged : [null];
    const vals = chs.map(c => {
      if (!c) return FDmg / FDur;
      const cm = moveMultiplier({ moveType: c.type, attackerTypes: boss.types, defenderTypes: def.types, chart: opts.chart });
      const CDmg = pveDamage(c.power, boss.atk, def.def, cm);
      const CDur = c.durationMs / 1000 + delay;
      const n = c.energy / f.energy;
      return (n * FDmg + CDmg) / (n * FDur + CDur);
    });
    const y = vals.reduce((a, b) => a + b, 0) / vals.length;
    return y * (1 - dodge * (1 - C.MULT.DODGE));
  }

  /**
   * Rendimiento de un atacante con un moveset contra un jefe.
   * att : {base, iv, level, types, isShadow, cpmTable}
   * fast/charged: {type, power, durationMs, energy, dwsMs?}
   * boss: null → DPS puro (y = 0) | {atk, def, types, hp, fast, charged[]} | {def, types, y}
   * opts: {weatherTypes, relobbySec, bossDelaySec, dodge, effOverride, chart, extra}
   */
  function performance(att, fast, charged, boss, opts) {
    opts = opts || {};
    const st = fighterStats(att.base, att.iv, att.level, att);
    const bossDef = boss ? boss.def : 1;
    const defTypes = boss ? boss.types : [];
    const mk = (mv) => moveMultiplier({
      moveType: mv.type, attackerTypes: att.types, defenderTypes: defTypes,
      weatherTypes: opts.weatherTypes, effOverride: opts.effOverride, chart: opts.chart, extra: opts.extra
    });
    const FDmg = pveDamage(fast.power, st.atk, bossDef, mk(fast));
    const CDmg = pveDamage(charged.power, st.atk, bossDef, mk(charged));
    let y = 0;
    if (boss && boss.y != null) y = boss.y;
    else if (boss && boss.atk != null) y = bossIncomingDps(boss, { def: st.def, types: att.types }, opts);
    const r = comprehensiveDPS({
      FDmg, CDmg, FE: fast.energy, CE: charged.energy,
      FDur: fast.durationMs / 1000, CDur: charged.durationMs / 1000,
      CDWS: (charged.dwsMs || 0) / 1000, HP: st.hp, x: opts.x, y
    });
    return {
      ...r, y, FDmg, CDmg, stats: st,
      edps: eDPS(r.dps, r.tdo, opts.relobbySec),
      // Índice de robustez (independiente del jefe): Def × PS
      bulk: st.def * st.hp
    };
  }

  /**
   * Mejor moveset de una especie (por eDPS si hay jefe, por DPS si no).
   * species: {types, base, fast:[id], charged:[id]}   moves: {id → move PvE}
   */
  function bestMoveset(att, species, moves, boss, opts) {
    let best = null;
    const fasts = (species.fast || []).map(id => moves[id]).filter(m => m && m.pve);
    const chs = (species.charged || []).map(id => moves[id]).filter(m => m && m.pve);
    for (const f of fasts) for (const c of chs) {
      const p = performance(att, { type: f.type, ...f.pve }, { type: c.type, ...c.pve }, boss, opts);
      const score = boss && isFinite(p.tdo) ? p.edps : p.dps;
      if (!best || score > best.score) best = { fast: f, charged: c, perf: p, score };
    }
    return best;
  }

  /**
   * Ranking de atacantes.
   * list: especies {id,name,types,base,fast,charged,tags}; moves: mapa PvE.
   * opts: {level, iv, boss, weatherTypes, includeMega, onlyType, ...}
   */
  function rankAttackers(list, moves, opts) {
    opts = opts || {};
    const iv = opts.iv || { atk: 15, def: 15, hp: 15 };
    const level = opts.level || 40;
    const out = [];
    for (const sp of list) {
      if (!sp.base || !sp.types) continue;
      const isMega = (sp.tags || []).includes('mega');
      if (isMega && !opts.includeMega) continue;
      const att = { base: sp.base, iv, level, types: sp.types, isShadow: !!sp.isShadow, cpmTable: opts.cpmTable, shadow: opts.shadow };
      const b = bestMoveset(att, sp, moves, opts.boss || null, opts);
      if (!b) continue;
      if (opts.onlyType && b.fast.type !== opts.onlyType && b.charged.type !== opts.onlyType) continue;
      out.push({
        id: sp.id, name: sp.name, types: sp.types, dex: sp.dex, isShadow: !!sp.isShadow,
        fast: b.fast, charged: b.charged, dps: b.perf.dps, tdo: b.perf.tdo, edps: b.perf.edps,
        bulk: b.perf.bulk, score: b.score, y: b.perf.y
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  const api = {
    DEFAULTS, pveDamage, typeEff, moveMultiplier, fighterStats,
    comprehensiveDPS, eDPS, bossIncomingDps, performance, bestMoveset, rankAttackers
  };
  if (isNode) module.exports = api; else { root.PoGo = root.PoGo || {}; root.PoGo.pve = api; }
})(typeof window !== 'undefined' ? window : globalThis);
