/*
 * Pestaña "Escanear caja": sube una grabación de pantalla recorriendo tu caja con la evaluación
 * abierta, y devuelve una lista con el IV de cada Pokémon. Todo se procesa en tu navegador — el
 * vídeo nunca se envía a ningún servidor.
 */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit, C = PoGo.constants, IV = PoGo.iv, Sc = PoGo.scan;
  const { esc, fmt, orb, tchips } = K;
  PoGo.tabs = PoGo.tabs || {};

  let tesseractReady = null;
  function loadTesseract() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (tesseractReady) return tesseractReady;
    tesseractReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
      s.onload = () => resolve(root.Tesseract);
      s.onerror = () => reject(new Error('No se pudo cargar la librería de lectura (Tesseract) desde internet.'));
      document.head.appendChild(s);
    });
    return tesseractReady;
  }

  function starTierFromOverall(overallGuess) {
    // De momento no se lee automáticamente (ver docs/MANTENIMIENTO.md); queda listo para cuando se active.
    return null;
  }

  PoGo.tabs.scan = {
    render(rootEl, ctx) {
      const D = ctx.D;
      rootEl.innerHTML = `<div class="stack">
        <div class="card stack">
          <div><h2>Escanear caja</h2><p class="muted small" style="margin-top:6px">Sube una grabación de pantalla recorriendo tu caja con la <b>evaluación de cada Pokémon abierta</b> (como al pulsar el listón de valoración). El vídeo se procesa aquí mismo, en tu navegador: no se sube a ningún servidor.</p></div>
          <label class="f">Vídeo<input class="in" type="file" id="file" accept="video/*"></label>
          <div class="row"><button class="btn primary" id="start" disabled>Analizar vídeo</button><span class="muted small" id="hint">Elige un vídeo para empezar.</span></div>
          <div id="prog" hidden><div class="bar" style="height:10px"><i id="bar" style="width:0%"></i></div><p class="muted small" id="progtxt" style="margin-top:6px"></p></div>
          <details class="acc"><summary>Cómo funciona y sus límites</summary><div class="body stack">
            <p>Por cada fotograma se lee el PC, el nombre y los PS con reconocimiento de texto, y se mide el llenado de las barras de Ataque/Defensa/PS. Con eso se ejecuta la misma calculadora de IV exacta de la pestaña <b>IV</b>.</p>
            <p><b>Funciona mejor si:</b> grabas con la pantalla de evaluación abierta en cada Pokémon (como en el ejemplo), sin música ni notificaciones tapando la tarjeta, avanzando con calma.</p>
            <p><b>Limitaciones actuales:</b> calibrado sobre grabaciones de proporción ~20:9 (Android típico); en otras proporciones (p. ej. iPhone) puede fallar la lectura. El número de estrellas de la evaluación aún no se lee automáticamente. Revisa siempre la tabla antes de guardar: puedes corregir el Pokémon o descartar una fila.</p>
            <p>Necesita conexión a internet la primera vez, para cargar la librería de lectura de texto (unos ~2–5 MB).</p></div></details>
        </div>
        <div id="out"></div></div>`;

      const $ = (id) => rootEl.querySelector('#' + id);
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true;
      let file = null;

      $('file').addEventListener('change', () => {
        file = $('file').files[0] || null;
        $('start').disabled = !file;
        $('hint').textContent = file ? `${file.name} · ${(file.size / 1e6).toFixed(1)} MB` : 'Elige un vídeo para empezar.';
      });

      $('start').addEventListener('click', async () => {
        $('start').disabled = true; $('out').innerHTML = '';
        $('prog').hidden = false; $('bar').style.width = '0%'; $('progtxt').textContent = 'Cargando el lector de texto…';
        try {
          const Tesseract = await loadTesseract();
          const worker = await Tesseract.createWorker('spa', 1, { logger: () => {} });
          const ocrFn = async (canvas, kind) => {
            if (kind === 'digits') await worker.setParameters({ tessedit_char_whitelist: 'PC0123456789', tessedit_pageseg_mode: '8' });
            else await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '7' });
            const { data } = await worker.recognize(canvas);
            return data.text;
          };
          const url = URL.createObjectURL(file);
          video.src = url;
          await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('No se pudo abrir el vídeo.')); });
          $('progtxt').textContent = 'Analizando fotogramas…';
          const readings = await PoGo.scanVision.scanVideo(video, {
            ocrFn, stepSec: 0.5,
            onProgress: (f) => { $('bar').style.width = (f * 100).toFixed(0) + '%'; $('progtxt').textContent = `Analizando fotogramas… ${Math.round(f * 100)}%`; }
          });
          URL.revokeObjectURL(url);
          await worker.terminate();
          $('prog').hidden = true; $('start').disabled = false;
          renderResults(readings, D, $('out'), ctx);
        } catch (e) {
          $('prog').hidden = true; $('start').disabled = false;
          $('out').innerHTML = `<div class="card"><div class="notice bad"><b>No se pudo completar el análisis.</b> ${esc(e.message)}</div></div>`;
        }
      });
    }
  };

  function resolveRow(r, D) {
    const match = Sc.matchSpecies(r.nameText, D.speciesSorted);
    const sp = match ? match.species : null;
    let cands = [];
    if (sp && r.cp && r.hp && r.hp.full) {
      const appraisal = {};
      if (r.bars) { ['atk', 'def', 'hp'].forEach(k => { if (r.bars[k] != null) appraisal[k] = r.bars[k]; }); }
      cands = IV.solveIVs({ base: sp.base, cp: r.cp, hp: r.hp.cur, maxLevel: 51, appraisal });
    }
    return { reading: r, species: sp, matchScore: match ? match.score : 0, ambiguous: match ? match.ambiguous : false, candidates: cands };
  }

  function renderResults(readings, D, out, ctx) {
    if (!readings.length) { out.innerHTML = `<div class="card empty">${K.icon('box')}<h3>No se detectó ninguna tarjeta</h3><p class="small">Comprueba que el vídeo muestra la pantalla de evaluación de cada Pokémon (con su tarjeta blanca de datos visible).</p></div>`; return; }
    const rows = readings.map(r => resolveRow(r, D));
    const needsReview = (row) => !row.species || row.ambiguous || !row.reading.cp || !(row.reading.hp && row.reading.hp.full) || row.candidates.length !== 1;
    const okCount = rows.filter(r => !needsReview(r)).length;

    const rowHtml = (row, i) => {
      const r = row.reading, sp = row.species;
      const one = row.candidates.length === 1 ? row.candidates[0] : null;
      const ivTxt = one ? `<b>${one.atk}/${one.def}/${one.hp}</b> <span class="muted small">(${fmt(one.percent, 1)}%)</span>`
        : row.candidates.length > 1 ? `${row.candidates.length} posibles` : '—';
      const flag = needsReview(row) ? `<span class="pill warn">Revisar</span>` : `<span class="pill good">OK</span>`;
      return `<tr data-i="${i}">
        <td>${sp ? K.orb(sp) : '<span class="orb" style="background:var(--surface-2)">?</span>'}</td>
        <td><select class="in small sp-pick" data-i="${i}">${!sp ? '<option value="">— elegir —</option>' : ''}${D.speciesSorted.map(s => `<option value="${esc(s.id)}" ${sp && sp.id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
          ${row.ambiguous ? `<div class="muted small">Nombre leído: "${esc(r.nameText)}" (dudoso)</div>` : ''}</td>
        <td class="num">${r.cp ?? '—'}</td>
        <td class="num">${r.hp ? (r.hp.full ? r.hp.cur : `${r.hp.cur}/${r.hp.max} ⚠︎`) : '—'}</td>
        <td>${ivTxt}</td>
        <td>${flag}</td>
        <td><button class="btn small" data-save="${i}" ${one ? '' : 'disabled'}>Guardar</button> <button class="btn small" data-drop="${i}" aria-label="Descartar">✕</button></td>
      </tr>`;
    };

    out.innerHTML = `<div class="card">
      <div class="row between"><h3>Resultado: ${rows.length} tarjetas detectadas</h3><span class="chip ${okCount === rows.length ? 'ok' : 'warn'}"><span class="dot"></span>${okCount}/${rows.length} listas sin revisar</span></div>
      <p class="muted small" style="margin:6px 0 12px">Revisa las filas marcadas antes de guardar: corrige el Pokémon con el desplegable si el nombre no se leyó bien.</p>
      <div class="table-wrap"><table><thead><tr><th></th><th>Pokémon</th><th class="r">PC</th><th class="r">PS</th><th>IV</th><th></th><th></th></tr></thead>
      <tbody id="rowsBody">${rows.map(rowHtml).join('')}</tbody></table></div>
      <div class="row" style="margin-top:14px"><button class="btn primary" id="saveAll">Guardar todas las listas (${okCount})</button></div>
    </div>`;

    function recompute(i) {
      const sel = out.querySelector(`.sp-pick[data-i="${i}"]`);
      const sp = D.byId.get(sel.value);
      const r = rows[i].reading;
      let cands = [];
      if (sp && r.cp && r.hp && r.hp.full) {
        const appraisal = {}; if (r.bars) ['atk', 'def', 'hp'].forEach(k => { if (r.bars[k] != null) appraisal[k] = r.bars[k]; });
        cands = IV.solveIVs({ base: sp.base, cp: r.cp, hp: r.hp.cur, maxLevel: 51, appraisal });
      }
      rows[i] = { reading: r, species: sp, matchScore: 1, ambiguous: false, candidates: cands };
      out.querySelector(`tr[data-i="${i}"]`).outerHTML = rowHtml(rows[i], i);
      bindRow(i);
    }
    function bindRow(i) {
      const tr = out.querySelector(`tr[data-i="${i}"]`); if (!tr) return;
      tr.querySelector('.sp-pick').addEventListener('change', () => recompute(i));
      const save = tr.querySelector('[data-save]'); if (save) save.addEventListener('click', () => {
        const row = rows[i], one = row.candidates[0];
        PoGo.box.add({ speciesId: row.species.id, name: row.species.name, iv: { atk: one.atk, def: one.def, hp: one.hp }, level: one.level, cp: row.reading.cp });
        save.textContent = 'Guardado ✓'; save.disabled = true;
      });
      tr.querySelector('[data-drop]').addEventListener('click', () => tr.remove());
    }
    rows.forEach((_, i) => bindRow(i));
    out.querySelector('#saveAll').addEventListener('click', () => {
      let n = 0;
      rows.forEach(row => { if (row.candidates.length === 1 && row.species) { const one = row.candidates[0]; PoGo.box.add({ speciesId: row.species.id, name: row.species.name, iv: { atk: one.atk, def: one.def, hp: one.hp }, level: one.level, cp: row.reading.cp }); n++; } });
      out.querySelector('#saveAll').textContent = `Guardadas ${n} ✓`;
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
