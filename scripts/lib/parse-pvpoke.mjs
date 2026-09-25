// parse-pvpoke.mjs — Normaliza el gamemaster y los rankings de PvPoke.
//
// Esquema esperado (PvPoke, repo pvpoke/pvpoke → src/data/gamemaster.json):
//   pokemon[]: { dex, speciesId, speciesName, baseStats:{atk,def,hp}, types:[..],
//                fastMoves:[ids], chargedMoves:[ids], eliteMoves?:[ids], legacyMoves?:[ids],
//                tags?:[..], released?:bool, family?:{id,evolutions?,parent?}, buddyDistance?, thirdMoveCost? }
//   moves[]  : { moveId, name, type, power, energy, energyGain, cooldown, buffs?, buffTarget?, buffApplyChance? }
// Todo campo se lee de forma defensiva: un campo ausente degrada la función, no rompe la actualización.

const TYPE_OK = new Set(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);

export function parsePvpokeGamemaster(gm) {
  if (!gm || !Array.isArray(gm.pokemon) || !Array.isArray(gm.moves)) {
    throw new Error('gamemaster de PvPoke con formato inesperado (faltan "pokemon" o "moves")');
  }
  const moves = {};
  for (const m of gm.moves) {
    if (!m || !m.moveId) continue;
    const isFast = (m.energy || 0) === 0 && (m.energyGain || 0) > 0;
    const type = String(m.type || '').toLowerCase();
    moves[m.moveId] = {
      id: m.moveId,
      name: m.name || prettify(m.moveId),
      type: TYPE_OK.has(type) ? type : 'normal',
      kind: isFast ? 'fast' : 'charged',
      pvp: {
        power: num(m.power), energy: num(m.energy), energyGain: num(m.energyGain),
        cooldown: num(m.cooldown) || 500,
        turns: Math.max(1, Math.round((num(m.cooldown) || 500) / 500)),
        ...(m.buffs ? { buffs: m.buffs, buffTarget: m.buffTarget || 'self', buffApplyChance: Number(m.buffApplyChance) || 1 } : {})
      }
    };
  }

  const species = [];
  for (const p of gm.pokemon) {
    if (!p || !p.speciesId || !p.baseStats) continue;
    const types = (p.types || []).map(t => String(t).toLowerCase()).filter(t => TYPE_OK.has(t));
    if (!types.length) continue;
    const tags = (p.tags || []).map(t => String(t).toLowerCase());
    species.push({
      id: p.speciesId, dex: p.dex, name: p.speciesName || prettify(p.speciesId),
      types, base: { atk: p.baseStats.atk, def: p.baseStats.def, hp: p.baseStats.hp },
      fast: p.fastMoves || [], charged: p.chargedMoves || [],
      elite: p.eliteMoves || [], legacy: p.legacyMoves || [],
      tags, released: p.released !== false,
      shadow: tags.includes('shadow') || /_shadow$/.test(p.speciesId),
      family: p.family ? { id: p.family.id, parent: p.family.parent || null, evolutions: p.family.evolutions || [] } : null,
      thirdMoveCost: p.thirdMoveCost || null
    });
  }
  return { species, moves };
}

/** Ranking de PvPoke → lista compacta [{id, score, moveset}] (se descartan matchups/counters). */
export function parsePvpokeRanking(arr) {
  if (!Array.isArray(arr)) throw new Error('ranking de PvPoke con formato inesperado');
  return arr
    .filter(r => r && r.speciesId)
    .map(r => ({
      id: r.speciesId,
      score: round(Number(r.score ?? r.rating ?? 0), 1),
      moveset: Array.isArray(r.moveset) ? r.moveset : []
    }))
    .sort((a, b) => b.score - a.score);
}

const num = (v) => (v == null || v === '' ? 0 : Number(v));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
export function prettify(id) {
  return String(id).replace(/_FAST$/, '').toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
