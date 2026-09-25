/*
 * scan-vision.js — Captura de fotogramas de un vídeo y lectura visual de cada tarjeta de Pokémon.
 * Todo ocurre en el navegador del usuario: el vídeo NUNCA se sube a ningún servidor.
 *
 * Regiones (ROI) calibradas sobre una grabación real (1080×2400, relación ~20:9, la más común en
 * Android) de la pantalla de EVALUACIÓN de un Pokémon. Se anclan al borde superior de la tarjeta
 * blanca (que se detecta en cada fotograma) en vez de a una fracción fija de toda la pantalla, para
 * tolerar barras de estado o relaciones de aspecto algo distintas. Aun así, esto es lo menos probado
 * de la función: si tu dispositivo da resultados pobres, cuéntamelo con un vídeo de ejemplo.
 */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, Sc = PoGo.scan;

  // Offsets en fracción de la ANCHURA del vídeo, medidos desde el borde superior de la tarjeta blanca.
  // Calibrados por medición directa de píxeles sobre un vídeo real (1080×2400); ver docs/MANTENIMIENTO.md.
  const ROI = {
    cp: { top: -0.660, height: 0.135, x0: 0.29, x1: 0.64 },
    name: { top: 0.140, height: 0.100, x0: 0.28, x1: 0.72 },
    hp: { top: 0.272, height: 0.080, x0: 0.28, x1: 0.72 },
    bars: { top: 0.822, height: 0.372, x0: 0.15, x1: 0.52 }, // franja que contiene las 3 barras
  };
  const BAR_ROWS = [[0.305, 0.372], [0.552, 0.618], [0.80, 0.865]]; // atk/def/ps dentro de ROI.bars, en fracción de su alto

  function findCardTopY(ctx, w, h) {
    // Busca, en una columna central, la primera fila (de arriba hacia abajo, tras el 30% superior)
    // que sea sólidamente blanca en un tramo largo: el borde superior de la tarjeta de datos.
    const x = Math.round(w * 0.5);
    const data = ctx.getImageData(x, Math.round(h * 0.30), 1, Math.round(h * 0.5)).data;
    let run = 0;
    for (let i = 0; i < data.length / 4; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (r > 245 && g > 245 && b > 245) { run++; if (run > h * 0.02) return Math.round(h * 0.30) + i - run + 1; }
      else run = 0;
    }
    return null;
  }

  function cropCanvas(src, x0, y0, x1, y1) {
    const w = Math.max(1, Math.round(x1 - x0)), h = Math.max(1, Math.round(y1 - y0));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, w, h);
    return c;
  }

  /** Aísla el texto blanco (CP, sobre la foto/escena 3D) sobre fondo negro, para que el OCR lo lea bien. */
  function maskWhiteText(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const white = sat < 0.25 && max > 175;
      d[i] = d[i + 1] = d[i + 2] = white ? 0 : 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** Umbral simple (Otsu aproximado por percentil) para texto oscuro sobre la tarjeta blanca. */
  function threshold(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data, n = d.length / 4;
    const gray = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    const sorted = Array.from(gray).sort((a, b) => a - b);
    const t = sorted[Math.round(n * 0.55)] || 140;
    for (let i = 0; i < n; i++) { const v = gray[i] > t ? 255 : 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** Fracción de llenado de una barra de evaluación (ver docs/FORMULAS.md § lectura visual). */
  function barFillFraction(ctx, x0, x1, y) {
    const w = x1 - x0;
    const data = ctx.getImageData(x0, y, w, 1).data;
    const sat = new Array(w);
    for (let i = 0; i < w; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      sat[i] = max === 0 ? 0 : (max - min) / max * 255;
    }
    const lo = Math.round(w * 0.02), hi = Math.round(w * 0.965);
    let boundary = hi - lo;
    let i = lo;
    while (i < hi) {
      if (sat[i] < 40) {
        let j = i; while (j < hi && sat[j] < 40) j++;
        if (j - i >= 10) { boundary = i - lo; break; }
        i = j;
      } else i++;
    }
    return boundary / (hi - lo);
  }

  /**
   * Procesa un fotograma ya dibujado en `frameCanvas` (mismo tamaño que el vídeo).
   * ocrFn: (canvas) => Promise<string> — normalmente Tesseract.recognize(...).then(r => r.data.text).
   * Devuelve null si no se encontró el borde de la tarjeta (fotograma de transición/animación).
   */
  async function readFrame(frameCanvas, ocrFn) {
    const ctx = frameCanvas.getContext('2d');
    const w = frameCanvas.width, h = frameCanvas.height;
    const cardTop = findCardTopY(ctx, w, h);
    if (cardTop == null) return null;
    const at = (roi) => ({ x0: w * roi.x0, x1: w * roi.x1, y0: cardTop + w * roi.top, y1: cardTop + w * roi.top + w * roi.height });

    const cpBox = at(ROI.cp);
    const cpCanvas = maskWhiteText(cropCanvas(frameCanvas, cpBox.x0, cpBox.y0, cpBox.x1, cpBox.y1));
    const nameBox = at(ROI.name);
    const nameCanvas = threshold(cropCanvas(frameCanvas, nameBox.x0, nameBox.y0, nameBox.x1, nameBox.y1));
    const hpBox = at(ROI.hp);
    const hpCanvas = threshold(cropCanvas(frameCanvas, hpBox.x0, hpBox.y0, hpBox.x1, hpBox.y1));

    const [cpText, nameText, hpText] = await Promise.all([ocrFn(cpCanvas, 'digits'), ocrFn(nameCanvas, 'text'), ocrFn(hpCanvas, 'text')]);

    const barsBox = at(ROI.bars);
    const bars = BAR_ROWS.map(([f0, f1]) => {
      const y = Math.round(barsBox.y0 + (barsBox.y1 - barsBox.y0) * (f0 + f1) / 2);
      if (y < 0 || y >= h) return null;
      return barFillFraction(ctx, Math.round(barsBox.x0), Math.round(barsBox.x1), y);
    });

    return {
      cp: Sc.parseCP(cpText), hp: Sc.parseHP(hpText), nameText: (nameText || '').trim(),
      bars: { atk: Sc.barFractionToBucket(bars[0]), def: Sc.barFractionToBucket(bars[1]), hp: Sc.barFractionToBucket(bars[2]) },
      barsRaw: bars, cardTop
    };
  }

  /**
   * Recorre un <video> muestreando fotogramas, evita repetir el mismo (mismo PC que el anterior)
   * y llama a onFrame(reading|null, {t, index, total}) según avanza. onProgress(fraction) es opcional.
   */
  async function scanVideo(video, { ocrFn, stepSec = 0.5, onProgress }) {
    const duration = video.duration || 0;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    const readings = [];
    const total = Math.max(1, Math.floor(duration / stepSec));
    for (let i = 0; i <= total; i++) {
      const t = Math.min(duration, i * stepSec);
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      let r = null;
      try { r = await readFrame(canvas, ocrFn); } catch (e) { r = null; }
      if (r) readings.push(r);
      if (onProgress) onProgress((i + 1) / (total + 1));
    }
    return Sc.groupReadings(readings);
  }

  function seekTo(video, t) {
    return new Promise((resolve) => {
      const done = () => { video.removeEventListener('seeked', done); resolve(); };
      video.addEventListener('seeked', done);
      video.currentTime = t;
    });
  }

  PoGo.scanVision = { readFrame, scanVideo, findCardTopY, maskWhiteText, threshold, barFillFraction, ROI };
})(typeof window !== 'undefined' ? window : globalThis);
