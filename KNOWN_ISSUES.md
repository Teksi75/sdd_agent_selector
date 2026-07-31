# Known Issues

Bitácora de issues detectados en uso real que **no son bugs del código** sino
desalineamientos con datos externos o affordances incompletas. Cada item
incluye evidencia + ruta de resolución sugerida. El objetivo es que la próxima
persona (vos o yo) sepa qué estaba pendiente al cerrar la sesión.

---

## KI-1 · Precios de OpenAI desactualizados — GPT 5.6 Terra/Luna especialmente

**Detectado:** 2026-07-31 (sesión actual)
**Reporter:** Pablo (en uso de la página)
**Severidad:** media — afecta la elección de modelos en el role matrix
**Síntoma:**
- Los precios en `data/models.json` para la familia GPT 5.6 (Terra, Luna, Sol)
  cambiaron desde la última sync (`lastSynced: 2026-07-26`, hace ~5 días).
- Consecuencia: en algunas asignaciones, **GPT 5.4 sigue siendo elegido
  porque la relación costo/razonamiento de 5.6 no está reflejada**. Con los
  precios nuevos, GPT 5.6 reemplazaría a 5.4 en varios slots.

**Por qué pasó:**
- La data se scrapea de páginas públicas de pricing (scripts
  `scrape-openai-pricing.js`, etc.) pero el cron de sync es cada 5 días
  (`0 0 */5 * *`). Si OpenAI cambia precios entre syncs, la página queda
  mostrando los precios viejos.

**Ruta de resolución:**
1. Disparar sync manual inmediato: `gh workflow run sync-benchmarks --ref main`
2. Revisar `data/models.json` después del sync y comparar `input`/`output` de
   `gpt56terra` y `gpt56luna` contra los precios públicos actuales de OpenAI.
3. Si la nueva sync no refleja los precios reales (porque el scraper no
   matchea), patch manual con los precios correctos.
4. Considerar acortar el intervalo de sync (¿cada 2 días?) si OpenAI está
   moviendo precios con frecuencia.

**Modelos a vigilar post-sync:**
- `gpt56terra` (input, output, cacheRead)
- `gpt56luna` (input, output, cacheRead)
- `gpt56sol` (mismo)
- `gpt55` (referencia — el costRatio=1 se ancla acá)

---

## KI-2 · Botón "Actualizar ahora" (freshness badge) no produce feedback visible

**Detectado:** 2026-07-31 (sesión actual)
**Reporter:** Pablo (en uso de la página)
**Severidad:** media — UX oscura, no se sabe si la acción sirvió
**Síntoma:**
- El botón `Actualizar ahora` en el freshness badge llama a
  `dataSync.refresh()` y trae data nueva de
  `https://raw.githubusercontent.com/Teksi75/sdd-data/main/data/*.json`.
- Visualmente, no hay feedback de "actualizando…" ni "actualizado ✓" ni
  mensaje de error si el fetch falla. El usuario no sabe si pasó algo.

**Por qué pasó:**
- El código de `data-sync.js` loguea a `console` pero no emite toast ni cambia
  el estado del botón.
- Además, si `Teksi75/sdd-data` no existe o está desincronizado, el refresh
  falla silenciosamente y la UI muestra la misma data.

**Ruta de resolución:**
1. En `js/services/data-sync.js` (o donde esté `Ve()`), emitir toast via
   `showToast` durante el refresh:
   - Antes: "Actualizando datos…"
   - Después (success): "Datos actualizados · N archivos"
   - Después (failure): "No se pudo actualizar · usando cache local"
2. Cambiar el texto del botón a "Actualizando…" + `disabled=true` durante el
   fetch.
3. Verificar que el repo `Teksi75/sdd-data` exista y tenga los JSON
   actualizados — si no existe, el botón SIEMPRE va a fallar. La página lo
   sirve igual desde `dist/data/`, pero el refresh nunca puede mejorar la
   data local.

**Relacionado:** el `_meta.scrapers.benchlm.lastRun` se chequea para el badge
"stale > 7 días" — si la última sync de BenchLM tiene 14 días, el badge de
alerta se muestra pero el botón de refresh no resuelve eso (la sync de
BenchLM es un workflow aparte).
