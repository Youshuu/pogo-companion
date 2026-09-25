/*
 * scan.js — Lógica PURA (sin DOM/canvas) para leer datos de capturas/vídeos de Pokémon GO.
 * La captura de fotogramas y el OCR en sí viven en js/ui/scan-vision.js (necesitan canvas/Tesseract).
 * Aquí solo hay: parseo de texto OCR, coincidencia difusa de especie y el mapeo de barras a IV.
 * Todo se prueba con Node normal (tests/scan.test.js), sin navegador.
 */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /** "PC1234", "Pc 1.234" (ruido de OCR alrededor) → 1234. Se queda con la racha de dígitos más larga. */
  function parseCP(text) {
    const runs = String(text || '').match(/\d[\d.,]*\d|\d/g);
    if (!runs) return null;
    const n = parseInt(runs.sort((a, b) => b.length - a.length)[0].replace(/[.,]/g, ''), 10);
    return (n >= 10 && n <= 10000) ? n : null;
  }

  /** "113/113 PS", "84 / 84" → {cur, max}. Exige cur === max (solo así el PS es fiable para resolver IV). */
  function parseHP(text) {
    const m = String(text || '').match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
    if (!m) return null;
    const cur = +m[1], max = +m[2];
    if (cur < 1 || max < 1 || max > 1000) return null;
    return { cur, max, full: cur === max };
  }

  /** Distancia de edición simple (Levenshtein), para tolerar errores típicos de OCR. */
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
      prev = cur;
    }
    return prev[n];
  }

  /**
   * Empareja un nombre leído por OCR con la especie más parecida de una lista.
   * species: [{id, name}]. Devuelve {species, score(0-1), ambiguous} o null si no hay nada razonable.
   */
  function matchSpecies(text, species) {
    const q = norm(text);
    if (!q || !species.length) return null;
    let best = null, second = null;
    for (const sp of species) {
      const n = norm(sp.name);
      let score;
      if (n === q) score = 1;
      else if (n.startsWith(q) || q.startsWith(n)) score = 0.92;
      else {
        const d = editDistance(q, n);
        score = 1 - d / Math.max(q.length, n.length, 1);
      }
      if (!best || score > best.score) { second = best; best = { species: sp, score }; }
      else if (!second || score > second.score) second = { species: sp, score };
    }
    if (!best || best.score < 0.55) return null;
    return { species: best.species, score: best.score, ambiguous: !!(second && best.score - second.score < 0.08 && second.score > 0.55) };
  }

  /**
   * Fracción de llenado (0-1) de una barra de evaluación → cubo de IV (0-3, como C.APPRAISAL_BAR) o null si
   * cae demasiado cerca de un límite para confiar en la lectura (evita errores por compresión de vídeo).
   */
  const BAR_EDGES = [5 / 15, 10 / 15, 14 / 15]; // límites entre cubos 0|1, 1|2, 2|3
  function barFractionToBucket(frac, tolerance) {
    tolerance = tolerance == null ? 0.035 : tolerance;
    if (frac == null || Number.isNaN(frac)) return null;
    for (const e of BAR_EDGES) if (Math.abs(frac - e) < tolerance) return null; // demasiado cerca del límite: abstenerse
    if (frac < BAR_EDGES[0]) return 0;
    if (frac < BAR_EDGES[1]) return 1;
    if (frac < BAR_EDGES[2]) return 2;
    return 3;
  }

  /**
   * ¿Son estas dos lecturas (de fotogramas consecutivos) el mismo Pokémon?
   * El PC es la señal más estable frame a frame (dígitos puros, prefijo fijo "PC"); el nombre puede
   * variar un poco por ruido de OCR aunque sea la misma tarjeta, así que no se exige que coincida.
   */
  function sameCard(a, b) {
    if (!a || !b || a.cp == null || b.cp == null) return false;
    if (a.cp !== b.cp) return false;
    const ah = a.hp ? a.hp.cur : null, bh = b.hp ? b.hp.cur : null;
    return ah == null || bh == null || ah === bh;
  }

  /**
   * Agrupa lecturas por fotograma consecutivas en "tarjetas" (un Pokémon = 1+ fotogramas seguidos iguales),
   * y de cada grupo se queda con la lectura de mayor confianza (más campos leídos).
   */
  function groupReadings(readings) {
    const groups = [];
    for (const r of readings) {
      const last = groups[groups.length - 1];
      if (last && sameCard(last[last.length - 1], r)) last.push(r);
      else groups.push([r]);
    }
    const score = (r) => (r.cp != null) + (r.hp && r.hp.full ? 1 : 0) + (r.speciesMatch ? 1 : 0) + (r.bars ? 1 : 0);
    return groups.map(g => g.slice().sort((a, b) => score(b) - score(a))[0]);
  }

  const api = { norm, parseCP, parseHP, editDistance, matchSpecies, barFractionToBucket, sameCard, groupReadings, BAR_EDGES };
  if (isNode) module.exports = api; else { root.PoGo = root.PoGo || {}; root.PoGo.scan = api; }
})(typeof window !== 'undefined' ? window : globalThis);
