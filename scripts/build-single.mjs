#!/usr/bin/env node
// build-single.mjs — Empaqueta la app en UN solo archivo HTML (dist/pogo-companion.html).
// Incrusta CSS, JS, muestra de datos, config/season.json y, si existen, los data/*.json actuales.
// Útil para abrirla sin servidor, compartirla por mensaje o subirla a cualquier hosting.
//   node scripts/build-single.mjs            → incluye data/*.json si existen
//   node scripts/build-single.mjs --no-data  → solo la muestra
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const noData = process.argv.includes('--no-data');

let html = rd('index.html');
const css = rd('css/app.css');
html = html.replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');

const embed = { 'config/season.json': JSON.parse(rd('config/season.json')) };
for (const f of ['meta', 'species', 'moves', 'rankings', 'pve', 'changes']) {
  const p = path.join(ROOT, 'data', f + '.json');
  // null = "no existe": la app no intenta descargarlo (evita peticiones fallidas en la versión de un solo archivo)
  embed['data/' + f + '.json'] = (!noData && fs.existsSync(p)) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
html = html.replace(/<script src="([^"]+)"><\/script>\n?/g, (m, src) => {
  if (src === 'data/starter.js') return `<script>window.PoGo=window.PoGo||{};window.PoGo.EMBED=${safe(JSON.stringify(embed))};</script>\n<script>\n${safe(rd(src))}\n</script>\n`;
  return `<script>\n${safe(rd(src))}\n</script>\n`;
});
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'pogo-companion.html');
fs.writeFileSync(out, html);
console.log(`✔ ${out} (${(html.length / 1024).toFixed(0)} KB) · datos incrustados: ${Object.keys(embed).filter(k => k.startsWith('data/') && embed[k]).join(', ') || 'solo muestra'}`);
