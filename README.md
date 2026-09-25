# PoGo Companion

Companion web para **Pokémon GO**: calculadora de IV, ranking de IV para PvP (Liga Grande, Ultra, Máster y copas), mejores atacantes de incursión (DPS/TDO/eDPS), tipos y debilidades, un lector de IV a partir de un vídeo de tu caja, y tu box personal. Funciona en móvil y escritorio, con modo claro/oscuro y sin conexión (PWA).

- **Escanear caja:** sube una grabación de pantalla recorriendo tu caja (con la evaluación de cada Pokémon abierta) y recibe una lista con el IV de cada uno. Se procesa en tu navegador; el vídeo no se sube a ningún servidor. Detalles y límites conocidos en `docs/MANTENIMIENTO.md`.

Los datos (especies, ataques, rankings, rebalanceos) **se actualizan solos** desde fuentes públicas y **se validan antes de publicarse**.

## Puesta en marcha (5 minutos)

**Requisitos:** una cuenta de GitHub. Para probar en tu PC: Node.js 20 o superior.

### A) En internet, con actualización automática (recomendado)
1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta (rama `main`).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Pestaña **Actions → "Actualizar datos y publicar" → Run workflow**. La primera vez tarda ~2 minutos.
4. Tu app queda en `https://TU-USUARIO.github.io/TU-REPO/`. A partir de aquí se actualiza cada 6 horas sin que hagas nada.
5. Revisa en la app la pestaña **Datos**: debe decir "Datos al día" y mostrar ~1000+ especies. Si dice "Datos de muestra", mira el registro de la Action (ver `docs/MANTENIMIENTO.md`).

### B) En tu ordenador
```bash
npm run update     # descarga y valida los datos (necesita internet)
npm run serve      # abre http://localhost:8080
npm test           # pruebas de fórmulas y pipeline
npm run build      # genera dist/pogo-companion.html (un solo archivo con los datos incrustados)
```

## Qué contiene
| Carpeta | Qué hay |
|---|---|
| `js/core/` | Motor matemático (CP, IV, PvP, PvE, copas). Sin dependencias, probado. |
| `js/ui/`, `css/` | Interfaz. |
| `scripts/` | Actualizador de datos, validaciones, comparador de cambios, empaquetador. |
| `data/` | Datos generados (no se editan a mano). `starter.js` es la muestra de respaldo. |
| `config/season.json` | **Lo único que editas a mano** (cada ~3 meses): temporada, calendario de GBL y copas. |
| `tests/` | Pruebas automáticas. |
| `docs/` | Investigación, fuentes, fórmulas y mantenimiento. |

## Honestidad sobre la fiabilidad
- Las fórmulas del motor se contrastan con datos publicados por fuentes independientes (p. ej., rango 1 de Azumarill y Registeel en Liga Grande).
- Cada actualización compara CPM, costes de polvo, tabla de tipos y multiplicadores con el Game Master; si algo no cuadra, **no publica**.
- Los rankings de PvP son del simulador de PvPoke; el ranking de incursiones es un modelo con supuestos declarados. Ver pestaña **Datos** y `docs/FORMULAS.md`.
- Herramienta no oficial. Pokémon y Pokémon GO son marcas de sus respectivos propietarios.
