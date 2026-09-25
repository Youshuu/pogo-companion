# Investigación: qué hace falta para un companion de Pokémon GO fiable y vigente

*Fecha de la investigación: 23 de septiembre de 2026.*

## 1. Los cuatro problemas que resuelve una app así

| Problema | Solución en este proyecto |
|---|---|
| Datos que cambian cada pocas semanas (rebalanceos, especies) | Actualizador automático con validaciones y diff de cambios |
| Fórmulas que deben ser exactas (IV, PC, ranking) | Motor propio, sin dependencias, con pruebas contra anclas conocidas |
| Contexto que no está en el juego (calendario de GBL, reglas de copas) | `config/season.json`, curado a mano cada temporada con aviso de caducidad |
| Confianza: ¿el dato es correcto y está al día? | Compuertas de calidad, indicador de frescura visible en la app y datos anteriores conservados si algo falla |

## 2. Estado de las fuentes (hallazgo clave)

Una fuente puede seguir "respondiendo" y estar muerta. En septiembre de 2026:
- **PoGoAPI.net**: congelada (feeds de nov-2025).
- **PokeMiners/game_masters**: ~4 meses sin actualizar.
- **alexelgt/game_masters**: se actualiza cada 1–3 días → principal para el Game Master de Niantic.
- **PvPoke**: activo; su gamemaster y sus rankings son el estándar de PvP.

Consecuencia de diseño: se mide la **fecha del último commit** de cada espejo (no el código HTTP), se elige el más fresco y se avisa cuando una fuente supera 30–45 días. Detalle en `FUENTES.md`.

## 3. Datos y fórmulas necesarias
Ver `FORMULAS.md`. Puntos que suelen estar mal en calculadoras web:
- **CPM**: hay sitios con tablas incorrectas. Aquí se verifica con Mewtwo (4178 PC nv. 40 / 4724 PC nv. 50) y contra el Game Master en cada actualización.
- **Costes de polvo**: varias webs de calculadoras discrepan entre sí. Se usa la tabla verificada (nivel 1→40 = 270.000 de polvo) y se compara con el Game Master.
- **Nivel máximo**: hay que distinguir nivel 40, 50 y 51 (Mejor Compañero). El ranking de PvP cambia según el tope.
- **Inmunidades**: en GO son ×0,390625 (doble resistencia), no 0.
- **Sombrío**: Atk ×1,2 y Def ×0,8333; no afecta a la PC.
- **Suelos de IV**: salvaje 0, clima 4, incursión/huevo/investigación 10, Lucky 12, intercambio 1/2/3/5, purificar +2.
- **Evaluación**: estrellas por suma (≤22, 23–29, 30–36, 37–44, 45) y barras por IV (0–5, 6–10, 11–14, 15).

## 4. Metas actuales (referencia a 23-sep-2026)

**Temporada Twilight Trails**: 8 de septiembre → 1 de diciembre de 2026 (GBL temporada 28).

**Calendario de GBL relevante**: la semana del 22 al 29 de septiembre tiene Liga Ultra, Liga Máster: Edición Mega y Copa Retro (Liga Grande, sin Siniestro/Acero/Hada). Le siguen Máster + Copa Mega Color, Edición Mega en las tres ligas, Copa Pequeña, Copa Fantasía, Copa Mega Halloween, Copa GO LAIC 2026 y Copa Mega Captura (todas en `config/season.json` con sus reglas).

**Rebalanceo de movimientos de esta temporada** (curado en `config/season.json`): entre otros, Bulldoze (poder 45→80), Brine (60→100), Bubble Beam (25→50), Air Cutter (45→60), Iron Head (70→85), Draining Kiss (60→80), Psycho Boost (PvP 70→85; gimnasios/incursiones 70→130 con energía 50→33), más ~35 Pokémon con ataques nuevos (Lugia con Earth Power, Skarmory con Drill Run, Darkrai con Foul Play y Sucker Punch, etc.). La fuente reconoce que no publicó todos los valores exactos de energía, por lo que el actualizador reemplaza esa lista con los números reales del Game Master.

**Meta de Liga Grande** (referencia informativa de sitios de la comunidad, sujeta a cambios y no verificada por esta app): Melmetal, Altaria y Ninetales de Alola sombrío destacaban en los rankings recientes; Registeel y Azumarill figuraban entre los más usados en GBL. La app no fija el meta a mano: lo lee de los rankings de PvPoke en cada actualización.

**PvE**: los rankings de atacantes dependen de cada temporada; se calculan con el modelo de DPS/TDO/eDPS (metodología de GamePress/DialgaDex), no se copian de un tier list.

## 5. Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| Cambia el formato de una fuente | Parsers defensivos + conteos mínimos + especies ancla; si falla, no se publica y quedan los datos anteriores |
| PvPoke va por detrás del juego tras un rebalanceo | Comparación PvPoke vs Game Master y aviso `pvp.lag`; novedades curadas en *Inicio* |
| Una fuente se estanca | Medición de frescura, prioridad de espejos, aviso visible |
| Cambia una constante del juego (CPM, polvo, tipos) | Comparación automática y bloqueo |
| Calendario/copas caducan | Aviso en la app y en la Action |
| Modelo PvE con supuestos | Supuestos visibles y ajustables; explicación en la pestaña *Datos* |
| Legal/marcas | Herramienta no oficial, sin recursos del juego incluidos; sprites opcionales de PokeAPI |

## 6. Límites conocidos
- El actualizador no pudo probarse contra las fuentes reales durante su desarrollo (entorno sin internet); su primera ejecución debe revisarse (ver `MANTENIMIENTO.md`).
- Sin simulador propio de batallas PvP (se usa el de PvPoke).
- Sin Max Battles (Dynamax) todavía.
- Nombres en inglés.
