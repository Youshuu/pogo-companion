/* Pestaña Calculadora de IV. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants, IV = PoGo.iv, PVP = PoGo.pvp;
  const { esc, fmt, tchips, orb } = K;
  PoGo.tabs = PoGo.tabs || {};

  const opt = (arr, sel) => arr.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const AP_O = [['', '— sin dato —'], ...C.APPRAISAL_OVERALL.map(o => [o.id, o.label])];
  const AP_B = [['', '— sin dato —'], ...C.APPRAISAL_BAR.map(o => [o.id, o.label])];
  const LG = [['great', 'GL', 1500], ['ultra', 'UL', 2500], ['master', 'ML', Infinity]];

  PoGo.tabs.iv = {
    render(rootEl, ctx, params) {
      const D = ctx.D;
      const st = Object.assign({ speciesId: '', cp: '', hp: '', dust: '', level: '', source: 'wild', purified: false, maxLevel: 40, manual: false, mA: 200, mD: 150, mH: 150, ap: {} },
        K.store.get('iv', {}), params || {});
      const dustMap = C.dustToLevels();
      const dustOpts = [['', 'No lo sé'], ...Object.keys(dustMap).map(Number).sort((a, b) => a - b).map(d => [d, fmt(d) + ' polvo'])];
      const levelOpts = [[30, 'Hasta 30'], [35, 'Hasta 35 (clima)'], [40, 'Hasta 40'], [45, 'Hasta 45'], [50, 'Hasta 50'], [51, 'Hasta 51']];

      rootEl.innerHTML = `<div class="split">
        <form class="card stack" id="ivform" onsubmit="return false">
          <div><h2>Calculadora de IV</h2><p class="muted small" style="margin-top:6px">Introduce lo que ves en la ficha del Pokémon. Cuantos más datos, menos posibilidades.</p></div>
          <div id="pick"></div>
          <label class="check"><input type="checkbox" id="manual" ${st.manual ? 'checked' : ''}> No aparece: usar stats base manuales</label>
          <div class="fgrid" id="manualbox" ${st.manual ? '' : 'hidden'}>
            <label class="f">Ataque base<input class="in num" id="mA" type="number" min="1" value="${esc(st.mA)}"></label>
            <label class="f">Defensa base<input class="in num" id="mD" type="number" min="1" value="${esc(st.mD)}"></label>
            <label class="f">PS base<input class="in num" id="mH" type="number" min="1" value="${esc(st.mH)}"></label></div>
          <div class="fgrid">
            <label class="f">PC<input class="in num" id="cp" type="number" inputmode="numeric" min="10" value="${esc(st.cp)}" placeholder="p. ej. 1493"></label>
            <label class="f">PS<input class="in num" id="hp" type="number" inputmode="numeric" min="10" value="${esc(st.hp)}" placeholder="p. ej. 132"></label></div>
          <div class="fgrid">
            <label class="f">Polvo estelar<select class="in" id="dust">${opt(dustOpts, st.dust)}</select></label>
            <label class="f">Nivel exacto (opcional)<input class="in num" id="level" type="number" step="0.5" min="1" max="51" value="${esc(st.level)}"></label></div>
          <label class="f">Origen<select class="in" id="source">${opt(C.IV_SOURCES.map(s => [s.id, s.label + ' (mín. ' + s.floor + ')']), st.source)}</select></label>
          <label class="check"><input type="checkbox" id="purified" ${st.purified ? 'checked' : ''}> Es Purificado (cada IV ≥ 2)</label>
          <label class="f">Nivel máximo posible si no sabes el polvo<select class="in" id="maxLevel">${opt(levelOpts, st.maxLevel)}</select></label>
          <details class="acc" ${Object.keys(st.ap).length ? 'open' : ''}><summary>Evaluación del juego (opcional)</summary><div class="body stack">
            <label class="f">Estrellas<select class="in" id="ap_overall">${opt(AP_O, st.ap.overall ?? '')}</select></label>
            <label class="f">Barra de Ataque<select class="in" id="ap_atk">${opt(AP_B, st.ap.atk ?? '')}</select></label>
            <label class="f">Barra de Defensa<select class="in" id="ap_def">${opt(AP_B, st.ap.def ?? '')}</select></label>
            <label class="f">Barra de PS<select class="in" id="ap_hp">${opt(AP_B, st.ap.hp ?? '')}</select></label></div></details>
          <button class="btn small" type="button" id="reset">Borrar datos</button>
        </form>
        <div id="out" class="stack" aria-live="polite"></div></div>`;

      const $ = (id) => rootEl.querySelector('#' + id);
      const picker = K.speciesPicker($('pick'), D.speciesSorted, () => run(), st.speciesId);

      function readState() {
        const v = (id) => $(id).value;
        const apv = (id) => (v(id) === '' ? undefined : +v(id));
        const s = { speciesId: picker.get() ? picker.get().id : '', cp: v('cp'), hp: v('hp'), dust: v('dust'), level: v('level'), source: v('source'),
          purified: $('purified').checked, maxLevel: +v('maxLevel'), manual: $('manual').checked, mA: +v('mA'), mD: +v('mD'), mH: +v('mH'),
          ap: { overall: apv('ap_overall'), atk: apv('ap_atk'), def: apv('ap_def'), hp: apv('ap_hp') } };
        Object.keys(s.ap).forEach(k => s.ap[k] === undefined && delete s.ap[k]);
        return s;
      }

      function run() {
        const s = readState(); K.store.set('iv', s);
        $('manualbox').hidden = !s.manual;
        const out = $('out');
        const sp = s.manual ? { id: 'manual', name: 'Pokémon manual', types: [], base: { atk: s.mA, def: s.mD, hp: s.mH } } : picker.get();
        if (!sp || !s.cp || !s.hp) { out.innerHTML = `<div class="card empty">${K.icon('iv')}<h3>Empieza con el Pokémon, su PC y sus PS</h3><p class="small">El polvo estelar lo ves en el botón "Potenciar". Con él la mayoría de casos queda en una sola posibilidad.</p></div>`; return; }
        const levels = s.level ? [+s.level] : (s.dust ? dustMap[s.dust] : null);
        const floor = C.IV_SOURCES.find(x => x.id === s.source).floor;
        const cands = IV.solveIVs({ base: sp.base, cp: +s.cp, hp: +s.hp, levels, maxLevel: s.maxLevel, floor, purified: s.purified, appraisal: s.ap });
        if (!cands.length) {
          out.innerHTML = `<div class="card"><div class="notice bad"><b>Ninguna combinación coincide.</b></div>
            <ul class="muted" style="margin:12px 0 0;padding-left:20px"><li>Revisa PC y PS (un dígito mal cambia todo).</li><li>Comprueba que la especie o forma es la correcta (p. ej. formas de Alola/Galar).</li><li>Si pusiste polvo, prueba sin él; si pusiste origen, prueba "Salvaje".</li><li>Quita datos de evaluación por si te equivocaste de barra.</li><li>Sube el nivel máximo si el Pokémon fue potenciado por encima de 40.</li></ul></div>`;
          return;
        }
        // agrupar por IV
        const g = new Map();
        cands.forEach(c => { const k = c.atk + '/' + c.def + '/' + c.hp; if (!g.has(k)) g.set(k, { atk: c.atk, def: c.def, hp: c.hp, total: c.total, percent: c.percent, levels: [] }); g.get(k).levels.push(c.level); });
        const rows = [...g.values()].sort((a, b) => b.total - a.total);
        const sum = IV.summarize(cands);
        const one = rows.length === 1 ? rows[0] : null;

        const lgChips = (r) => LG.map(([id, lab, cap]) => {
          const e = PVP.evaluate(sp.base, r, cap, 50);
          return e.valid ? `<span class="pill ${e.pct >= 98 ? 'good' : e.pct < 90 ? 'bad' : ''}" title="${lab}: rango ${e.rank} de ${e.of}">${lab} #${fmt(e.rank)} · ${fmt(e.pct, 1)}%</span>` : `<span class="pill">${lab} —</span>`;
        }).join(' ');

        let head;
        if (one) {
          const bars = [['ATQ', one.atk], ['DEF', one.def], ['PS', one.hp]].map(([l, v]) => `<div class="ivbar"><span>${l}</span><div class="bar"><i style="width:${v / 15 * 100}%"></i></div><span class="num">${v}/15</span></div>`).join('');
          head = `<div class="card"><div class="grid cols-2" style="align-items:center">
            <div>${K.arcGauge({ pct: one.percent / 100, big: fmt(one.percent, 1) + ' %', small: 'IV exactos', caption: `${one.atk} / ${one.def} / ${one.hp}`, aria: 'Porcentaje de IV' })}</div>
            <div class="stack"><div class="row">${orb(sp, 'lg')}<div><h2>${esc(sp.name)}</h2><span class="muted small">Nivel ${one.levels.map(l => fmt(l, l % 1 ? 1 : 0)).join(' o ')}</span></div></div>
              <div class="ivbars">${bars}</div><div class="row">${lgChips(one)}</div>
              <div class="row"><button class="btn primary small" id="tobox">Guardar en Mi box</button><button class="btn small" id="topvp">Ver en PvP</button></div></div></div></div>`;
        } else {
          head = `<div class="card"><div class="grid cols-2" style="align-items:center">
            <div>${K.arcGauge({ pct: sum.meanPct / 100, big: fmt(sum.minPct, 0) + '–' + fmt(sum.maxPct, 0) + ' %', small: rows.length + ' posibilidades', caption: 'media ' + fmt(sum.meanPct, 1) + ' %', aria: 'Rango de IV' })}</div>
            <div class="stack"><div class="row">${orb(sp, 'lg')}<div><h2>${esc(sp.name)}</h2><span class="muted small">${sum.uniqueLevels} nivel(es) posible(s)</span></div></div>
              <div class="kpis"><div class="kpi"><b class="num">${sum.min.atk}–${sum.max.atk}</b><span>Ataque</span></div><div class="kpi"><b class="num">${sum.min.def}–${sum.max.def}</b><span>Defensa</span></div><div class="kpi"><b class="num">${sum.min.hp}–${sum.max.hp}</b><span>PS</span></div></div></div></div></div>`;
        }

        let tip = '';
        if (rows.length > 1) {
          const nx = IV.bestNextAppraisal(cands);
          const nm = { overall: 'las estrellas de la evaluación', atk: 'la barra de Ataque', def: 'la barra de Defensa', hp: 'la barra de PS' };
          if (nx) tip = `<div class="notice"><span><b>Siguiente paso:</b> mira ${nm[nx[0].feature]}; dejaría en promedio ~${fmt(nx[0].expected, 1)} posibilidades. ${s.dust || s.level ? '' : 'Añadir el polvo estelar suele reducirlas mucho más.'}</span></div>`;
        }

        const shown = rows.slice(0, 60);
        const tbl = `<div class="table-wrap"><table><thead><tr><th>ATQ/DEF/PS</th><th class="r">IV</th><th>Nivel</th><th>Rango PvP</th></tr></thead><tbody>${shown.map((r, i) =>
          `<tr class="clickable" data-i="${i}"><td class="num"><b>${r.atk}/${r.def}/${r.hp}</b></td><td class="r num">${fmt(r.percent, 1)} %</td><td class="num">${r.levels.map(l => fmt(l, l % 1 ? 1 : 0)).join(', ')}</td><td style="white-space:normal">${lgChips(r)}</td></tr>`).join('')}</tbody></table></div>
          ${rows.length > 60 ? `<p class="muted small">Se muestran 60 de ${rows.length}. Añade polvo o evaluación para acotar.</p>` : ''}`;
        const note = `<p class="muted small">Cómo se calcula: se prueban todos los niveles, IV de ataque/defensa/PS y se conservan los que reproducen exactamente tu PC y tus PS${s.dust ? ' y el polvo' : ''}. Pulsa una fila para verla en PvP.</p>`;
        out.innerHTML = head + tip + `<div class="card">${one ? '' : '<h3 style="margin-bottom:12px">Posibilidades</h3>'}${one ? '<h3 style="margin-bottom:12px">Detalle</h3>' : ''}${tbl}${note}</div>`;

        const go = (r) => ctx.go('pvp', { speciesId: sp.id, iv: { atk: r.atk, def: r.def, hp: r.hp } });
        out.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => sp.id !== 'manual' && go(shown[+tr.dataset.i])));
        if (one) {
          const b = out.querySelector('#tobox'); if (b) b.addEventListener('click', () => { PoGo.box.add({ speciesId: sp.id, name: sp.name, iv: { atk: one.atk, def: one.def, hp: one.hp }, level: one.levels[0], cp: +s.cp }); b.textContent = 'Guardado ✓'; });
          const p = out.querySelector('#topvp'); if (p) p.addEventListener('click', () => sp.id !== 'manual' && go(one));
        }
      }

      rootEl.querySelector('#ivform').addEventListener('input', run);
      rootEl.querySelector('#ivform').addEventListener('change', run);
      $('reset').addEventListener('click', () => { K.store.set('iv', {}); ctx.go('iv', {}); });
      run();
    }
  };

  /* Mi box (almacén compartido con la pestaña Box) */
  PoGo.box = {
    all() { return K.store.get('box', []); },
    add(e) { const a = PoGo.box.all(); a.unshift({ ...e, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }); K.store.set('box', a.slice(0, 500)); },
    remove(id) { K.store.set('box', PoGo.box.all().filter(x => x.id !== id)); },
    replace(a) { K.store.set('box', a); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
