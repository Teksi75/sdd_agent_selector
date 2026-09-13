# Apply Progress — 2026-09-13-aa-intelligence-refresh

Artifact store: **openspec**. Primer run de apply para este change; el archivo es acumulativo.
Fecha del run: 2026-09-13 · Modo: auto · Strict TDD: activo (`openspec/config.yaml`: `strict_tdd: true`, runner `pnpm test` / vitest)

## Slice 0 — Contrato spec + evidencia AA (tareas 0.1–0.5, blocking para todo)

- **Implementation status: complete.** Delta spec corregido a **4 ADDED / 6 MODIFIED / 5 REMOVED**, escenario Astra reescrito a “máximo real”, migración Tier Badge ampliada a `composite-chart`, reconciliación 0.4 documentada y manifest de evidencia AA congelado.
- **Delivery status: la Fase 0 no abre PR propia.** Solo artefactos de planning del change dir (untracked): cero cambios en `scripts/`, `js/`, `css/`, `data/`, `tests/`. Nada commiteado (sin commit sin pedido explícito del usuario).
- **Gates:** **G3 DISPARADO** (path de Intelligence Index sin confirmar) · **G1 EN RIESGO** (la evidencia congelada no alcanza para que Astra sea el máximo real) · **G2 pendiente** (se mide recién en PR-A/PR-B).

### Completed tasks (persisted checkboxes marked `[x]` in `tasks.md`)

| Task | Summary | Persisted |
|------|---------|-----------|
| 0.1 | Sección `MODIFIED “Scoring Service — compositeScore”`: `benchlm.score` clamp `[0,100]`; ausente/no finito → `null` (nunca `0`); función pura; `arena`/`swePro`/`sweVer`/`term`/`intelligenceIndex` inertes; 5 escenarios exigidos | `[x]` |
| 0.2 | Escenario Astra reescrito: precondición = catálogo completo post-backfill trazado del mismo snapshot; THEN = máximo real computado en test (nunca `53` hardcodeado); cláusula “nunca se baja un candidato sin evidencia AA”; parada en G1 | `[x]` |
| 0.3 | Migración de `REMOVED “Tier Badge Elements”` ampliada: `composite-chart` (`tierOf`/`barColor`, `data-tier`, leyenda y columna `Tier` del md), token neutral `--composite-score-fill`; conteo del delta intacto | `[x]` |
| 0.4 | Reconciliación canónica `:227` / `:639` + barrido completo de menciones `tier`/`soft`: nada contradicho sin cobertura | `[x]` |
| 0.5 | Manifest `evidence/aa-2026-09-13-backfill-manifest.md`: Astra 53 / Spark 48 / Opus 51 congelados, cero números sintetizados; G3 documentado; cobertura faltante para G1 enumerada | `[x]` (ver limitación) |

### Files changed (slice scope only — change dir, planning artifacts, untracked)

| Path | Líneas |
|------|---:|
| `openspec/changes/2026-09-13-aa-intelligence-refresh/specs/model-picker/spec.md` (delta: +sección compositeScore de 38 líneas + rewrites de escenario Astra/migración Tier Badge) | +~40 netas |
| `openspec/changes/2026-09-13-aa-intelligence-refresh/evidence/aa-2026-09-13-backfill-manifest.md` (nuevo) | +58 |
| `openspec/changes/2026-09-13-aa-intelligence-refresh/tasks.md` (5 checkboxes `[ ]`→`[x]`) | 5 líneas editadas |
| `openspec/changes/2026-09-13-aa-intelligence-refresh/apply-progress.md` (nuevo, este archivo) | +~150 |

No hay diffs en `scripts/`, `js/`, `css/`, `data/`, `tests/` (verificado: `git status --short` de esos paths = vacío). Con la convención de medición V5, los planning artifacts untracked del change dir no se cuentan contra el budget de 400 de PR-A/PR-B.

### Test commands run (evidence)

| Command | Result |
|---------|--------|
| `pnpm test` (no-regresión, solo lectura/ejecución) | 44 files: 41 passed, 3 failed **at collection**; **566/566 tests colectados pasan** |

Los 3 suites que fallan al colectar (`availability-matrix`, `data-integrity`, `propagate-provider-availability`) importan `scripts/propagate-provider-availability.mjs` y fallan con `SyntaxError` en `node:vm` bajo **Node v24.20.0** (vitest 1.6.1). Los archivos están intactos (`git status` limpio para `tests/` y `scripts/`), el script parsea bien con `node --check` e `import()` plano, y el CI fija Node 20 (`.github/workflows/deploy-pages.yml`). Es un problema de entorno pre-existente, no de este slice (que solo toca markdown bajo `openspec/changes/...`). Ninguna tarea de Fase 0 modifica tests.

### TDD Cycle Evidence (strict TDD activo)

La Fase 0 no tiene código productivo; el ciclo RED→GREEN→TRIANGULATE→REFACTOR se aplicó a nivel contrato:

| Task | Artifact | RED (equivalente) | GREEN | TRIANGULATE | REFACTOR |
|------|----------|-------------------|-------|-------------|----------|
| 0.1 | delta spec | Conteo 4/5/5 incumplía el ajuste obligatorio de design (4/6/5: falta `MODIFIED compositeScore`) | 4/6/5 verificado con conteo programático | 5 escenarios exigidos: valor directo, clamp alto, clamp bajo, null fail-soft, par idéntico salvo `intelligenceIndex` | ➖ (doc-only) |
| 0.2 | delta spec §getBestFor | El escenario afirmaba `53`/ganador asumido | Escenario real-max + cláusula de no-bajar sin evidencia AA | Gate G1 registrado para el caso “máximo real ≠ Astra” | ➖ |
| 0.3 | delta spec §REMOVED | La migración no nombraba `composite-chart` | Migración + escenario ampliados (color/attr/leyenda/export) sin cambiar conteo | Token neutral `--composite-score-fill` y asserts de ausencia explicitados | ➖ |
| 0.4 | nota de reconciliación | N/A (lectura) | Nota en esta bitácora | Barrido completo de menciones `tier`/`soft` del canónico | ➖ |
| 0.5 | manifest de evidencia | Búsqueda de captura/payload = 0 hits; sin `AA_API_KEY` → branch G3 | Manifest congelado + G3 documentado | Tabla de máximo real del set `chatgpt-plus` para el pronóstico de G1 | ➖ |

### Reconciliation note (task 0.4)

- Canónico `:227` **Scoring Service — compositeScore**: cubierto exactamente por la nueva sección MODIFIED; la fórmula weighted 30/30/20/20 queda declarada obsoleta y el runtime existente (benchlm-clamp) es la autoridad.
- Canónico `:639` **UI Component — Composite Chart**: el texto canónico no menciona tier; la fuga real de implementación (color por tier, `data-tier`, leyenda, columna `Tier` del markdown) queda cubierta por la migración ampliada de `REMOVED “Tier Badge Elements”`, sin alterar el conteo del delta.
- Barrido completo del canónico (`tier`/`soft`): las menciones restantes quedan **retained por diseño/non-goals** — Data Layer `tier` (:36), filtro `tier-based` y reference model de `getBestFor` (:325–328), `selectConfig` (:187/:199), Workflow Table con tag por tier (:605/:624/:626), Testing–Data Integrity chequeo V3 (:912), Provider Registry `tier` = label de suscripción (:936–952), Hard Provider Filter “soft fallbacks resolve within eligible set” (:1044). No queda ningún requisito canónico contradicho por effort-only sin cobertura del delta.

### G3 — ask-on-risk gate (DISPARADO; branch de tasks.md ejecutado)

- No existe path real de Intelligence Index en AA payload v2: sin `AA_API_KEY` en el entorno y sin captura/payload archivado (búsqueda `*.png|*.jpg|*.webp|*payload*|*screenshot*` = 0 hits).
- Consecuencia ejecutada (tasks.md G3): el scraper no adivina; **tareas 1.3 (fixture con path real) y 1.4 (key del `FIELD_MAP`) quedan bloqueadas** hasta que exista captura o el usuario autorice explícitamente un path con follow-up.
- Lo que sí puede avanzar sin path confirmado: contrato nullable de `buildAaPatch`, write-guard `preserveManualModelFields`, schema 5, dedupe de `sources[]` y backfill manual trazado.

### G1 — pronóstico de gate de datos (tarea 2.7)

Con la evidencia congelada (3 filas), el máximo real del conjunto `chatgpt-plus` sigue siendo `gpt56sol` 81.96 (`gpt54` 74.24, `gpt55` 73.51, `gpt56terra` 72.57): Astra 53 **no** sería el máximo. G1 se dispara en 2.7 salvo que llegue la captura del chart completo (o al menos de las filas `chatgpt-plus`) con valores 2026-09-13 y el backfill trazado las cubra. Prohibido bajar candidatos sin evidencia AA, agregar rama al scorer/sort, o inferir `size:exception`.

### Deviations from design / proposal

1. **0.5 quedó con evidencia parcial** (solo Astra/Spark/Opus): el manifest declara explícitamente la cobertura faltante y los pedidos al usuario. No se sintetizó ningún número; el resto del chart queda fuera del backfill hasta captura (fail-closed).
2. **G3 ejecutado según tasks.md**, sin desviación del diseño: la salida “sin path → backfill manual trazado + omisión documentada” era la prevista.
3. Sin otras desviaciones: D1–D4, scoring benchlm-clamp e `intelligenceIndex` inerte quedan intactos.

### Remaining tasks (exact unchecked lines)

Resumen: **33 unchecked** (todas Fases 1–4), **0 restantes en Fase 0**. Líneas exactas:

```
- [ ] **1.1** Escribir tests rojos en `tests/scrape-artificialanalysis.test.js`: (a) Intelligence finita del payload v2 llega **exacta** a `intelligenceIndex` (sin clamp ni normalización); (b) ausente/no finita → `null` + nota de omisión y el key NO se borra; (c) ningún número fabricado cuando el path falta. Evidencia: `pnpm vitest run tests/scrape-artificialanalysis.test.js` falla por el motivo esperado. <!-- sdd-owner: implementation -->
- [ ] **1.2** Escribir tests rojos de write-guard y versionado: (a) `availability` de un registro existente queda deep-equal tras el write real (`preserveManualModelFields`); (b) id nuevo sale con `{}`; (c) `_meta.schemaVersion` final es **5** y no 4; (d) `CACHE_KEY` sigue `sdd-models-v6` y `DATA_FILES` en 6. Archivos: `tests/scrape-artificialanalysis.test.js`, `tests/_scraper-utils.test.js`, `tests/data-loader.test.js`. Evidencia: rojo con mensajes nombrados. <!-- sdd-owner: implementation -->
- [ ] **1.3** Actualizar `tests/fixtures/aa-sample.json` con el path real del Intelligence Index: al menos **un caso finito y uno ausente/null**, `fetchedAt`/nota a la fecha real, sin Astra ni valores que la captura no traiga; el test no hace HTTP. Evidencia: fixture + test de fixture rojo. <!-- sdd-owner: implementation -->
- [ ] **1.4** Implementar en `scripts/scrape-artificialanalysis.js`: `FIELD_MAP` suma **una sola key** `evaluations.artificial_analysis_intelligence_index -> intelligenceIndex` (sin cadena de paths inferidos), `buildAaPatch` con contrato nullable propio (finito → número exacto; no finito → `null` + omisión; no borrar key nullable) y `SCHEMA_VERSION` / escritura en **5**. Evidencia: `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **1.5** Agregar casos de triangulación: valor `0` legítimo vs ausencia, string/NaN como no-finito, modelo nunca cubierto por AA (campo ausente, no `null`), dedupe de `sources[]` por `url+date+scraper` y aborto ante desaparición de ids. Evidencia: suite verde con los 4+ casos nuevos. <!-- sdd-owner: implementation -->
- [ ] **1.6** Dejar comentarios de ownership en el scraper: AA es dueño de `intelligenceIndex` y sus campos actuales; **nunca** escribe `benchlm`; `benchlm.score` del backfill es one-shot de curación y queda auditado por `sources[]`. Evidencia: re-green sin cambios de conducta. <!-- sdd-owner: implementation -->
- [ ] **1.7** Verificación de cierre de fase: `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js tests/_aa-safety.test.js tests/data-loader.test.js` verde y revisión del tamaño acumulado de PR-A (si >400 → **G2**). <!-- sdd-owner: implementation -->
- [ ] **2.1 RED** — Tests de catálogo en `tests/aa-effort.test.js` y `tests/data-integrity.test.js`: todo alias nuevo declara `effort` explícito (nunca inferido del slug); `intelligenceIndex` admite finito o `null`; cada número backfilleado tiene su `sources[]` AA fechado; `musespark13contributor` conserva `xhigh`; no hay duplicados DeepSeek/MiniMax. Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [ ] **2.2 GREEN** — Curar `data/aa-aliases.json` con los slugs confirmados (Astra, Spark y resto con evidencia), cada uno `{slug,to,effort}` + `lastUpdated`; ningún slug sin effort. Evidencia: `pnpm vitest run tests/aa-effort.test.js tests/_aa-safety.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **2.3 GREEN** — Backfill one-shot en `data/models.json`: `gpt6astra` con `benchlm.score: 53` + `intelligenceIndex: 53` (conservando subcampos BenchLM salvo evidencia explícita), `musespark13` (“Muse Spark 1.3 (max)”) 48 como entrada distinta y `benchmark-only`, Opus 51 y cada fila legible del chart; `sources[]` por número según el manifest de 0.5; omisiones enumeradas en `notes`. Evidencia: `pnpm vitest run tests/data-integrity.test.js` verde y manifest ↔ `sources[]` 1:1. <!-- sdd-owner: implementation -->
- [ ] **2.4** Reconciliar familias sin duplicar: DeepSeek 0813/V4.1 como alias **o** variante distinta (nunca ambos), `minimaxm3` verificado mismo/distinto antes de crear, Qwen3.8/Gemini 3.8 Flash/K2 Horizon/Inkling/Nemotron solo con evidencia (si no, quedan en notas de omisión). Evidencia: test de no-duplicados verde + listado de omisiones. <!-- sdd-owner: implementation -->
- [ ] **2.5** Materializar availability fail-closed: mapa completo de providers en `false` salvo `sourceOfTruth`, `lifecycle: "benchmark-only"` para las altas, correr `pnpm run propagate:availability`. Evidencia: `pnpm vitest run tests/availability-matrix.test.js tests/propagate-provider-availability.test.js` verde (matriz `families × providers` completa). <!-- sdd-owner: implementation -->
- [ ] **2.6** Caracterización del scorer en `tests/model-scorer.test.js`: dos modelos que solo difieren en `intelligenceIndex` producen igual `compositeScore` y mismo ganador; assert de ausencia de `intelligenceIndex` en el source del scorer. Sin cambios productivos en `js/services/model-scorer.js`. Evidencia: `pnpm vitest run tests/model-scorer.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **2.7 GATE** — Test del criterio Astra sobre el conjunto **real**: tras `applyProviderFilter` con `chatgpt-plus`, ordenar por `compositeScore` desc y afirmar que el máximo pertenece a Astra. Si 53 no es el máximo real: **no** bajar candidatos ni agregar branch especial; pausar en **G1**, degradar a Astra+Spark (D4-B) con follow-up y mantener el delta en 4 ADDED/6 MODIFIED/5 REMOVED. Evidencia: test verde **o** informe de gate fallido con follow-up creado. <!-- sdd-owner: implementation -->
- [ ] **2.8** Cierre de PR-A: `pnpm test` verde, `pnpm build` <30s con `dist/index.html` autocontenido, y medición de líneas cambiadas (si >400 → **G2** antes de abrir el PR). Rollback: revert del commit de datos + revalidar schema 5 y matriz. <!-- sdd-owner: implementation -->
- [ ] **3.1 RED** — `tests/effort-tag.test.js` (nuevo): vocabulario cerrado `max|xhigh|high|medium|low|non-reasoning`, labels rioplatenses existentes, escape HTML, y **cero badge** ante effort faltante o inválido (sin labels inventados). Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [ ] **3.2 GREEN** — Crear `js/components/effort-tag.js` con el renderer puro y el helper de vocabulario cerrado hasta que `pnpm vitest run tests/effort-tag.test.js` quede verde. <!-- sdd-owner: implementation -->
- [ ] **3.3 TRIANGULATE** — Casos límite del helper: string vacío, valor fuera de vocabulario, HTML hostil en el label y `softFallback: true` (sin badges). Evidencia: suite verde con los 4 casos. <!-- sdd-owner: implementation -->
- [ ] **3.4 REFACTOR** — Migrar el render de effort de ref-table, model-card, cli-mirror y justification al helper compartido sin cambiar labels ni atributos `data-effort`. Evidencia: `pnpm vitest run tests/effort-tag.test.js tests/ref-table.test.js tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.5** `js/components/ref-table.js`: eliminar `tierCell` + header/export `Tier`, conservar `Esfuerzo` y lifecycle, ajustar colspans y `exportRowsFrom` (header md `['Modelo','Esfuerzo',...]`). Evidencia: `pnpm vitest run tests/ref-table.test.js` verde con assert explícito de ausencia de `Tier`/`[data-tier]`. <!-- sdd-owner: implementation -->
- [ ] **3.6** `js/components/model-card.js`: eliminar `tierSlug/tierLabel` y `.model-tier-tag`/`data-tier`; dejar NEW + effort válido usando `effort-tag.js`. Evidencia: `pnpm vitest run tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.7** `js/components/cli-mirror-table.js`: eliminar helpers de tier/token color y `softBadge`/`.soft-badge`/`~`; normal = nombre + effort, fallback = **solo nombre**, 18 filas y `unassigned` intactos. Evidencia: `pnpm vitest run tests/cli-mirror-table.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.8** `js/components/justification-ui.js`: agregar tag effort en `assignmentHeader`, eliminar tier, `.soft-badge`, banner `.soft-summary`/`[data-test=soft-summary]` y columnas `Tier`/`Estado`; export md `Agente/Rol/Modelo/Esfuerzo/Score/Costo`; fallback sin badges y CTA enable-all intacto. Evidencia: `pnpm vitest run tests/justification-ui.test.js` verde (cubre `:249` tiers y `:278` banner). <!-- sdd-owner: implementation -->
- [ ] **3.9** `js/services/exporter.js`: `agentsMarkdown` sin `(tier · score · costo)` ni `_soft fallback_`; conservar header providers+timestamp, score, costo y flag full-catalog; JSON puede conservar `softFallback` como dato de máquina. Evidencia: `pnpm vitest run tests/exporter.test.js tests/export-button.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.10** `js/components/composite-chart.js`: barras con token neutral `--composite-score-fill` (fallback indigo); eliminar `tierOf`, `barColor`, `data-tier`, texto de tier en leyenda y columna `Tier` del export; conservar sort BenchLM, nulls-last y agrupación AA. Evidencia: `pnpm vitest run tests/composite-chart.test.js` verde con asserts de color neutral y ausencia de tier. <!-- sdd-owner: implementation -->
- [ ] **3.11** `css/tokens.css`: agregar `--composite-score-fill`; eliminar `--composite-tier-*`, `.model-tier-tag`, `.soft-badge`, `.soft-summary` **solo si quedan huérfanos**; conservar `.tier-tag`, sus shapes y `--pricing-tier-*` usados por workflow-table/pricing-chart. Evidencia: grep de referencias + `pnpm build` verde. <!-- sdd-owner: implementation -->
- [ ] **3.12** Actualizar los ~10 tests UI restantes (`tests/p2-polish.test.js`, `tests/v2-polish-final.test.js`, `tests/config-selector.test.js`, `tests/aa-effort.test.js`, `tests/data-integrity.test.js`, y los que aparezcan por grep de `tier`/`soft`/`~`): reemplazar asserts de tier/soft por asserts de ausencia, conservando las shapes de `.tier-tag` que workflow todavía usa. Evidencia: `pnpm test` verde completo. <!-- sdd-owner: implementation -->
- [ ] **4.1** `pnpm test` verde (suite completa) y `pnpm test:coverage` con scorer ≥80% y umbrales vigentes. Evidencia: salida de coverage. <!-- sdd-owner: implementation -->
- [ ] **4.2** `pnpm build` <30s con `dist/index.html` autocontenido. Evidencia: artefacto + tiempo. <!-- sdd-owner: implementation -->
- [ ] **4.3** Verificación de conteos vivos: cli-mirror 18 filas, 18 cards, workflow 9 filas, 5 botones de config, twin judge `jd-judge-a/b` mismo modelo, hero-stats `"X de Y visibles"`. Evidencia: suites `cli-mirror-table`, `justification-ui`, `config-selector`, `twin-judge`, `hero-stats`, `workflow-table` verdes. <!-- sdd-owner: implementation -->
- [ ] **4.4** Medir líneas cambiadas de PR-A y PR-B por separado; si alguno supera 400, aplicar **G2** (ask-on-risk) antes de mergear: recorte por evidencia o tercer eslabón, nunca `size:exception` inferido. Evidencia: `git diff --stat` por slice. <!-- sdd-owner: implementation -->
- [ ] **4.5** Entrega stacked-to-main: merge PR-A a main primero (verificando sources, matriz y resultado del filtro `chatgpt-plus`), luego rebase de PR-B sobre ese SHA verde y merge. Rollback: nunca cruzado — revert de PR-B restaura presentación, revert de PR-A restaura scraper/datos revalidando schema 5 + matriz. Evidencia: ambos PRs verdes e independientes. <!-- sdd-owner: implementation -->
- [ ] **4.6** Archive del change: mover a `openspec/changes/archive/` con prefijo ISO y mergear el delta al canónico `openspec/specs/model-picker/spec.md`, incorporando “Model Card (effort-only)” como anexo de model-picker y el `MODIFIED compositeScore`. Evidencia: spec canónico actualizado y delta archivado. <!-- sdd-owner: implementation -->
```

### Workload / PR boundary

- Fase 0 = solo change dir (delta spec, manifest, tasks, esta bitácora). Sus artefactos acompañan al change; no forman una PR propia.
- Delta spec ≈ +40 líneas netas; manifest 58 líneas; sin impacto en el budget 400 de los slices de código.
- Sin commits: se deja todo en working tree (pedido explícito del parent).

### Structured status consumed / produced

- Consumido: status nativo del change — `applyState: ready`, `nextRecommended: sdd-apply`, `artifactStore: openspec`, `actionContext.mode: repo-local`, `allowedEditRoots: [D:\Proyectos\sdd_agent_selector]`, sin `blockedReasons`, **sin warnings de actionContext**; `taskProgress` 0/38 al inicio. Alcance acotado por el parent a Fase 0 (0.1–0.5).
- Producido: 5 tareas persistidas como `[x]` en `tasks.md` (5/38); gates G3/G1/G2 documentados; este artefacto. Próximo recomendado: decisión del usuario sobre G3 (captura/payload o autorización de follow-up) antes de Fase 1, y captura del chart para cerrar G1 en 2.7.

---

## Slice Fase 1 — PR-A scraper + fixture + schema 5 (tareas 1.1–1.7, strict TDD)

Fecha del run: 2026-09-13 · Modo: auto · Runner: `pnpm test` / `pnpm vitest run` (vitest 1.6.1)

- **Implementation status: complete.** `intelligenceIndex` (`number|null`) mapeado desde el path live confirmado, contrato nullable propio en `buildAaPatch`, merge que no borra la key nullable, write-guard de `availability` ejercitado por el write real, `SCHEMA_VERSION = 5` y fixture regenerada desde captura live autenticada (646 items).
- **Delivery status: slice PR-A en working tree, sin commit (pedido del parent).** 4 archivos: scraper + 2 suites + fixture. Fase 2 (aliases/backfill/matriz) NO iniciada; `data/`, `js/`, `css/` intactos.
- **Gates:** **G3 CERRADO** por probe live (HTTP 200, 646/646 items con `evaluations.artificial_analysis_intelligence_index`). **G2 pendiente de Fase 2**: la Fase 1 sola mide **393 líneas cambiadas (<400)**, pero PR-A completo (Fase 2 backfill JSON) lo superará con alta probabilidad → ask-on-risk en 2.8/4.4, nunca `size:exception` inferido. **G1 sigue en riesgo** (ver riesgos; dato nuevo del probe).

### Completed tasks (persisted checkboxes `[x]` en `tasks.md`)

| Task | Summary | Persisted |
|------|---------|-----------|
| 1.1 | RED tests de `intelligenceIndex`: finito exacto (63.75, sin clamp), `0` legítimo, ausente/null → `null` + nota y key NO borrada, cero números fabricados | `[x]` |
| 1.2 | RED tests de write-guard/versionado: `availability` deep-equal tras el write real, id nuevo sale `{}`, schema final 5 (no 4) | `[x]` |
| 1.3 | Fixture regenerada desde captura live (2026-09-13T01:03:29.104Z, 646 items): 11 slices reales, 10 II finitos + `gpt-5-4-pro` con II real `null`; sin Astra; `fetchedAt`/nota reales; ningún valor inventado | `[x]` |
| 1.4 | GREEN: `FIELD_MAP` +1 key (al final de la tabla), `NULLABLE_FIELDS`, `SCHEMA_VERSION = 5`, merge sin `delete` para nullable, JSDoc del contrato | `[x]` |
| 1.5 | TRIANGULATE: `0` vs ausencia, string/null no-finito, >100 exacto (no clamp), modelo nunca cubierto sin key, dedupe `sources[]` preservando snapshots de otra fecha, aborto por desaparición de ids a nivel writer | `[x]` |
| 1.6 | REFACTOR: bloque de ownership en el scraper (AA dueño de FIELD_MAP + `blended`/`pricingSource`; **nunca** escribe `benchlm`; backfill one-shot auditado por `sources[]`) | `[x]` |
| 1.7 | Cierre: 4 suites verdes (84/84), `node --check` OK, scan de leak de key = `false`, medición del slice (393) | `[x]` |

### Files changed (slice scope only)

| Path | + | − | Total |
|------|---|---|-------|
| `scripts/scrape-artificialanalysis.js` | 55 | 7 | 62 |
| `tests/scrape-artificialanalysis.test.js` | 188 | 9 | 197 |
| `tests/fixtures/aa-sample.json` | 70 | 41 | 111 |
| `tests/_scraper-utils.test.js` | 23 | 0 | 23 |
| **Slice total (authored additions + deletions)** | **336** | **57** | **393** |

Los artefactos untracked de `openspec/changes/...` (tasks.md + este archivo) no se cuentan contra el budget, misma convención del run de Fase 0.

### Test commands run (evidence)

| Command | Result |
|---------|--------|
| `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js` (RED, pre-1.4) | **8 failed / 35 passed** — motivos esperados: `intelligenceIndex` undefined (5), schema 4≠5 (2), fixture 37.5 undefined (1) |
| `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js` (GREEN post-1.4) | **43/43 passed** |
| `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/_scraper-utils.test.js tests/_aa-safety.test.js tests/data-loader.test.js` (1.7) | **84/84 passed** (4 files) |
| `pnpm test` (smoke completo) | 41 files passed / 3 fallan al colectar (pre-existentes Node 24: `availability-matrix`, `data-integrity`, `propagate-provider-availability`); **573/573 tests colectados pasan** (+7 vs baseline 566) |
| `node --check scripts/scrape-artificialanalysis.js` | OK |
| Key-leak scan (`node` compara la key contra los 4 archivos) | `false` en los 4; la key nunca se imprimió ni se escribió en el repo |

### TDD Cycle Evidence (strict TDD activo)

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----|-------|-------------|----------|
| 1.1 | Tests nuevos fallan: `expected undefined to be 63.75` / `to be null` / `false to be true` (key borrada) | `FIELD_MAP` + `NULLABLE_FIELDS` + patch nullable → verde | `0` legítimo vs ausencia; string/null no-finito; >100 exacto | JSDoc del contrato nullable |
| 1.2 | `expected 4 to be 5` en 3 suites (el write-guard de `availability` ya estaba implementado: esas aserciones nacieron verdes como caracterización) | `SCHEMA_VERSION = 5` → verde | id nuevo `{}` verificado end-to-end; aborto de ids huérfanos al writer | Header/JSDoc del schema 5 |
| 1.3 | Fixture nueva + asserts → rojo `expected undefined to be 37.5` y speeds viejos | Fixture live + asserts actualizados → verde | Caso real `null` (`gpt-5-4-pro`) key presente + nota; sin Astra | Nota/fetchedAt documentados |
| 1.4 | (RED de 1.1/1.2 es el test que lo guía) | 43/43 verde con el campo mapeado | — | Ownership comments (1.6) |
| 1.5 | Dedupe/historial nace verde (comportamiento preexistente) — se reforzó con snapshot viejo + hoy deduplicado | Verde | 5 casos agregados (0/ausencia, string/null, no-cubierto, dedupe+historial, aborto writer) | — |
| 1.6 | — | — | — | Comentarios only → re-green 84/84 sin cambio de conducta |
| 1.7 | — | 4 suites verdes | `pnpm test` 573/573 colectados | — |

### Deviations from design / prior progress

1. **`tests/data-loader.test.js` no se tocó** (aunque tasks.md 1.2(d) lo nombra): las aserciones `CACHE_KEY === 'sdd-models-v6'` y `DATA_FILES.length === 6` ya existían y pasan; se re-corrieron como evidencia en vez de duplicarlas (el parent acotó las superficies de edición a scraper/fixture/suites del scraper).
2. **Fixture regenerada completa, no solo el campo II**: para no mezclar fechas se tomaron todos los slices de la misma captura live (dos valores de velocidad y `gpt-oss-120b` cambiaron respecto de la captura 2026-08-16 y sus asserts se actualizaron). Cero valores retenidos de la captura vieja.
3. **NaN no es transportable por JSON** (deviene `null`): la cobertura no-finita usa string y null; la rama es `Number.isFinite`, que rechaza NaN por construcción.
4. **`gpt54pro`** es un alias test-local (`writeAliases` del test), no de `data/aa-aliases.json`: sirve para ejercitar el caso real II=null sin tocar Fase 2.
5. **G3 cerrado sin desvío**: el path real se confirmó por probe live autenticado; el scraper tiene UNA sola key, sin cadena de paths inferidos.

### Remaining tasks (exact unchecked lines, 26 — Fases 2–4)

```
- [ ] **2.1 RED** — Tests de catálogo en `tests/aa-effort.test.js` y `tests/data-integrity.test.js`: todo alias nuevo declara `effort` explícito (nunca inferido del slug); `intelligenceIndex` admite finito o `null`; cada número backfilleado tiene su `sources[]` AA fechado; `musespark13contributor` conserva `xhigh`; no hay duplicados DeepSeek/MiniMax. Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [ ] **2.2 GREEN** — Curar `data/aa-aliases.json` con los slugs confirmados (Astra, Spark y resto con evidencia), cada uno `{slug,to,effort}` + `lastUpdated`; ningún slug sin effort. Evidencia: `pnpm vitest run tests/aa-effort.test.js tests/_aa-safety.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **2.3 GREEN** — Backfill one-shot en `data/models.json`: `gpt6astra` con `benchlm.score: 53` + `intelligenceIndex: 53` (conservando subcampos BenchLM salvo evidencia explícita), `musespark13` (“Muse Spark 1.3 (max)”) 48 como entrada distinta y `benchmark-only`, Opus 51 y cada fila legible del chart; `sources[]` por número según el manifest de 0.5; omisiones enumeradas en `notes`. Evidencia: `pnpm vitest run tests/data-integrity.test.js` verde y manifest ↔ `sources[]` 1:1. <!-- sdd-owner: implementation -->
- [ ] **2.4** Reconciliar familias sin duplicar: DeepSeek 0813/V4.1 como alias **o** variante distinta (nunca ambos), `minimaxm3` verificado mismo/distinto antes de crear, Qwen3.8/Gemini 3.8 Flash/K2 Horizon/Inkling/Nemotron solo con evidencia (si no, quedan en notas de omisión). Evidencia: test de no-duplicados verde + listado de omisiones. <!-- sdd-owner: implementation -->
- [ ] **2.5** Materializar availability fail-closed: mapa completo de providers en `false` salvo `sourceOfTruth`, `lifecycle: "benchmark-only"` para las altas, correr `pnpm run propagate:availability`. Evidencia: `pnpm vitest run tests/availability-matrix.test.js tests/propagate-provider-availability.test.js` verde (matriz `families × providers` completa). <!-- sdd-owner: implementation -->
- [ ] **2.6** Caracterización del scorer en `tests/model-scorer.test.js`: dos modelos que solo difieren en `intelligenceIndex` producen igual `compositeScore` y mismo ganador; assert de ausencia de `intelligenceIndex` en el source del scorer. Sin cambios productivos en `js/services/model-scorer.js`. Evidencia: `pnpm vitest run tests/model-scorer.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **2.7 GATE** — Test del criterio Astra sobre el conjunto **real**: tras `applyProviderFilter` con `chatgpt-plus`, ordenar por `compositeScore` desc y afirmar que el máximo pertenece a Astra. Si 53 no es el máximo real: **no** bajar candidatos ni agregar branch especial; pausar en **G1**, degradar a Astra+Spark (D4-B) con follow-up y mantener el delta en 4 ADDED/6 MODIFIED/5 REMOVED. Evidencia: test verde **o** informe de gate fallido con follow-up creado. <!-- sdd-owner: implementation -->
- [ ] **2.8** Cierre de PR-A: `pnpm test` verde, `pnpm build` <30s con `dist/index.html` autocontenido, y medición de líneas cambiadas (si >400 → **G2** antes de abrir el PR). Rollback: revert del commit de datos + revalidar schema 5 y matriz. <!-- sdd-owner: implementation -->
- [ ] **3.1 RED** — `tests/effort-tag.test.js` (nuevo): vocabulario cerrado `max|xhigh|high|medium|low|non-reasoning`, labels rioplatenses existentes, escape HTML, y **cero badge** ante effort faltante o inválido (sin labels inventados). Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [ ] **3.2 GREEN** — Crear `js/components/effort-tag.js` con el renderer puro y el helper de vocabulario cerrado hasta que `pnpm vitest run tests/effort-tag.test.js` quede verde. <!-- sdd-owner: implementation -->
- [ ] **3.3 TRIANGULATE** — Casos límite del helper: string vacío, valor fuera de vocabulario, HTML hostil en el label y `softFallback: true` (sin badges). Evidencia: suite verde con los 4 casos. <!-- sdd-owner: implementation -->
- [ ] **3.4 REFACTOR** — Migrar el render de effort de ref-table, model-card, cli-mirror y justification al helper compartido sin cambiar labels ni atributos `data-effort`. Evidencia: `pnpm vitest run tests/effort-tag.test.js tests/ref-table.test.js tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.5** `js/components/ref-table.js`: eliminar `tierCell` + header/export `Tier`, conservar `Esfuerzo` y lifecycle, ajustar colspans y `exportRowsFrom` (header md `['Modelo','Esfuerzo',...]`). Evidencia: `pnpm vitest run tests/ref-table.test.js` verde con assert explícito de ausencia de `Tier`/`[data-tier]`. <!-- sdd-owner: implementation -->
- [ ] **3.6** `js/components/model-card.js`: eliminar `tierSlug/tierLabel` y `.model-tier-tag`/`data-tier`; dejar NEW + effort válido usando `effort-tag.js`. Evidencia: `pnpm vitest run tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.7** `js/components/cli-mirror-table.js`: eliminar helpers de tier/token color y `softBadge`/`.soft-badge`/`~`; normal = nombre + effort, fallback = **solo nombre**, 18 filas y `unassigned` intactos. Evidencia: `pnpm vitest run tests/cli-mirror-table.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.8** `js/components/justification-ui.js`: agregar tag effort en `assignmentHeader`, eliminar tier, `.soft-badge`, banner `.soft-summary`/`[data-test=soft-summary]` y columnas `Tier`/`Estado`; export md `Agente/Rol/Modelo/Esfuerzo/Score/Costo`; fallback sin badges y CTA enable-all intacto. Evidencia: `pnpm vitest run tests/justification-ui.test.js` verde (cubre `:249` tiers y `:278` banner). <!-- sdd-owner: implementation -->
- [ ] **3.9** `js/services/exporter.js`: `agentsMarkdown` sin `(tier · score · costo)` ni `_soft fallback_`; conservar header providers+timestamp, score, costo y flag full-catalog; JSON puede conservar `softFallback` como dato de máquina. Evidencia: `pnpm vitest run tests/exporter.test.js tests/export-button.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.10** `js/components/composite-chart.js`: barras con token neutral `--composite-score-fill` (fallback indigo); eliminar `tierOf`, `barColor`, `data-tier`, texto de tier en leyenda y columna `Tier` del export; conservar sort BenchLM, nulls-last y agrupación AA. Evidencia: `pnpm vitest run tests/composite-chart.test.js` verde con asserts de color neutral y ausencia de tier. <!-- sdd-owner: implementation -->
- [ ] **3.11** `css/tokens.css`: agregar `--composite-score-fill`; eliminar `--composite-tier-*`, `.model-tier-tag`, `.soft-badge`, `.soft-summary` **solo si quedan huérfanos**; conservar `.tier-tag`, sus shapes y `--pricing-tier-*` usados por workflow-table/pricing-chart. Evidencia: grep de referencias + `pnpm build` verde. <!-- sdd-owner: implementation -->
- [ ] **3.12** Actualizar los ~10 tests UI restantes (`tests/p2-polish.test.js`, `tests/v2-polish-final.test.js`, `tests/config-selector.test.js`, `tests/aa-effort.test.js`, `tests/data-integrity.test.js`, y los que aparezcan por grep de `tier`/`soft`/`~`): reemplazar asserts de tier/soft por asserts de ausencia, conservando las shapes de `.tier-tag` que workflow todavía usa. Evidencia: `pnpm test` verde completo. <!-- sdd-owner: implementation -->
- [ ] **4.1** `pnpm test` verde (suite completa) y `pnpm test:coverage` con scorer ≥80% y umbrales vigentes. Evidencia: salida de coverage. <!-- sdd-owner: implementation -->
- [ ] **4.2** `pnpm build` <30s con `dist/index.html` autocontenido. Evidencia: artefacto + tiempo. <!-- sdd-owner: implementation -->
- [ ] **4.3** Verificación de conteos vivos: cli-mirror 18 filas, 18 cards, workflow 9 filas, 5 botones de config, twin judge `jd-judge-a/b` mismo modelo, hero-stats `"X de Y visibles"`. Evidencia: suites `cli-mirror-table`, `justification-ui`, `config-selector`, `twin-judge`, `hero-stats`, `workflow-table` verdes. <!-- sdd-owner: implementation -->
- [ ] **4.4** Medir líneas cambiadas de PR-A y PR-B por separado; si alguno supera 400, aplicar **G2** (ask-on-risk) antes de mergear: recorte por evidencia o tercer eslabón, nunca `size:exception` inferido. Evidencia: `git diff --stat` por slice. <!-- sdd-owner: implementation -->
- [ ] **4.5** Entrega stacked-to-main: merge PR-A a main primero (verificando sources, matriz y resultado del filtro `chatgpt-plus`), luego rebase de PR-B sobre ese SHA verde y merge. Rollback: nunca cruzado — revert de PR-B restaura presentación, revert de PR-A restaura scraper/datos revalidando schema 5 + matriz. Evidencia: ambos PRs verdes e independientes. <!-- sdd-owner: implementation -->
- [ ] **4.6** Archive del change: mover a `openspec/changes/archive/` con prefijo ISO y mergear el delta al canónico `openspec/specs/model-picker/spec.md`, incorporando “Model Card (effort-only)” como anexo de model-picker y el `MODIFIED compositeScore`. Evidencia: spec canónico actualizado y delta archivado. <!-- sdd-owner: implementation -->
```

### Risks / findings for next phases

1. **G1 — Astra vs máximo real (dato nuevo del probe live)**: `gpt-6-astra` (max) devolvió `II = 52.8` (no 53), con variantes high 51 / xhigh 52.5 / medium 49.7 / low 46. El manifest congela 53 por transcripción; en 2.3/2.7 hay que decidir con evidencia qué valor usar y verificar el máximo real del set `chatgpt-plus`. No toqué `data/` en esta fase.
2. **G2 — budget de PR-A**: Fase 1 = 393; el backfill de Fase 2 lo empuja por encima de 400 con alta probabilidad → ask-on-risk en 2.8/4.4.
3. **Node 24 local**: las 3 suites que no colectan (`availability-matrix`, `data-integrity`, `propagate-provider-availability`) siguen siendo pre-existentes (CI fija Node 20). `data-integrity` es la suite del backfill de Fase 2: validar también con `node --check`/import directo o Node 20 para no confundir el fallo de entorno con una regresión de datos.
4. **Semántica nullable documentada**: un run de AA sin `intelligenceIndex` pisa un valor finito previo con `null` (contrato literal del delta: ausente/no-finito → `null` + nota, key no borrada). Queda auditado en `notes`; si Fase 2 prefiere preservar el último valor finito, es un cambio de contrato a discutir explícitamente, no silencioso.

### Workload / PR boundary

- **Fase 1 sola: 393 líneas cambiadas authored (336 + 57) — bajo el umbral 400.** El slice es coherente (scraper + fixture + suites, tests con código) y revierte solo con los 4 archivos.
- **PR-A completo (Fases 1+2) proyecta >400** (forecast original 320–520). Al cerrar 2.8 hay que **medir y pausar en G2 (ask-on-risk)** si supera 400: recorte por evidencia o tercer eslabón; nunca `size:exception` tácito. Fase 2 puede empezar igual: el gate se resuelve en 2.8/4.4, no antes.
- Sin commits: working tree, pedido explícito del parent.

### Structured status consumed / produced

- **Consumido:** status nativo del change — `applyState: ready`, `nextRecommended: sdd-apply`, `artifactStore: openspec`, `actionContext.mode: repo-local`, `allowedEditRoots: [D:\Proyectos\sdd_agent_selector]`, sin `blockedReasons` ni warnings; `taskProgress` 5/38 al inicio. Alcance acotado por el parent a **Fase 1** (1.1–1.7); G3 declarado RESUELTO por probe live previo.
- **Producido:** 7 tareas persistidas `[x]` en `tasks.md` (12/38 total), re-verificadas por lectura del artefacto; G3 cerrado con evidencia live; G2/G1 con estado y disparadores documentados; este artefacto acumulativo. Próximo recomendado: **Fase 2 (2.1 RED)** — vigilar **G1 en 2.7** (ver riesgos) y **G2 en 2.8** antes de abrir PR-A.

---

## Slice Fase 2 — PR-A aliases + backfill trazado + matriz + gate G1 (tareas 2.1–2.8, strict TDD)

Fecha del run: 2026-09-13 · Modo: auto · Runner: `pnpm test` / `pnpm vitest run` (vitest 1.6.1)

- **Implementation status: complete.** Aliases AA nuevos con effort explícito, backfill one-shot trazado del chart 2026-09-13 (8 modelos) desde la captura live autenticada, `musespark13` fail-closed, reconciliaciones DeepSeek/MiniMax por alias, caracterización del scorer y **G1 CERRADO** con el máximo real del set `chatgpt-plus`.
- **Decisión 53 vs 52.8 (2.3):** entra el valor **exacto del payload live** (`fetchedAt 2026-09-13T01:11:12.045Z`, 646 items): Astra 52.8 / Opus 50.7 / Spark 48.2. El screenshot del chart es el rendering redondeado (53/51/48) de la misma observación; guardar 53 habría divergido de lo que la próxima sync AA escribe en `intelligenceIndex`. Se actualizaron los tres literales del delta spec (53→52.8, 48→48.2, 51→50.7) con nota de redondeo; el conteo 4 ADDED/6 MODIFIED/5 REMOVED queda intacto.
- **Delivery status: slice PR-A en working tree, sin commit (pedido del parent).** Ningún PR abierto; `scripts/`, `js/`, `css/` sin cambios de este slice (Fase 1 sigue en working tree).
- **Gates:** **G1 CERRADO** (test verde, ranking real abajo) · **G2 DISPARADO** (PR-A 873 líneas > 400; decisión ask-on-risk pendiente, ver abajo) · **G3 cerrado** en Fase 1.

### Completed tasks (persisted checkboxes `[x]` en `tasks.md`)

| Task | Summary | Persisted |
|------|---------|-----------|
| 2.1 RED | +7 tests: slugs nuevos curados, effort explícito, backfill exacto + `sources[]`, `intelligenceIndex` finite\|null, `musespark13` fail-closed con contributor `xhigh` intacto, no-duplicados DeepSeek/MiniMax, gate G1 real-max | `[x]` |
| 2.2 GREEN | `data/aa-aliases.json`: + `gpt-6-astra`→`gpt6astra` (max), `muse-spark-1-3`→`musespark13` (max); `_meta.lastUpdated` 2026-09-13; conteo 69→71 | `[x]` |
| 2.3 GREEN | Backfill one-shot de 8 modelos (Astra 52.8, Opus 50.7, Spark 48.2, Sol 47.1, Terra 42.3, gpt54 39, gpt55 38.6, Luna 37.5) con `sources[]` AA 2026-09-13; manifest reescrito con captura live, resolución 53/52.8 y omisiones §6 | `[x]` |
| 2.4 | DeepSeek: `deepseek-v4-pro` (0813) y `deepseek-v4-flash` (0731) ya son alias de los ids existentes; `deepseek-v4-1-flash` sin curar → omisión. MiniMax-M3 verificado mismo (`minimaxm3`), sin altas. Test de no-duplicados verde | `[x]` |
| 2.5 | `musespark13`: availability completa en `false`, `lifecycle: benchmark-only`; `pnpm run propagate:availability` → "up to date (88 records)"; matriz 0 celdas faltantes | `[x]` |
| 2.6 | Caracterización en `tests/model-scorer.test.js`: par que solo difiere en `intelligenceIndex` → igual score y winner; grep de fuente sin `intelligenceIndex`. Sin cambios productivos | `[x]` |
| 2.7 GATE | **G1 verde**: tras `applyProviderFilter(chatgpt-plus)` el máximo real computado en test time es Astra 52.8; sin branch de sort ni scorer tocado | `[x]` |
| 2.8 | `pnpm test` 583/583 colectados verdes; `pnpm build` 2.93s con `dist/index.html` autocontenido (124 KB, 0 externals); medición PR-A = 873 → **G2** reportado | `[x]` |

### Files changed (slice scope only — tracked; artifacts del change dir excluidos por convención)

| Path | + | − | Total |
|------|---|---|-------|
| `data/aa-aliases.json` | 5 | 3 | 8 |
| `data/models.json` | 91 | 21 | 112 |
| `tests/aa-effort.test.js` | 144 | 1 | 145 |
| `tests/data-integrity.test.js` | 129 | 1 | 130 |
| `tests/model-scorer.test.js` | 61 | 0 | 61 |
| `tests/composite-chart.test.js` | 7 | 4 | 11 |
| `tests/lifecycle.test.js` | 7 | 2 | 9 |
| `tests/_aa-safety.test.js` | 2 | 2 | 4 |
| **Fase 2 subtotal** | **446** | **34** | **480** |
| Fase 1 (recap del run anterior) | 336 | 57 | 393 |
| **PR-A total (Fases 1+2)** | **782** | **91** | **873** |

### Test commands run (evidence)

| Command | Result |
|---------|--------|
| `pnpm vitest run tests/aa-effort.test.js` (RED pre-2.2/2.3) | **6 failed / 9 passed** — motivos nombrados: slug sin curar, `gpt6astra.benchlm.score expected null to be 52.8`, coverage 0, `musespark13` ausente, `aaOwned 69 vs 71`, G1 `expected 'gpt56sol' to be 'gpt6astra'` |
| `pnpm vitest run tests/aa-effort.test.js tests/_aa-safety.test.js tests/model-scorer.test.js` (GREEN) | **92/92** (15 + 23 + 54) |
| `pnpm vitest run` de 10 suites data/UI tocadas por acoplamiento | **154/154** (composite-chart, lifecycle, ref-table, pricing-chart, justification-ui, twin-judge, config-selector, cli-mirror-table, workflow-table, hero-stats) |
| `pnpm test` | 44 files: 41 passed; 3 fallan al colectar (pre-existentes Node 24: availability-matrix, data-integrity, propagate-provider-availability); **583/583 tests colectados pasan** (+10 vs baseline 573) |
| Harness directo Node (réplica del bloque data-integrity) | **PASS**: 16 filas manifest ↔ 8 modelos 1:1, `intelligenceIndex` finite\|null, sin nombres AA duplicados, scorer sin `intelligenceIndex` |
| `node scripts/propagate-provider-availability.mjs --dry-run` + `pnpm run propagate:availability` | "up to date (88 records)" — sin escritura, serialización canónica verificada |
| Probe live de mapping (`mapAaSlug` sobre payload 2026-09-13T01:11:12.045Z) | Los 8 slugs mapean con effort correcto; II live == almacenado (52.8/50.7/48.2/47.1/42.3/39/38.6/37.5) |
| `AA_API_KEY=... node scripts/scrape-artificialanalysis.js --dry-run` | `{ok:true, changes:368}` (sync pendiente normal); los slugs nuevos resuelven; `missing` solo keys non-AA esperadas |
| `pnpm build` | rc=0 en **2.93s**; `dist/index.html` 124 KB, `externals: []` (autocontenido) |
| `npx esbuild tests/data-integrity.test.js --format=esm` | OK tras eliminar el import duplicado pre-existente |

### TDD Cycle Evidence (strict TDD activo)

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----|-------|-------------|----------|
| 2.1 | 7 tests nuevos → 6 rojos con motivos esperados (arriba) | — | — | — |
| 2.2 | (guiado por el RED de 2.1) | Aliases curados → alias tests verdes; `_aa-safety` 23/23 con conteo 71 | Conteo real re-verificado por lectura del JSON | — |
| 2.3 | Backfill rojo (`null`) | Backfill aplicado → 92/92 | Harness manifest 1:1 + G1 real-max + probe live de mapping | Serialización canónica vía `serializeModels` (propagate no-op) |
| 2.4 | RED de no-duplicados (aaOwned 69 vs 71) | Reconciliación por alias + omisiones enumeradas | Aliases DeepSeek/MiniMax confirmados contra payload live | — |
| 2.5 | Matriz/harness: 0 celdas faltantes | `musespark13` fail-closed + propagate up-to-date | Availability all-false + lifecycle benchmark-only ejercitados por el test de lifecycle | — |
| 2.6 | Caracterización nace verde (comportamiento existente, como el write-guard de Fase 1) | 3 tests verdes | Flip de `intelligenceIndex` no cambia el winner + grep de fuente | — |
| 2.7 | G1 rojo: `expected 'gpt56sol' to be 'gpt6astra'` | G1 verde: Astra 52.8 real max del set filtrado | Ranking real completo impreso en manifest §4 | — |
| 2.8 | Suite roja por 2 data-coupled (composite-chart, lifecycle) | Fixes mínimos → 583/583; build verde | Medición por slice (393/480/873) | — |

### Deviations from design / prior progress

1. **53 → 52.8 (+48.2/50.7):** decisión de evidencia pedida en 2.3; el payload live exacto manda sobre el redondeo del screenshot. Delta spec actualizado en los tres literales; manifest §1 documenta la resolución. Sin cambios de conteo del delta.
2. **Competidores chatgpt-plus backfilleados (Sol/Terra/Luna/gpt54/gpt55):** es la precondición explícita de D1/D2-B ("catálogo completo tras el backfill AA trazado del mismo snapshot"). Cada bajada tiene su fila de manifest y su `sources[]`; no se tocó scorer, sort ni elegibilidad, y no se bajó ningún candidato sin evidencia.
3. **Superficies de test fuera de la lista del parent, tocadas solo por acoplamiento directo a los datos:** `tests/composite-chart.test.js` (3 asserts de score real 82.0/72.6/67.2 → 47.1/42.3/37.5), `tests/lifecycle.test.js` (`benchmark-only` pasa de "sin miembros" a "solo `musespark13` fail-closed"), `tests/_aa-safety.test.js` (conteo 69→71 exigido por 2.2), `tests/model-scorer.test.js` (2.6 lo nombra explícitamente). `availability-matrix` y `propagate-provider-availability` no requirieron cambios.
4. **`tests/data-integrity.test.js`**: además del bloque nuevo se eliminó un **import duplicado pre-existente** (`CURRENT_SCHEMA_VERSION`, dos declaraciones) que rompía el parseo de esbuild; fix de una línea, sin cambio de conducta.
5. **`musespark13` sin cacheRead/cacheWrite/term/codingIndex:** opcionales ausentes (nunca sintetizados); la sync AA los completa cuando correspondan. La matriz se materializó con el serializer del repo.
6. **G1 no necesitó la rama de degradación:** con la captura live, Astra 52.8 es el máximo real; la opción D4-B (Astra+Spark con follow-up) quedó sin ejecutar.

### G1 — evidencia y resultado

Test: `tests/aa-effort.test.js` → "G1 — Astra is the real maximum of the chatgpt-plus eligible set (scorer intact)". Ranking real tras `applyProviderFilter(chatgpt-plus)` ordenado por `compositeScore` desc: **gpt6astra 52.8** → gpt56sol 47.1 → gpt56terra 42.3 → gpt54 39 → gpt55 38.6 → gpt56luna 37.5 → variantes null (nulls-last). `compositeScore` intacto (grep sin `intelligenceIndex` + pair characterization de 2.6).

### G2 — medición y recomendación (ask-on-risk, decisión pendiente)

- **Medición:** Fase 1 = 393 (bajo 400) · Fase 2 sola = 480 (**sobre 400**) · **PR-A total = 873** (782 add + 91 del, solo archivos trackeados del slice).
- **Recorte por evidencia ya aplicado una vez:** el one-shot se acotó a las filas necesarias para G1 + las 3 filas del manifest; newcomers y variantes quedaron enumerados como omisiones (manifest §6). Nada se borró ni comprimió para bajar el número.
- **Opciones honestas para la decisión:** (a) **tercer eslabón stacked-to-main**: A1 scraper/fixture/schema (393) → A2a aliases + backfill + catálogo core (~302) → A2b manifest 1:1 + caracterización + fixes data-coupled (~178); (b) PR-A único con `size:exception` **explícito del humano**. Nunca inferido.
- **Estado:** sin PR abierto (sin commits), por lo que G2 no bloquea nada todavía; se resuelve antes de abrir PR-A.

### Remaining tasks (exact unchecked lines, Fases 3–4)

```
- [ ] **3.1 RED** — `tests/effort-tag.test.js` (nuevo): vocabulario cerrado `max|xhigh|high|medium|low|non-reasoning`, labels rioplatenses existentes, escape HTML, y **cero badge** ante effort faltante o inválido (sin labels inventados). Evidencia: rojo esperado. <!-- sdd-owner: implementation -->
- [ ] **3.2 GREEN** — Crear `js/components/effort-tag.js` con el renderer puro y el helper de vocabulario cerrado hasta que `pnpm vitest run tests/effort-tag.test.js` quede verde. <!-- sdd-owner: implementation -->
- [ ] **3.3 TRIANGULATE** — Casos límite del helper: string vacío, valor fuera de vocabulario, HTML hostil en el label y `softFallback: true` (sin badges). Evidencia: suite verde con los 4 casos. <!-- sdd-owner: implementation -->
- [ ] **3.4 REFACTOR** — Migrar el render de effort de ref-table, model-card, cli-mirror y justification al helper compartido sin cambiar labels ni atributos `data-effort`. Evidencia: `pnpm vitest run tests/effort-tag.test.js tests/ref-table.test.js tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.5** `js/components/ref-table.js`: eliminar `tierCell` + header/export `Tier`, conservar `Esfuerzo` y lifecycle, ajustar colspans y `exportRowsFrom` (header md `['Modelo','Esfuerzo',...]`). Evidencia: `pnpm vitest run tests/ref-table.test.js` verde con assert explícito de ausencia de `Tier`/`[data-tier]`. <!-- sdd-owner: implementation -->
- [ ] **3.6** `js/components/model-card.js`: eliminar `tierSlug/tierLabel` y `.model-tier-tag`/`data-tier`; dejar NEW + effort válido usando `effort-tag.js`. Evidencia: `pnpm vitest run tests/model-card.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.7** `js/components/cli-mirror-table.js`: eliminar helpers de tier/token color y `softBadge`/`.soft-badge`/`~`; normal = nombre + effort, fallback = **solo nombre**, 18 filas y `unassigned` intactos. Evidencia: `pnpm vitest run tests/cli-mirror-table.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.8** `js/components/justification-ui.js`: agregar tag effort en `assignmentHeader`, eliminar tier, `.soft-badge`, banner `.soft-summary`/`[data-test=soft-summary]` y columnas `Tier`/`Estado`; export md `Agente/Rol/Modelo/Esfuerzo/Score/Costo`; fallback sin badges y CTA enable-all intacto. Evidencia: `pnpm vitest run tests/justification-ui.test.js` verde (cubre `:249` tiers y `:278` banner). <!-- sdd-owner: implementation -->
- [ ] **3.9** `js/services/exporter.js`: `agentsMarkdown` sin `(tier · score · costo)` ni `_soft fallback_`; conservar header providers+timestamp, score, costo y flag full-catalog; JSON puede conservar `softFallback` como dato de máquina. Evidencia: `pnpm vitest run tests/exporter.test.js tests/export-button.test.js` verde. <!-- sdd-owner: implementation -->
- [ ] **3.10** `js/components/composite-chart.js`: barras con token neutral `--composite-score-fill` (fallback indigo); eliminar `tierOf`, `barColor`, `data-tier`, texto de tier en leyenda y columna `Tier` del export; conservar sort BenchLM, nulls-last y agrupación AA. Evidencia: `pnpm vitest run tests/composite-chart.test.js` verde con asserts de color neutral y ausencia de tier. <!-- sdd-owner: implementation -->
- [ ] **3.11** `css/tokens.css`: agregar `--composite-score-fill`; eliminar `--composite-tier-*`, `.model-tier-tag`, `.soft-badge`, `.soft-summary` **solo si quedan huérfanos**; conservar `.tier-tag`, sus shapes y `--pricing-tier-*` usados por workflow-table/pricing-chart. Evidencia: grep de referencias + `pnpm build` verde. <!-- sdd-owner: implementation -->
- [ ] **3.12** Actualizar los ~10 tests UI restantes (`tests/p2-polish.test.js`, `tests/v2-polish-final.test.js`, `tests/config-selector.test.js`, `tests/aa-effort.test.js`, `tests/data-integrity.test.js`, y los que aparezcan por grep de `tier`/`soft`/`~`): reemplazar asserts de tier/soft por asserts de ausencia, conservando las shapes de `.tier-tag` que workflow todavía usa. Evidencia: `pnpm test` verde completo. <!-- sdd-owner: implementation -->
- [ ] **4.1** `pnpm test` verde (suite completa) y `pnpm test:coverage` con scorer ≥80% y umbrales vigentes. Evidencia: salida de coverage. <!-- sdd-owner: implementation -->
- [ ] **4.2** `pnpm build` <30s con `dist/index.html` autocontenido. Evidencia: artefacto + tiempo. <!-- sdd-owner: implementation -->
- [ ] **4.3** Verificación de conteos vivos: cli-mirror 18 filas, 18 cards, workflow 9 filas, 5 botones de config, twin judge `jd-judge-a/b` mismo modelo, hero-stats `"X de Y visibles"`. Evidencia: suites `cli-mirror-table`, `justification-ui`, `config-selector`, `twin-judge`, `hero-stats`, `workflow-table` verdes. <!-- sdd-owner: implementation -->
- [ ] **4.4** Medir líneas cambiadas de PR-A y PR-B por separado; si alguno supera 400, aplicar **G2** (ask-on-risk) antes de mergear: recorte por evidencia o tercer eslabón, nunca `size:exception` inferido. Evidencia: `git diff --stat` por slice. <!-- sdd-owner: implementation -->
- [ ] **4.5** Entrega stacked-to-main: merge PR-A a main primero (verificando sources, matriz y resultado del filtro `chatgpt-plus`), luego rebase de PR-B sobre ese SHA verde y merge. Rollback: nunca cruzado — revert de PR-B restaura presentación, revert de PR-A restaura scraper/datos revalidando schema 5 + matriz. Evidencia: ambos PRs verdes e independientes. <!-- sdd-owner: implementation -->
- [ ] **4.6** Archive del change: mover a `openspec/changes/archive/` con prefijo ISO y mergear el delta al canónico `openspec/specs/model-picker/spec.md`, incorporando “Model Card (effort-only)” como anexo de model-picker y el `MODIFIED compositeScore`. Evidencia: spec canónico actualizado y delta archivado. <!-- sdd-owner: implementation -->
```

### Workload / PR boundary

- Fase 2 = 480 líneas authored en 8 archivos trackeados; PR-A completo = 873. Sin commits (working tree). Artefactos del change dir (manifest, delta spec, tasks, esta bitácora) son planning untracked y no se cuentan.
- Rollback del slice: revert de `data/aa-aliases.json` + `data/models.json` + los tests data-coupled, revalidar schema 5 (sigue 5), correr `pnpm run propagate:availability` y las suites del slice. No hay revert cruzado con Fase 1 (scraper) ni con Fase 3 (UI).

### Structured status consumed / produced

- **Consumido:** status nativo del change — `applyState: ready`, `nextRecommended: sdd-apply`, 12/38, `artifactStore: openspec`, `actionContext.mode: repo-local`, `allowedEditRoots: [D:\Proyectos\sdd_agent_selector]`, sin `blockedReasons` ni warnings; alcance acotado por el parent a Fase 2.
- **Producido:** 8 tareas persistidas `[x]` en `tasks.md` (20/38 total, re-verificado por lectura); manifest actualizado con captura live; G1 cerrado con evidencia; G2 medido y escalado como decisión ask-on-risk. Próximo recomendado: resolver G2 (tercer eslabón vs size:exception explícito) al abrir PR-A y arrancar Fase 3 (strict TDD UI) en el working tree.

---

## Slice Fase 3 — PR-B effort-only + composite-chart neutral (tareas 3.1–3.12, strict TDD)

Fecha del run: 2026-09-13 · Modo: auto · Runner: `pnpm test` / `pnpm vitest run` (vitest 1.6.1)

- **Implementation status: complete.** Helper compartido `js/components/effort-tag.js` (vocabulario cerrado, labels rioplatenses, escape, cero badge ante faltante/inválido y `softFallback`), migración de las 4 superficies, `Tier` eliminado de ref-table, model-card/cli-mirror/justification effort-only, exporter sin tier/soft, composite-chart con color neutral y tokens.css sin reglas huérfanas.
- **Delivery status: slice PR-B en working tree, sin commit (pedido del parent).** 17 archivos: 7 productivos/CSS + 2 nuevos (helper + su suite) + 8 suites actualizadas. No se tocaron `scripts/`, `data/`, scorer, provider filter ni assignment logic (verificado por grep + suites).
- **Gates:** **G2 DISPARADO para PR-B**: 1075 líneas authored (1064 atribuibles tras descontar 11 de Fase 2 en `composite-chart.test.js`) → >400. Decisión **ask-on-risk** pendiente antes de abrir el PR (tercer/cuarto eslabón o recorte por evidencia); nunca `size:exception` inferido. **G1/G3** cerrados en fases previas.

### Completed tasks (persisted checkboxes `[x]` en `tasks.md`)

| Task | Summary | Persisted |
|------|---------|-----------|
| 3.1 RED | `tests/effort-tag.test.js` nuevo: vocabulario cerrado, labels, escape, cero badge; rojo por `Failed to resolve import` | `[x]` |
| 3.2 GREEN | `js/components/effort-tag.js`: `EFFORT_VOCABULARY`/`EFFORT_LABELS`/`isEffort`/`effortLabel`/`effortTagHtml` puros | `[x]` |
| 3.3 TRIANGULATE | 4 casos límite: string vacío, valor fuera de vocabulario, HTML hostil, `softFallback: true` sin badge | `[x]` |
| 3.4 REFACTOR | ref-table y model-card migran su render de effort al helper sin cambiar labels ni `data-effort`; cli-mirror/justification consumen el helper en sus reescrituras 3.7/3.8 | `[x]` |
| 3.5 | ref-table sin `tierCell`/header/export `Tier`; colspans 9→8; header md `Modelo,Esfuerzo,Lifecycle,Score,Input $,Output $` | `[x]` |
| 3.6 | model-card sin `tierSlug`/`tierLabel`/`.model-tier-tag`/`data-tier`; NEW + effort válido vía helper | `[x]` |
| 3.7 | cli-mirror sin helpers tier/token/`softBadge`/`.soft-badge`/`~`; normal = nombre+effort, fallback = solo nombre; 18 filas y `unassigned` intactos | `[x]` |
| 3.8 | justification: effort en `assignmentHeader`, sin tier/`.soft-badge`/banner `.soft-summary`/columnas `Tier`/`Estado`; export md `Agente/Rol/Modelo/Esfuerzo/Score/Costo`; fallback sin badges; se eliminó el link `switch-balanced` y su import de `config-selector` | `[x]` |
| 3.9 | exporter `agentsMarkdown` sin `(tier · …)` ni `_soft fallback_`; header providers+timestamp, score y costo intactos; JSON conserva `softFallback` | `[x]` |
| 3.10 | composite-chart con `--composite-score-fill` (fallback indigo), sin `tierOf`/`barColor`/`data-tier`/leyenda de tier/columna `Tier`; sort BenchLM, nulls-last y agrupación AA intactos | `[x]` |
| 3.11 | tokens.css: +`--composite-score-fill`; −`--composite-tier-*`, `.model-tier-tag`, `.soft-badge`, `.soft-summary` (huérfanos verificados); `.tier-tag`+shapes y `--pricing-tier-*`/`--tag-*` conservados (workflow-table/pricing-chart) | `[x]` |
| 3.12 | p2-polish y v2-polish-final pasan de asserts de presencia a ausencia (model-tier-tag/soft); `pnpm test` completo sin regresiones nuevas | `[x]` |

### Files changed (slice scope only)

| Path | + | − | Total |
|------|---|---|-------|
| `js/components/effort-tag.js` (nuevo) | 81 | 0 | 81 |
| `js/components/ref-table.js` | 14 | 25 | 39 |
| `js/components/model-card.js` | 7 | 39 | 46 |
| `js/components/cli-mirror-table.js` | 11 | 97 | 108 |
| `js/components/justification-ui.js` | 20 | 92 | 112 |
| `js/components/composite-chart.js` | 22 | 46 | 68 |
| `js/services/exporter.js` | 7 | 5 | 12 |
| `css/tokens.css` | 16 | 60 | 76 |
| **Producción + CSS subtotal** | **178** | **364** | **542** |
| `tests/effort-tag.test.js` (nuevo) | 117 | 0 | 117 |
| `tests/ref-table.test.js` | 66 | 8 | 74 |
| `tests/model-card.test.js` | 29 | 7 | 36 |
| `tests/cli-mirror-table.test.js` | 20 | 12 | 32 |
| `tests/justification-ui.test.js` | 72 | 93 | 165 |
| `tests/exporter.test.js` | 11 | 2 | 13 |
| `tests/composite-chart.test.js` | 63 | 4 | 67 (56 atribuibles a PR-B; 11 son de Fase 2) |
| `tests/p2-polish.test.js` | 12 | 5 | 17 |
| `tests/v2-polish-final.test.js` | 6 | 6 | 12 |
| **Tests subtotal (atribuible a PR-B)** | — | — | **522** |
| **PR-B total (authored, atribuible)** | — | — | **≈1064** (working tree 1075) |

Los artefactos del change dir (tasks.md + esta bitácora) no se cuentan contra el budget, misma convención de las fases previas.

### Test commands run (evidence)

| Command | Result |
|---------|--------|
| `pnpm vitest run tests/effort-tag.test.js` (RED 3.1) | Falla al colectar: `Failed to resolve import "../js/components/effort-tag.js"` |
| `pnpm vitest run tests/effort-tag.test.js` (GREEN 3.2/3.3) | **16/16** |
| `pnpm vitest run tests/effort-tag.test.js tests/ref-table.test.js tests/model-card.test.js` (3.4) | **62/62** |
| `pnpm vitest run tests/ref-table.test.js` (RED 3.5) | **2 failed**: `ths.length` 9≠8; export md con header `Tier` |
| `pnpm vitest run tests/ref-table.test.js` (GREEN) | **30/30** |
| `pnpm vitest run tests/model-card.test.js` (RED 3.6) | **3 failed**: `.model-tier-tag` presente, `data-tier=` presente, `/reference/` presente |
| `pnpm vitest run tests/model-card.test.js tests/effort-tag.test.js` (GREEN) | **36/36** |
| `pnpm vitest run tests/cli-mirror-table.test.js` (RED 3.7) | **2 failed**: `.tier-tag` presente, `.soft-badge` presente |
| `pnpm vitest run tests/cli-mirror-table.test.js` (GREEN) | **8/8** |
| `pnpm vitest run tests/justification-ui.test.js` (RED 3.8) | **4 failed**: texto soft, `data-tier`, banner `soft-summary`, header de export |
| `pnpm vitest run tests/justification-ui.test.js` (GREEN) | **13/13** |
| `pnpm vitest run tests/exporter.test.js` (RED 3.9) | **2 failed**: falta `(score · cost)` y persiste `soft fallback` |
| `pnpm vitest run tests/exporter.test.js tests/export-button.test.js` (GREEN) | **43/43** |
| `pnpm vitest run tests/composite-chart.test.js` (RED 3.10) | **3 failed**: `data-tier` 3≠0, falta token `--composite-score-fill`, export con `Tier` |
| `pnpm vitest run tests/composite-chart.test.js` (GREEN) | **21/21** |
| `pnpm vitest run tests/p2-polish.test.js tests/v2-polish-final.test.js` (RED 3.11) | **3 failed**: reglas `.model-tier-tag`, falta `--composite-score-fill`, `.soft-badge` presente |
| `pnpm vitest run tests/p2-polish.test.js tests/v2-polish-final.test.js` (GREEN) + grep huérfanos | **49/49** + “CSS: sin huérfanos” |
| 10 suites PR-B en conjunto (cierre 3.12) | **200/200** |
| `pnpm test` (cierre 3.12) | 45 files: **42 passed**; 3 fallan al colectar (pre-existentes Node 24: `availability-matrix`, `data-integrity`, `propagate-provider-availability`); **607/607 tests colectados pasan** (+24 vs baseline 583) |
| `pnpm build` | rc=0 en **1.58s**; `dist/index.html` **122.911 bytes**, 0 referencias `http` externas (autocontenido) |
| Grep de restos prohibidos en superficies PR-B + tokens.css | Solo quedan el comentario docs de justification y las reglas `.tier-tag[data-tier=…]` retenidas para workflow-table |

### TDD Cycle Evidence (strict TDD activo)

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----|-------|-------------|----------|
| 3.1/3.2/3.3 | Suite nueva no colecta (módulo inexistente) | 16/16 con el helper | 4 casos límite + pureza + vocabulario frozen | JSDoc del contrato |
| 3.4 | (contrato fijado por `effort-tag.test.js`) | ref-table+model-card migrados; 62/62 | Hostile HTML/empty/out-of-vocab ya cubiertos por el helper | Migración sin cambio de labels/atributos |
| 3.5 | 2 rojos nombrados (header count, export Tier) | 30/30 | Ausencia explícita de `[data-tier]`/`.tier-tag`/`.model-tier-tag` + export sin Tier + effort inválido → `—` | Header/comentarios del módulo |
| 3.6 | 3 rojos nombrados | 20/20 | Scenario spec “card shows effort and nothing else” + reference sin label | Comentarios del módulo |
| 3.7 | 2 rojos nombrados | 8/8 | Fallback = nombre solo; normal sin tier/soft; 18 filas y `unassigned` intactos | — |
| 3.8 | 4 rojos nombrados | 13/13 | Escenario 18 cards sin tier/soft + fallback sin badges + export sin `Tier`/`Estado` | — |
| 3.9 | 2 rojos nombrados | 43/43 | Shape `**Name** (score · cost)` + fallback sin marcador | JSDoc del formato |
| 3.10 | 3 rojos nombrados | 21/21 | Fuente sin `tierOf`/`data-tier`/`--composite-tier-`; barras single-fill; export sin Tier | Comentarios del módulo |
| 3.11 | 3 rojos nombrados | 49/49 | `.tier-tag` shapes 4 retenidas; `--pricing-tier-*` intacto; grep huérfanos vacío | Comentarios del CSS |
| 3.12 | (barrido) | `pnpm test` 607/607 colectados + build 1.58s | — | — |

### Deviations from design / prior progress

1. **3.4 acotado a ref-table + model-card**: cli-mirror y justification adoptan el helper directamente al reescribirse (3.7/3.8); no hubo un paso intermedio de solo-migración para esas dos. Mismo contrato final; el helper es la única fuente de las labels (verificado por suites).
2. **justification softFallback**: se conserva el atributo machine-readable `data-soft-fallback="true"` + borde ámbar (estado), pero se eliminó el `.soft-badge`, el párrafo con el `reason` y el tag effort del fallback. Los headers del export pasaron a `Agente/Rol/…` siguiendo el texto de 3.8.
3. **`index.html` intacto (fuera de scope)**: el glossary sigue mencionando `tier` y “soft fallback” y el test de p2-polish lo verifica; es texto educativo, no badge. Si Fase 4 quiere limpiar el término, hay que ampliar la superficie a `index.html`; se deja como observación, no como tarea.
4. **tokens.css retiene `.tier-tag`+shapes, `--tag-*` y `--pricing-tier-*`** porque workflow-table y pricing-chart todavía los consumen (non-goal explícito); solo se removieron las reglas sin consumidores tras el grep de huérfanos.
5. **`tests/composite-chart.test.js`** ya tenía 11 líneas de Fase 2; la medición PR-B descuenta esas 11 (56 atribuibles de 67 en working tree).
6. **Sin commits** (pedido del parent); todo queda en working tree para que el parent/4.5 maneje la entrega.

### G2 — medición y opciones para PR-B (ask-on-risk, decisión pendiente)

- **Medición:** PR-B completo = **1075 líneas authored** (542 producción+CSS / 533 tests), **1064 atribuibles** descontando Fase 2. Supera el umbral 400 → G2 disparado.
- **Opciones honestas:** (a) **cadena adicional dentro de PR-B** con eslabones <400: B1 helper+ref-table+model-card ≈393 · B2 cli-mirror+exporter ≈165 · B3 justification ≈302 · B4 chart+tokens+p2/v2-polish ≈229; (b) PR-B único con `size:exception` **explícito del humano**. Nunca inferido.
- **Estado:** sin PR abierto (sin commits); nada bloquea todavía. Se resuelve antes de abrir PR-B.

### Remaining tasks (exact unchecked lines — solo Fase 4, fuera del alcance de este slice)

```
- [ ] **4.1** `pnpm test` verde (suite completa) y `pnpm test:coverage` con scorer ≥80% y umbrales vigentes. Evidencia: salida de coverage. <!-- sdd-owner: implementation -->
- [ ] **4.2** `pnpm build` <30s con `dist/index.html` autocontenido. Evidencia: artefacto + tiempo. <!-- sdd-owner: implementation -->
- [ ] **4.3** Verificación de conteos vivos: cli-mirror 18 filas, 18 cards, workflow 9 filas, 5 botones de config, twin judge `jd-judge-a/b` mismo modelo, hero-stats `"X de Y visibles"`. Evidencia: suites `cli-mirror-table`, `justification-ui`, `config-selector`, `twin-judge`, `hero-stats`, `workflow-table` verdes. <!-- sdd-owner: implementation -->
- [ ] **4.4** Medir líneas cambiadas de PR-A y PR-B por separado; si alguno supera 400, aplicar **G2** (ask-on-risk) antes de mergear: recorte por evidencia o tercer eslabón, nunca `size:exception` inferido. Evidencia: `git diff --stat` por slice. <!-- sdd-owner: implementation -->
- [ ] **4.5** Entrega stacked-to-main: merge PR-A a main primero (verificando sources, matriz y resultado del filtro `chatgpt-plus`), luego rebase de PR-B sobre ese SHA verde y merge. Rollback: nunca cruzado — revert de PR-B restaura presentación, revert de PR-A restaura scraper/datos revalidando schema 5 + matriz. Evidencia: ambos PRs verdes e independientes. <!-- sdd-owner: implementation -->
- [ ] **4.6** Archive del change: mover a `openspec/changes/archive/` con prefijo ISO y mergear el delta al canónico `openspec/specs/model-picker/spec.md`, incorporando “Model Card (effort-only)” como anexo de model-picker y el `MODIFIED compositeScore`. Evidencia: spec canónico actualizado y delta archivado. <!-- sdd-owner: implementation -->
```

### Workload / PR boundary

- PR-B = 17 archivos (7 productivos/CSS + 2 nuevos + 8 suites). Rollback: revert de esos archivos restaura únicamente presentación; no toca datos, scraper, scorer, provider filter ni assignment logic (PR-A queda intacto).
- El slice quedó en working tree sin commits; la decisión G2 (eslaborar o excepción explícita) es del humano vía ask-on-risk.

### Structured status consumed / produced

- **Consumido:** status nativo del change — `applyState: ready`, `nextRecommended: sdd-apply`, `taskProgress` 20/38, `artifactStore: openspec`, `actionContext.mode: repo-local`, `allowedEditRoots: [D:\Proyectos\sdd_agent_selector]`, sin `blockedReasons` ni warnings. Inputs leídos del change dir: `tasks.md` (Fase 3), `design.md` (D4 helper, D3 chart neutral, huérfanos vs compartidos), `specs/model-picker/spec.md` (delta) y `apply-progress.md` (Fases 0–2). `skill_resolution: paths-injected` (`chained-pr`, `work-unit-commits`).
- **Producido:** 12 tareas persistidas `[x]` en `tasks.md` (32/38 total; 0 unchecked en Fase 3, 6 unchecked de Fase 4, re-verificado por lectura); G2 medido/escalado para PR-B; este artefacto acumulativo. Próximo recomendado: **gate G2 para PR-B** (ask-on-risk) y luego **Fase 4** (4.1–4.6) — o pausar en el gate si el parent prefiere decidir antes.

## Slice Fase 4 — Verificación (2026-09-13, parent inline)

- `sdd-verify` (read-only): veredicto `needs-fixes` solo por `pnpm test` exit 1 nominal — 3 suites no colectan bajo Node 24.20.0 + vitest 1.6.1 (`availability-matrix`, `data-integrity`, `propagate-provider-availability`, `SyntaxError` en `node:vm` apuntando a backticks en comentarios). Cobertura spec: 15 reqs / 44 escenarios mapeados a suites verdes; G1/G3 cerrados; strictly TDD OK; leak scan limpio; out-of-scope intacto.
- Prueba de pre-existencia (parent): `git show HEAD:tests/data-integrity.test.js` corrido como suite temporal falla IDÉNTICO → el fallo es ambiental (toolchain), no del change. `availability-matrix` y `propagate` no fueron tocados por el change (fuera de `git diff --name-only`) y fallan igual. `node --check` y esbuild parsean los archivos sin error.
- Decisión: NO se tocan comentarios de tests para conformar un toolchain local (divergería del CI); la autoridad para esas 3 suites es el CI (Node 20). Evidencia local sustituta ya registrada en Fase 2: harness directo manifest↔sources 1:1 PASS + matriz 0 celdas faltantes + propagate "up to date".
- Foco verificado por parent: scraper 4 suites 84/84, aa-effort+scorer 69/69 (G1), effort-tag+composite-chart 37/37, `pnpm build` OK (dist/index.html autocontenido).
- Resta (requiere orden explícita del humano): commits por eslabón + 7 PRs stacked-to-main (A1→A2a→A2b→B1→B2→B3→B4), sync, archive. 4.1-4.6 quedan unchecked hasta CI verde + entrega.
