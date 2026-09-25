# Fuentes de datos

Estado verificado en septiembre de 2026 (auditoría propia):

| Fuente | Qué aporta | Estado | Uso |
|---|---|---|---|
| `pvpoke/pvpoke` → `src/data/gamemaster.json` | Especies, stats base, tipos, ataques y movesets de PvP | Activa; estándar de la comunidad (licencia MIT) | **Principal** para PvP |
| `pvpoke/pvpoke` → `src/data/rankings/{copa}/overall/rankings-{PC}.json` | Ranking por simulación, moveset recomendado | Activa | Rankings por liga y copa |
| `alexelgt/game_masters` → `GAME_MASTER.json` | Game Master de Niantic (PvE, CPM, costes, constantes) | Activa; actualizada cada 1–3 días | **Principal** para PvE |
| `PokeMiners/game_masters` → `latest/latest.json` | Igual | **Estancada ~4 meses** en 2026 | Respaldo |
| PoGoAPI.net | API de datos | **Congelada** (datos de nov-2025) | No se usa |
| `pokemon-go-api.github.io` | Jefes de incursión y Max Battles | Activa (mejor esfuerzo) | Opcional |
| GO Hub / LeekDuck / GamePress / PokéBase | Calendarios, rebalanceos, metodología | Web editorial | Referencia humana para `config/season.json` |

**Lección de diseño:** una fuente puede responder HTTP 200 y aun así estar meses desactualizada. Por eso el actualizador mide la fecha del último commit de cada espejo y elige el más reciente, y avisa cuando una fuente pasa de 30–45 días.

## Estructura relevante
- PvPoke `pokemon[]`: `speciesId, speciesName, dex, baseStats{atk,def,hp}, types[], fastMoves[], chargedMoves[], eliteMoves[], tags[], released`.
- PvPoke `moves[]`: `moveId, name, type, power, energy, energyGain, cooldown(ms), buffs, buffTarget, buffApplyChance`.
- Game Master de Niantic: array de `{templateId, data}` con bloques `pokemonSettings`, `moveSettings` (PvE), `combatMove` (PvP), `playerLevel.cpMultiplier`, `pokemonUpgrades`, `typeEffective`, `battleSettings`.

## Imágenes
Los sprites se cargan opcionalmente de `PokeAPI/sprites` (GitHub) cuando la app está alojada en http(s); si no cargan, se ve un círculo del color del tipo.
