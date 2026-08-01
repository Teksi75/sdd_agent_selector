# Known Issues

Bitácora de issues detectados en uso real que **no son bugs del código** sino
desalineamientos con datos externos o affordances incompletas. Cada item
incluye evidencia + ruta de resolución sugerida. El objetivo es que la próxima
persona (vos o yo) sepa qué estaba pendiente al cerrar la sesión.

---

## KI-1 · ✅ RESUELTO (2026-08-01) — Precios de OpenAI desactualizados

**Cerrado por:** PR #44 (`sync-data` workflow) + creación de `Teksi75/sdd-data`.

**Cómo se resolvió:**
- Repo `Teksi75/sdd-data` creado con los 5 JSON (commit `1b6cec2`)
- Workflow `sync-data.yml` en `sdd_agent_selector` que mirrorea
  `data/*.json` → `sdd-data` en cada push a main
- Cron `0 6 * * *` (06:00 UTC) como self-heal en caso de push perdido
- E2E verificado: test commit en `test/sync-data-e2e` → workflow corrió →
  commit `ad22a8d8 chore(data): sync from sdd_agent_selector @ 6129f437`
  apareció en `sdd-data` con el diff correcto (bumped `lastSynced` a
  `2026-08-01`)
- PAT fine-grained configurado como secret `SDD_DATA_TOKEN` en
  `Teksi75/sdd_agent_selector` con scope Contents: Read/Write sobre
  `Teksi75/sdd-data` solamente

**Resolución del "no vale la pena seguir con GPT 5.4":** ahora la data se
puede actualizar vía el cron diario de `data/sync-benchmarks.yml` (que toca
`data/models.json` sin hacer push) o manualmente vía PR. El workflow
`sync-data` corre en cualquier push, así que el refresh button siempre
devuelve data fresca.

---

## KI-2 · ✅ RESUELTO (2026-08-01) — Botón "Actualizar ahora" sin feedback

**Cerrado por:** PR #43 (`fix(ui): KI-2 — feedback del botón Actualizar ahora`)

**Cómo se resolvió:**
- `data-sync.refresh()` ahora acepta callback opcional `onProgress(evt)` que
  dispara en cada fase (`start` / `success` / `failure`)
- `app.js handleRefreshClick` lo wirea a `showToast`:
  - start → "Actualizando datos…" (1.5s, success kind)
  - success → "Datos actualizados · N archivos · sync YYYY-MM-DD"
  - failure con 404 sobre `sdd-data` → "No se pudo conectar al repo de
    datos — usando la versión local (actualizada en cada deploy)"
  - failure genérico → "No se pudo actualizar — usando la versión local
    (cache)"
- Botón se deshabilita durante el fetch + label "Actualizando…" +
  `aria-busy="true"`. `try/finally` garantiza re-enable.
- Con KI-1 cerrado (sdd-data existe), el caso 404 desaparece y el toast
  de success pasa a ser el path normal.
