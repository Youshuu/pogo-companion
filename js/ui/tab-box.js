/* Pestaña Mi box: tus Pokémon guardados (solo en este dispositivo) evaluados por liga. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants, PVP = PoGo.pvp;
  const { esc, fmt, orb } = K;
  PoGo.tabs = PoGo.tabs || {};

  PoGo.tabs.box = {
    render(rootEl, ctx) {
      const D = ctx.D;
      const items = PoGo.box.all().map(e => ({ e, sp: D.byId.get(e.speciesId) }));
      const ev = (x, cap) => (x.sp ? PVP.evaluate(x.sp.base, x.e.iv, cap, 50) : { valid: false });
      const rows = items.map(x => ({ ...x, g: ev(x, 1500), u: ev(x, 2500), m: ev(x, Infinity), pct: (x.e.iv.atk + x.e.iv.def + x.e.iv.hp) / 45 * 100 }));
      const cell = (r) => (r.valid ? `<span class="pill ${r.pct >= 98 ? 'good' : r.pct < 90 ? 'bad' : ''}">#${fmt(r.rank)} · ${fmt(r.pct, 1)}%</span>` : '<span class="pill">—</span>');
      rootEl.innerHTML = `<div class="row between" style="margin-bottom:14px"><div><h2>Mi box</h2><p class="muted small" style="margin-top:4px">Se guarda solo en este navegador. Añade desde la calculadora de IV o PvP.</p></div>
        <div class="row"><button class="btn small" id="exp">Copiar copia (JSON)</button><button class="btn small" id="imp">Importar</button></div></div>
        <div id="impbox" hidden class="card stack" style="margin-bottom:14px"><label class="f">Pega aquí la copia<textarea class="in" id="txt" rows="4"></textarea></label><div class="row"><button class="btn primary small" id="doimp">Importar</button></div></div>
        ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Pokémon</th><th>IV</th><th class="r">%</th><th>Liga Grande</th><th>Liga Ultra</th><th>Máster</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><span class="row">${r.sp ? orb(r.sp) : ''}<b>${esc(r.e.name)}</b></span></td><td class="num"><b>${r.e.iv.atk}/${r.e.iv.def}/${r.e.iv.hp}</b></td><td class="r num">${fmt(r.pct, 1)}</td><td>${cell(r.g)}</td><td>${cell(r.u)}</td><td>${cell(r.m)}</td>
        <td><button class="btn small" data-pvp="${r.e.id}">PvP</button> <button class="btn small" data-del="${r.e.id}" aria-label="Borrar">✕</button></td></tr>`).join('')}</tbody></table></div>`
          : `<div class="card empty">${K.icon('box')}<h3>Tu box está vacío</h3><p class="small">Calcula los IV de un Pokémon y pulsa "Guardar en Mi box".</p></div>`}`;
      rootEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { PoGo.box.remove(b.dataset.del); ctx.go('box'); }));
      rootEl.querySelectorAll('[data-pvp]').forEach(b => b.addEventListener('click', () => { const x = items.find(i => i.e.id === b.dataset.pvp); ctx.go('pvp', { speciesId: x.e.speciesId, iv: x.e.iv }); }));
      rootEl.querySelector('#exp').addEventListener('click', async (ev) => { const t = JSON.stringify(PoGo.box.all()); try { await navigator.clipboard.writeText(t); ev.target.textContent = 'Copiado ✓'; } catch { rootEl.querySelector('#impbox').hidden = false; rootEl.querySelector('#txt').value = t; } });
      rootEl.querySelector('#imp').addEventListener('click', () => { rootEl.querySelector('#impbox').hidden = false; });
      rootEl.querySelector('#doimp').addEventListener('click', () => {
        try { const a = JSON.parse(rootEl.querySelector('#txt').value); if (!Array.isArray(a)) throw 0; PoGo.box.replace(a.filter(x => x && x.speciesId && x.iv).slice(0, 500)); ctx.go('box'); } catch { alert('Copia no válida'); }
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
