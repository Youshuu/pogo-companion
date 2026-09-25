/* Pestaña Incursiones (PvE): ranking de atacantes y calculadora manual (comprehensive DPS). */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants, PVE = PoGo.pve;
  const { esc, fmt, tchip, tchips, orb } = K;
  PoGo.tabs = PoGo.tabs || {};

  const WEATHER = { none: ['Sin clima', []], sunny: ['Soleado', ['grass', 'ground', 'fire']], rain: ['Lluvia', ['water', 'electric', 'bug']],
    partly: ['Parcialmente nublado', ['normal', 'rock']], cloudy: ['Nublado', ['fairy', 'fighting', 'poison']], windy: ['Viento', ['dragon', 'flying', 'psychic']],
    snow: ['Nieve', ['ice', 'steel']], fog: ['Niebla', ['dark', 'ghost']] };
  const TIERS = { t1: ['Nivel 1 (nv. 20)', 20], t3: ['Nivel 3 (nv. 30)', 30], t5: ['Nivel 5 (nv. 40)', 40], mega: ['Mega (nv. 40)', 40] };
  const typeOpts = (sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + C.TYPES.map(t => `<option value="${t}" ${t === sel ? 'selected' : ''}>${C.TYPE_ES[t]}</option>`).join('');
  const num = (v, d) => (isFinite(+v) && v !== '' ? +v : d);

  PoGo.tabs.pve = {
    render(rootEl, ctx, params) {
      const D = ctx.D;
      const hasPve = !!(D.pve && D.pve.species && D.pve.species.length);
      let mode = (params && params.mode) || K.store.get('pveMode', hasPve ? 'rank' : 'manual');
      if (mode === 'rank' && !hasPve) mode = 'manual';
      rootEl.innerHTML = `<div class="row between" style="margin-bottom:16px"><div><h2>Incursiones y gimnasios</h2><p class="muted small" style="margin-top:4px">Modelo de DPS completo: incluye la energía que ganas al recibir daño.</p></div>
        <div class="seg" role="group" aria-label="Modo"><button data-m="rank" aria-pressed="${mode === 'rank'}" ${hasPve ? '' : 'disabled title="Requiere data/pve.json"'}>Ranking</button><button data-m="manual" aria-pressed="${mode === 'manual'}">Calculadora manual</button></div></div><div id="body"></div>`;
      rootEl.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { K.store.set('pveMode', b.dataset.m); ctx.go('pve', { mode: b.dataset.m }); }));
      (mode === 'rank' ? rank : manual)(rootEl.querySelector('#body'), ctx);
    }
  };

  /* ================= Ranking ================= */
  function rank(body, ctx) {
    const D = ctx.D, moves = D.pve.moves;
    const st = Object.assign({ boss: 'none', bt1: 'dragon', bt2: '', tier: 't5', level: 40, weather: 'none', shadow: true, mega: false, ivp: '15', relobby: 10, dodge: 0, typeFilter: '', bossFast: '', bossCharged: '' }, K.store.get('pveRank', {}));
    body.innerHTML = `<div class="split"><div class="card stack">
      <label class="f">Contra…<select class="in" id="boss"><option value="none" ${st.boss === 'none' ? 'selected' : ''}>Tipo de jefe (solo DPS)</option><option value="species" ${st.boss === 'species' ? 'selected' : ''}>Jefe concreto (DPS + TDO + eDPS)</option></select></label>
      <div id="bnone" class="fgrid"><label class="f">Tipo 1 del jefe<select class="in" id="bt1">${typeOpts(st.bt1)}</select></label><label class="f">Tipo 2<select class="in" id="bt2">${typeOpts(st.bt2, '—')}</select></label></div>
      <div id="bspec" class="stack" hidden><div id="bpick"></div>
        <label class="f">Nivel del jefe<select class="in" id="tier">${Object.entries(TIERS).map(([k, v]) => `<option value="${k}" ${k === st.tier ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
        <div class="fgrid"><label class="f">Ataque rápido del jefe<select class="in" id="bf"></select></label><label class="f">Ataque cargado del jefe<select class="in" id="bc"></select></label></div>
        <label class="f">Esquivas efectivas: <span id="dv" class="num">${Math.round(st.dodge * 100)}</span> %<input id="dodge" type="range" min="0" max="100" value="${Math.round(st.dodge * 100)}"></label></div>
      <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:0">
      <div class="fgrid"><label class="f">Nivel de tus atacantes<select class="in" id="lvl">${[40, 50, 51].map(v => `<option value="${v}" ${v == st.level ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f">IV<select class="in" id="ivp"><option value="15" ${st.ivp === '15' ? 'selected' : ''}>15/15/15</option><option value="10" ${st.ivp === '10' ? 'selected' : ''}>10/10/10</option></select></label></div>
      <label class="f">Clima<select class="in" id="wx">${Object.entries(WEATHER).map(([k, v]) => `<option value="${k}" ${k === st.weather ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <label class="f">Solo con ataques de tipo<select class="in" id="tf">${typeOpts(st.typeFilter, 'Cualquiera')}</select></label>
      <label class="check"><input type="checkbox" id="shadow" ${st.shadow ? 'checked' : ''}> Incluir Sombríos</label>
      <label class="check"><input type="checkbox" id="mega" ${st.mega ? 'checked' : ''}> Incluir Megas (sin bono de equipo)</label>
      <label class="f">Tiempo de re-lobby (s)<input class="in num" id="rl" type="number" min="0" max="60" value="${st.relobby}"></label></div>
      <div id="out" class="stack" aria-live="polite"></div></div>`;
    const $ = (id) => body.querySelector('#' + id);
    const bossSp = D.pve.species.filter(s => !(s.tags || []).includes('mega')).slice().sort((a, b) => a.name.localeCompare(b.name));
    let bossPick = K.speciesPicker($('bpick'), bossSp, (s) => { fillMoves(s); run(); }, st.bossId);
    function fillMoves(s) {
      const nm = (id) => (moves[id] ? moves[id].name : id);
      const f = s.fast.filter(id => moves[id]), c = s.charged.filter(id => moves[id]);
      $('bf').innerHTML = f.map(id => `<option value="${id}" ${id === st.bossFast ? 'selected' : ''}>${esc(nm(id))}</option>`).join('');
      $('bc').innerHTML = c.map(id => `<option value="${id}" ${id === st.bossCharged ? 'selected' : ''}>${esc(nm(id))}</option>`).join('');
    }
    if (bossPick.get()) fillMoves(bossPick.get());

    function run() {
      const s = { boss: $('boss').value, bt1: $('bt1').value, bt2: $('bt2').value, tier: $('tier').value, level: +$('lvl').value, weather: $('wx').value, shadow: $('shadow').checked, mega: $('mega').checked,
        ivp: $('ivp').value, relobby: num($('rl').value, 10), dodge: +$('dodge').value / 100, typeFilter: $('tf').value, bossId: bossPick.get() ? bossPick.get().id : '', bossFast: $('bf').value, bossCharged: $('bc').value };
      K.store.set('pveRank', s);
      $('dv').textContent = Math.round(s.dodge * 100);
      $('bnone').hidden = s.boss !== 'none'; $('bspec').hidden = s.boss !== 'species';
      const iv = { atk: +s.ivp, def: +s.ivp, hp: +s.ivp };
      let list = D.pve.species.filter(x => x.base && x.types);
      if (s.shadow) list = list.concat(list.filter(x => x.hasShadow).map(x => ({ ...x, id: x.id + '_shadow', name: 'Sombrío ' + x.name, isShadow: true })));
      const opts = { level: s.level, iv, includeMega: s.mega, weatherTypes: WEATHER[s.weather][1], relobbySec: s.relobby, dodge: s.dodge, onlyType: s.typeFilter || null, shadow: D.pve.battle && D.pve.battle.shadowAtk ? { atk: D.pve.battle.shadowAtk, def: D.pve.battle.shadowDef || C.MULT.SHADOW_DEF } : undefined };
      let boss = null, bossNote = '';
      if (s.boss === 'none') {
        const bt = [s.bt1, s.bt2].filter(Boolean); boss = { def: 160, types: bt }; opts.boss = boss; // defensa de referencia ≈ jefe de nivel 5 típico
        bossNote = `DPS puro contra un jefe de tipo ${bt.map(t => C.TYPE_ES[t]).join('/')}. Sin daño entrante no hay TDO: se muestra también la robustez (Def × PS).`;
      } else {
        const b = bossPick.get();
        if (!b || !moves[s.bossFast] || !moves[s.bossCharged]) { $('out').innerHTML = `<div class="card empty">${K.icon('pve')}<h3>Elige el jefe y sus ataques</h3></div>`; return; }
        const cpm = C.cpm(TIERS[s.tier][1]);
        boss = { atk: (b.base.atk + 15) * cpm, def: (b.base.def + 15) * cpm, types: b.types,
          fast: { type: moves[s.bossFast].type, ...moves[s.bossFast].pve }, charged: [{ type: moves[s.bossCharged].type, ...moves[s.bossCharged].pve }] };
        opts.boss = boss; bossNote = `Jefe: ${b.name} (${TIERS[s.tier][0]}) con sus ataques elegidos, pausa entre ataques ${PVE.DEFAULTS.bossDelaySec} s.`;
      }
      const t0 = performance.now();
      const res = PVE.rankAttackers(list, moves, opts);
      const ms = performance.now() - t0;
      const top = res.slice(0, 40);
      if (!top.length) { $('out').innerHTML = `<div class="card empty"><h3>Sin resultados con esos filtros</h3></div>`; return; }
      const full = s.boss === 'species';
      const maxScore = top[0].score;
      const pts = full ? top.map(r => ({ x: r.dps, y: isFinite(r.tdo) ? r.tdo : 0, label: `${r.name}: DPS ${fmt(r.dps, 1)} · TDO ${fmt(r.tdo, 0)}`, color: C.TYPE_COLOR[r.types[0]] })) : [];
      const bulkMax = Math.max(...top.map(r => r.bulk));
      $('out').innerHTML = `<div class="card"><div class="row between"><h3>Mejores atacantes</h3><span class="muted small">${fmt(res.length)} evaluados en ${Math.round(ms)} ms</span></div>
        <p class="muted small" style="margin:4px 0 12px">${esc(bossNote)}</p>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Pokémon</th><th>Movimientos</th><th class="r">DPS</th>${full ? '<th class="r">TDO</th><th class="r">eDPS</th>' : '<th class="r">Robustez</th>'}<th style="min-width:110px"></th></tr></thead><tbody>
        ${top.map((r, i) => `<tr><td class="num">${i + 1}</td><td><span class="row">${orb(r)}<span><b>${esc(r.name)}</b><br>${tchips(r.types)}</span></span></td>
          <td><span class="row" style="gap:6px">${tchip(r.fast.type)}<span>${esc(r.fast.name)}</span></span><span class="row" style="gap:6px;margin-top:3px">${tchip(r.charged.type)}<span>${esc(r.charged.name)}</span></span></td>
          <td class="r num"><b>${fmt(r.dps, 2)}</b></td>${full ? `<td class="r num">${isFinite(r.tdo) ? fmt(r.tdo, 0) : '—'}</td><td class="r num"><b>${fmt(r.edps, 2)}</b></td>` : `<td class="r num">${fmt(r.bulk / bulkMax * 100, 0)} %</td>`}
          <td><div class="bar"><i style="width:${(r.score / maxScore * 100).toFixed(1)}%;background:${C.TYPE_COLOR[r.types[0]]}"></i></div></td></tr>`).join('')}</tbody></table></div></div>
        ${full ? `<div class="card"><h3>DPS frente a TDO</h3><p class="muted small" style="margin:4px 0 8px">Arriba a la derecha = pega fuerte y aguanta. Cada punto es un atacante con su mejor moveset.</p>${K.scatter(pts, 'DPS', 'TDO')}</div>` : ''}
        <p class="muted small">Ranking por ${full ? 'eDPS = 1 / (1/DPS + relobby/TDO)' : 'DPS'}. Modelo y supuestos en la pestaña Datos → Fórmulas.</p>`;
    }
    ['boss', 'bt1', 'bt2', 'tier', 'lvl', 'wx', 'ivp', 'tf', 'shadow', 'mega', 'rl', 'dodge', 'bf', 'bc'].forEach(id => { $(id).addEventListener('input', run); $(id).addEventListener('change', run); });
    run();
  }

  /* ================= Manual ================= */
  function manual(body, ctx) {
    const D = ctx.D;
    const d = Object.assign({ bA: 300, bD: 182, bH: 214, iA: 15, iD: 15, iH: 15, lvl: 40, t1: 'psychic', t2: '', shadow: false,
      fT: 'psychic', fP: 16, fD: 1.6, fE: 12, cT: 'psychic', cP: 90, cD: 2.0, cE: 50, cW: 1.2, e1: 'fighting', e2: '', bd: 160, y: 30, x: '', wx: 'none', relobby: 10, extra: 1 }, K.store.get('pveManual', {}));
    const f = (id, label, v, extra) => `<label class="f">${label}<input class="in num" id="${id}" type="number" step="any" value="${esc(v)}" ${extra || ''}></label>`;
    body.innerHTML = `<div class="split"><div class="card stack">
      <div id="pick"></div>
      <div class="fgrid">${f('bA', 'Ataque base', d.bA)}${f('bD', 'Defensa base', d.bD)}${f('bH', 'PS base', d.bH)}</div>
      <div class="fgrid">${f('iA', 'IV Ataque', d.iA, 'min=0 max=15')}${f('iD', 'IV Defensa', d.iD, 'min=0 max=15')}${f('iH', 'IV PS', d.iH, 'min=0 max=15')}${f('lvl', 'Nivel', d.lvl, 'min=1 max=51 step=0.5')}</div>
      <div class="fgrid"><label class="f">Tipo 1<select class="in" id="t1">${typeOpts(d.t1)}</select></label><label class="f">Tipo 2<select class="in" id="t2">${typeOpts(d.t2, '—')}</select></label></div>
      <label class="check"><input type="checkbox" id="shadow" ${d.shadow ? 'checked' : ''}> Sombrío (Atk ×1,2 · Def ×0,833)</label>
      <h3>Ataque rápido</h3><div class="fgrid"><label class="f">Tipo<select class="in" id="fT">${typeOpts(d.fT)}</select></label>${f('fP', 'Poder', d.fP)}${f('fD', 'Duración (s)', d.fD)}${f('fE', 'Energía ganada', d.fE)}</div>
      <h3>Ataque cargado</h3><div class="fgrid"><label class="f">Tipo<select class="in" id="cT">${typeOpts(d.cT)}</select></label>${f('cP', 'Poder', d.cP)}${f('cD', 'Duración (s)', d.cD)}${f('cE', 'Coste de energía', d.cE)}${f('cW', 'Inicio del daño (s)', d.cW)}</div>
      <h3>Jefe</h3><div class="fgrid"><label class="f">Tipo 1<select class="in" id="e1">${typeOpts(d.e1, '—')}</select></label><label class="f">Tipo 2<select class="in" id="e2">${typeOpts(d.e2, '—')}</select></label></div>
      <div class="fgrid">${f('bd', 'Defensa efectiva del jefe', d.bd, 'min=1')}${f('y', 'DPS entrante del jefe (y)', d.y, 'min=0')}${f('rl', 'Re-lobby (s)', d.relobby, 'min=0')}</div>
      <label class="f">Clima<select class="in" id="wx">${Object.entries(WEATHER).map(([k, v]) => `<option value="${k}" ${k === d.wx ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <p class="muted small">Sin jefe concreto, usa <b>y = 0</b> para el DPS puro. Con y &gt; 0 se calculan también TDO y eDPS. Puedes teclear ataques nuevos o cambiados antes de que lleguen a los datos.</p></div>
      <div id="out" class="stack" aria-live="polite"></div></div>`;
    const $ = (id) => body.querySelector('#' + id);
    K.speciesPicker($('pick'), D.speciesSorted, (s) => { $('bA').value = s.base.atk; $('bD').value = s.base.def; $('bH').value = s.base.hp; $('t1').value = s.types[0] || ''; $('t2').value = s.types[1] || ''; run(); });
    function run() {
      const v = (id) => num($(id).value, 0);
      const s = { bA: v('bA'), bD: v('bD'), bH: v('bH'), iA: v('iA'), iD: v('iD'), iH: v('iH'), lvl: v('lvl'), t1: $('t1').value, t2: $('t2').value, shadow: $('shadow').checked,
        fT: $('fT').value, fP: v('fP'), fD: v('fD'), fE: v('fE'), cT: $('cT').value, cP: v('cP'), cD: v('cD'), cE: v('cE'), cW: v('cW'), e1: $('e1').value, e2: $('e2').value, bd: v('bd'), y: v('y'), relobby: v('rl'), wx: $('wx').value };
      K.store.set('pveManual', s);
      const out = $('out');
      if (s.bd <= 0 || s.fD <= 0 || s.cD <= 0 || s.fE <= 0 || s.cE <= 0 || s.lvl < 1 || s.lvl > 51) { out.innerHTML = `<div class="card"><div class="notice warn">Duraciones y energías deben ser mayores que 0, y el nivel estar entre 1 y 51.</div></div>`; return; }
      const att = { base: { atk: s.bA, def: s.bD, hp: s.bH }, iv: { atk: s.iA, def: s.iD, hp: s.iH }, level: s.lvl, types: [s.t1, s.t2].filter(Boolean), isShadow: s.shadow };
      const bt = [s.e1, s.e2].filter(Boolean);
      const p = PVE.performance(att, { type: s.fT, power: s.fP, durationMs: s.fD * 1000, energy: s.fE }, { type: s.cT, power: s.cP, durationMs: s.cD * 1000, energy: s.cE, dwsMs: s.cW * 1000 },
        { def: Math.max(1, s.bd), types: bt, y: s.y }, { weatherTypes: WEATHER[s.wx][1], relobbySec: s.relobby });
      const fin = isFinite(p.tdo);
      out.innerHTML = `<div class="card"><div class="grid cols-2" style="align-items:center"><div>${K.arcGauge({ pct: Math.min(1, p.dps / 40), big: fmt(p.dps, 2), small: 'DPS', caption: fin ? 'eDPS ' + fmt(p.edps, 2) : 'sin daño entrante', aria: 'DPS' })}</div>
        <div class="kpis"><div class="kpi"><b class="num">${fin ? fmt(p.tdo, 0) : '—'}</b><span>TDO</span></div><div class="kpi"><b class="num">${fin ? fmt(p.timeAlive, 1) + ' s' : '—'}</b><span>Tiempo vivo</span></div>
          <div class="kpi"><b class="num">${p.FDmg}</b><span>Daño rápido</span></div><div class="kpi"><b class="num">${p.CDmg}</b><span>Daño cargado</span></div>
          <div class="kpi"><b class="num">${fmt(p.stats.atk, 1)}</b><span>Ataque efectivo</span></div><div class="kpi"><b class="num">${fmt(p.stats.def, 1)}</b><span>Defensa efectiva</span></div><div class="kpi"><b class="num">${p.stats.hp}</b><span>PS</span></div></div></div>
        <p class="muted small" style="margin-top:12px">Daño del rápido = ⌊0,5 · ${s.fP} · Atk/Def · ×⌋ + 1 con el multiplicador de tipo/STAB/clima frente al jefe. El daño del jefe hacia ti usa "y" tal cual; y con más daño recibido ganas más energía (0,5 por PS).</p></div>`;
    }
    body.querySelectorAll('input,select').forEach(el => { el.addEventListener('input', run); el.addEventListener('change', run); });
    run();
  }
})(typeof window !== 'undefined' ? window : globalThis);
