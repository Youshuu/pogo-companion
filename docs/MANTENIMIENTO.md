# Mantenimiento: cómo mantener la app vigente

## Qué es automático y qué no
| Cambia con… | ¿Quién lo actualiza? | Cómo |
|---|---|---|
| Stats base, tipos, ataques (PvP y PvE), movesets, costes | **Automático** | `scripts/update-data.mjs` cada 6 h |
| Rebalanceos de movimientos, nuevas especies | **Automático** | Se detectan en `data/changes.json` y salen en *Inicio* |
| Rankings de PvP por liga y copa | **Automático** | Rankings de PvPoke |
| Tabla CPM, polvo, tipos, multiplicadores | **Automático + vigilado** | Se compara con el Game Master; si difiere, se bloquea |
| **Temporada, calendario de GBL, reglas de copas** | **Manual (~cada 3 meses)** | Editar `config/season.json` |
| Parámetros de modelo PvE (re-lobby, pausa del jefe…) | Manual, raro | `js/core/pve.js` → `DEFAULTS` |

## Rutina por temporada (15 minutos)
1. La app y la Action te avisan cuando faltan ≤ 10 días para que termine (`check-season`).
2. Abre `config/season.json` y actualiza:
   - `season`: nombre, número de GBL, `start` y `end` (con zona horaria; el cambio de horario en EE. UU. en noviembre es UTC−8).
   - `cups`: una entrada por copa. Campos: `name`, `cap` (500/1500/2500/100000), `includeTypes`, `excludeTypes`, `bannedNames`, `allowMega`, `allowLegendary`, `littleCup`, `pvpokeCup` (id de la copa en PvPoke si tiene ranking propio).
   - `schedule`: una fila por semana con `from`, `to` y `leagues` (ids de `cups`).
   - `moveChanges` / `newMoves`: opcional; el diff automático ya cubre lo esencial.
3. Fuentes para copiar el calendario: la publicación oficial de Niantic/Scopely y GO Hub (el enlace queda en `season.sources`).
4. Sube el cambio. La Action lo publica sola.

## Si la Action falla (te llega un correo y se abre una incidencia)
Los **datos anteriores siguen publicados**; nada se rompe para los usuarios. Abre el registro de la ejecución y busca líneas `[ERROR]`:

| Código | Qué significa | Qué hacer |
|---|---|---|
| `cpm.mismatch` | Niantic cambió la tabla de multiplicadores | Es un cambio grande y raro. Comprueba en fuentes de la comunidad, actualiza `CPM_WHOLE` en `js/core/constants.js` y los tests. |
| `dust.mismatch` | Cambiaron costes de polvo | Actualiza `DUST_STEPS` en `constants.js` y el test de 270.000. |
| `types.mismatch` | Cambió la tabla de tipos | Actualiza `_CHART_SRC` en `constants.js`. |
| `battle.*` | Cambió STAB, energía por PS o multiplicadores Sombrío | Actualiza `MULT` en `constants.js`. |
| `anchor.mismatch` | Una especie ancla cambió de stats (o el parser leyó mal) | Verifica antes de aceptar. Si es un cambio real, edita las anclas en `scripts/lib/validate.mjs`. |
| `pvpoke.species.count` / `moves.count` | Descarga truncada o esquema roto | Reintenta; si persiste, la estructura de PvPoke cambió: ajustar `parse-pvpoke.mjs`. |

Avisos (`[WARN]`) no bloquean pero se ven en la pestaña **Datos**:
- `pvp.lag`: PvPoke aún no refleja un rebalanceo del juego (típico en los primeros días de temporada). Los movimientos de PvP mostrados pueden estar desfasados hasta que PvPoke actualice; los cambios del diff manual (`season.json`) sirven de referencia.
- `stale.niantic` / `stale.pvpoke`: la fuente lleva semanas sin actualizarse. Cambia la prioridad en `scripts/lib/sources.mjs`.

## Primera ejecución
Nota importante: el actualizador se escribió según los formatos documentados de PvPoke y del Game Master, pero **no pudo probarse contra las fuentes reales** durante su creación (sin acceso a internet). Tras la primera ejecución:
1. Revisa la pestaña **Datos**: especies (~1000+), movimientos (~500+), especies PvE (~1000+).
2. Compara un par de Pokémon que conozcas (stats base, ataques) con el juego.
3. Si `pveSpecies` sale en 0, el parser del Game Master de Niantic necesita un ajuste: pega aquí las primeras 60 líneas de `latest.json` / `GAME_MASTER.json` y se corrige en `scripts/lib/parse-niantic.mjs`.

## Cambiar de fuente
Todas las URLs están en `scripts/lib/sources.mjs`. Para añadir un espejo del Game Master basta con añadir una entrada a `SOURCES.niantic`; el actualizador elige el más reciente por fecha de commit.

## Ideas de evolución (hoja de ruta)
1. **Max Battles (Dynamax/Gigantamax):** módulo propio; ya hay fuente de jefes (`maxbattles.json`) y GamePress publica calculadora de referencia.
2. **Nombres en español** de ataques y especies (textos del juego).
3. **Equipos de PvP:** cobertura de tipos y amenazas de un equipo de 3.
4. **Simulador 1v1 propio** con escudos (hoy se usa el de PvPoke).
5. **Jefes de incursión en vivo** enlazados al ranking (`raids.json`).


## Función "Escanear caja" (leer un vídeo de tu box)

Lee un vídeo grabado por el usuario (recorriendo su caja con la pantalla de **evaluación** abierta en
cada Pokémon) y devuelve una lista con el IV de cada uno. Todo ocurre en el navegador del usuario
(canvas + Tesseract.js): el vídeo nunca sale de su dispositivo.

**Piezas:**
- `js/core/scan.js` — lógica pura (sin DOM): interpretar el texto del OCR (PC, PS), emparejar el
  nombre leído con la especie correcta tolerando errores de OCR, y traducir el llenado de una barra
  de evaluación a uno de los 4 cubos de IV que ya usa la calculadora manual. Probado en `tests/scan.test.js`.
- `js/ui/scan-vision.js` — captura de fotogramas del `<video>`, localiza el borde superior de la
  tarjeta blanca de datos (para no depender de una posición fija en pantalla) y recorta desde ahí las
  zonas de PC, nombre, PS y las tres barras. Mide el llenado de cada barra por color (píxeles muy
  saturados = relleno; grises = pista vacía).
- `js/ui/tab-scan.js` — la pestaña: carga Tesseract.js desde un CDN la primera vez, orquesta el
  recorrido del vídeo y muestra la tabla de resultados (con la calculadora de IV exacta ya aplicada).

**Calibración actual:** hecha por medición directa de píxeles sobre un vídeo real de 1080×2400
(relación ~20:9, la más común en Android). Las coordenadas de recorte están en `ROI` dentro de
`scan-vision.js`, expresadas como fracción de la ANCHURA del vídeo, medidas desde el borde superior
de la tarjeta (detectado dinámicamente por `findCardTopY`, así que tolera barras de estado o
proporciones ligeramente distintas). Si un vídeo de otra proporción (p. ej. iPhone, con muescas o
relación de aspecto distinta) da malas lecturas, hay que volver a medir esos offsets sobre un vídeo
de ejemplo de ese dispositivo — el proceso está documentado arriba en el histórico de esta sección
del proyecto: extraer fotogramas con `ffmpeg`, recortar con Python/OpenCV probando distintos
porcentajes hasta que el recorte quede centrado en el texto, y pasar esas fracciones a `ROI`.

**Por qué el número de estrellas de la evaluación NO se lee todavía:** se intentó (clasificar cada
una de las 3 estrellas del medallón por color, gris vacío/oro llena) pero el fondo del medallón usa
tonos dorados parecidos a los de una estrella rellena, y los intentos de aislar cada estrella dieron
lecturas poco fiables. Se dejó fuera en vez de mandar una función que a veces engaña. El llenado de
las barras (que sí se lee) ya aporta señal equivalente y es más preciso.

**Red de seguridad:** una lectura de PC corrompida por el OCR casi siempre queda fuera de rango
(10–10000) o, si no, no encaja con ningún IV real al resolver junto con el PS exacto — en ambos
casos la fila se marca "Revisar" en vez de dar un dato falso con confianza. Por eso cada fila debe
producir un candidato único para poder guardarse de un clic; si no, el usuario corrige el Pokémon a
mano con el desplegable (los números de PC/PS los sigue usando tal cual se leyeron).

**Pendiente de probar con conexión real:** Tesseract.js se carga desde `cdnjs.cloudflare.com` en
tiempo de ejecución; el entorno de desarrollo de este proyecto no tuvo acceso a internet para probar
esa carga en vivo. Antes de darla por buena, procesa un vídeo real y revisa que las filas "OK" tengan
sentido.
