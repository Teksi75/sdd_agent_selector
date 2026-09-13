# Tasks — 2026-09-13-aa-intelligence-refresh

Fecha: 2026-09-13 · Fase: tasks · Store: openspec · Modo: auto
Autoridad de implementación: `design.md` (D1 scorer=benchlm-clamp e intacto; D2 model-card anexo de model-picker; D3 composite-chart en PR-B; D4 helper `effort-tag.js`).
Spec: delta `openspec/changes/2026-09-13-aa-intelligence-refresh/specs/model-picker/spec.md` (4 ADDED / **6** MODIFIED / 5 REMOVED tras fase 0) + canónico `openspec/specs/model-picker/spec.md`.
Stack: pnpm + vitest · strict TDD (`openspec/config.yaml`) · Budget 400 líneas/PR · Cadena stacked-to-main (PR-A → PR-B).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650–900 total (PR-A 320–520 · PR-B 280–420) |
| 400-line budget risk | High (cada slice roza o supera el umbral; el combinado lo excede con seguridad) |
| Chained PRs recommended | Yes |
| Suggested split | PR-A datos AA → PR-B UI effort-only (stacked a main, cada uno verde e independiente) |
| Delivery strategy | ask-on-risk (pausar y preguntar si un slice supera 400 o si el gate Astra-53 no cierra; nunca inferir `size:exception`) |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

Diagrama de dependencias (📍 = trabajo de esta tanda):

```text
Fase 0 (contrato spec + evidencia AA)   [blocking]
   └─> 📍 Fase 1 PR-A scraper/fixture (TDD)
          └─> 📍 Fase 2 PR-A aliases/backfill/matriz + gate chatgpt-plus
                 └─> 📍 Fase 3 PR-B effort-only + chart neutral (TDD)
                        └─> 📍 Fase 4 cierre, gates y entrega
```

Gates de decisión `ask-on-risk` (no resolverlos solo; pausar y preguntar):
- **G1** — Si 53 no es el máximo real del conjunto elegible `chatgpt-plus` tras backfill completo: NO bajar candidatos sin evidencia; degradar a Astra+Spark (D4-B), mover el resto a follow-up y corregir el spec a 4 ADDED/6 MODIFIED/5 REMOVED ya establecido.
- **G2** — Si PR-A (o PR-B) supera 400 líneas cambiadas: recortar por evidencia o abrir tercer eslabón; no `size:exception` tácito.
- **G3** — Si no existe path real de Intelligence Index en payload AA v2 (ni live ni captura): el scraper no adivina; el campo cae a backfill manual trazado y se documenta la omisión.

---

## Fase 0 — Contrato spec y evidencia AA (blocking para todo)

- [x] **0.1** Agregar en el delta spec la sección `MODIFIED` **“Scoring Service — compositeScore”** que reemplaza el weighted 30/30/20/20 por el contrato ejecutable: score finito = `model.benchlm.score` clamp `[0,100]`; ausente/no finito = `null` (nunca `0`); función pura; `arena`/`swePro`/`sweVer`/`term`/`intelligenceIndex` inertes; escenarios: valor directo, clamp alto, clamp bajo, null fail-soft y par idéntico salvo `intelligenceIndex` con igual resultado. Archivo: `openspec/changes/2026-09-13-aa-intelligence-refresh/specs/model-picker/spec.md`. Evidencia: diff del delta + conteo final **4 ADDED / 6 MODIFIED / 5 REMOVED**. <!-- sdd-owner: implementation -->
  - Deja el `MODIFIED getBestFor` ya escrito intacto; no reabrir decisiones D1–D4 del proposal.
- [x] **0.2** Reescribir el escenario Astra del delta para que la precondición sea “catálogo completo tras el backfill AA trazado del mismo snapshot” y el THEN exija el **máximo real** del conjunto elegible, no `53` asumido; agregar la cláusula “nunca se baja un candidato sin evidencia AA”. Archivo: mismo delta, sección `MODIFIED getBestFor`. Evidencia: lectura del delta. <!-- sdd-owner: implementation -->
- [x] **0.3** Ampliar la migración del requisito `REMOVED “Tier Badge Elements”` para nombrar explícitamente `composite-chart` (color por tier, `data-tier`, texto de leyenda y columna `Tier` del markdown), sin agregar requisito ni alterar el conteo. Evidencia: sección actualizada. <!-- sdd-owner: implementation -->
- [x] **0.4** Releer `openspec/specs/model-picker/spec.md:227` (`Scoring Service — compositeScore`) y `:639` (`UI Component — Composite Chart`) para confirmar que el delta los cubre y que no queda ningún requisito canónico contradicho por effort-only. Evidencia: nota de reconciliación en la bitácora del change. <!-- sdd-owner: implementation -->
- [x] **0.5** Congelar la evidencia AA 2026-09-13 antes de codear: guardar screenshot/payload y el path real del Intelligence Index (o declarar su ausencia), y armar el manifest `modelo/campo/valor → {url, date, scraper}`. Si el path no existe, disparar **G3** (`ask-on-risk`) y seguir solo por backfill manual trazado. Archivos: evidencia del change + `tests/fixtures/aa-sample.json` (se edita en 1.3). Evidencia: manifest con Astra 53, Spark 48, Opus 51 y resto del chart legible; cero números sintetizados. <!-- sdd-owner: implementation -->

---

## Fase 1 — PR-A: scraper, fixture y schema (strict TDD)

Bloque RED → GREEN → TRIANGULATE → REFACTOR sobre `scripts/scrape-artificialanalysis.js` y su fixture.

**RED**
- [x] **1.1** Escribir tests rojos en `tests/scrape-artificialanalysis.test.js`: (a) Intelligence finita del payload v2 llega **exacta** a `intelligenceIndex` (sin clamp ni normalización); (b) ausente/no finita → `null` + nota de omisión y el key NO se borra; (c) ningún número fabricado cuando el path falta. Evidencia: `pnpm vitest run tests/scrape-artificialanalysis.test.js` falla por el motivo esperado. <!-- sdd-owner: implementation -->
- [x] **1.2** Escribir tests rojos de write-guard y versionado: (a) `availability` de un registro existente queda deep-equal tras el write real (`preserveManualModelFields`); (b) id nuevo sale con `{}`; (c) `_meta.schemaVersion` final es **5** y no 4; (d) `CACHE_KEY` sigue `sdd-models-v6` y `DATA_FILES` en 6. Archivos: `tests/scrape-artificialanalysis.test.js`, `tests/_scraper-utils.test.js`, `tests/data-loader.test.js`. Evidencia: rojo con mensajes nombrados. <!-- sdd-owner: implementation -->
- [x] **1.3** Actualizar `tests/fixtures/aa-sample.json` con el path real del Intelligence Index: al menos **un caso finito y uno ausente/null**, `fetchedAt`/nota a la fecha real, sin Astra ni valores que la captura no traiga; el test no hace HTTP. Evidencia: fixture + test de fixture rojo. <!-- sdd-owner: implementation -->

**GREEN**
- [x] **1.4** Implementar en `scripts/scrape-artificialanalysis.js`: `FIELD_MAP` suma **una sola key** `evaluations.artificial_analysis_intelligence_index -> intelligenceIndex` (sin cadena de paths inferidos), `buildAaPatch` con contrato nullable propio (finito → número exacto; no finito → `null` + omisión; no borrar key nullable) y `SCHEMA_VERSION` / escritura en **5**. Evidencia: `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js` verde. <!-- sdd-owner: implementation -->

**TRIANGULATE**
- [x] **1.5** Agregar casos de triangulación: valor `0` legítimo vs ausencia, string/NaN como no-finito, modelo nunca cubierto por AA (campo ausente, no `null`), dedupe de `sources[]` por `url+date+scraper` y aborto ante desaparición de ids. Evidencia: suite verde con los 4+ casos nuevos. <!-- sdd-owner: implementation -->

**REFACTOR**
- [x] **1.6** Dejar comentarios de ownership en el scraper: AA es dueño de `intelligenceIndex` y sus campos actuales; **nunca** escribe `benchlm`; `benchlm.score` del backfill es one-shot de curación y queda auditado por `sources[]`. Evidencia: re-green sin cambios de conducta. <!-- sdd-owner: implementation -->
- [x] **1.7** Verificación de cierre de fase: `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js tests/_aa-safety.test.js tests/data-loader.test.js` verde y revisión del tamaño acumulado de PR-A (si >400 → **G2**). <!-- sdd-owner: implementation -->

---

## Fase 2 — PR-A: aliases, backfill trazado, matriz y gate chatgpt-plus

Dependencia: fase 1 verde. Sin tocar UI.

- [x] **2.1 RED** — Tests de catálogo en `tests/aa-effort.test.js` y `tests/data-integrity.test.js`: todo alias nuevo declara `effort` explícito (nunca inferido del slug); `intelligenceIndex` admite finito o `null`; cada número backfilleado tiene su `sources[]` AA fechado; `musespark13contributor` conserva `xhigh`; no hay duplicados DeepSeek/MiniMax. Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [x] **2.2 GREEN** — Curar `data/aa-aliases.json` con los slugs confirmados (Astra, Spark y resto con evidencia), cada uno `{slug,to,effort}` + `lastUpdated`; ningún slug sin effort. Evidencia: `pnpm vitest run tests/aa-effort.test.js tests/_aa-safety.test.js` verde. <!-- sdd-owner: implementation -->
- [x] **2.3 GREEN** — Backfill one-shot en `data/models.json`: `gpt6astra` con `benchlm.score: 53` + `intelligenceIndex: 53` (conservando subcampos BenchLM salvo evidencia explícita), `musespark13` (“Muse Spark 1.3 (max)”) 48 como entrada distinta y `benchmark-only`, Opus 51 y cada fila legible del chart; `sources[]` por número según el manifest de 0.5; omisiones enumeradas en `notes`. Evidencia: `pnpm vitest run tests/data-integrity.test.js` verde y manifest ↔ `sources[]` 1:1. <!-- sdd-owner: implementation -->
- [x] **2.4** Reconciliar familias sin duplicar: DeepSeek 0813/V4.1 como alias **o** variante distinta (nunca ambos), `minimaxm3` verificado mismo/distinto antes de crear, Qwen3.8/Gemini 3.8 Flash/K2 Horizon/Inkling/Nemotron solo con evidencia (si no, quedan en notas de omisión). Evidencia: test de no-duplicados verde + listado de omisiones. <!-- sdd-owner: implementation -->
- [x] **2.5** Materializar availability fail-closed: mapa completo de providers en `false` salvo `sourceOfTruth`, `lifecycle: "benchmark-only"` para las altas, correr `pnpm run propagate:availability`. Evidencia: `pnpm vitest run tests/availability-matrix.test.js tests/propagate-provider-availability.test.js` verde (matriz `families × providers` completa). <!-- sdd-owner: implementation -->
- [x] **2.6** Caracterización del scorer en `tests/model-scorer.test.js`: dos modelos que solo difieren en `intelligenceIndex` producen igual `compositeScore` y mismo ganador; assert de ausencia de `intelligenceIndex` en el source del scorer. Sin cambios productivos en `js/services/model-scorer.js`. Evidencia: `pnpm vitest run tests/model-scorer.test.js` verde. <!-- sdd-owner: implementation -->
- [x] **2.7 GATE** — Test del criterio Astra sobre el conjunto **real**: tras `applyProviderFilter` con `chatgpt-plus`, ordenar por `compositeScore` desc y afirmar que el máximo pertenece a Astra. Si 53 no es el máximo real: **no** bajar candidatos ni agregar branch especial; pausar en **G1**, degradar a Astra+Spark (D4-B) con follow-up y mantener el delta en 4 ADDED/6 MODIFIED/5 REMOVED. Evidencia: test verde **o** informe de gate fallido con follow-up creado. <!-- sdd-owner: implementation -->
- [x] **2.8** Cierre de PR-A: `pnpm test` verde, `pnpm build` <30s con `dist/index.html` autocontenido, y medición de líneas cambiadas (si >400 → **G2** antes de abrir el PR). Rollback: revert del commit de datos + revalidar schema 5 y matriz. <!-- sdd-owner: implementation -->

---

## Fase 3 — PR-B: effort-only + composite-chart neutral (strict TDD)

Apilado sobre el SHA verde de PR-A. No toca datos, scorer, provider filter ni lógica de assignments.

**Helper compartido (RED → GREEN → TRIANGULATE → REFACTOR)**
- [x] **3.1 RED** — `tests/effort-tag.test.js` (nuevo): vocabulario cerrado `max|xhigh|high|medium|low|non-reasoning`, labels rioplatenses existentes, escape HTML, y **cero badge** ante effort faltante o inválido (sin labels inventados). Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [x] **3.2 GREEN** — Crear `js/components/effort-tag.js` con el renderer puro y el helper de vocabulario cerrado hasta que `pnpm vitest run tests/effort-tag.test.js` quede verde. <!-- sdd-owner: implementation -->
- [x] **3.3 TRIANGULATE** — Casos límite del helper: string vacío, valor fuera de vocabulario, HTML hostil en el label y `softFallback: true` (sin badges). Evidencia: suite verde con los 4 casos. <!-- sdd-owner: implementation -->
- [x] **3.4 REFACTOR** — Migrar el render de effort de ref-table, model-card, cli-mirror y justification al helper compartido sin cambiar labels ni atributos `data-effort`. Evidencia: `pnpm vitest run tests/effort-tag.test.js tests/ref-table.test.js tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->

**Superficies (una tarea por componente, cada una con su suite)**
- [x] **3.5** `js/components/ref-table.js`: eliminar `tierCell` + header/export `Tier`, conservar `Esfuerzo` y lifecycle, ajustar colspans y `exportRowsFrom` (header md `['Modelo','Esfuerzo',...]`). Evidencia: `pnpm vitest run tests/ref-table.test.js` verde con assert explícito de ausencia de `Tier`/`[data-tier]`. <!-- sdd-owner: implementation -->
- [x] **3.6** `js/components/model-card.js`: eliminar `tierSlug/tierLabel` y `.model-tier-tag`/`data-tier`; dejar NEW + effort válido usando `effort-tag.js`. Evidencia: `pnpm vitest run tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [x] **3.7** `js/components/cli-mirror-table.js`: eliminar helpers de tier/token color y `softBadge`/`.soft-badge`/`~`; normal = nombre + effort, fallback = **solo nombre**, 18 filas y `unassigned` intactos. Evidencia: `pnpm vitest run tests/cli-mirror-table.test.js` verde. <!-- sdd-owner: implementation -->
- [x] **3.8** `js/components/justification-ui.js`: agregar tag effort en `assignmentHeader`, eliminar tier, `.soft-badge`, banner `.soft-summary`/`[data-test=soft-summary]` y columnas `Tier`/`Estado`; export md `Agente/Rol/Modelo/Esfuerzo/Score/Costo`; fallback sin badges y CTA enable-all intacto. Evidencia: `pnpm vitest run tests/justification-ui.test.js` verde (cubre `:249` tiers y `:278` banner). <!-- sdd-owner: implementation -->
- [x] **3.9** `js/services/exporter.js`: `agentsMarkdown` sin `(tier · score · costo)` ni `_soft fallback_`; conservar header providers+timestamp, score, costo y flag full-catalog; JSON puede conservar `softFallback` como dato de máquina. Evidencia: `pnpm vitest run tests/exporter.test.js tests/export-button.test.js` verde. <!-- sdd-owner: implementation -->
- [x] **3.10** `js/components/composite-chart.js`: barras con token neutral `--composite-score-fill` (fallback indigo); eliminar `tierOf`, `barColor`, `data-tier`, texto de tier en leyenda y columna `Tier` del export; conservar sort BenchLM, nulls-last y agrupación AA. Evidencia: `pnpm vitest run tests/composite-chart.test.js` verde con asserts de color neutral y ausencia de tier. <!-- sdd-owner: implementation -->
- [x] **3.11** `css/tokens.css`: agregar `--composite-score-fill`; eliminar `--composite-tier-*`, `.model-tier-tag`, `.soft-badge`, `.soft-summary` **solo si quedan huérfanos**; conservar `.tier-tag`, sus shapes y `--pricing-tier-*` usados por workflow-table/pricing-chart. Evidencia: grep de referencias + `pnpm build` verde. <!-- sdd-owner: implementation -->
- [x] **3.12** Actualizar los ~10 tests UI restantes (`tests/p2-polish.test.js`, `tests/v2-polish-final.test.js`, `tests/config-selector.test.js`, `tests/aa-effort.test.js`, `tests/data-integrity.test.js`, y los que aparezcan por grep de `tier`/`soft`/`~`): reemplazar asserts de tier/soft por asserts de ausencia, conservando las shapes de `.tier-tag` que workflow todavía usa. Evidencia: `pnpm test` verde completo. <!-- sdd-owner: implementation -->

---

## Fase 4 — Cierre, gates y entrega

- [ ] **4.1** `pnpm test` verde (suite completa) y `pnpm test:coverage` con scorer ≥80% y umbrales vigentes. Evidencia: salida de coverage. <!-- sdd-owner: implementation -->
- [ ] **4.2** `pnpm build` <30s con `dist/index.html` autocontenido. Evidencia: artefacto + tiempo. <!-- sdd-owner: implementation -->
- [ ] **4.3** Verificación de conteos vivos: cli-mirror 18 filas, 18 cards, workflow 9 filas, 5 botones de config, twin judge `jd-judge-a/b` mismo modelo, hero-stats `"X de Y visibles"`. Evidencia: suites `cli-mirror-table`, `justification-ui`, `config-selector`, `twin-judge`, `hero-stats`, `workflow-table` verdes. <!-- sdd-owner: implementation -->
- [ ] **4.4** Medir líneas cambiadas de PR-A y PR-B por separado; si alguno supera 400, aplicar **G2** (ask-on-risk) antes de mergear: recorte por evidencia o tercer eslabón, nunca `size:exception` inferido. Evidencia: `git diff --stat` por slice. <!-- sdd-owner: implementation -->
- [ ] **4.5** Entrega stacked-to-main: merge PR-A a main primero (verificando sources, matriz y resultado del filtro `chatgpt-plus`), luego rebase de PR-B sobre ese SHA verde y merge. Rollback: nunca cruzado — revert de PR-B restaura presentación, revert de PR-A restaura scraper/datos revalidando schema 5 + matriz. Evidencia: ambos PRs verdes e independientes. <!-- sdd-owner: implementation -->
- [ ] **4.6** Archive del change: mover a `openspec/changes/archive/` con prefijo ISO y mergear el delta al canónico `openspec/specs/model-picker/spec.md`, incorporando “Model Card (effort-only)” como anexo de model-picker y el `MODIFIED compositeScore`. Evidencia: spec canónico actualizado y delta archivado. <!-- sdd-owner: implementation -->

---

## Fuera de alcance (recordatorio)

Scorer formula/pesos, reordenamiento global por inteligencia, nuevos providers o cambios a `data/providers.json`, estrategia interna `tier-based` (se mantiene, solo se oculta el badge), pricing-chart/workflow-table (siguen usando `tier`), re-sync de precios/velocidades fuera del chart 2026-09-13.
