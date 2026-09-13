# Design — 2026-09-13-aa-intelligence-refresh

Fecha: 2026-09-13 · Fase: design · Store: openspec · Modo: auto
Delivery: ask-on-risk · Budget: 400 líneas cambiadas por PR · Cadena: stacked-to-main
Research: UNSELECTED · skill_resolution: none

## 1. Objetivo y límites

Este cambio entrega dos slices separables:

- **PR-A — datos AA:** captura `intelligenceIndex`, cura aliases y backfill del chart AA 2026-09-13, preserva availability manual y deja la matriz de providers en verde.
- **PR-B — effort-only:** deja effort como única etiqueta de razonamiento en ref-table, model-card, cli-mirror y justification; saca tier/soft de sus exports y elimina la codificación visual por tier del composite-chart.

No se cambia la fórmula ni la firma de `compositeScore`, `getBestFor`, `applyProviderFilter` o `selectConfig`. Tampoco se cambia `data/providers.json`, el filtro fail-closed, la estrategia interna `tier-based`, pricing-chart ni workflow-table. Estos dos últimos todavía consumen `tier`, por lo que el campo y los estilos compartidos que aún usan se conservan.

## 2. Decisiones de arquitectura

### D1 — El scorer ejecutable manda: BenchLM directo, no weighted composite

La autoridad de runtime es `js/services/model-scorer.js` y sus tests actuales. `compositeScore(model)`:

1. lee únicamente `model.benchlm.score`;
2. devuelve `null` si el modelo, el bloque o el score faltan o no son finitos;
3. clampa números finitos a `[0, 100]`;
4. no consulta Arena, SWE-Pro, SWE-Verified, Terminal-Bench ni `intelligenceIndex`.

Por lo tanto, la fórmula ponderada 30/30/20/20 del spec canónico está obsoleta. **El scorer queda intacto en ambos PRs.** `intelligenceIndex` es dato AA capturado para trazabilidad/futuro uso, pero es inerte para selección y ranking en este change.

#### Ajuste exacto obligatorio al delta spec antes de apply

En `openspec/changes/2026-09-13-aa-intelligence-refresh/specs/model-picker/spec.md` se debe agregar una sexta sección `MODIFIED` llamada **“Scoring Service — compositeScore”** que reemplace íntegramente el requisito canónico weighted por este contrato:

- score finito = `model.benchlm.score` clamp `[0,100]`;
- score ausente/no finito = `null`, nunca `0`;
- función pura;
- `arena`, `swePro`, `sweVer`, `term` e `intelligenceIndex` son inertes.

Sus escenarios deben fijar: valor directo, clamp alto/bajo, null fail-soft y par de modelos idénticos salvo `intelligenceIndex` con igual resultado. El delta pasa así de **4 ADDED / 5 MODIFIED / 5 REMOVED** a **4 ADDED / 6 MODIFIED / 5 REMOVED**. El `MODIFIED getBestFor` ya escrito se conserva.

También se debe precisar el escenario Astra: escribir solamente `benchlm.score = 53` no prueba que quede primera. En el catálogo actual hay candidatos activos de `chatgpt-plus` con scores mayores (`gpt56sol` 81.96, `gpt54` 74.24, `gpt55` 73.51 y `gpt56terra` 72.57, aunque algunos no sean activos). La precondición correcta es **“catálogo completo tras el backfill AA trazado del mismo snapshot”**, y el test debe comprobar el máximo real del conjunto elegible, no asumirlo. Nunca se bajará un candidato sin evidencia AA para fabricar el resultado. Si la evidencia legible no alcanza para dejar 53 como máximo del conjunto activo, PR-A se detiene en el gate de datos: no se agrega una rama especial al scorer ni al sort.

El backfill curado de `benchlm.score` decidido en proposal D2-B es una operación one-shot sobre `data/models.json`, separada del ownership automático del scraper AA. El scraper AA solo es dueño de `intelligenceIndex` y sus campos actuales; no empieza a escribir `benchlm`.

### D2 — Model-card es un anexo del dominio model-picker

No se crea un capability/domain nuevo. `model-card` consume el mismo `Model` y comparte vocabulario, estilos y ciclo de release con las demás superficies del picker; no tiene persistencia, workflow ni API autónoma.

El requisito `ADDED “Model Card Effort-Only”` es correcto como **anexo de UI dentro de `model-picker`**. Al archivar el change se incorpora al spec canónico junto a ref-table/composite-chart, con nombre final **“UI Component — Model Card (effort-only)”**. La implementación usa el mismo renderer puro de effort que las otras tres superficies.

### D3 — Composite-chart entra explícitamente en PR-B

`js/components/composite-chart.js` hoy colorea barras por `tier`, emite `data-tier`, explica el color de tier en la leyenda y exporta una columna `Tier`. Eso contradice effort-only aunque el delta no lo enumere como superficie original.

PR-B elimina esa fuga completa:

- todas las barras usan un token neutral `--composite-score-fill` con fallback indigo;
- desaparecen `tierOf`, `barColor`, `data-tier`, el texto de tier en la leyenda y la columna `Tier` del markdown;
- se eliminan solo `--composite-tier-*`; `--pricing-tier-*`, `.tier-tag` y sus shapes quedan porque pricing-chart/workflow-table todavía los usan;
- `tests/composite-chart.test.js` deja de esperar colores/atributos por tier y pasa a afirmar color neutral, ausencia de `data-tier` y export sin `Tier`.

En el delta spec se amplía la migración del requisito REMOVED **“Tier Badge Elements”** para nombrar también `composite-chart` (color, atributo, leyenda y export). Esto no agrega otro requisito ni cambia el conteo del delta.

### D4 — Un único contrato de effort

Se agrega un helper puro pequeño, `js/components/effort-tag.js`, consumido por las cuatro superficies. Centraliza:

- vocabulario cerrado: `max | xhigh | high | medium | low | non-reasoning`;
- labels rioplatenses existentes;
- escape HTML;
- ausencia de badge ante valor faltante o inválido, sin inventar labels.

Un assignment normal muestra nombre + como máximo un tag effort. Un assignment con `softFallback: true` conserva ese dato para lógica/JSON, pero el HTML y markdown muestran **solo el nombre**, sin tag effort, tier, soft, `~`, banner ni columna Estado. Los checks y el estado `unassigned` siguen funcionando.

## 3. Grafo de dependencias

```text
AA API v2 / tests/fixtures/aa-sample.json
  └─> scripts/scrape-artificialanalysis.js
        ├─> scripts/_aa-safety.mjs
        │     └─> data/aa-aliases.json  ({slug,to,effort})
        ├─> buildAaPatch + omission notes + sources[]
        └─> scripts/_scraper-utils.mjs
              ├─> readModelsJson
              ├─> preserveManualModelFields  (availability)
              └─> writeModelsJson  (tmp + rename)
                    └─> data/models.json (schemaVersion 5)

data/models.json + data/providers.json + otros 4 DATA_FILES
  └─> js/services/data-loader.js (CACHE_KEY sdd-models-v6)
        └─> js/services/provider-filter.js
              ├─> js/services/model-scorer.js (BenchLM clamp; INTACTO)
              │     └─> config/assignments/fallback interno
              ├─> js/components/ref-table.js
              ├─> js/components/composite-chart.js
              ├─> js/components/model-card.js
              ├─> js/components/cli-mirror-table.js
              ├─> js/components/justification-ui.js
              └─> js/services/exporter.js

js/components/effort-tag.js
  ├─> ref-table.js
  ├─> model-card.js
  ├─> cli-mirror-table.js
  └─> justification-ui.js

css/tokens.css
  ├─> composite-chart neutral fill
  ├─> effort tag shared styles
  └─> workflow/pricing tier styles retained
```

No se introduce dependencia desde scraper hacia UI ni desde scorer hacia AA. El filtro de providers sigue siendo el pre-pass duro antes de scorer, tablas, charts, conteos y export.

## 4. Data-flow del sync AA

1. `runScrape` obtiene el payload autenticado o la fixture local y valida `{ data: [...] }` antes de tocar disco.
2. `_aa-safety.mjs` resuelve cada slug solo mediante `data/aa-aliases.json`. Cada alias nuevo declara `effort`; un slug no curado se ignora y un slug faltante aborta.
3. `FIELD_MAP` suma el path real AA v2 `evaluations.artificial_analysis_intelligence_index -> intelligenceIndex`. La fixture debe demostrar ese path con una captura real; si el live payload usa otro path, se cambia **esa única key y la fixture juntas**, nunca se prueba una cadena de paths inferidos.
4. `buildAaPatch` copia solo campos AA-owned. Para `intelligenceIndex` aplica un contrato nullable distinto del resto de opcionales:
   - finito: guarda el número exacto, sin clamp ni normalización;
   - ausente/no finito: guarda `null` y agrega `intelligenceIndex` a la nota de omisión;
   - no borra el key nullable durante el merge.
5. El merge conserva los campos no AA. Para registros existentes hace spread del registro + patch + effort explícito; para un alias curado nuevo crea el registro mínimo y un bloque BenchLM placeholder, sin score fabricado.
6. `appendAttribution` agrega/deduplica `{url, date, scraper}`. Una tupla AA por modelo y snapshot respalda todos los números AA de ese modelo obtenidos en esa observación. Los tests mantienen un manifest `modelo/campo/valor` y exigen que cada entrada del manifest tenga la tupla correspondiente.
7. Antes de escribir, `writeModelsJson` relee el target y llama `preserveManualModelFields(onDisk.models, candidate.models)`. Availability del registro existente queda deep-equal al valor en disco; un id nuevo queda temporalmente con `{}`; una desaparición accidental de ids aborta.
8. La escritura actualiza metadata/sources y usa temp + rename. Ningún failure previo llega al write.
9. La curación del PR materializa en `data/models.json` la matriz completa para cada alta. Sin evidencia de provider, todos los provider ids quedan `false` y el modelo queda `lifecycle: "benchmark-only"`; así es fail-closed y no viola el gate que prohíbe familias activas sin ningún provider confirmado. Solo evidencia `sourceOfTruth` permite un `true` y promoción a `active`.
10. `data-loader` carga los seis archivos, compone availability y entrega el catálogo al provider filter. El scorer continúa leyendo solo BenchLM. Ref-table/chart/export reciben el conjunto filtrado; `intelligenceIndex` viaja en el record/JSON pero no altera sort, barras, matching ni markdown en este slice.

### Backfill curado y reconciliación

- `gpt6astra` recibe `intelligenceIndex: 53` y el backfill de `benchlm.score: 53` aprobado en proposal D2-B, ambos con source AA 2026-09-13; se conservan los demás subcampos BenchLM salvo cambios explícitamente evidenciados.
- Se aplica el mismo criterio de evidencia a Muse 48, Opus 51 y cada fila legible. No se copia un número sin screenshot/payload y no se usa `0` como ausencia.
- Por defecto se crea una entrada distinta `musespark13` para “Muse Spark 1.3 (max)” y se preserva `musespark13contributor` (`xhigh`) intacta. Solo un slug AA que pruebe identidad autoriza reatribución en vez de alta.
- DeepSeek 0813/V4.1 se resuelve como alias a ids existentes o como variante distinta, nunca ambos. `minimaxm3` se reutiliza si el slug confirma identidad. Todo alias conserva effort explícito.
- Los no evidenciados quedan enumerados en `notes`/reporte de omisiones, no como filas parciales inventadas.

## 5. Data shape y versionado

### Campo de modelo

| Campo | Shape | Ownership | Regla |
|---|---|---|---|
| `intelligenceIndex` | `number | null` en modelos cubiertos por AA; ausente solo en modelos nunca cubiertos por AA | scraper AA / backfill curado | Número finito exacto o `null`; nunca `0` sintético |
| `benchlm.score` | `number | null` | scraper BenchLM; excepción one-shot del backfill aceptado | Fuente efectiva de `compositeScore` |
| `effort` | enum cerrado | alias/curación | Nunca inferido del slug |
| `availability` | mapa booleano completo al shippear | humano/propagador | Write-guard; fail-closed |
| `sources[]` | `{url:string,date:ISO-date,scraper?:string}[]` | cada ingestión | Dedupe por url+date+scraper |

### Versiones

- El archivo en disco ya es `_meta.schemaVersion: 5`; el `SCHEMA_VERSION = 4` del scraper es un bug de downgrade.
- PR-A cambia el scraper para escribir/preservar **5** y actualiza fixtures/tests que hoy esperan 4.
- `intelligenceIndex` es una extensión nullable y ningún consumidor runtime lo requiere para decidir; por eso **no se crea schema 6**.
- `CURRENT_SCHEMA_VERSION` queda `5`, `CACHE_KEY` queda `sdd-models-v6` y `DATA_FILES` queda en 6, incluyendo `data/providers.json`. No se toca `js/services/data-loader.js` salvo que un test revele una escritura de schema 4.
- `tests/fixtures/aa-sample.json` actualiza `fetchedAt`/nota y contiene al menos un caso real finito y uno ausente/null del path de Intelligence Index. La fixture no inventa Astra ni valores que el payload capturado no traiga.

## 6. Diseño por slice

### PR-A — AA data pipeline y catálogo

Archivos previstos:

- `scripts/scrape-artificialanalysis.js`: nuevo FIELD_MAP, nullable handling, schema 5 y comentarios de ownership.
- `data/aa-aliases.json`: aliases confirmados, effort explícito y fecha.
- `data/models.json`: backfill trazado, `musespark13` distinto por defecto, reconciliaciones sin duplicados, nuevos modelos benchmark-only con matriz false completa.
- `tests/fixtures/aa-sample.json`: payload real actualizado.
- `tests/scrape-artificialanalysis.test.js`: mapping, null/omission, preservation, fixture y schema 5.
- `tests/aa-effort.test.js`: `intelligenceIndex` admite finito o null y aliases nuevos conservan effort.
- `tests/data-integrity.test.js`, `tests/availability-matrix.test.js` y `tests/propagate-provider-availability.test.js`: fuentes por campo esperado, matriz, lifecycle y ausencia de duplicados.
- `tests/model-scorer.test.js`: caracterización que prueba que cambiar solo `intelligenceIndex` no cambia score/winner; no hay cambio productivo en scorer.

Orden interno:

1. corregir delta spec del scorer;
2. agregar tests rojos de FIELD_MAP/null/write-guard/schema;
3. implementar scraper + fixture;
4. curar aliases y backfill desde evidencia;
5. materializar availability y reconciliar familias;
6. ejecutar gates de integridad y el test Astra sobre el conjunto `chatgpt-plus` real.

PR-A no toca componentes visuales. Si el JSON empuja el diff sobre 400 líneas, se activa `ask-on-risk`: no se recorta evidencia silenciosamente ni se acepta `size:exception` por defecto.

### PR-B — effort-only + chart neutral

Archivos previstos:

- `js/components/effort-tag.js`: vocabulario/labels/renderer compartido.
- `js/components/ref-table.js`: elimina celda/header/export Tier; conserva Esfuerzo y lifecycle; ajusta colspans.
- `js/components/model-card.js`: elimina helpers/atributos/badge tier y deja NEW + effort válido.
- `js/components/cli-mirror-table.js`: elimina tier/token helpers y soft badge; normal = nombre+effort, fallback = nombre solo.
- `js/components/justification-ui.js`: agrega effort normal, elimina tier helpers, soft badge, summary, link/listener y columnas Tier/Estado; fallback sin badges.
- `js/services/exporter.js`: `agentsMarkdown` elimina tier y `_soft fallback_`; conserva header, score y costo. JSON puede conservar `softFallback` como dato de máquina.
- `js/components/composite-chart.js`: color neutral, sin atributo/leyenda/export tier.
- `css/tokens.css`: agrega `--composite-score-fill`; elimina `--composite-tier-*`, `.model-tier-tag`, `.soft-badge` y `.soft-summary`; conserva `.tier-tag`, shapes y tokens todavía usados por workflow/pricing.

PR-B no modifica datos, scorer, provider filter ni assignment logic. Al estar apilado sobre PR-A, se rebasa sobre el SHA verde de PR-A y apunta a main mediante la cadena acordada.

## 7. Estrategia de tests Vitest

### PR-A — node/data

Focused loop:

- `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/model-scorer.test.js`
- `pnpm vitest run tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js`

Casos mínimos nuevos:

1. Intelligence finita llega exacta a `intelligenceIndex`.
2. Intelligence ausente/no finita queda `null` + nota; no se borra ni se vuelve cero.
3. Availability existente queda deep-equal después del write real.
4. Alta nueva es `{}` al salir del write-guard y matriz false completa antes de shippear.
5. Fixture usa el path real y no llama HTTP.
6. Schema final es 5 y no cambia `CACHE_KEY`/`DATA_FILES`.
7. Cada valor del manifest de backfill tiene source AA fechado.
8. Spark contributor xhigh no cambia; Spark max es distinto salvo evidencia contraria.
9. DeepSeek/MiniMax no quedan duplicados.
10. Dos modelos que solo difieren en Intelligence producen igual `compositeScore`/winner.
11. Tras filtrar `chatgpt-plus`, el máximo real cumple el criterio Astra o el gate falla sin mutar sorting.

### PR-B — jsdom/UI

Focused loop sobre aproximadamente diez suites:

- `tests/ref-table.test.js`
- `tests/model-card.test.js`
- `tests/cli-mirror-table.test.js`
- `tests/justification-ui.test.js`
- `tests/exporter.test.js`
- `tests/composite-chart.test.js`
- test nuevo del helper effort
- `tests/p2-polish.test.js`
- `tests/v2-polish-final.test.js`
- `tests/config-selector.test.js` como regresión de conteos/recompute

Asserts de contrato:

- vocabulario cerrado y cero badge para effort inválido/faltante;
- ausencia explícita de `.model-tier-tag`, `.tier-tag` y `[data-tier]` en las superficies afectadas;
- ausencia de `.soft-badge`, `~`, `[data-test=soft-summary]` y `soft fallback` en HTML/markdown;
- fallback conserva nombre con cero badges y unassigned conserva warning;
- ref-table exporta Esfuerzo sin Tier;
- justification exporta Agent/Role/Modelo/Esfuerzo/Score/Costo sin Tier/Estado;
- agentsMarkdown mantiene providers+timestamp y score/costo sin tier/soft;
- composite-chart mantiene sort BenchLM, unavailable/nulls-last, grouping AA y barras de un solo color neutral; no Tier en DOM, leyenda ni markdown;
- p2-polish conserva shapes de `.tier-tag` para workflow, pero elimina solo expectativas de `.model-tier-tag`;
- v2-polish reemplaza el test que exigía `.soft-badge` por ausencia de sus reglas.

Gate por PR:

- `pnpm test`
- `pnpm test:coverage` (scorer y total sobre umbrales vigentes)
- `pnpm build` y verificación de `dist/index.html` autocontenido en menos de 30 segundos.

## 8. Rollout, rollback y observabilidad

1. **Merge PR-A primero.** Verificar diff de cada número contra evidencia, sources, matriz, aliases y resultado del filtro chatgpt-plus. La sync programada siguiente corre con schema 5 y no puede clobber availability.
2. **Merge PR-B después.** Smoke visual de las cuatro superficies, chart y exports; validar 18 cli rows, 18 cards, 9 workflow rows, 5 configs y hero `X de Y visibles`.
3. Si un slice supera 400 líneas, pausar con `ask-on-risk` para decidir otro eslabón o recorte basado en evidencia. Nunca inferir `size:exception`.
4. Rollback de PR-B restaura solo presentación. Rollback de PR-A restaura scraper/datos/fixture y debe revalidar schema 5 + matriz. No hacer revert cruzado.

Se observan en CI: warnings de aliases faltantes, notas de omisión, diff de dry-run, fallas nombradas `(family, provider)`, conteo de backfills sin source y ranking real del eligible set.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación / gate |
|---|---|
| El path live de Intelligence difiere del supuesto | Fixture autenticada manda; FIELD_MAP tiene un solo path, sin fallback adivinatorio |
| `53` no supera scores actuales de chatgpt-plus | Testea el conjunto final completo; backfill consistente y trazado o PR-A no mergea; jamás branch especial |
| El scraper baja schema 5 a 4 | Fijar schema 5 y reemplazar expectativas schema 4 |
| Alta fail-closed queda activa sin provider | Lifecycle benchmark-only + mapa completo false hasta evidencia |
| Limpiar `.tier-tag` rompe workflow | Retener clase/shapes/tokens compartidos; sacar solo consumidores objetivo y composite tier tokens |
| Soft sigue filtrándose por export | Tests negativos sobre HTML y markdown; JSON conserva el dato solo como contrato machine-readable |
| Backfill JSON supera 400 líneas | `ask-on-risk`; no excepción ni recorte silencioso |
| Backfill AA one-shot de `benchlm.score` se vuelve obsoleto | Sources/fecha lo hacen auditable; scorer no cambia y el scraper AA nunca toma ownership de BenchLM |
