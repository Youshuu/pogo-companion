// http.mjs — descarga robusta: reintentos con espera creciente, timeout y metadatos de frescura.

const UA = 'pogo-companion-updater/1.0 (+https://github.com/ - uso educativo)';

export async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Descarga una URL. Devuelve { ok, status, text?, json?, lastModified, url, bytes }.
 * No lanza por 404 (ok=false); sí lanza tras agotar reintentos por errores de red/5xx.
 */
export async function fetchResource(url, { json = true, retries = 3, timeoutMs = 60000, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: '*/*', ...headers } });
      clearTimeout(timer);
      if (res.status === 404) return { ok: false, status: 404, url };
      if (res.status >= 500 || res.status === 429) throw new Error('HTTP ' + res.status);
      if (!res.ok) return { ok: false, status: res.status, url };
      const text = await res.text();
      const out = { ok: true, status: res.status, url, bytes: text.length, lastModified: res.headers.get('last-modified') || null };
      if (json) {
        try { out.json = JSON.parse(text); } catch (e) { throw new Error('JSON inválido en ' + url + ': ' + e.message); }
      } else out.text = text;
      return out;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await sleep(1500 * Math.pow(2, attempt));
    }
  }
  throw new Error('No se pudo descargar ' + url + ' → ' + (lastErr && lastErr.message));
}

/** Fecha del último commit que tocó un archivo (frescura real de un espejo del Game Master). */
export async function githubLastCommit(repo, filePath, branch = 'master') {
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(filePath)}&sha=${branch}&per_page=1`;
  try {
    const r = await fetchResource(url, { retries: 1, headers: token ? { Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' } : {} });
    if (!r.ok || !Array.isArray(r.json) || !r.json[0]) return null;
    return r.json[0].commit?.committer?.date || r.json[0].commit?.author?.date || null;
  } catch { return null; }
}

export const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : null);
