// diff.mjs — Qué cambió entre la versión anterior y la nueva de los datos (alimenta "Novedades").
const P = ['power', 'energy', 'energyGain', 'turns'];
const E = ['power', 'durationMs', 'energy'];

export function diffData(prev, next) {
  const out = { generatedAt: new Date().toISOString(), moves: [], newMoves: [], removedMoves: [], newSpecies: [], movepool: [] };
  if (!prev) return out;
  const pm = prev.moves || {}, nm = next.moves || {};
  for (const id of Object.keys(nm)) {
    if (!pm[id]) { out.newMoves.push({ id, name: nm[id].name }); continue; }
    const ch = [];
    for (const k of P) { const a = pm[id].pvp?.[k], b = nm[id].pvp?.[k]; if (a !== b && (a != null || b != null)) ch.push({ mode: 'pvp', field: k, from: a, to: b }); }
    for (const k of E) { const a = pm[id].pve?.[k], b = nm[id].pve?.[k]; if (a !== b && (a != null || b != null)) ch.push({ mode: 'pve', field: k, from: a, to: b }); }
    if (ch.length) out.moves.push({ id, name: nm[id].name, type: nm[id].type, changes: ch });
  }
  for (const id of Object.keys(pm)) if (!nm[id]) out.removedMoves.push({ id, name: pm[id].name });
  const ps = new Map((prev.species || []).map(s => [s.id, s]));
  for (const s of next.species || []) {
    const o = ps.get(s.id);
    if (!o) { out.newSpecies.push({ id: s.id, name: s.name }); continue; }
    const add = (s.fast || []).filter(m => !(o.fast || []).includes(m)).concat((s.charged || []).filter(m => !(o.charged || []).includes(m)));
    const rem = (o.fast || []).filter(m => !(s.fast || []).includes(m)).concat((o.charged || []).filter(m => !(s.charged || []).includes(m)));
    if (add.length || rem.length) out.movepool.push({ id: s.id, name: s.name, added: add, removed: rem });
  }
  out.movepool = out.movepool.slice(0, 300);
  return out;
}
