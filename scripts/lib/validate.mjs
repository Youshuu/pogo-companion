// validate.mjs — Compuertas de calidad. Severidad 'error' BLOQUEA la publicación de datos
// (se conservan los últimos datos buenos); 'warn' se muestra en la app y en el log.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../../js/core/constants.js');

export function validateAll({ pvpoke, niantic, rankings, ages, staleDays }) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });

  // 1) Conteos mínimos: detectan descargas truncadas o esquemas rotos
  if (pvpoke) {
    if (pvpoke.species.length < 800) add('error', 'pvpoke.species.count', `PvPoke trae solo ${pvpoke.species.length} especies (<800)`);
    if (Object.keys(pvpoke.moves).length < 250) add('error', 'pvpoke.moves.count', `PvPoke trae solo ${Object.keys(pvpoke.moves).length} movimientos (<250)`);
    const bad = pvpoke.species.filter(s => !(s.base.atk > 0 && s.base.def > 0 && s.base.hp > 0));
    if (bad.length) add('error', 'pvpoke.base.invalid', `${bad.length} especies con stats base inválidos (ej. ${bad[0].id})`);
    // Anclas: especies estables cuyo stat base no debe cambiar jamás
    const anchors = { mewtwo: [300, 182, 214], azumarill: [112, 152, 225], registeel: [143, 285, 190], dragonite: [263, 198, 209] };
    for (const [id, [a, d, h]] of Object.entries(anchors)) {
      const s = pvpoke.species.find(x => x.id === id);
      if (!s) add('warn', 'anchor.missing', `Especie ancla ausente: ${id}`);
      else if (s.base.atk !== a || s.base.def !== d || s.base.hp !== h) add('error', 'anchor.mismatch', `Stats de ${id} no coinciden con el ancla (${s.base.atk}/${s.base.def}/${s.base.hp})`);
    }
  } else add('error', 'pvpoke.missing', 'No se obtuvo el gamemaster de PvPoke');

  if (niantic) {
    if (niantic.species.length < 800) add('warn', 'niantic.species.count', `Game Master: solo ${niantic.species.length} especies`);
    if (Object.keys(niantic.moves).length < 250) add('warn', 'niantic.moves.count', `Game Master: solo ${Object.keys(niantic.moves).length} movimientos PvE`);
    // CPM
    if (!niantic.cpm) add('warn', 'cpm.unverified', 'No se encontró la tabla CPM en el Game Master (se usa la incluida)');
    else {
      const n = Math.min(niantic.cpm.length, C.CPM_WHOLE.length);
      let diff = 0; for (let i = 0; i < n; i++) if (Math.abs(niantic.cpm[i] - C.CPM_WHOLE[i]) > 1e-5) diff++;
      if (diff > 0) add('error', 'cpm.mismatch', `La tabla CPM del Game Master difiere en ${diff}/${n} niveles: revisar antes de aceptar`);
    }
    // Costes de polvo (niveles ≤ 39.5, verificados)
    if (niantic.upgrades && niantic.upgrades.stardustCost.length) {
      const sd = niantic.upgrades.stardustCost;
      const expected = []; C.DUST_STEPS.forEach(([f, t, d]) => { for (let l = f; l <= t + 1e-9; l += 0.5) expected.push(d); });
      const perHalf = sd.length >= expected.length ? sd : null;
      const perLevel = sd.length >= 39 && sd.length < 60 ? sd : null;
      if (perHalf) {
        const bad = expected.findIndex((v, i) => sd[i] !== v);
        if (bad >= 0) add('error', 'dust.mismatch', `Coste de polvo distinto en el paso ${bad}`);
      } else if (perLevel) {
        // formato por nivel entero: comparar con el primer paso de cada nivel
        let bad = -1; for (let l = 1; l <= 39; l++) { if (sd[l - 1] !== expected[(l - 1) * 2]) { bad = l; break; } }
        if (bad >= 0) add('warn', 'dust.format', `Coste de polvo distinto en nivel ${bad} (¿otro formato de tabla?)`);
      } else add('warn', 'dust.unverified', 'Formato de tabla de polvo no reconocido');
    } else add('warn', 'dust.unverified', 'Sin tabla de polvo en el Game Master');
    // Tabla de tipos
    if (niantic.typeChart && Object.keys(niantic.typeChart).length === 18) {
      let diff = 0;
      for (const a of C.TYPES) for (const d of C.TYPES) if (Math.abs((niantic.typeChart[a]?.[d] ?? 1) - C.TYPE_CHART[a][d]) > 1e-6) diff++;
      if (diff) add('error', 'types.mismatch', `La tabla de tipos difiere en ${diff} casillas`);
    } else add('warn', 'types.unverified', 'Tabla de tipos no verificada');
    // Constantes de batalla
    const b = niantic.battle;
    if (b) {
      const chk = (v, exp, name) => { if (v != null && Math.abs(v - exp) > 1e-3) add('error', 'battle.' + name, `${name}: juego=${v}, app=${exp}`); };
      chk(b.stab, C.MULT.STAB, 'stab'); chk(b.energyPerHp, C.MULT.ENERGY_PER_HP, 'energyPerHp');
      chk(b.shadowAtk, C.MULT.SHADOW_ATK, 'shadowAtk'); chk(b.shadowDef, C.MULT.SHADOW_DEF, 'shadowDef');
    } else add('warn', 'battle.unverified', 'Constantes de batalla no encontradas en el Game Master');
    // Coherencia PvP: PvPoke vs Niantic (detecta rezago de PvPoke tras un rebalanceo)
    if (pvpoke && Object.keys(niantic.pvpMoves).length) {
      let diff = 0, cmp = 0; const ex = [];
      for (const [id, m] of Object.entries(pvpoke.moves)) {
        const g = niantic.pvpMoves[id]; if (!g) continue; cmp++;
        const p = m.pvp;
        if (g.power !== p.power || g.energy !== p.energy || g.energyGain !== p.energyGain || (g.turns && g.turns !== p.turns)) { diff++; if (ex.length < 5) ex.push(id); }
      }
      if (cmp && diff / cmp > 0.02) add('warn', 'pvp.lag', `PvPoke difiere del Game Master en ${diff}/${cmp} movimientos de PvP (¿aún no actualizó el rebalanceo?): ${ex.join(', ')}`);
    }
  } else add('warn', 'niantic.missing', 'Sin Game Master de Niantic: la pestaña de Incursiones (PvE) no tendrá datos nuevos');

  if (rankings && !Object.keys(rankings).length) add('warn', 'rankings.empty', 'Sin rankings de PvPoke');

  // Frescura
  for (const [k, d] of Object.entries(ages || {})) {
    if (d != null && staleDays && staleDays[k] && d > staleDays[k]) add('warn', 'stale.' + k, `Fuente "${k}" sin actualizar desde hace ${Math.round(d)} días`);
  }
  return { issues, ok: !issues.some(i => i.level === 'error') };
}
