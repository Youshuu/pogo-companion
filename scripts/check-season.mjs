// check-season.mjs — Avisa (anotación de GitHub Actions) si config/season.json está por caducar o caducó.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'season.json'), 'utf8'));
const end = new Date(s.season.end), now = new Date();
const days = Math.ceil((end - now) / 86400000);
if (days < 0) console.log(`::warning title=Temporada caducada::config/season.json terminó hace ${-days} días. Actualiza calendario y copas (docs/MANTENIMIENTO.md).`);
else if (days <= 10) console.log(`::notice title=Temporada por terminar::Quedan ${days} días. Prepara config/season.json de la siguiente temporada.`);
else console.log(`Temporada "${s.season.name}" vigente (${days} días restantes).`);
const wk = (s.schedule || []).find(w => new Date(w.from) <= now && now < new Date(w.to));
if (!wk && days >= 0) console.log('::warning title=Sin semana de GBL::El calendario no cubre la fecha actual.');
