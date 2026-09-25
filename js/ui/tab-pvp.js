/* Pestaña PvP: ranking de IV por stat product, movimientos, copas y clasificación de la liga. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants, PVP = PoGo.pvp;
  const { esc, fmt, tchip, tchips, orb } = K;
  PoGo.tabs = PoGo.tabs || {};

  const STD = { little: { name: 'Copa Pequeña (500)', cap: 500 }, great: { name: 'Liga Grande (1500)', cap: 1500 }, ultra: { name: 'Liga Ultra (2500)', cap: 2500 }, master: { name: 'Liga Máster', cap: Infinity } };
  const capOf = (c) => (!isFinite(c) || c >= 100000 ? Infinity : c);
  const baseLeague = (cap) => (cap <= 500 ? 'little' : cap <= 1500 ? 'great' : cap <= 2500 ? 'ultra' : 'master');

  function leagues(D) {
    const L = {}; Object.entries(STD).forEach(([k, v]) => { L[k] = { ...v }; });
    const cups = (D.season && D.season.cups) || {};
    Object.entries(cups).forEach(([k, c]) => { if (!L[k]) L[k] = { ...c, cap: capOf(c.cap), isCup: true }; else L[k] = { ...L[k], ...c, cap: capOf(c.cap), isCup: !STD[k] }; });
    return L;
  }

  function verdict(pct, rank, of) {
    if (rank === 1) return ['good', 'Es el rango 1: la mejor combinación posible.'];
    if (pct >= 99) return ['good', 'Excelente: prácticamente óptimo.'];
    if (pct >= 97) return ['good', 'Muy bueno: la diferencia con el mejor es mínima.'];
    if (pct >= 94) return ['', 'Bueno: totalmente jugable.'];
    if (pct >= 90) return ['warn', 'Aceptable, pero hay IV notablemente mejores.'];
    return ['bad', 'Bajo para esta liga: mejor buscar otro ejemplar.'];
  }

  PoGo.tabs.pvp = {
    render(rootEl, ctx, params) {
      const D = ctx.D, L = leagues(D);
      const saved = K.store.get('pvp', {});
      const st = Object.assign({ speciesId: '', league: 'great', maxLevel: 50, iv: { atk: 15, def: 15, hp: 15 } }, saved, params || {});
      if (params && params.cup) st.league = L[params.cup] ? params.cup : st.league;
      if (!L[st.league]) st.league = 'great';
      if (!st.speciesId && D.rankings && D.rankings.great && D.rankings.great[0]) st.speciesId = D.rankings.great[0].id;
      if (!st.speciesId && D.speciesSorted.length) st.speciesId = (D.byId.get('azumarill') || D.speciesSorted[0]).id;

      rootEl.innerHTML = `<div class="split">
        <div class="card stack">
          <div><h2>PvP · Rango de IV</h2><p class="muted small" style="margin-top:6px">Compara tus IV con las 4096 combinaciones posibles, cada una al mejor nivel que cabe bajo el tope de PC.</p></div>
          <div id="pick"></div>
          <label class="f">Liga o copa<select class="in" id="lg">${Object.entries(L).map(([k, v]) => `<option value="${esc(k)}" ${k === st.league ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
          <label class="f">Nivel máximo permitido<select class="in" id="ml">${[[40, 'Nivel 40 (sin XL)'], [50, 'Nivel 50'], [51, 'Nivel 51 (Mejor Compañero)']].map(([v, l]) => `<option value="${v}" ${v == st.maxLevel ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <div class="fgrid">${['atk', 'def', 'hp'].map(k => `<label class="f">${{ atk: 'IV Ataque', def: 'IV Defensa', hp: 'IV PS' }[k]}<input class="in num" id="iv_${k}" type="number" inputmode="numeric" min="0" max="15" value="${st.iv[k]}"></label>`).join('')}</div>
          <div class="row"><button class="btn small" type="button" data-p="best">Rango 1</button><button class="btn small" type="button" data-p="hundo">15/15/15</button><button class="btn small" type="button" data-p="0-15-15">0/15/15</button></div>
          <button class="btn small" type="button" id="tobox">Guardar en Mi box</button>
        </div>
        <div id="out" class="stack" aria-live="polite"></div></div>`;

      const $ = (id) => rootEl.querySelector('#' + id);
      const picker = K.speciesPicker($('pick'), D.speciesSorted, () => run(), st.speciesId);
      const clamp = (v) => Math.max(0, Math.min(15, Math.round(+v || 0)));
      const getIV = () => ({ atk: clamp($('iv_atk').value), def: clamp($('iv_def').value), hp: clamp($('iv_hp').value) });
      const setIV = (iv) => { $('iv_atk').value = iv.atk; $('iv_def').value = iv.def; $('iv_hp').value = iv.hp; };

      function run() {
        const sp = picker.get(); const out = $('out');
        const key = $('lg').value, lg = L[key], maxLevel = +$('ml').value, iv = getIV();
        K.store.set('pvp', { speciesId: sp ? sp.id : '', league: key, maxLevel, iv });
        if (!sp) { out.innerHTML = `<div class="card empty">${K.icon('pvp')}<h3>Elige un Pokémon</h3></div>`; return; }
        const t = PVP.buildRankTable(sp.base, lg.cap, maxLevel);
        if (!t.valid) { out.innerHTML = `<div class="card"><div class="notice bad">${esc(sp.name)} no cabe en esta liga: ni siquiera al nivel 1 baja de ${lg.cap} PC.</div></div>`; return; }
        const e = PVP.evaluate(sp.base, iv, lg.cap, maxLevel);
        const best = t.best;
        const isMaster = !isFinite(lg.cap);

        // elegibilidad de copa
        let elig = '';
        if (lg.isCup || lg.includeTypes || lg.excludeTypes || lg.bannedNames || lg.allowLegendary === false || lg.allowMega === false) {
          const r = PVP.cupEligibility(sp, lg);
          elig = r.ok ? `<span class="pill good">Elegible en esta copa</span>` : `<span class="pill bad">No elegible: ${esc(r.reason)}</span>`;
        }
        // meta
        const bl = baseLeague(lg.cap);
        const rmap = (D.rankCups && D.rankCups[key]) || (D.rank && D.rank[bl]);
        const mr = rmap && rmap.get(sp.id);
        const metaLine = mr ? `<span class="pill">Meta: #${mr.rank} · puntuación ${fmt(mr.score, 1)}</span>` : (D.rankings ? '<span class="pill">Fuera del ranking</span>' : '');

        let head = '';
        if (e.valid) {
          const [cls, txt] = verdict(e.pct, e.rank, e.of);
          const d = (a, b) => (a / b - 1) * 100;
          head = `<div class="card"><div class="grid cols-2" style="align-items:center">
            <div>${K.arcGauge({ pct: e.pct / 100, big: fmt(e.pct, 1) + ' %', small: `Rango ${fmt(e.rank)} de ${fmt(e.of)}`, caption: 'del stat product máximo', color: cls === 'bad' ? 'var(--bad)' : cls === 'warn' ? 'var(--sun)' : 'var(--primary)', aria: 'Porcentaje del mejor stat product' })}</div>
            <div class="stack"><div class="row">${orb(sp, 'lg')}<div><h2>${esc(sp.name)}</h2>${tchips(sp.types)}</div></div>
              <div class="row"><span class="pill ${cls}">${esc(txt)}</span>${elig}${metaLine}</div>
              <div class="kpis"><div class="kpi"><b class="num">${fmt(e.level, e.level % 1 ? 1 : 0)}</b><span>Nivel</span></div><div class="kpi"><b class="num">${e.cp}</b><span>PC</span></div>
                <div class="kpi"><b class="num">${fmt(e.sAtk, 1)}</b><span>Ataque</span></div><div class="kpi"><b class="num">${fmt(e.sDef, 1)}</b><span>Defensa</span></div><div class="kpi"><b class="num">${e.sHp}</b><span>PS</span></div></div></div></div>
            <p class="muted small" style="margin-top:10px">Mejor: <b class="num">${best.atk}/${best.def}/${best.hp}</b> a nivel ${fmt(best.level, best.level % 1 ? 1 : 0)} (${best.cp} PC). Frente a él tu ejemplar tiene ${fmt(d(e.sAtk, best.sAtk), 1)} % de ataque, ${fmt(d(e.sDef, best.sDef), 1)} % de defensa y ${fmt(d(e.sHp, best.sHp), 1)} % de PS.
            ${isMaster ? 'En Máster no hay tope de PC, por eso 15/15/15 es siempre lo mejor.' : ''}</p></div>`;
        } else head = `<div class="card"><div class="notice bad">Estos IV no caben bajo el tope (${lg.cap} PC) ni al nivel 1.</div></div>`;

        const hist = e.valid ? `<div class="card"><h3>Dónde queda tu ejemplar</h3><p class="muted small" style="margin:4px 0 8px">Cada barra agrupa combinaciones de IV por stat product; la línea amarilla eres tú.</p>${K.histogram(PVP.histogram(t, 32), e.sp, 'stat product (Ataque × Defensa × PS)')}</div>` : '';

        const top = `<div class="card"><h3 style="margin-bottom:10px">Mejores combinaciones de IV</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>ATQ/DEF/PS</th><th>Nivel</th><th class="r">PC</th><th class="r">% mejor</th></tr></thead><tbody>${t.rows.slice(0, 8).map(r => `<tr class="clickable" data-iv="${r.atk},${r.def},${r.hp}"><td class="num">${r.rank}</td><td class="num"><b>${r.atk}/${r.def}/${r.hp}</b></td><td class="num">${fmt(r.level, r.level % 1 ? 1 : 0)}</td><td class="r num">${r.cp}</td><td class="r num">${fmt(r.pct, 1)} %</td></tr>`).join('')}</tbody></table></div></div>`;

        // movimientos
        let moves = '';
        if (D.moves && (sp.fast || sp.charged) && (sp.fast.length || sp.charged.length)) {
          const rec = mr && mr.moveset ? mr.moveset : [];
          const star = (id) => (rec.includes(id) ? ' <span class="pill good">Recomendado</span>' : '');
          const recFast = D.moves[rec[0]];
          const F = sp.fast.map(id => D.moves[id]).filter(Boolean).map(m => {
            const x = PVP.fastMetrics(m.pvp);
            return `<tr><td><b>${esc(m.name)}</b>${star(m.id)}</td><td>${tchip(m.type)}</td><td class="r num">${m.pvp.power}</td><td class="r num">${m.pvp.energyGain}</td><td class="r num">${x.turns}</td><td class="r num">${fmt(x.dpt, 2)}</td><td class="r num">${fmt(x.ept, 2)}</td></tr>`;
          }).join('');
          const baseFast = recFast || D.moves[sp.fast[0]];
          const Ch = sp.charged.map(id => D.moves[id]).filter(Boolean).map(m => {
            const x = PVP.chargedMetrics(m.pvp);
            const buff = m.pvp.buffs ? `${(m.pvp.buffApplyChance * 100).toFixed(0)} % ${m.pvp.buffTarget === 'self' ? 'a ti' : 'al rival'}: ${m.pvp.buffs.join('/')}` : '—';
            const ttc = baseFast ? PVP.turnsToCharge(baseFast.pvp, m.pvp) : null;
            return `<tr><td><b>${esc(m.name)}</b>${star(m.id)}</td><td>${tchip(m.type)}</td><td class="r num">${m.pvp.power}</td><td class="r num">${m.pvp.energy}</td><td class="r num">${fmt(x.dpe, 2)}</td><td class="r num">${ttc == null ? '—' : ttc}</td><td>${esc(buff)}</td></tr>`;
          }).join('');
          moves = `<div class="card"><div class="row between"><h3>Ataques</h3><span class="muted small">${rec.length ? 'Moveset recomendado por el simulador de PvPoke' : 'Sin recomendación de ranking'}</span></div>
            <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Rápido</th><th>Tipo</th><th class="r">Poder</th><th class="r">Energía</th><th class="r">Turnos</th><th class="r">DPT</th><th class="r">EPT</th></tr></thead><tbody>${F}</tbody></table></div>
            <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Cargado</th><th>Tipo</th><th class="r">Poder</th><th class="r">Coste</th><th class="r">DPE</th><th class="r">Turnos a cargar</th><th>Efecto</th></tr></thead><tbody>${Ch}</tbody></table></div>
            <p class="muted small" style="margin-top:8px">DPT = daño por turno · EPT = energía por turno · DPE = daño por energía. "Turnos a cargar" usa el ataque rápido recomendado. Elegir el mejor moveset exige simular batallas (escudos, cebos); por eso se toma del simulador de PvPoke.</p></div>`;
        } else if (D.mode !== 'full') {
          moves = `<div class="card"><div class="notice">Los ataques y el moveset recomendado aparecen cuando se cargan los datos completos (<code>data/</code>). Ver pestaña <b>Datos</b>.</div></div>`;
        }

        // clasificación
        let board = '';
        const arr = D.rankCups && D.rankCups[key] ? D.rankings.cups[key] : (D.rankings && D.rankings[bl]);
        if (arr) {
          const filt = (lg.isCup || lg.includeTypes || lg.excludeTypes || lg.bannedNames || lg.allowLegendary === false) && !D.rankCups[key];
          const list = arr.map((r, i) => ({ r, i, s: D.byId.get(r.id) })).filter(x => x.s && (!filt || PVP.cupEligibility(x.s, lg).ok)).slice(0, 25);
          board = `<div class="card"><div class="row between"><h3>Clasificación · ${esc(lg.name)}</h3><span class="muted small">${filt ? 'Filtrada por las reglas de la copa' : 'PvPoke'}</span></div><div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>#</th><th>Pokémon</th><th>Ataques</th><th class="r">Puntuación</th></tr></thead><tbody>${list.map((x, j) => `<tr class="clickable" data-sp="${esc(x.s.id)}"><td class="num">${filt ? j + 1 : x.i + 1}</td><td><span class="row">${orb(x.s)}<b>${esc(x.s.name)}</b></span></td><td class="muted small">${(x.r.moveset || []).map(id => esc((D.moves && D.moves[id] && D.moves[id].name) || id)).join(' · ')}</td><td class="r num">${fmt(x.r.score, 1)}</td></tr>`).join('')}</tbody></table></div></div>`;
        }
        out.innerHTML = head + hist + top + moves + board;

        out.querySelectorAll('tr[data-iv]').forEach(tr => tr.addEventListener('click', () => { const [a, d, h] = tr.dataset.iv.split(',').map(Number); setIV({ atk: a, def: d, hp: h }); run(); }));
        out.querySelectorAll('tr[data-sp]').forEach(tr => tr.addEventListener('click', () => { picker.set(D.byId.get(tr.dataset.sp)); run(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
      }

      rootEl.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
        const sp = picker.get(); if (!sp) return; const lg = L[$('lg').value];
        if (b.dataset.p === 'best') { const t = PVP.buildRankTable(sp.base, lg.cap, +$('ml').value); if (t.valid) setIV(t.best); }
        else if (b.dataset.p === 'hundo') setIV({ atk: 15, def: 15, hp: 15 }); else setIV({ atk: 0, def: 15, hp: 15 });
        run();
      }));
      $('tobox').addEventListener('click', () => {
        const sp = picker.get(); if (!sp) return; const iv = getIV(); const e = PVP.evaluate(sp.base, iv, L[$('lg').value].cap, +$('ml').value);
        PoGo.box.add({ speciesId: sp.id, name: sp.name, iv, level: e.valid ? e.level : null, cp: e.valid ? e.cp : null }); $('tobox').textContent = 'Guardado ✓';
      });
      ['lg', 'ml', 'iv_atk', 'iv_def', 'iv_hp'].forEach(id => { $(id).addEventListener('input', run); $(id).addEventListener('change', run); });
      run();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
