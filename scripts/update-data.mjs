#!/usr/bin/env node
// update-data.mjs — Actualiza data/*.json desde las fuentes públicas.
//
//   node scripts/update-data.mjs            # descarga y publica si pasa las validaciones
//   node scripts/update-data.mjs --dry      # valida y muestra el informe sin escribir
//   node scripts/update-data.mjs --force    # publica aunque haya errores de validación (no recomendado)
//
// Garantía: si una validación de severidad 'error' falla, NO se toca data/ (quedan los últimos
// datos buenos) y el proceso termina con código 1 para que GitHub Actions avise.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SOURCES, STALE_DAYS, LEAGUE_CAPS } from './lib/sources.mjs';
import { fetchResource, githubLastCommit, daysSince } from './lib/http.mjs';
import { parsePvpokeGamemaster, parsePvpokeRanking, prettify } from './lib/parse-pvpoke.mjs';
import { parseNianticGM } from './lib/parse-niantic.mjs';
import { validateAll } from './lib/validate.mjs';
import { diffData } from './lib/diff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

async function firstOk(urls, opts) {
  for (const url of urls) {
    try { const r = await fetchResource(url, opts); if (r.ok) return r; } catch (e) { console.warn('  ! ' + e.message); }
  }
  return null;
}

/** Elige el espejo del Game Master más FRESCO (por fecha de commit), no el primero que responde. */
async function pickNianticMirror(fetcher) {
  const cands = [];
  for (const m of SOURCES.niantic) {
    const iso = await githubLastCommit(m.repo, m.file, m.branch);
    cands.push({ ...m, commitDate: iso, age: daysSince(iso) });
  }
  cands.sort((a, b) => (new Date(b.commitDate || 0)) - (new Date(a.commitDate || 0)));
  for (const c of cands) {
    console.log(`  · ${c.id}: último commit ${c.commitDate || 'desconocido'}`);
    const r = await fetcher([c.url], { timeoutMs: 180000 });
    if (r) return { mirror: c, res: r };
  }
  return null;
}

export async function run({ dry = false, force = false, fetcher = firstOk, log = console.log } = {}) {
  const t0 = Date.now();
  const prev = { moves: readJson(path.join(DATA, 'moves.json')), species: readJson(path.join(DATA, 'species.json')) };
  const season = readJson(path.join(ROOT, 'config', 'season.json')) || { cups: {} };

  log('1/5 PvPoke gamemaster…');
  let pvpoke = null, pvpokeRes = null;
  pvpokeRes = await fetcher(SOURCES.pvpoke.gamemaster, { timeoutMs: 120000 });
  if (pvpokeRes) pvpoke = parsePvpokeGamemaster(pvpokeRes.json);
  const pvpokeCommit = await githubLastCommit(SOURCES.pvpoke.repo, 'src/data/gamemaster.json');

  log('2/5 Game Master de Niantic…');
  let niantic = null, mirror = null;
  const pick = await pickNianticMirror(fetcher);
  if (pick) { niantic = parseNianticGM(pick.res.json); mirror = pick.mirror; }

  log('3/5 Rankings PvPoke…');
  const rankings = {};
  for (const [lg, cap] of Object.entries(LEAGUE_CAPS)) {
    const r = await fetcher(SOURCES.pvpoke.ranking('all', cap), { timeoutMs: 90000 });
    if (r) rankings[lg] = parsePvpokeRanking(r.json).slice(0, 500);
  }
  rankings.cups = {};
  for (const [cid, cup] of Object.entries(season.cups || {})) {
    if (!cup.pvpokeCup) continue;
    const cap = cup.cap >= 10000 || !isFinite(cup.cap) ? 10000 : cup.cap;
    const r = await fetcher(SOURCES.pvpoke.ranking(cup.pvpokeCup, cap), { timeoutMs: 90000 });
    if (r) rankings.cups[cid] = parsePvpokeRanking(r.json).slice(0, 300);
  }

  log('4/5 Jefes de incursión…');
  let raids = null, maxb = null;
  try { const r = await fetcher(SOURCES.raidBosses, { retries: 1 }); if (r) raids = r.json; } catch {}
  try { const r = await fetcher(SOURCES.maxBattles, { retries: 1 }); if (r) maxb = r.json; } catch {}

  log('5/5 Validando…');
  const ages = {
    niantic: mirror ? daysSince(mirror.commitDate) : null,
    pvpoke: daysSince(pvpokeCommit)
  };
  const report = validateAll({ pvpoke, niantic, rankings, ages, staleDays: STALE_DAYS });
  report.issues.forEach(i => log(`  [${i.level.toUpperCase()}] ${i.code}: ${i.msg}`));

  if (!report.ok && !force) {
    log('✖ Validación fallida: se conservan los datos anteriores.');
    return { ok: false, report };
  }
  if (!pvpoke) return { ok: false, report };

  // ---- Construcción de salidas
  const nameById = {}; Object.values(pvpoke.moves).forEach(m => { nameById[m.id] = m.name; });
  const pveMoves = {};
  if (niantic) for (const [id, m] of Object.entries(niantic.moves)) {
    pveMoves[id] = { ...m, name: nameById[id.replace(/_FAST$/, '')] || prettify(id) };
  }
  // Fusiona PvE dentro de moves.json para un único diccionario en la app
  const moves = JSON.parse(JSON.stringify(pvpoke.moves));
  for (const [id, m] of Object.entries(pveMoves)) {
    const key = id.replace(/_FAST$/, '');
    if (moves[key]) moves[key].pve = m.pve;
  }
  const species = pvpoke.species;
  const pve = niantic ? { species: niantic.species, moves: pveMoves, battle: niantic.battle, upgrades: niantic.upgrades } : null;

  const changes = diffData(prev.moves && prev.species ? { moves: prev.moves, species: prev.species } : null, { moves, species });
  const hash = crypto.createHash('sha256').update(JSON.stringify({ species, moves })).digest('hex').slice(0, 16);
  const meta = {
    schema: 1, generatedAt: new Date().toISOString(), hash,
    counts: { species: species.length, moves: Object.keys(moves).length, pveSpecies: pve ? pve.species.length : 0 },
    sources: {
      pvpoke: { lastCommit: pvpokeCommit, ageDays: ages.pvpoke },
      niantic: mirror ? { mirror: mirror.id, lastCommit: mirror.commitDate, ageDays: ages.niantic } : null,
      rankings: Object.fromEntries(Object.entries(rankings).filter(([k]) => k !== 'cups').map(([k, v]) => [k, v.length])),
      raidBosses: !!raids
    },
    checks: report.issues, validated: report.ok
  };

  const changed = !prev.moves || JSON.stringify(prev.moves) !== JSON.stringify(moves) || JSON.stringify(prev.species) !== JSON.stringify(species);
  log(`Listo en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${changed ? 'HAY cambios' : 'sin cambios en especies/movimientos'}`);
  if (dry) return { ok: true, report, meta, changes };

  fs.mkdirSync(DATA, { recursive: true });
  const write = (name, obj) => { const tmp = path.join(DATA, name + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, path.join(DATA, name)); };
  write('species.json', species); write('moves.json', moves); write('rankings.json', rankings);
  if (pve) write('pve.json', pve);
  if (raids) write('raids.json', raids);
  if (maxb) write('maxbattles.json', maxb);
  if (changed) write('changes.json', changes); // solo se reemplaza cuando hubo cambios reales
  write('meta.json', meta);
  return { ok: true, report, meta, changes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  run({ dry: args.includes('--dry'), force: args.includes('--force') })
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(e => { console.error('✖ ' + e.message); process.exit(1); });
}
