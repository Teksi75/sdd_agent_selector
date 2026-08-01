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

---

## Critique v2 · 2026-08-01 — Backlog de polish (Nielsen 28/40)

Snapshot del critique: `.impeccable/critique/2026-08-01T04-30-00Z__sdd-agent-selector-v2.md`
Score 28/40 (subió 25→28 desde el critique inicial). Items clasificados por
severidad según el rubric del critique. Estado de cada uno al final de PR #47:

### P0 · bloqueante · pendiente
- **P0-1 (2da mitad) — copy de onboarding en el empty state.** PR #47 cerró
  la primera mitad (pre-select `balanceado` con `silent: true` → 18 cards
  con modelo asignado en vez de wall de rojos). Falta la copy: el
  primer render aún no le dice al usuario "qué está mirando" ni cómo
  cambiar de estrategia. Acción: agregar un `<p>` corto en el hero que
  explique el flujo en 2 oraciones, link al glossary.

### P0 · bloqueante · ✅ RESUELTO en este PR
- **P0-2 — hero-stats "0 agentes".** El loader componía el payload bajo
  la key `roles` pero el componente leía `roleMatrix` (regresión de
  PR #46). Fix: dual-key resolution `data?.roles ?? data?.roleMatrix`
  con preferencia por `roles` (la del data-loader real). Tres tests
  pinnean la tolerancia para que un futuro rename de cualquier lado
  rompa el build en vez del live.

### P1 · alta · pendiente
- **P1-1 — tier h2 labels casi invisibles.** `text-[11px] text-slate-400`
  sobre fondo `slate-900` da contraste <3:1. Acción: subir a `text-sm`
  o `text-base` + `text-slate-200`.
- **P1-2 — SOFT badge se lee como error.** El `amber-300` actual está
  overloaded con otros warnings. Acción: cambiar a `text-purple-300`
  (color del fallback) o agregar un icono prefix `~` para disambiguar
  de "warning".

### P2 · eficiencia / a11y · mezcla
- **P2-2 — skip-link.** ✅ RESUELTO en este PR: `<a class="skip-link"
  data-test="skip-link" href="#tier-1">Saltar al contenido principal</a>`
  con `.skip-link{position:absolute;top:-100px}` y
  `.skip-link:focus{top:.5rem}`. 5 tests pinnean el shape HTML + CSS.
- **P2-3 — export menu keyboard nav.** ✅ RESUELTO en este PR: roving
  tabindex, `aria-activedescendant`, ArrowUp/Down con wrap-around
  (estilo WAI-ARIA Authoring Practices), Home/End, Tab/Escape. 6 tests
  en `export-button.test.js` + 2 shape tests en `p2-polish.test.js`.
- **P2-5 — descripción de formatos en el export menu.** Los `<button>`
  items solo tienen `Copiar` / `Descargar` — falta una línea de copy
  que explique qué se exporta. Acción: agregar un `<span class="text-[10px] text-slate-500">`
  debajo de cada label.
- **P2 eficiencia — keyboard shortcuts.** Falta `?` para help,
  `g+i/j/k` para navegar entre tiers, `r` para refresh. Acción:
  documentar primero; agregar keybindings en el siguiente PR.
- **P2-4 — aria-live per-card.** Las cards de justificación se
  re-pintan en cada `selectConfig` sin anuncio. Acción: agregar
  `aria-live="polite"` al mount + un `sr-only` "Configuración aplicada"
  que se actualice.
- **P2-6 — rename "CLI mirror".** El nombre "CLI mirror" no comunica
  qué hace. Acción: cambiar a "Equivalentes CLI" o "Comando
  equivalente" y agregar tooltip.
- **P2-1 — refresh affordance.** El botón "Actualizar ahora" en
  `freshness-badge` es pequeño y gris. KI-2 ya cerró el feedback del
  click, pero el affordance visual sigue débil. Acción: subir a
  `min-height:2.5rem` + `text-sm`.

### P3 · SLOP false positives · ignorado
- P3-1 indigo "intencional" (color de marca SDD)
- P3-2 em-dashes "tipografía española"
- P3-3 Inter "V3-parity"
- P3-4 `.gradient-text` "clase muerta legacy"

Estos los marcó el critique como SLOP heuristics pero el autor los
defiende; no se actúa.
