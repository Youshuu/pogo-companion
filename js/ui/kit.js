/* kit.js — utilidades de interfaz: escape HTML, iconos, chips de tipo, buscador de especies, gráficos SVG. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo = root.PoGo || {};
  const C = PoGo.constants;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---- almacenamiento seguro (puede no existir) ---- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('pogoc:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('pogoc:' + k, JSON.stringify(v)); return true; } catch { return false; } }
  };

  /* ---- iconos (trazo, 24×24) ---- */
  const P = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    iv: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pvp: '<path d="M14 4l6 6-9 9-4 1 1-4z"/><path d="M4 4l6 6M5 19l-2 2"/>',
    pve: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
    types: '<circle cx="8" cy="8" r="4"/><circle cx="16" cy="8" r="4"/><circle cx="12" cy="15" r="4"/>',
    box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    data: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    scan: '<path d="M7 4H4v3M17 4h3v3M7 20H4v-3M17 20h3v-3"/><rect x="8" y="9" width="8" height="6" rx="1"/>'
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const ball = `<svg class="ball" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#0E2029" stroke-width="2"/><path d="M2 16a14 14 0 0 1 28 0z" fill="#E4405F" stroke="#0E2029" stroke-width="2"/><path d="M2 16h28" stroke="#0E2029" stroke-width="2"/><circle cx="16" cy="16" r="4.5" fill="#fff" stroke="#0E2029" stroke-width="2"/></svg>`;

  /* ---- tipos ---- */
  const tchip = (t) => `<span class="tchip" style="background:${C.TYPE_COLOR[t] || '#777'}">${esc(C.TYPE_ES[t] || t)}</span>`;
  const tchips = (arr) => (arr || []).map(tchip).join(' ');

  /* ---- orbe de Pokémon (sprite opcional con respaldo) ---- */
  const SPRITES = { on: false, base: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' };
  function orb(sp, cls) {
    const t = (sp.types && sp.types[0]) || 'normal', t2 = (sp.types && sp.types[1]) || t;
    const bg = `linear-gradient(135deg, ${C.TYPE_COLOR[t]}, ${C.TYPE_COLOR[t2]})`;
    const dex = sp.dex ? `#${sp.dex}` : '?';
    const img = SPRITES.on && sp.dex && !/_(shadow|mega|primal)/.test(sp.id || '') && !/_/.test(sp.id || '')
      ? `<img loading="lazy" alt="" src="${SPRITES.base}${sp.dex}.png" onerror="this.remove()">` : '';
    return `<span class="orb ${cls || ''}" style="background:${bg}" aria-hidden="true">${img}<span>${esc(dex)}</span></span>`;
  }

  /* ---- buscador de especies ---- */
  function speciesPicker(el, list, onPick, initialId) {
    const idx = list.map(s => ({ s, n: norm(s.name + ' ' + s.id) }));
    el.classList.add('picker');
    el.innerHTML = `<label class="f">Pokémon<input class="in" type="text" autocomplete="off" spellcheck="false" placeholder="Escribe un nombre…" role="combobox" aria-expanded="false"></label><div class="list" hidden role="listbox"></div>`;
    const input = el.querySelector('input'), box = el.querySelector('.list');
    let cur = null, hi = 0, shown = [];
    const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); };
    function pick(s) { cur = s; input.value = s.name; close(); onPick(s); }
    function open() {
      const q = norm(input.value);
      shown = (q ? idx.filter(x => x.n.includes(q)).sort((a, b) => (b.n.startsWith(q) - a.n.startsWith(q)) || a.s.name.length - b.s.name.length) : idx.slice(0, 12)).slice(0, 14).map(x => x.s);
      hi = 0;
      box.innerHTML = shown.length ? shown.map((s, i) => `<button type="button" class="opt" role="option" data-i="${i}" aria-selected="${i === 0}">${orb(s)}<span><b>${esc(s.name)}</b><br>${tchips(s.types)}</span></button>`).join('')
        : '<div class="empty small">Sin coincidencias</div>';
      box.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', open);
    input.addEventListener('focus', () => { input.select(); open(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (box.hidden) open(); hi = Math.max(0, Math.min(shown.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1)));
        [...box.querySelectorAll('.opt')].forEach((b, i) => { b.setAttribute('aria-selected', i === hi); if (i === hi) b.scrollIntoView({ block: 'nearest' }); }); }
      else if (e.key === 'Enter' && !box.hidden && shown[hi]) { e.preventDefault(); pick(shown[hi]); }
      else if (e.key === 'Escape') close();
    });
    box.addEventListener('mousedown', (e) => { const b = e.target.closest('.opt'); if (b) { e.preventDefault(); pick(shown[+b.dataset.i]); } });
    input.addEventListener('blur', () => setTimeout(close, 120));
    const api = { get: () => cur, set(s) { if (s) { cur = s; input.value = s.name; } } };
    if (initialId) api.set(list.find(s => s.id === initialId));
    return api;
  }

  /* ---- gráficos SVG ---- */
  /** Arco tipo "PC del juego". pct 0-1. */
  function arcGauge(o) {
    const r = 88, cx = 110, cy = 106, len = Math.PI * r;
    const p = Math.max(0, Math.min(1, o.pct));
    const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    const ang = Math.PI * (1 - p), mx = cx + r * Math.cos(ang), my = cy - r * Math.sin(ang);
    const color = o.color || 'var(--primary)';
    return `<svg class="gauge" viewBox="0 0 220 134" role="img" aria-label="${esc(o.aria || o.big)}">
      <path class="track" d="${d}" fill="none" stroke-width="14" stroke-linecap="round"/>
      <path class="val" d="${d}" fill="none" stroke-width="14" stroke-linecap="round" stroke="${color}" stroke-dasharray="${(len * p).toFixed(1)} ${len.toFixed(1)}"/>
      <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="var(--surface)" stroke="${color}" stroke-width="4"/>
      <text x="${cx}" y="${cy - 40}" text-anchor="middle" font-size="12" class="gcap">${esc(o.small || '')}</text>
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="34" font-weight="800">${esc(o.big)}</text>
      <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="12" class="gcap">${esc(o.caption || '')}</text></svg>`;
  }

  /** Histograma con marcador. hist = {bins:[{from,to,n}]}, mark = valor en el eje. */
  function histogram(hist, mark, xLabel) {
    const W = 520, H = 170, pl = 8, pr = 8, pt = 10, pb = 30;
    const bins = hist.bins; if (!bins.length) return '';
    const max = Math.max(...bins.map(b => b.n)) || 1, bw = (W - pl - pr) / bins.length;
    const lo = bins[0].from, hi = bins[bins.length - 1].to;
    const bars = bins.map((b, i) => {
      const h = (H - pt - pb) * (b.n / max), on = mark >= b.from && mark <= b.to;
      return `<rect class="bin ${on ? 'on' : ''}" x="${(pl + i * bw + 1).toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${fmt(b.n)} combinaciones</title></rect>`;
    }).join('');
    const mx = pl + ((mark - lo) / (hi - lo || 1)) * (W - pl - pr);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Distribución del stat product">
      ${bars}<line class="axis" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
      <line class="mark" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${pt - 4}" y2="${H - pb}"/>
      <text x="${pl}" y="${H - 10}">peor</text><text x="${W - pr}" y="${H - 10}" text-anchor="end">mejor</text>
      <text x="${W / 2}" y="${H - 10}" text-anchor="middle">${esc(xLabel || '')}</text></svg>`;
  }

  /** Dispersión (DPS vs TDO). pts=[{x,y,label,color}] */
  function scatter(pts, xl, yl) {
    const W = 560, H = 320, pl = 48, pr = 14, pt = 12, pb = 40;
    if (!pts.length) return '';
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = 0, x1 = Math.max(...xs) * 1.08, y0 = 0, y1 = Math.max(...ys) * 1.08;
    const X = (v) => pl + (v - x0) / (x1 - x0 || 1) * (W - pl - pr), Y = (v) => H - pb - (v - y0) / (y1 - y0 || 1) * (H - pt - pb);
    const ticks = (max, n) => Array.from({ length: n + 1 }, (_, i) => max * i / n);
    const g = ticks(x1, 5).map(v => `<line class="axis" x1="${X(v)}" x2="${X(v)}" y1="${pt}" y2="${H - pb}" opacity=".5"/><text x="${X(v)}" y="${H - pb + 15}" text-anchor="middle">${fmt(v, x1 < 20 ? 1 : 0)}</text>`).join('')
      + ticks(y1, 5).map(v => `<line class="axis" y1="${Y(v)}" y2="${Y(v)}" x1="${pl}" x2="${W - pr}" opacity=".5"/><text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${fmt(v, 0)}</text>`).join('');
    const dots = pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="6" fill="${p.color}" fill-opacity=".85" stroke="var(--surface)" stroke-width="1.5"><title>${esc(p.label)}</title></circle>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(yl)} frente a ${esc(xl)}">${g}${dots}
      <text x="${W / 2}" y="${H - 6}" text-anchor="middle">${esc(xl)}</text>
      <text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text></svg>`;
  }

  const heat = (m) => m >= 2.5 ? '#0E9F6E' : m > 1.05 ? '#5BC79B' : m < 0.3 ? '#7A2E3A' : m < 0.9 ? '#E58C9B' : 'transparent';
  const multLabel = (m) => m >= 2.5 ? '2.56' : m > 1.05 ? '1.6' : m < 0.3 ? '.39' : m < 0.9 ? '.63' : '';

  PoGo.kit = { esc, fmt, norm, store, icon, ball, tchip, tchips, orb, SPRITES, speciesPicker, arcGauge, histogram, scatter, heat, multLabel };
})(typeof window !== 'undefined' ? window : globalThis);
