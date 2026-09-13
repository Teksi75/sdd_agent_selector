# Explore — 2026-09-13-aa-intelligence-refresh

Fecha: 2026-09-13 · Fase: explore (read-only, sin implementación) · skill_resolution: none

## 1. Objetivo del change (dos objetivos)

- **OBJ1 — GPT-6 Astra + scores AA curados:** Astra (max) 53 primera con chatgpt-plus habilitado; backfill Muse 1.3 (max) 48 y resto del chart AA; extender scraper con Intelligence Index; agregar modelos nuevos del chart que falten en catálogo con availability fail-closed + gate de matriz en verde.
- **OBJ2 — Solo tag de effort:** quitar badges de tier (high/balanced/budget/reference) y soft (~) de ref-table, model-card, cli-mirror y justification-ui; conservar SOLO etiqueta de effort (max/xhigh/high/medium/low/non-reasoning); fallback sigue con nombre del modelo sin badge; actualizar tests.

## 2. Scraper AA — estado actual

- **Archivo:** `scripts/scrape-artificialanalysis.js` — `FIELD_MAP` (línea ~77) mapea hoy:
  `pricing.price_1m_input_tokens→input`, `pricing.price_1m_output_tokens→output`,
  `evaluations.terminalbench_v2_1→term` (×100), `evaluations.artificial_analysis_coding_index→codingIndex`,
  `evaluations.artificial_analysis_math_index→mathIndex`, más 3 campos `median_*` de velocidad.
  **No existe ningún mapeo de Intelligence Index** (`intelligence_index` / `artificial_analysis_intelligence_index` no aparecen en repo salvo el verify-report que lo declara diferido).
- **Helpers:** `scripts/_scraper-utils.mjs` (parseArgs, read/writeModelsJson atómico tmp+rename, write-guard `preserveManualModelFields` que restaura `availability` curada, soft-fail sin `AA_API_KEY`); `scripts/_aa-safety.mjs` (alias v2 `{slug,to,effort}`, `mapAaSlug` ignora slugs no curados, `detectMissing` WARN+preserve).
- **Flujo a datos:** `buildAaPatch` → merge solo campos AA-owned + `blended` local + `pricingSource` → `data/models.json` (+ `sources[] {url AA, date, scraper}`, `notes` de omisiones, nunca sintetiza). `_meta.schemaVersion` actual en disco = **5** (el scraper escribe 4; V5 subscription lo subió a 5).
- **Fixture:** `tests/fixtures/aa-sample.json` (nota fetchedAt 2026-08-16) sin campo intelligence — hay que ampliar fixture + `tests/scrape-artificialanalysis.test.js` (~600 líneas) al agregar el campo.
- **Decisión de diseño pendiente (proposal):** nombre del campo nuevo (`intelligenceIndex` propuesto, consistente con `codingIndex`/`mathIndex`), si integra al scorer o es solo columna/backfill, y path exacto del payload AA v2 (requiere corrida live con `AA_API_KEY` o inspección del JSON real — hoy desconocido).

## 3. Scorer y ranking — por qué Astra no rankea primera

- **Scorer:** `js/services/model-scorer.js` `compositeScore(model)` = `benchlm.score` clamp [0,100], `null` si falta (fail-soft). `codingIndex`/`mathIndex`/`term` son **inertes** al scorer (legado Phase-1 removido en PR3). `aa-signal.js` (`hasAaSignal`/`splitByAaSignal`) solo agrupa Con-AA/Sin-AA en ref-table, no ordena por score.
- **Ranking con chatgpt-plus:** `provider-filter.js` `applyProviderFilter` (fail-closed, unión de providers) → vistas ordenan por `compositeScore` desc. Modelos con `chatgpt-plus:true`: familias gpt55, gpt56terra/luna/sol, gpt54 (`benchlm 74.24`), gpt6astra/gpt6astraLow. **Astra tiene `benchlm.score: null`** (curación manual 2026-09-10 solo pricing) → cae al fondo como "unavailable" en composite-chart y ref-table (nulls-last; en ref-table además debajo por pin `isNew` solo dentro de activos con score). Criterio "Astra primera (53)" exige o bien backfill de score, o bien nuevo modo de orden por Intelligence Index — decisión de proposal (cuidado: cambiar orden global toca spec Scoring + chart + ref-table).
- **Ref-table orden actual:** `rowsFor` (isNew pin solo en activos, luego score desc, input tie-break) + `orderRows` (Con-AA antes que Sin-AA). Composite-chart: solo activos, scored desc, unavailable al final, color por `tier`.

## 4. Catálogo — qué existe y qué falta

- **Existen:** `gpt6astra` (max, chatgpt-plus true, benchlm null, sin codingIndex) + `gpt6astraLow`; `claudeOpus5` (benchlm 82.5 est., codingIndex 78); `qwen38max`, `glm53`, `glm53flash` (=GLM-5.3-Flash), `qwen38flash`, `grok46` (=Grok 4.6 high), `kimik3`, `gpt56terra/luna/sol` (+variantes effort), `deepseekv4*` (pro/flash, peak/off-peak/vision), `grok45`, `opencodeHy3`.
- **Muse Spark:** `musespark13contributor` = "Muse Spark 1.3 Contributor", effort **xhigh** (curado non-AA, `aa-effort.test.js:225`), availability opencode-go+meta, **sin chatgpt-plus, sin benchlm/codingIndex**. El chart AA dice "Muse 1.3 (max)" 48 → **mismatch de effort (xhigh vs max)** a resolver en proposal: ¿renombrar/reatribuir effort a max con sources[], o crear modelo nuevo? No hay slug AA para Spark en `data/aa-aliases.json` (69 entradas, ninguna de Spark/Astra/Grok4.6/GLM-5.3/Qwen3.8 — esos entraron por opencode-prices stubs).
- **Faltan (sin evidencia en `data/models.json`):** GPT-5.6 Sol como familia separada existe (gpt56sol) pero verificar scores; **Qwen3.8 27B, K2 Horizon, MiniMax-M3** (ojo: `minimaxm3` existe como MiniMax M3 — verificar si es el mismo), **Inkling, Nemotron 3 Ultra, Gemini 3.8 Flash (high), DeepSeek V4.1 Flash / V4 Pro 0813** (existen `deepseekv4f*`/`deepseekv4p*` pero sin sufijo 0813/V4.1 — reconciliar nombres), **Qwen3.8 xhigh**. Grep de Inkling/Nemotron/Horizon/Gemini/intelligence en repo = cero hits en datos.
- **Regla para nuevos:** availability fail-closed (false en todos los providers salvo evidencia) + gate de matriz en verde (`availability-matrix.test.js`, `propagate-provider-availability.test.js`).

## 5. Las 4 superficies de tags (OBJ2) — archivos y snippets exactos

| Superficie | Archivo | Badge tier (quitar) | Badge effort (conservar) | Soft (quitar) |
|---|---|---|---|---|
| ref-table | `js/components/ref-table.js` | `rowHtml` ~l.340: `tierCell` (`m.tier`, header `Tier`); export `exportRowsFrom` col Tier + md header `['Modelo','Tier','Esfuerzo',...]` | `effortBadgeHtml` (`data-effort`, header `Esfuerzo`) | — (no usa soft) |
| model-card | `js/components/model-card.js` | `tierSlug/tierLabel` + `<span class="model-tier-tag" data-tier>` (~l.150) | `effortBadgeHtml` (`data-effort`) | — |
| cli-mirror | `js/components/cli-mirror-table.js` | `tierSlug/tierLabel/tokenColor/twClassFor` + `<span class="tier-tag" data-tier>` en `assignedCell` | `effortBadge` (`data-effort`) | `softBadge` (`.soft-badge data-soft-fallback`, con `~` en tokens.css) |
| justification-ui | `js/components/justification-ui.js` | `assignmentHeader`: `<span class="tier-tag" data-tier>`; export col Tier | — (no hay effort badge: oportunidad de agregar o dejar solo nombre) | `.soft-badge` en card soft + banner `.soft-summary [data-test=soft-summary]` + col Estado 'soft fallback' en export md |

- **Fallback sin badge:** cli-mirror null-assignment ya renderiza "Sin modelo elegible" sin badge (ok); quitar tier implica que el nombre del modelo queda solo — justificación `assignmentHeader` igual.
- **CSS:** `css/tokens.css` (`--just-tier-*`, `--cli-tier-*`, `.tier-tag`, `.soft-badge`, `.soft-summary`) — limpiar lo que quede sin uso.
- **Exporter:** `js/services/exporter.js:134` `agentsMarkdown` incluye `(tier · score · costo)` — decidir si sale el tier también (coherencia con OBJ2).
- **Tests que cubren tags (actualizar):** `ref-table.test.js` (header Tier/Esfuerzo, `data-effort`, reference-sink), `model-card.test.js` (tier badge, reference label, effort labels), `cli-mirror-table.test.js:65` (`.tier-tag`), `:144` (effort labels), `justification-ui.test.js:249` (4 tiers `data-tier`), `:278` (soft-summary banner + copy rioplatense), `config-selector.test.js`, `composite-chart.test.js` (tier colors), `exporter.test.js`, `aa-effort.test.js`, `data-integrity.test.js` (tier asserts p.ej. luna budget). `~` shape prefix de soft-badge también en `p2-polish`/`v2-polish-final` posiblemente.

## 6. Tamaño estimado (¿excede 400/PR?)

- **OBJ1 (datos):** scraper (FIELD_MAP + patch + tests + fixture) ~150-250 líneas; `aa-aliases.json` + `models.json` backfill (Astra 53, Spark 48 + resto con sources[]) — JSON voluminoso pero mecánico; posible score/ranking wiring si el criterio lo exige. Estimación: **300-600 líneas** según alcance del backfill (N modelos × ~15 líneas + tests).
- **OBJ2 (UI):** 4 componentes + exporter + tokens.css + ~6 archivos de tests. Estimación: **250-450 líneas** (mayoría deletions + asserts).
- **Total combinado excede el budget 400/PR con alta probabilidad → conviene slice en 2 PRs:** PR-A datos AA (scraper + alias + backfill + tests scraper/integrity) y PR-B UI tags (4 superficies + exporter + css + tests UI). Cada uno queda ≤400 y son independientes (PR-B no bloquea PR-A).
- Spec canónico `openspec/specs/model-picker/spec.md` (≥10 `### Requirement`, 30 según contexto) requerirá delta spec en proposal (nuevo campo AA + columna/badge effort-only + criterio ranking Astra).

## 7. Evidencia AA en repo y faltante para backfill

- Última data AA: sync **2026-08-17** (`notes`/`sources` en models.json), fixture 2026-08-16, alias `lastUpdated` 2026-08-16. Todo `sources[]` AA usa `https://artificialanalysis.ai/` + `scraper: scrape-artificialanalysis`.
- **Falta:** (a) path real del Intelligence Index en el payload v2 (requiere live `AA_API_KEY` o muestra del JSON); (b) valores publicados del chart 2026-09-13 con fecha para cada backfill (Astra 53, Spark 48, Opus 51, resto) — prohibido sintetizar; (c) slugs AA de modelos nuevos para `aa-aliases.json` (effort explícito, nunca inferido); (d) confirmación Spark 1.3 (max) vs `musespark13contributor` xhigh.
