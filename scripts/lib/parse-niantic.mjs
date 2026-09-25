// parse-niantic.mjs — Extrae del Game Master de Niantic lo necesario para PvE y validación.
//
// Formato de los espejos (PokeMiners / alexelgt): array de { templateId, data:{ templateId, <payload> } }.
// Payloads usados (nombres tal como aparecen en el juego):
//   moveSettings        → movimientos de gimnasio/incursión (PvE): power, durationMs, damageWindowStartMs, energyDelta
//   combatMove          → movimientos de combate de entrenadores (PvP): power, durationTurns, energyDelta, buffs
//   pokemonSettings     → especie/forma: stats, types, quickMoves, cinematicMoves, elite*, shadow, tempEvoOverrides
//   playerLevel         → cpMultiplier[]
//   pokemonUpgrades     → costes de polvo/caramelos
//   typeEffective       → tabla de tipos
//   battleSettings      → constantes de batalla (STAB, energía por PS, multiplicadores de Sombrío, intervalos del jefe…)
//
// Diseño defensivo: cualquier bloque que no aparezca se devuelve como null y validate.mjs
// lo marca como "no verificado" en lugar de fallar en silencio con datos inventados.

const stripType = (t) => (t ? String(t).replace(/^POKEMON_TYPE_/, '').toLowerCase() : null);

const NIANTIC_TYPE_ORDER = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];

export function parseNianticGM(items) {
  if (!Array.isArray(items)) throw new Error('Game Master de Niantic con formato inesperado (no es un array)');
  const out = {
    moves: {}, pvpMoves: {}, species: [], cpm: null, upgrades: null,
    typeChart: null, battle: null, stats: { templates: items.length }
  };
  const rawSpecies = [];

  for (const it of items) {
    const d = (it && it.data) || it || {};
    const tid = String((it && it.templateId) || d.templateId || '');

    if (d.moveSettings && d.moveSettings.movementId && !/^COMBAT_/.test(tid)) {
      const m = d.moveSettings;
      const delta = Number(m.energyDelta || 0);
      const id = String(m.movementId);
      out.moves[id] = {
        id, type: stripType(m.pokemonType), kind: delta > 0 ? 'fast' : 'charged',
        pve: {
          power: Number(m.power || 0),
          durationMs: Number(m.durationMs || 0),
          energy: Math.abs(delta),
          dwsMs: Number(m.damageWindowStartMs || 0)
        }
      };
    }

    if (d.combatMove && d.combatMove.uniqueId) {
      const c = d.combatMove;
      const id = String(c.uniqueId).replace(/_FAST$/, '');
      const delta = Number(c.energyDelta || 0);
      out.pvpMoves[id] = {
        id, type: stripType(c.type), power: Number(c.power || 0),
        turns: Number(c.durationTurns || 0) + 1, // durationTurns cuenta turnos ADICIONALES
        energy: delta < 0 ? -delta : 0, energyGain: delta > 0 ? delta : 0
      };
    }

    if (d.pokemonSettings && d.pokemonSettings.pokemonId) {
      const p = d.pokemonSettings;
      const m = /^V(\d{4})_POKEMON_/.exec(tid);
      const dex = m ? parseInt(m[1], 10) : null;
      if (p.stats && p.stats.baseAttack != null) {
        rawSpecies.push({
          dex, pokemonId: String(p.pokemonId), form: p.form ? String(p.form) : null,
          types: [stripType(p.type), stripType(p.type2)].filter(Boolean),
          base: { atk: p.stats.baseAttack, def: p.stats.baseDefense, hp: p.stats.baseStamina },
          fast: (p.quickMoves || []).map(String), charged: (p.cinematicMoves || []).map(String),
          eliteFast: (p.eliteQuickMove || []).map(String), eliteCharged: (p.eliteCinematicMove || []).map(String),
          hasShadow: !!p.shadow,
          evolutionIds: p.evolutionIds || [],
          temp: (p.tempEvoOverrides || []).filter(t => t && t.stats).map(t => ({
            id: String(t.tempEvoId || ''), types: [stripType(t.typeOverride1), stripType(t.typeOverride2)].filter(Boolean),
            base: { atk: t.stats.baseAttack, def: t.stats.baseDefense, hp: t.stats.baseStamina }
          }))
        });
      }
    }

    if (d.playerLevel && Array.isArray(d.playerLevel.cpMultiplier)) out.cpm = d.playerLevel.cpMultiplier.map(Number);
    if (d.pokemonUpgrades) {
      const u = d.pokemonUpgrades;
      out.upgrades = {
        upgradesPerLevel: u.upgradesPerLevel ?? null,
        stardustCost: (u.stardustCost || []).map(Number),
        candyCost: (u.candyCost || []).map(Number),
        xlCandyCost: (u.xlCandyCost || []).map(Number),
        shadowStardustMultiplier: u.shadowStardustMultiplier ?? null,
        shadowCandyMultiplier: u.shadowCandyMultiplier ?? null,
        purifiedStardustMultiplier: u.purifiedStardustMultiplier ?? null,
        purifiedCandyMultiplier: u.purifiedCandyMultiplier ?? null
      };
    }
    if (d.typeEffective && Array.isArray(d.typeEffective.attackScalar)) {
      out.typeChart = out.typeChart || {};
      const atk = stripType(d.typeEffective.attackType);
      if (atk) {
        out.typeChart[atk] = {};
        d.typeEffective.attackScalar.forEach((v, i) => { if (NIANTIC_TYPE_ORDER[i]) out.typeChart[atk][NIANTIC_TYPE_ORDER[i]] = Number(v); });
      }
    }
    if (d.battleSettings) {
      const b = d.battleSettings;
      out.battle = {
        stab: b.sameTypeAttackBonusMultiplier ?? null,
        energyPerHp: b.energyDeltaPerHealthLost ?? null,
        dodgeReduction: b.dodgeDamageReductionPercent ?? null,
        shadowAtk: b.shadowPokemonAttackBonusMultiplier ?? null,
        shadowDef: b.shadowPokemonDefenseBonusMultiplier ?? null,
        maxEnergy: b.maximumEnergy ?? null,
        enemyAttackInterval: b.enemyAttackInterval ?? null,
        weather: b.weatherAttackBonusMultiplier ?? null
      };
    }
  }

  out.species = buildSpecies(rawSpecies);
  return out;
}

/** Convierte las plantillas crudas en especies únicas (formas + megas), sin duplicados de disfraces. */
function buildSpecies(raw) {
  const list = [];
  const seen = new Map();
  const push = (s) => {
    const key = [s.dex, s.types.join('+'), s.base.atk, s.base.def, s.base.hp, s.fast.slice().sort().join(','), s.charged.slice().sort().join(',')].join('|');
    const prev = seen.get(key);
    if (prev && prev.id.length <= s.id.length) return; // conserva el id más corto (forma base)
    if (prev) list.splice(list.indexOf(prev), 1);
    seen.set(key, s); list.push(s);
  };
  for (const r of raw) {
    const id = (r.form || r.pokemonId).toLowerCase();
    const name = prettify(r.form || r.pokemonId);
    const moves = { fast: [...new Set([...r.fast, ...r.eliteFast])], charged: [...new Set([...r.charged, ...r.eliteCharged])] };
    push({
      id, dex: r.dex, name, types: r.types, base: r.base, ...moves,
      elite: [...r.eliteFast, ...r.eliteCharged], tags: [], hasShadow: r.hasShadow
    });
    for (const t of r.temp) {
      const kind = /PRIMAL/.test(t.id) ? 'primal' : 'mega';
      const suffix = /_(X|Y|Z)$/.exec(t.id);
      const label = (kind === 'primal' ? 'Primal ' : 'Mega ') + prettify(r.pokemonId) + (suffix ? ' ' + suffix[1] : '');
      push({
        id: kind + '_' + id + (suffix ? '_' + suffix[1].toLowerCase() : ''), dex: r.dex, name: label,
        types: t.types.length ? t.types : r.types, base: t.base, ...moves,
        elite: [...r.eliteFast, ...r.eliteCharged], tags: [kind], hasShadow: false
      });
    }
  }
  return list;
}

function prettify(id) {
  return String(id).toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
