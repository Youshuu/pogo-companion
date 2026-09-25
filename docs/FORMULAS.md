# Fórmulas y método

Todas están implementadas en `js/core/` y cubiertas por `tests/core.test.js`.

## Estadísticas
```
Atk = (baseAtk + IVatk) · CPM(nivel)
Def = (baseDef + IVdef) · CPM(nivel)
PS  = max(10, ⌊(basePS + IVps) · CPM(nivel)⌋)
PC  = max(10, ⌊(baseAtk+IVatk) · √(baseDef+IVdef) · √(basePS+IVps) · CPM² / 10⌋)
CPM(n + 0.5) = √((CPM(n)² + CPM(n+1)²) / 2)
```
CPM en niveles clave: 1 → 0.094 · 30 → 0.7317 · 40 → 0.7903 · 50 → 0.8403 · 51 → 0.8453.
Anclas verificadas: Mewtwo 15/15/15 = 4178 PC (nv. 40) y 4724 PC (nv. 50); Dragonite = 3792 PC (nv. 40).

## Calculadora de IV
Enumeración exhaustiva de (nivel, IVatk, IVdef, IVps) que reproducen PC y PS exactos. Filtros:
- Polvo → niveles posibles (coste de la siguiente potenciación; ≤ 39,5 verificado; la suma nivel 1→40 = 270.000).
- Suelo por origen: salvaje 0 · clima 4 · incursión/huevo/investigación 10 · Lucky 12 · intercambio 1/2/3/5 · purificado +2.
- Evaluación: estrellas por suma (≤22 · 23–29 · 30–36 · 37–44 · 45) y barras por IV (0–5 · 6–10 · 11–14 · 15).
- Sugerencia de siguiente dato: el que minimiza el nº esperado de IV restantes (Σ nᵍ² / N).

## PvP
- **Stat product** = Atk · Def · PS al mayor nivel (paso 0,5) con PC ≤ tope. Rango = posición entre las 4096 combinaciones; % = producto / mejor.
- **Daño** = ⌊poder · 1,3 · STAB(1,2) · efectividad · Atk/Def⌋ + 1. Sombrío: Atk ×1,2, Def ×5/6.
- **Buffs**: escalón n → (4+n)/4 si n ≥ 0; 4/(4−n) si n < 0 (rango −4…+4).
- **Breakpoint**: Atk efectivo = (daño actual)/(k), con k = poder·1,3·STAB·efect/Def. **Bulkpoint**: Def efectiva mínima para recibir 1 menos.
- **Turnos a cargar** = ⌈coste / energía por rápido⌉ · turnos del rápido (1 turno = 0,5 s).
- Validación independiente: rango 1 de Azumarill en Liga Grande = 0/15/15, nivel 45,5, 1499 PC; Registeel = 0/8/15, nivel 24, 1500 PC.

## Efectividades de tipo (GO)
Súper eficaz ×1,6 · poco eficaz ×0,625 · inmune ×0,390625 (= doble resistencia). Se multiplican por cada tipo del defensor (p. ej. Eléctrico vs Agua/Volador = ×2,56).

## PvE
```
daño = ⌊0,5 · poder · Atk/Def · STAB · efectividad · clima⌋ + 1
FDPS = FDmg/FDur      FEPS = FE/FDur      CDPS = CDmg/CDur      CEPS = CE/CDur
CEPS' = (CE + 0,5·FE + 0,5·y·CDWS)/CDur       (solo si CE = 100, ataque de 1 barra)
DPS₀ = (FDPS·CEPS + CDPS·FEPS) / (CEPS + FEPS)
DPS  = DPS₀ + (CDPS − FDPS)/(CEPS + FEPS) · (0,5 − x/PS) · y
TDO  = DPS · PS / y
eDPS = 1 / (1/DPS + R/TDO)
```
`x` = energía sobrante al caer (supuesto CE/2), `y` = DPS entrante del jefe, `R` = re-lobby (supuesto 10 s), CDWS = inicio de la ventana de daño del cargado.
DPS entrante del jefe: ciclo rápido+cargado con pausa de 2 s entre ataques (supuesto), promedio de sus cargados, con fracción de esquivas opcional (daño ×0,25 al esquivar).
Raid tiers usados como preset: nivel 20 / 30 / 40 / 40 (T1 / T3 / T5 / Mega) con IV 15 del jefe.

**Supuestos que cambian resultados:** pausa del jefe, esquivas, re-lobby, clima, nivel/IV de los atacantes. Están a la vista y son ajustables.
**No modelado:** bonos de amistad/equipo, Mega boost, Party Power, Max Battles, dodge por ataque, variabilidad del jefe.

## Reglas de copas
`includeTypes`, `excludeTypes`, `bannedNames/bannedIds`, `allowMega`, `allowLegendary`, `littleCup` (ver `PVP.cupEligibility`).


## Lectura visual de barras de evaluación (función "Escanear caja")
Las barras de Ataque/Defensa/PS de la pantalla de evaluación se rellenan de forma **continua y
proporcional** a IV/15 (no a saltos de tercio, aunque tengan líneas divisorias visuales cada tercio).
Midiendo qué fracción de la barra está coloreada (saturación de color alta) frente a la pista vacía
(gris, saturación baja) se obtiene `fracción ≈ IV/15`. Esta app usa esa fracción solo para decidir en
cuál de los 4 cubos oficiales de la evaluación cae (0-5, 6-10, 11-14, 15) — igual que si el usuario
mirara la barra a ojo — y no como el IV exacto, con una zona de tolerancia alrededor de cada límite
(±0,035) en la que se abstiene de decidir, para no equivocarse por la compresión de vídeo. Validado
contra medición manual sobre un vídeo real (ver `MANTENIMIENTO.md`).
