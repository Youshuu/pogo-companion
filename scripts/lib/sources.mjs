// sources.mjs — Registro central de fuentes de datos (URLs, prioridad y motivo).
// Cambiar una fuente = editar SOLO este archivo.
//
// Contexto (auditoría sep-2026): PoGoAPI.net quedó congelado (feeds de nov-2025) y el
// espejo PokeMiners/game_masters llevaba ~4 meses sin actualizarse; alexelgt/game_masters
// se actualiza cada 1-3 días. Por eso el orden de preferencia es este y se mide la
// frescura REAL de cada espejo (fecha del último commit), no el HTTP 200.

export const SOURCES = {
  // Game Master de Niantic (mecánicas PvE, movesets PvE, CPM, costes…)
  niantic: [
    { id: 'alexelgt', repo: 'alexelgt/game_masters', branch: 'master', file: 'GAME_MASTER.json',
      url: 'https://raw.githubusercontent.com/alexelgt/game_masters/master/GAME_MASTER.json' },
    { id: 'pokeminers', repo: 'PokeMiners/game_masters', branch: 'master', file: 'latest/latest.json',
      url: 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json' }
  ],
  // PvPoke: especies + stats PvP de movimientos + rankings del simulador (licencia MIT)
  pvpoke: {
    repo: 'pvpoke/pvpoke',
    gamemaster: [
      'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json',
      'https://cdn.jsdelivr.net/gh/pvpoke/pvpoke@master/src/data/gamemaster.json'
    ],
    // {cup}/{role}/rankings-{cap}.json ; cup "all" = ligas estándar
    ranking: (cup, cap, role = 'overall') =>
      [`https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/${cup}/${role}/rankings-${cap}.json`,
       `https://cdn.jsdelivr.net/gh/pvpoke/pvpoke@master/src/data/rankings/${cup}/${role}/rankings-${cap}.json`]
  },
  // Jefes de incursión / Max Battles actuales (mejor esfuerzo; opcional)
  raidBosses: [
    'https://pokemon-go-api.github.io/pokemon-go-api/api/raidboss.json'
  ],
  maxBattles: [
    'https://pokemon-go-api.github.io/pokemon-go-api/api/maxbattles.json'
  ]
};

// Umbrales de frescura (días). Por encima → aviso visible en la app.
export const STALE_DAYS = { niantic: 30, pvpoke: 45, rankings: 45 };

// Ligas estándar: tope de PC
export const LEAGUE_CAPS = { little: 500, great: 1500, ultra: 2500, master: 10000 };
