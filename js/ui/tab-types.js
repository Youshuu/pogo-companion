/* Pestaña Tipos: debilidades de un defensor, alcance de un atacante y matriz completa. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants;
  const { esc, fmt, tchip, tchips } = K;
  PoGo.tabs = PoGo.tabs || {};
  const GROUPS = [[2.5, '×2,56 · doble debilidad'], [1.5, '×1,6 · débil'], [0.99, '×1 · neutro'], [0.6, '×0,625 · resiste'], [0.3, '×0,39 · muy resistente / inmune'], [0, '×0,24 · triple resistencia']];

  PoGo.tabs.types = {
    render(rootEl, ctx) {
      const D = ctx.D;
      const st = Object.assign({ t1: 'dragon', t2: 'flying', atk: 'fire' }, K.store.get('types', {}));
      rootEl.innerHTML = `<div class="split"><div class="stack"><div class="card stack"><h2>Debilidades</h2><div id="pick"></div>
        <div class="fgrid"><label class="f">Tipo 1<select class="in" id="t1">${C.TYPES.map(t => `<option value="${t}" ${t === st.t1 ? 'selected' : ''}>${C.TYPE_ES[t]}</option>`).join('')}</select></label>
        <label class="f">Tipo 2<select class="in" id="t2"><option value="">—</option>${C.TYPES.map(t => `<option value="${t}" ${t === st.t2 ? 'selected' : ''}>${C.TYPE_ES[t]}</option>`).join('')}</select></label></div></div>
        <div class="card stack"><h2>Alcance de un ataque</h2><label class="f">Tipo del ataque<select class="in" id="atk">${C.TYPES.map(t => `<option value="${t}" ${t === st.atk ? 'selected' : ''}>${C.TYPE_ES[t]}</option>`).join('')}</select></label><div id="reach"></div></div></div>
        <div class="stack"><div class="card" id="def"></div></div></div>
        <div class="section-title"><h2>Tabla completa</h2><span class="muted small">Filas: ataca · Columnas: defiende</span></div>
        <div class="card" style="overflow-x:auto"><table class="matrix" id="mx"></table></div>`;
      const $ = (id) => rootEl.querySelector('#' + id);
      K.speciesPicker($('pick'), D.speciesSorted, (s) => { $('t1').value = s.types[0] || 'normal'; $('t2').value = s.types[1] || ''; run(); });
      function run() {
        const t1 = $('t1').value, t2 = $('t2').value, a = $('atk').value; K.store.set('types', { t1, t2, atk: a });
        const def = [t1, t2].filter(Boolean);
        const by = GROUPS.map(() => []);
        C.TYPES.forEach(att => {
          const m = def.reduce((p, d) => p * C.TYPE_CHART[att][d], 1);
          const gi = m > 2 ? 0 : m > 1.05 ? 1 : m > 0.95 ? 2 : m > 0.5 ? 3 : m > 0.3 ? 4 : 5;
          by[gi].push(att);
        });
        $('def').innerHTML = `<div class="row between"><h2>${tchips(def)}</h2></div><div class="stack" style="margin-top:14px">${GROUPS.map((g, i) => by[i].length ? `<div><div class="muted small" style="font-weight:700;margin-bottom:6px">${g[1]}</div><div class="row" style="gap:6px">${by[i].map(tchip).join('')}</div></div>` : '').join('')}</div>`;
        const se = C.TYPES.filter(d => C.TYPE_CHART[a][d] > 1), nve = C.TYPES.filter(d => C.TYPE_CHART[a][d] < 1 && C.TYPE_CHART[a][d] > 0.5), im = C.TYPES.filter(d => C.TYPE_CHART[a][d] < 0.5);
        $('reach').innerHTML = `<div class="stack"><div><div class="muted small"><b>Súper eficaz (×1,6)</b></div><div class="row" style="gap:6px;margin-top:4px">${se.map(tchip).join('') || '—'}</div></div>
          <div><div class="muted small"><b>Poco eficaz (×0,625)</b></div><div class="row" style="gap:6px;margin-top:4px">${nve.map(tchip).join('') || '—'}</div></div>
          <div><div class="muted small"><b>Casi nulo (×0,39)</b></div><div class="row" style="gap:6px;margin-top:4px">${im.map(tchip).join('') || '—'}</div></div></div>`;
      }
      const mx = C.TYPES.map(a => `<tr><th class="t"><span class="tchip" style="background:${C.TYPE_COLOR[a]}">${esc(C.TYPE_ES[a].slice(0, 3))}</span></th>${C.TYPES.map(d => { const m = C.TYPE_CHART[a][d]; return `<td style="background:${K.heat(m)};color:${m === 1 ? 'transparent' : '#fff'}" title="${C.TYPE_ES[a]} → ${C.TYPE_ES[d]}: ×${m}">${K.multLabel(m)}</td>`; }).join('')}</tr>`).join('');
      $('mx').innerHTML = `<tr><th></th>${C.TYPES.map(d => `<th class="t"><span class="tchip" style="background:${C.TYPE_COLOR[d]}">${esc(C.TYPE_ES[d].slice(0, 3))}</span></th>`).join('')}</tr>${mx}`;
      ['t1', 't2', 'atk'].forEach(id => $(id).addEventListener('change', run));
      run();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
