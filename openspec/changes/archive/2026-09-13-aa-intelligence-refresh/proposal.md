# Proposal — 2026-09-13-aa-intelligence-refresh

Fecha: 2026-09-13 · Fase: proposal · Change: `2026-09-13-aa-intelligence-refresh`
Store: openspec · Preflight: auto / openspec / ask-on-risk / budget 400 por PR / chain stacked-to-main
Predecesor: V5 archivado · Spec canónico: `openspec/specs/model-picker/spec.md` (30 requisitos)
Autoridad: screenshots usuario 2026-09-13 + archivos del repo. Prohibido sintetizar números AA.
Research: UNSELECTED (sin evidencia web).

Decisiones confirmadas del handoff (NO re-entrevistar, NO reabrir):
1. Astra (max) 53 primera con chatgpt-plus habilitado — criterio aceptado.
2. Backfill con `sources[]` {url AA, fecha, scraper} por cada número — obligatorio.
3. Modelos nuevos con availability fail-closed + gate matriz verde — obligatorio.
4. Effort-only: solo tag effort, fuera tier y soft (~), fallback con nombre sin badge — aceptado.
5. pnpm, vitest, budget 400/PR, slice en 2 PRs (datos AA / UI tags) — aceptado.

## 1. Problema (business problem)

El chart público de Artificial Analysis del 2026-09-13 muestra un ranking por Intelligence Index que el picker no refleja: GPT-6 Astra (max) 53 debería rankear primera con chatgpt-plus habilitado, pero hoy tiene `benchlm.score: null` y cae al fondo como "unavailable"; Muse 1.3 (max) 48 y el resto del chart tampoco están backfilleados. El scraper (`scripts/scrape-artificialanalysis.js`) no mapea ningún Intelligence Index, la fixture AA es del 2026-08-16 y el último sync es del 2026-08-17 — casi un mes de deriva. En paralelo, la UI muestra badges de tier (high/balanced/budget/reference) y de soft fallback (`~`) en 4 superficies, lo que confunde al usuario: el tier sugiere calidad fija cuando el ranking real viene del scorer, y el `~` expone mecánica interna de fallback que no aporta decisión. El costo operativo es doble: datos desactualizados que rompen confianza ("¿por qué Astra no aparece primera?") y etiquetas que hay que explicar en soporte.

## 2. Usuarios y situaciones (target users)

- **Suscriptor chatgpt-plus que elige modelo para construir:** filtra por chatgpt-plus, espera ver Astra primera (53). Hoy la ve última o ausente → desconfía del picker y lo abandona. Urgencia alta: es el caso hero del change.
- **Operador que cura datos AA (sync-benchmarks):** corre el scraper cada 5 días; hoy el Intelligence Index se pierde aunque AA lo publique. Necesita que el campo se capture, mergee sin clobber de `availability`, y quede trazable en `sources[]`.
- **Lector de tablas (ref-table / cli-mirror / justification):** compara modelos por esfuerzo (max/xhigh/high/medium/low/non-reasoning). Hoy debe decodificar además tier y `~`, que no cambian su decisión pero sí el ruido visual. Tras el cambio ve solo effort.
- **Revisor de PRs con budget 400:** necesita slices revisables (datos vs UI) en cadena stacked-to-main, no un PR gigante.

## 3. Reglas de negocio (business rules)

1. **Fail-closed availability:** todo modelo nuevo o slug AA sin alias curado entra con `availability: {}` o `false` en todos los providers salvo evidencia del `sourceOfTruth`; el integrity gate (`availability-matrix`, `propagate-provider-availability`) debe quedar verde. Los scrapers nunca escriben `data/providers.json` ni consultan `pricingSource` para availability.
2. **No-sintetizar números AA:** ningún valor de Intelligence Index / benchlm / coding / math entra sin screenshot AA 2026-09-13 o payload AA v2 live. Cada número backfilleado lleva `sources[]` con `{url: https://artificialanalysis.ai/, date: 2026-09-13, scraper: scrape-artificialanalysis}` (o fecha real del payload) + nota de omisión si falta.
3. **`sources[]` obligatorio por número:** Astra 53, Spark 48, Opus 51 y cada resto del chart llevan su entrada; fixture `tests/fixtures/aa-sample.json` se amplía con el campo real.
4. **Effort nunca inferido:** `aa-aliases.json` declara effort explícito por slug; `mapAaSlug` ignora slugs no curados (`detectMissing` WARN+preserve). El tag effort-only usa el vocabulario cerrado max/xhigh/high/medium/low/non-reasoning.
5. **Filtro provider es pre-pass duro:** `applyProviderFilter` antes de scorer/tablas/charts/export; fallback solo dentro del eligible set; jamás revertir silenciosamente al catálogo completo.
6. **Twin judge y conteos intactos:** `jd-judge-a/b` mismo modelo; cli-mirror 18 filas, workflow 9 filas, 5 botones de config, hero-stats `"X de Y visibles"`.

## 4. Outcome (product outcome)

Después del cambio: con chatgpt-plus habilitado, Astra (max, 53) rankea primera; el scraper captura Intelligence Index y el catálogo trae los scores del chart 2026-09-13 trazados con `sources[]`; los modelos nuevos existen con availability fail-closed y matriz verde. En UI, ref-table, model-card, cli-mirror y justification muestran SOLO etiqueta de effort; no hay columna/header Tier, ni `.tier-tag`, ni `.soft-badge`/`~`, ni banner soft-summary, ni `(tier · score · costo)` en exporter — el fallback se lee como nombre del modelo sin badge. Sensación objetivo: "los datos están al día y la etiqueta me dice lo único que importa: cuánto razona".

## 5. Gap actual (current-state gap)

- **Scraper sin Intelligence Index:** `FIELD_MAP` mapea pricing, `terminalbench_v2_1`, `codingIndex`, `mathIndex`, 3 median de velocidad. `intelligence_index` no existe en repo salvo mención diferida en verify-report. Path del payload AA v2 desconocido (requiere corrida live con `AA_API_KEY`).
- **Astra null:** `gpt6astra` existe (max, chatgpt-plus true) pero `benchlm.score: null` (curación manual 2026-09-10 solo pricing) → composite-chart y ref-table la mandan al fondo (nulls-last). `compositeScore` = `benchlm.score` clamp; coding/math/term inertes desde PR3.
- **Spark mismatch:** `musespark13contributor` es "Muse Spark 1.3 Contributor" effort **xhigh**, sin chatgpt-plus ni benchlm; el chart dice "Muse 1.3 (max)" 48. Sin slug AA en `aa-aliases.json` (69 entradas, ninguna Spark/Astra/Grok4.6/GLM-5.3/Qwen3.8).
- **Faltantes sin evidencia en `data/models.json`:** Qwen3.8 27B, K2 Horizon, Inkling, Nemotron 3 Ultra, Gemini 3.8 Flash (high), DeepSeek V4.1 Flash / V4 Pro 0813 (existen `deepseekv4f*/v4p*` sin sufijo — reconciliar), Qwen3.8 xhigh, GPT-5.6 Sol scores por verificar. Grep Inkling/Nemotron/Horizon/Gemini/intelligence = cero hits.
- **Tags tier/soft vivos:** ref-table (`tierCell`, header Tier, export col Tier), model-card (`model-tier-tag`), cli-mirror (`tier-tag` + `softBadge` + `~` en tokens.css), justification (`tier-tag` + `.soft-badge` + banner `.soft-summary` + col Estado 'soft fallback'), exporter `(tier · score · costo)`, CSS `--just-tier-*`/`--cli-tier-*`, y ~10 archivos de tests con asserts de tier/soft/colores por tier.

## 6. Implicancias e impacto (implications)

- **Spec delta obligatorio:** `openspec/specs/model-picker/spec.md` suma: campo Intelligence Index (nombre, tipo, fuente), criterio "Astra primera con chatgpt-plus", y regla effort-only (qué superficies, qué se quita, fallback sin badge). Sin este delta, tasks/apply no tienen contrato.
- **Scorer/ranking:** si el criterio Astra-primera se implementa por backfill de score, el toque es datos (bajo riesgo). Si se implementa por orden-por-inteligencia, toca spec Scoring + chart + ref-table (riesgo medio, más tests).
- **Equipos/flujos:** operador de sync (nuevo campo + fixture + alias), revisores (2 PRs ≤400), soporte (menos preguntas por tier/`~`), exporter (header providers+timestamp se mantiene, solo sale tier del cuerpo).
- **Datos voluminosos:** backfill N modelos × ~15 líneas JSON + aliases; mecánico pero empuja el tamaño del PR-A — por eso el slice.
- **CSS/tests:** limpiar tokens tier/soft solo si quedan sin uso; actualizar ref-table, model-card, cli-mirror, justification, exporter, config-selector, composite-chart, aa-effort, data-integrity tests.

## 7. Edge cases

1. **Spark max vs xhigh:** no renombrar esfuerzo sin evidencia. Si el chart 2026-09-13 trae "Muse 1.3 (max)" 48 y el catálogo tiene contributor-xhigh non-AA, o bien se crea entrada nueva max con `sources[]` AA, o se re-atribuye con nota explícita. Nunca cambiar effort por inferencia.
2. **DeepSeek 0813 / V4.1:** existen `deepseekv4f*/v4p*` (peak/off-peak/vision). No duplicar: reconciliar sufijos 0813/V4.1 contra slugs AA; si son variantes distintas, nuevas entradas fail-closed; si son renombres, alias + nota.
3. **MiniMax-M3:** `minimaxm3` ya existe — verificar si es el mismo del chart antes de crear duplicado.
4. **Slugs sin alias:** `mapAaSlug` los ignora, `detectMissing` WARN+preserve. Ningún slug nuevo entra al catálogo sin entrada curada en `aa-aliases.json` con effort explícito.
5. **Payload AA sin Intelligence Index:** si la corrida live no trae el path, el scraper mergea lo disponible, deja nota de omisión y no sintetiza; el criterio Astra-primera cae a backfill manual trazado (opción B de decisión 2).
6. **Empty eligible set:** tras quitar badges, el estado vacío sigue con mensaje + CTA enable-all, `unassigned` en assignments, charts vacíos con label. Quitar tier no debe romper ese layout.
7. **Exporter coherencia:** si sale tier del cuerpo, también sale de tests `exporter.test.js`; el header de providers+timestamp y el flag full-catalog se conservan.
8. **SchemaVersion:** disco en 5, scraper escribe 4 — el PR-A debe decidir bump o preservación sin romper `data-loader` ni caché (`CACHE_KEY`, `DATA_FILES` 6).

## 8. Alcance: first slice vs non-goals

**First slice (este change, 2 PRs stacked-to-main, cada uno ≤400):**
- **PR-A datos AA:** `FIELD_MAP` + `buildAaPatch` con Intelligence Index, `_aa-safety` alias nuevos con effort explícito, fixture + `scrape-artificialanalysis.test.js`, backfill Astra 53 + Spark 48 + resto del chart con `sources[]`, modelos nuevos fail-closed, integrity gate verde.
- **PR-B UI effort-only:** quitar tier y soft de ref-table, model-card, cli-mirror, justification + exporter + tokens.css muerto, fallback solo-nombre, tests UI actualizados.

**Non-goals (explícitamente fuera):**
- Cambiar pesos del scorer o agregar benchmarks nuevos más allá del wiring mínimo del criterio Astra-primera.
- Reordenamiento global por inteligencia fuera del criterio chatgpt-plus/Astra.
- Nuevos providers, cambios a `data/providers.json`, o estrategia `tier-based` (usa tier internamente — se mantiene lógica, solo se oculta badge).
- Re-sincronizar precios/velocidades fuera del chart 2026-09-13.
- Renombres masivos de modelos existentes (solo reconciliación DeepSeek/MiniMax/Spark puntual).

## 9. Constraints

- pnpm + vitest. Budget 400 líneas cambiadas por PR (umbral canónico); si algún slice lo excede, pausar con `ask-on-risk` — no inventar chain ni excepción `size:exception` sin aceptación explícita.
- Stacked-to-main: PR-B apilado sobre PR-A, cada uno verde e independiente (PR-B no bloquea datos).
- Cobertura: scorer ≥80%, integrity suite completa; `npm test` verde en ambos PRs; `npm run build` <30s con `dist/index.html` autocontenido.
- Trazabilidad: cada número AA con `sources[]`; effort explícito en aliases; sin números sintetizados.

## 10. Rollback

- **PR-A:** revert del commit del slice datos (scraper + models.json + aliases + fixture). Como el merge es read-modify-write con `preserveManualModelFields`, el revert restaura `data/models.json` previo; verificar `_meta.schemaVersion` y re-correr integrity. Riesgo bajo, sin toque UI.
- **PR-B:** revert del slice UI (componentes + exporter + css + tests). Al ser mayormente deletions de badges, el revert los restaura sin tocar datos. Riesgo bajo.
- En ambos casos: no revertir cruzado (datos vs UI son independientes); re-correr `vitest` + build tras el revert.

## 11. Decisiones abiertas (con opciones y recomendación)

### D1. Nombre del campo Intelligence Index + integración al scorer
- **Opción A (recomendada):** `intelligenceIndex` (number|null, AA-owned, consistente con `codingIndex`/`mathIndex`), capturado por scraper + backfill con `sources[]`, **inerte al scorer en este slice** (columna/backfill + criterio Astra por backfill de `benchlm`, ver D2-B). Minimiza riesgo, no toca spec Scoring.
- **Opción B:** `intelligenceIndex` integrado al `compositeScore` (nuevo peso o reemplazo parcial). Ranking más fiel al chart AA, pero cambia spec Scoring + todos los rankings + tests del scorer. Excede el slice.
- **Recomendación: A.** Dejar B como follow-up con su propio spec delta y recalibración de pesos.

### D2. Mecanismo del criterio "Astra primera con chatgpt-plus"
- **Opción A:** orden-por-inteligencia (vistas con chatgpt-plus ordenan por `intelligenceIndex` desc). Fiel al chart, pero toca sorting de chart + ref-table + spec.
- **Opción B (recomendada):** backfill de `benchlm.score` de Astra a 53 trazado (`sources[]` AA 2026-09-13) + resto del chart; el orden existente por `compositeScore` la pone primera con chatgpt-plus sin cambiar código de ranking. Mínimo diff, reversible.
- **Recomendación: B.** Si el payload live trae Intelligence Index robusto, un follow-up puede migrar a A.

### D3. Spark 1.3 max vs `musespark13contributor` xhigh
- **Opción A (recomendada):** crear entrada nueva "Muse Spark 1.3 (max)" 48 con `sources[]` AA + availability fail-closed, y conservar `musespark13contributor` xhigh non-AA intacto con nota de distinción. Sin re-atribución riesgosa.
- **Opción B:** re-atribuir contributor a max con nota. Menos entradas, pero destruye la curación non-AA existente sin evidencia de identidad.
- **Recomendación: A**, salvo que el slug AA demuestre identidad — entonces B con nota explícita.

### D4. Alcance exacto del backfill
- **Opción A (recomendada):** Astra 53 + Spark 48 + Opus 51 + todos los modelos del chart 2026-09-13 que tengan screenshot/fila legible, cada uno con `sources[]`; modelos del chart sin evidencia o sin slug curado quedan en `notes` de omisión, no entran.
- **Opción B:** solo Astra + Spark (mínimo para el criterio). PR-A más chico, pero deja deriva de un mes en el resto.
- **Opción C:** chart completo + reconciliación total DeepSeek/MiniMax/Qwen/Gemini/Inkling/Nemotron. Fiel pero casi seguro excede 400 y requiere tercera PR.
- **Recomendación: A.** Si al curar supera 400, degradar a B en PR-A y mover el resto a follow-up — decisión `ask-on-risk` en ejecución, no ahora.

## 12. Criterios de éxito

- [ ] Con chatgpt-plus habilitado, Astra (max, 53) rankea primera (test que lo fija).
- [ ] Scraper mapea Intelligence Index; fixture + tests del scraper verdes.
- [ ] Cada número backfilleado tiene `sources[]` {url, fecha, scraper}; cero números sintetizados.
- [ ] Modelos nuevos con availability fail-closed; integrity gate verde (matriz completa, 18/9/5 conteos, hero `"X de Y visibles"`).
- [ ] Ninguna de las 4 superficies renderiza tier ni soft/`~`; fallback muestra nombre sin badge; exporter sin tier en cuerpo.
- [ ] Dos PRs stacked-to-main, cada uno ≤400 líneas, `vitest` + build verdes.
- [ ] Spec delta propuesto para model-picker (campo + criterio + effort-only) listo para fase spec.
