/* Pestaña Datos: salud de los datos, fuentes, fórmulas y cómo mantener la app al día. */
(function (root) {
  'use strict';
  const PoGo = root.PoGo, K = PoGo.kit;
  const { esc, fmt } = K;
  PoGo.tabs = PoGo.tabs || {};

  const FORMULAS = [
    ['PC (Poder de Combate)', `<code>PC = ⌊ (Atk_base+IV_a) · √(Def_base+IV_d) · √(PS_base+IV_p) · CPM² / 10 ⌋</code> (mínimo 10). El CPM depende del nivel y el nivel .5 se obtiene como <code>√((CPM(n)² + CPM(n+1)²)/2)</code>. Anclas: Mewtwo 15/15/15 nivel 40 = 4178 PC y nivel 50 = 4724 PC.`],
    ['Estadísticas de combate', `<code>Atk = (base+IV)·CPM</code>, <code>Def = (base+IV)·CPM</code>, <code>PS = ⌊(base+IV)·CPM⌋</code> (mínimo 10). La PC no interviene en el combate.`],
    ['Calculadora de IV', `Se prueban todos los niveles posibles (del polvo o del nivel máximo) y las 16×16×16 combinaciones; se conservan las que reproducen tu PC y tus PS exactos, y después se filtra por polvo, origen (suelo de IV) y evaluación. Si queda una, es la real. Suelos: salvaje 0 · clima 4 · incursión/huevo/investigación 10 · Lucky 12 · intercambio 1/2/3/5 · purificar suma +2.`],
    ['Ranking de IV en PvP (stat product)', `Para cada una de las 4096 combinaciones se calcula el nivel más alto con PC ≤ tope y su <code>stat product = Atk · Def · PS</code>. Rango 1 = mayor producto. El % es frente al mejor. Es la misma idea que usan PvPoke y otras herramientas; el tope de nivel (40/50/51) cambia el resultado.`],
    ['Daño en PvP', `<code>daño = ⌊ poder · 1,3 · STAB · efectividad · Atk/Def ⌋ + 1</code>. STAB 1,2. Efectividades 1,6 / 0,625 / 0,390625 (la inmunidad cuenta como doble resistencia). Los turnos duran 0,5 s. Los <em>breakpoints</em> son el Atk efectivo que sube el daño +1; los <em>bulkpoints</em>, la Def que lo baja −1.`],
    ['Daño en incursiones', `<code>daño = ⌊ 0,5 · poder · Atk/Def · multiplicador ⌋ + 1</code>, con multiplicador = STAB (1,2) · efectividad · clima (1,2). Sombríos: Atk ×1,2 y Def ×0,8333.`],
    ['DPS, TDO y eDPS (modelo completo)', `Basado en el "Comprehensive DPS" de GamePress. <code>DPS₀ = (FDPS·CEPS + CDPS·FEPS)/(CEPS+FEPS)</code>; <code>DPS = DPS₀ + (CDPS−FDPS)/(CEPS+FEPS) · (0,5 − x/PS) · y</code>. Ataques de 1 barra: <code>CEPS' = (CE + 0,5·FE + 0,5·y·CDWS)/CDur</code>. <code>TDO = DPS·PS/y</code>. <code>eDPS = 1/(1/DPS + relobby/TDO)</code>. Supuestos propios: x = CE/2, pausa del jefe 2 s, sin esquivas, re-lobby 10 s. Son ajustables y se muestran siempre.`],
    ['Qué NO calcula esta app', `No simula batallas completas de PvP (escudos, cebos, cambios): usa el ranking del simulador de PvPoke. No modela bonos de equipo, Mega ni amistad, ni Max Battles (Dynamax) todavía.`]
  ];

  const SOURCES = [
    ['PvPoke (gamemaster + rankings)', 'Especies, stats base, tipos, ataques PvP, rankings por liga y copa', 'Licencia MIT. Es el estándar de la comunidad; se actualiza tras cada rebalanceo.', 'https://github.com/pvpoke/pvpoke'],
    ['Game Master de Niantic vía alexelgt/game_masters', 'Ataques y movesets de PvE, CPM, costes, constantes de batalla', 'Espejo con actualización cada 1–3 días; se mide su frescura por fecha de commit.', 'https://github.com/alexelgt/game_masters'],
    ['PokeMiners/game_masters (respaldo)', 'Lo mismo que el anterior', 'Se detuvo ~4 meses en 2026: solo se usa si el otro falla.', 'https://github.com/PokeMiners/game_masters'],
    ['pokemon-go-api (GitHub Pages)', 'Jefes de incursión y Max Battles vigentes', 'Mejor esfuerzo; opcional.', 'https://pokemon-go-api.github.io/pokemon-go-api/'],
    ['config/season.json (manual)', 'Calendario de GBL, reglas de copas, novedades curadas', 'No existe en el juego: se edita cada temporada (guía abajo).', '']
  ];

  PoGo.tabs.data = {
    render(rootEl, ctx) {
      const D = ctx.D, fr = PoGo.data.freshness(D), st = PoGo.data.seasonStatus(D.season);
      const m = D.meta;
      const checks = m && m.checks && m.checks.length ? m.checks.map(c => `<tr><td><span class="pill ${c.level === 'error' ? 'bad' : 'warn'}">${c.level === 'error' ? 'error' : 'aviso'}</span></td><td><code>${esc(c.code)}</code></td><td style="white-space:normal">${esc(c.msg)}</td></tr>`).join('') : '';
      const src = m && m.sources;
      rootEl.innerHTML = `<h2>Datos y fiabilidad</h2>
        <div class="grid cols-2" style="margin-top:14px">
          <div class="card stack"><div class="row between"><h3>Estado de los datos</h3><span class="chip ${fr.level}"><span class="dot"></span>${esc(fr.text)}</span></div>
            <p class="muted">${esc(fr.detail)}</p>
            ${D.mode === 'full' && m ? `<div class="kpis"><div class="kpi"><b class="num">${fmt(m.counts.species)}</b><span>Especies</span></div><div class="kpi"><b class="num">${fmt(m.counts.moves)}</b><span>Movimientos</span></div><div class="kpi"><b class="num">${fmt(m.counts.pveSpecies)}</b><span>Especies PvE</span></div></div>
            <p class="small muted">Generado: ${esc(new Date(m.generatedAt).toLocaleString('es-ES'))}${src && src.niantic ? ` · Game Master: ${esc(src.niantic.mirror)} (${src.niantic.ageDays != null ? Math.round(src.niantic.ageDays) + ' d' : 's/d'})` : ''}${src && src.pvpoke && src.pvpoke.ageDays != null ? ` · PvPoke: ${Math.round(src.pvpoke.ageDays)} d` : ''}</p>`
            : `<div class="notice warn">Estás viendo la <b>muestra incluida</b> (${D.species.length} especies, solo estadísticas base). Ejecuta <code>npm run update</code> o despliega el flujo de GitHub para cargar todo.</div>`}
            ${checks ? `<div class="table-wrap"><table><tbody>${checks}</tbody></table></div>` : ''}</div>
          <div class="card stack"><h3>Temporada configurada</h3>
            ${D.season && D.season.season ? `<p><b>${esc(D.season.season.name)}</b> (GBL ${esc(D.season.season.gblSeason)}) · ${esc(D.season.season.start.slice(0, 10))} → ${esc(D.season.season.end.slice(0, 10))}</p><p class="muted small">Verificado el ${esc(D.season.season.verifiedAt)}.</p>` : '<p class="muted">Sin configuración.</p>'}
            ${st.state === 'ended' ? '<div class="notice bad">La temporada terminó: actualiza <code>config/season.json</code>.</div>' : ''}
            <p class="muted small">Las reglas de copas y el calendario se editan a mano cada ~3 meses; todo lo demás se actualiza solo.</p></div></div>

        <div class="section-title"><h2>Fuentes de datos</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Fuente</th><th>Qué aporta</th><th>Nota</th></tr></thead><tbody>${SOURCES.map(s => `<tr><td style="white-space:normal"><b>${s[3] ? `<a href="${esc(s[3])}" target="_blank" rel="noopener">${esc(s[0])}</a>` : esc(s[0])}</b></td><td style="white-space:normal">${esc(s[1])}</td><td style="white-space:normal" class="muted">${esc(s[2])}</td></tr>`).join('')}</tbody></table></div>

        <div class="section-title"><h2>Por qué puedes fiarte (y dónde no)</h2></div>
        <div class="grid cols-2"><div class="card"><h3>Comprobaciones automáticas</h3><ul class="muted" style="padding-left:20px;margin:8px 0 0"><li>Cada actualización compara la tabla CPM, costes de polvo, tabla de tipos y multiplicadores (STAB, Sombrío) con el Game Master. Si algo difiere, <b>no se publica</b> y se conservan los datos anteriores.</li><li>Especies "ancla" (Mewtwo, Azumarill, Registeel, Dragonite) deben mantener sus estadísticas.</li><li>Se avisa si PvPoke va por detrás del juego tras un rebalanceo, o si una fuente lleva semanas sin actualizarse.</li><li>El motor tiene pruebas automáticas, incluidos rangos 1 de PvP contrastados con fuentes independientes.</li></ul></div>
        <div class="card"><h3>Límites conocidos</h3><ul class="muted" style="padding-left:20px;margin:8px 0 0"><li>Los rankings de PvP son los del simulador de PvPoke (1 contra 1); no sustituyen a tu criterio de equipo.</li><li>El ranking de incursiones es un modelo con supuestos (pausa del jefe, esquivas, re-lobby): úsalo para comparar, no como valor exacto.</li><li>Los nombres de especies y ataques están en inglés (como en las fuentes).</li><li>Max Battles (Dynamax) aún no está modelado.</li></ul></div></div>

        <div class="section-title"><h2>Fórmulas y método</h2></div>
        ${FORMULAS.map(f => `<details class="acc"><summary>${esc(f[0])}</summary><div class="body">${f[1]}</div></details>`).join('')}

        <div class="section-title"><h2>Cómo mantenerla al día</h2></div>
        <div class="card stack"><p><b>Automático (recomendado):</b> sube el proyecto a GitHub y activa Pages; el flujo <code>.github/workflows/update-data.yml</code> descarga los datos cada 6 horas, los valida y publica solo si todo es correcto. Si algo falla te llega el aviso de Actions.</p>
          <p><b>Manual:</b> <code>npm run update</code> (requiere Node 20+), y luego <code>npm run serve</code>.</p>
          <p><b>Cada temporada (~3 meses):</b> edita <code>config/season.json</code> con el calendario y las copas (ver <code>docs/MANTENIMIENTO.md</code>).</p></div>`;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
