/* Pestaña Inicio: temporada, ligas de esta semana, novedades y meta actual. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants;
  const { esc, fmt, tchip, icon } = K;
  PoGo.tabs = PoGo.tabs || {};

  function leagueCard(id, cup) {
    const capTxt = !isFinite(cup.cap) || cup.cap >= 100000 ? '∞' : cup.cap;
    const rules = [];
    if (cup.includeTypes) rules.push('Solo: ' + cup.includeTypes.map(t => C.TYPE_ES[t]).join(', '));
    if (cup.excludeTypes) rules.push('Sin: ' + cup.excludeTypes.map(t => C.TYPE_ES[t]).join(', '));
    if (cup.allowMega) rules.push('Megas permitidas');
    if (cup.littleCup) rules.push('Solo sin evolucionar');
    if (cup.allowLegendary === false) rules.push('Sin legendarios');
    return `<button class="league" data-cup="${esc(id)}"><span class="cap num">${capTxt} PC</span><b>${esc(cup.name)}</b><small>${esc(rules.join(' · ') || 'Reglas estándar')}</small></button>`;
  }

  PoGo.tabs.home = {
    render(rootEl, ctx) {
      const D = ctx.D, S = D.season, st = PoGo.data.seasonStatus(S), wk = PoGo.data.currentWeek(S);
      const weekEnd = wk ? new Date(wk.to) : null;
      const hoursLeft = weekEnd ? Math.max(0, Math.round((weekEnd - new Date()) / 3600000)) : null;
      let banner = '';
      if (st.state === 'ended') banner = `<div class="notice bad">La temporada configurada terminó hace ${st.daysAgo} días. Actualiza <code>config/season.json</code> (guía en <em>Datos</em>).</div>`;
      else if (st.state === 'unknown') banner = `<div class="notice warn">No se cargó <code>config/season.json</code>: no hay calendario de ligas.</div>`;

      const seasonLine = st.state === 'active' ? `${esc(S.season.name)} · quedan ${st.daysLeft} días`
        : st.state === 'ended' ? 'Temporada finalizada' : st.state === 'upcoming' ? `Empieza en ${st.days} días` : 'Sin datos de temporada';

      const weekCards = wk ? wk.leagues.map(id => leagueCard(id, S.cups[id] || { name: id, cap: 1500 })).join('') : '';
      const hero = `<section class="hero">
        <div class="row between"><span class="chip"><span class="dot"></span>Temporada ${S && S.season ? 'GBL ' + esc(S.season.gblSeason) : ''}</span>${wk && wk.stardust4x ? '<span class="chip">Polvo estelar ×4 esta semana</span>' : ''}</div>
        <h1 style="margin-top:14px">${esc(seasonLine)}</h1>
        <p class="muted" style="max-width:56ch;margin-top:8px">${wk ? `Ligas activas ahora${hoursLeft != null ? ' · rotan en ' + (hoursLeft > 48 ? Math.round(hoursLeft / 24) + ' días' : hoursLeft + ' h') : ''}. Toca una para calcular qué IV y qué Pokémon te sirven.` : 'Calendario no disponible.'}</p>
        <div class="week">${weekCards}</div></section>`;

      const tools = `<div class="grid cols-2" style="margin-top:16px">
        <button class="card" data-go="iv" style="text-align:left;cursor:pointer"><h3>Calcular IV de un Pokémon</h3><p class="muted small" style="margin-top:6px">Con PC, PS y polvo. Te dice todas las posibilidades y qué mirar en la evaluación para descartar.</p></button>
        <button class="card" data-go="pvp" style="text-align:left;cursor:pointer"><h3>¿Sirve para PvP?</h3><p class="muted small" style="margin-top:6px">Rango de tus IV entre 4096 combinaciones, mejor nivel bajo el tope y ranking de la liga.</p></button>
        <button class="card" data-go="pve" style="text-align:left;cursor:pointer"><h3>Mejores atacantes de incursión</h3><p class="muted small" style="margin-top:6px">DPS, TDO y eDPS contra el jefe que elijas, o calculadora manual para cualquier moveset.</p></button>
        <button class="card" data-go="types" style="text-align:left;cursor:pointer"><h3>Tipos y debilidades</h3><p class="muted small" style="margin-top:6px">Multiplicadores reales de GO (×1,6 y ×0,625), incluyendo dobles.</p></button></div>`;

      // Novedades: automáticas si existen, si no curadas
      let news = '';
      const ch = D.changes && D.changes.moves && D.changes.moves.length ? D.changes : null;
      if (ch) {
        const rows = ch.moves.slice(0, 60).map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${tchip(m.type)}</td><td>${m.changes.map(c => `${c.mode.toUpperCase()} ${esc(c.field)}: <b>${esc(c.from)}→${esc(c.to)}</b>`).join(' · ')}</td></tr>`).join('');
        news = `<div class="section-title"><h2>Cambios detectados automáticamente</h2><span class="muted small">${esc(ch.generatedAt.slice(0, 10))}</span></div>
          <div class="table-wrap"><table><thead><tr><th>Movimiento</th><th>Tipo</th><th>Cambios</th></tr></thead><tbody>${rows}</tbody></table></div>
          ${ch.newMoves.length ? `<p class="muted small" style="margin-top:8px">Movimientos nuevos: ${ch.newMoves.slice(0, 20).map(m => esc(m.name)).join(', ')}</p>` : ''}`;
      } else if (S && S.moveChanges) {
        const rows = S.moveChanges.rows.map(r => `<tr data-q="${esc(r[0].toLowerCase())}"><td><b>${esc(r[0])}</b></td><td>${tchip(r[1])}</td><td style="white-space:normal">${esc(r[2])}</td></tr>`).join('');
        news = `<div class="section-title"><h2>Rebalanceo de la temporada</h2><span class="muted small">Curado · ${esc(S.season.verifiedAt)}</span></div>
          <div class="notice" style="margin-bottom:10px">${esc(S.moveChanges.note)}</div>
          <label class="f" style="max-width:320px;margin-bottom:10px">Filtrar movimiento<input id="newsq" class="in" placeholder="p. ej. Bulldoze"></label>
          <div class="table-wrap"><table id="newstab"><thead><tr><th>Movimiento</th><th>Tipo</th><th>Cambio</th></tr></thead><tbody>${rows}</tbody></table></div>
          <details class="acc" style="margin-top:14px"><summary>Pokémon que reciben ataques nuevos (${S.newMoves.rows.length})</summary><div class="body"><div class="table-wrap"><table><tbody>${S.newMoves.rows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td style="white-space:normal">${esc(r[1])}</td></tr>`).join('')}</tbody></table></div></div></details>`;
      }

      // Meta actual (si hay rankings)
      let meta = '';
      if (D.rankings) {
        const col = (k, title) => {
          const arr = (D.rankings[k] || []).slice(0, 8);
          return `<div class="card flat"><h3>${title}</h3><div class="stack" style="margin-top:12px">${arr.map((r, i) => {
            const s = D.byId.get(r.id); if (!s) return '';
            return `<button class="row between" data-pvp="${esc(r.id)}|${k}" style="border:0;background:none;padding:0;cursor:pointer;text-align:left"><span class="row">${K.orb(s)}<span><b>${esc(s.name)}</b><br><span class="muted small">#${i + 1} · puntuación ${fmt(r.score, 1)}</span></span></span></button>`;
          }).join('')}</div></div>`;
        };
        meta = `<div class="section-title"><h2>Meta actual de PvP</h2><span class="muted small">Simulaciones de PvPoke</span></div><div class="grid cols-2">${col('great', 'Liga Grande')}${col('ultra', 'Liga Ultra')}${col('master', 'Liga Máster')}</div>`;
      }

      rootEl.innerHTML = banner + hero + tools + meta + news;

      rootEl.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => ctx.go(b.dataset.go)));
      rootEl.querySelectorAll('[data-cup]').forEach(b => b.addEventListener('click', () => ctx.go('pvp', { cup: b.dataset.cup })));
      rootEl.querySelectorAll('[data-pvp]').forEach(b => b.addEventListener('click', () => { const [id, lg] = b.dataset.pvp.split('|'); ctx.go('pvp', { speciesId: id, cup: lg }); }));
      const q = rootEl.querySelector('#newsq');
      if (q) q.addEventListener('input', () => { const v = K.norm(q.value); rootEl.querySelectorAll('#newstab tbody tr').forEach(tr => { tr.hidden = v && !K.norm(tr.dataset.q).includes(v); }); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
