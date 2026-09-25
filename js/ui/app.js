/* app.js — arranque, navegación, tema. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit;
  const TABS = [['home', 'Inicio', 'home'], ['iv', 'IV', 'iv'], ['scan', 'Escanear', 'scan'], ['pvp', 'PvP', 'pvp'], ['pve', 'Incursiones', 'pve'], ['types', 'Tipos', 'types'], ['box', 'Mi box', 'box'], ['data', 'Datos', 'data']];
  let D, current = 'home';

  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }
  function chip() {
    const fr = PoGo.data.freshness(D), el = document.getElementById('fresh');
    el.className = 'chip ' + fr.level; el.title = fr.detail;
    el.innerHTML = `<span class="dot"></span>${K.esc(fr.text)}`;
  }
  function go(tab, params) {
    current = tab;
    const main = document.getElementById('view');
    document.querySelectorAll('[data-tab]').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    try { history.replaceState(null, '', '#/' + tab); } catch { /* sandbox */ }
    try { PoGo.tabs[tab].render(main, { D, go }, params); }
    catch (e) { console.error(e); main.innerHTML = `<div class="card"><div class="notice bad"><b>Error al mostrar esta sección.</b> ${K.esc(e.message)}</div></div>`; }
    window.scrollTo({ top: 0 });
  }

  async function start() {
    D = await PoGo.data.load();
    K.SPRITES.on = D.mode === 'full' && /^https?:/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.hostname);
    applyTheme(K.store.get('theme', 'auto'));
    const nav = TABS.map(([id, l, ic]) => `<button data-tab="${id}">${K.icon(ic)}<span>${l}</span></button>`).join('');
    document.getElementById('app').innerHTML = `<div class="shell">
      <aside class="side"><div class="brand">${K.ball}<span>PoGo Companion</span></div><nav class="nav" aria-label="Secciones">${nav}</nav><div class="foot muted small">Herramienta no oficial. Pokémon y Pokémon GO son marcas de sus propietarios.</div></aside>
      <div><main class="main"><div class="topbar"><span id="fresh" class="chip"></span><button class="icon-btn" id="theme" aria-label="Cambiar tema">${K.icon('sun')}</button></div><div id="view"></div></main></div>
      <nav class="tabbar" aria-label="Secciones">${nav}</nav></div>`;
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
    document.getElementById('theme').addEventListener('click', () => {
      const cur = K.store.get('theme', 'auto'); const next = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto';
      K.store.set('theme', next); applyTheme(next);
      document.getElementById('theme').title = 'Tema: ' + { auto: 'automático', dark: 'oscuro', light: 'claro' }[next];
    });
    chip();
    const h = (location.hash || '').replace('#/', '');
    go(PoGo.tabs[h] ? h : 'home');
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && D.mode === 'full') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  document.addEventListener('DOMContentLoaded', start);
})(typeof window !== 'undefined' ? window : globalThis);
