/* data.js — Carga de datos con degradación elegante.
 * Orden: data/*.json (generados por el actualizador) → muestra incluida (PoGo.STARTER).
 * Nunca inventa datos: si algo falta, la pestaña lo dice y explica cómo obtenerlo. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo = root.PoGo || {};
  const C = PoGo.constants;

  async function getJson(url) {
    if (PoGo.EMBED && PoGo.EMBED[url] !== undefined) return PoGo.EMBED[url]; // versión de un solo archivo
    try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) return null; return await r.json(); } catch { return null; }
  }

  async function load() {
    const D = { mode: 'starter', species: [], moves: null, rankings: null, pve: null, meta: null, changes: null, season: null, cpm: null };
    const [meta, species, moves, rankings, pve, changes, season] = await Promise.all([
      getJson('data/meta.json'), getJson('data/species.json'), getJson('data/moves.json'),
      getJson('data/rankings.json'), getJson('data/pve.json'), getJson('data/changes.json'),
      PoGo.SEASON ? Promise.resolve(PoGo.SEASON) : getJson('config/season.json')
    ]);
    D.season = season;
    if (species && species.length > 100) {
      D.mode = 'full'; D.species = species; D.moves = moves; D.rankings = rankings; D.pve = pve; D.meta = meta; D.changes = changes;
    } else {
      D.species = (PoGo.STARTER && PoGo.STARTER.species) || [];
    }
    D.byId = new Map(D.species.map(s => [s.id, s]));
    D.speciesSorted = D.species.filter(s => s.released !== false).slice().sort((a, b) => a.name.localeCompare(b.name));
    D.pveById = D.pve ? new Map(D.pve.species.map(s => [s.id, s])) : new Map();
    // índice de rankings: liga → id → {rank, score, moveset}
    D.rank = {};
    if (D.rankings) {
      const mk = (arr) => { const m = new Map(); (arr || []).forEach((r, i) => m.set(r.id, { rank: i + 1, score: r.score, moveset: r.moveset })); return m; };
      for (const k of ['little', 'great', 'ultra', 'master']) D.rank[k] = mk(D.rankings[k]);
      D.rankCups = {}; for (const [k, v] of Object.entries(D.rankings.cups || {})) D.rankCups[k] = mk(v);
    }
    return D;
  }

  /* ---- temporada ---- */
  function currentWeek(season, now) {
    now = now || new Date();
    if (!season || !season.schedule) return null;
    return season.schedule.find(w => new Date(w.from) <= now && now < new Date(w.to)) || null;
  }
  function seasonStatus(season, now) {
    now = now || new Date();
    if (!season || !season.season) return { state: 'unknown' };
    const s = new Date(season.season.start), e = new Date(season.season.end);
    if (now > e) return { state: 'ended', daysAgo: Math.floor((now - e) / 86400000) };
    if (now < s) return { state: 'upcoming', days: Math.ceil((s - now) / 86400000) };
    return { state: 'active', daysLeft: Math.ceil((e - now) / 86400000), pct: (now - s) / (e - s) };
  }
  function freshness(D) {
    if (D.mode !== 'full' || !D.meta) return { level: 'warn', text: 'Datos de muestra', detail: 'Sin data/*.json: ejecuta el actualizador para tener todas las especies, movimientos y rankings.' };
    const ageH = (Date.now() - new Date(D.meta.generatedAt)) / 3600000;
    const bad = (D.meta.checks || []).filter(c => c.level === 'error').length, warn = (D.meta.checks || []).filter(c => c.level === 'warn').length;
    const days = ageH / 24;
    if (bad || days > 7) return { level: 'bad', text: 'Datos con problemas', detail: bad ? `${bad} error(es) de validación.` : `Última actualización hace ${Math.round(days)} días.` };
    if (days > 2 || warn) return { level: 'warn', text: 'Datos con avisos', detail: `${warn} aviso(s). Actualizado hace ${days < 1 ? Math.round(ageH) + ' h' : Math.round(days) + ' d'}.` };
    return { level: 'ok', text: 'Datos al día', detail: `Actualizado hace ${ageH < 1 ? '<1 h' : Math.round(ageH) + ' h'}.` };
  }

  PoGo.data = { load, currentWeek, seasonStatus, freshness };
})(typeof window !== 'undefined' ? window : globalThis);
