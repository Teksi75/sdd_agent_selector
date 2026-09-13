# Manifest de evidencia AA — 2026-09-13

Change: `2026-09-13-aa-intelligence-refresh` · Store: openspec · Fase: 2 (tareas 2.2–2.4/2.7)
Snapshot: AA 2026-09-13 · Estado: **RESUELTO por captura live** (G3 cerrado en Fase 1; **G1 CERRADO** en Fase 2)

## 1. Autoridad y reglas aplicadas

- **Fuente primaria de esta fase:** captura live del endpoint AA v2 `https://artificialanalysis.ai/api/v2/data/llms/models` autenticada con `x-api-key` (archivo de key fuera del repo; nunca impreso ni commiteado).
  - `fetchedAt`: **2026-09-13T01:11:12.045Z** · 646 items · HTTP 200.
  - El payload completo **no se archiva en el repo** (pesa ~0.5 MB y contiene datos de cuenta/API); la trazabilidad por número vive en esta tabla + `sources[]` del catálogo. La fixture de Fase 1 (`tests/fixtures/aa-sample.json`) conserva el subset real que ejercita el scraper.
- **Resolución `53` vs `52.8`:** la transcripción del screenshot (53) es el rendering redondeado del chart público; el payload exacto devuelve `gpt-6-astra` (max) = **52.8**. Regla aplicada: **entra el valor exacto del payload** (misma observación, sin redondeo), consistente con el contrato del scraper (“llega exacta, sin clamp ni normalización”) y con lo que la próxima sync escribirá en `intelligenceIndex`. Lo mismo aplica a Opus 5 (chart 51 → exacto 50.7) y Muse Spark 1.3 (chart 48 → exacto 48.2).
- **Regla cero números sintetizados:** solo entra un valor con su fila de payload/screenshot; lo no evidenciado queda fuera y enumerado en §6.
- Forma de la atribución a `data/models.json`: `{ url: "https://artificialanalysis.ai/", date: "2026-09-13", scraper: "scrape-artificialanalysis" }`. La curación es manual y one-shot (proposal D2-B); la tupla permite el check manifest ↔ `sources[]` 1:1 (test `tests/data-integrity.test.js`).

## 2. Manifest `modelo/campo/valor → {url, date, scraper}`

| # | Fila del chart | model id | Campo | Valor | url | date | scraper | Nota |
|---|---|---|---|---|---|---|---|---|
| 1 | GPT-6 Astra (max) | `gpt6astra` | `benchlm.score` | 52.8 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | one-shot D2-B; conserva subcampos BenchLM (verified/reliability/categories) |
| 2 | GPT-6 Astra (max) | `gpt6astra` | `intelligenceIndex` | 52.8 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | mismo snapshot; el chart público muestra el redondeo 53 |
| 3 | Claude Opus 5 (max) | `claudeOpus5` | `benchlm.score` | 50.7 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | reemplaza el estimado 82.5; conserva subcampos BenchLM |
| 4 | Claude Opus 5 (max) | `claudeOpus5` | `intelligenceIndex` | 50.7 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | el chart público muestra 51 |
| 5 | Muse Spark 1.3 (max) | `musespark13` | `benchlm.score` | 48.2 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | alta nueva `benchmark-only`, availability fail-closed (D3-A); contributor xhigh intacto |
| 6 | Muse Spark 1.3 (max) | `musespark13` | `intelligenceIndex` | 48.2 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | el chart público muestra 48 |
| 7 | GPT-5.6 Sol (max) | `gpt56sol` | `benchlm.score` | 47.1 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | candidato chatgpt-plus: baja **con** evidencia AA del mismo snapshot |
| 8 | GPT-5.6 Sol (max) | `gpt56sol` | `intelligenceIndex` | 47.1 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | mismo snapshot |
| 9 | GPT-5.6 Terra (max) | `gpt56terra` | `benchlm.score` | 42.3 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | candidato chatgpt-plus, misma regla |
| 10 | GPT-5.6 Terra (max) | `gpt56terra` | `intelligenceIndex` | 42.3 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | mismo snapshot |
| 11 | GPT-5.4 (xhigh) | `gpt54` | `benchlm.score` | 39 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | candidato chatgpt-plus, misma regla |
| 12 | GPT-5.4 (xhigh) | `gpt54` | `intelligenceIndex` | 39 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | mismo snapshot |
| 13 | GPT-5.5 (xhigh) | `gpt55` | `benchlm.score` | 38.6 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | candidato del set filtrado (lifecycle reference), misma regla |
| 14 | GPT-5.5 (xhigh) | `gpt55` | `intelligenceIndex` | 38.6 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | mismo snapshot |
| 15 | GPT-5.6 Luna (max) | `gpt56luna` | `benchlm.score` | 37.5 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | candidato chatgpt-plus, misma regla |
| 16 | GPT-5.6 Luna (max) | `gpt56luna` | `intelligenceIndex` | 37.5 | https://artificialanalysis.ai/ | 2026-09-13 | scrape-artificialanalysis | mismo snapshot |

Todos los valores provienen de la captura live del §1 (mismo `fetchedAt`). El test `tests/data-integrity.test.js` exige que **cada fila de esta tabla** resuelva al valor exacto del catálogo + su tupla en `sources[]`, y que todo modelo con la tupla AA 2026-09-13 esté enumerado acá (1:1 en ambas direcciones).

## 3. Por qué los competidores entran en el backfill (precondición de G1)

Los cinco modelos del set `chatgpt-plus` con score previo (`gpt56sol` 81.96, `gpt54` 74.24, `gpt55` 73.51, `gpt56terra` 72.57, `gpt56luna` 67.17) estaban en la escala BenchLM, no en la escala del chart AA. La precondición aprobada por design es **“catálogo completo tras el backfill AA trazado del mismo snapshot”**: cada fila legible del set recibe su valor AA 2026-09-13 con su propia tupla. Ningún candidato fue bajado sin evidencia — cada bajada tiene su fila (7–16) y su entrada en `sources[]`. Prohibido y no hecho: tocar scorer, sort o filtrar candidatos.

## 4. G1 — resultado (tarea 2.7)

- Test: `tests/aa-effort.test.js` → “G1 — Astra is the real maximum of the chatgpt-plus eligible set (scorer intact)”; computa el máximo real del set filtrado en test time (nunca `53` hardcodeado) y afirma que la fila 0 es `gpt6astra`.
- Resultado: **VERDE**. Ranking real tras `applyProviderFilter(chatgpt-plus)` ordenado por `compositeScore` desc:

| Pos | model id | compositeScore |
|---|---|---|
| 1 | `gpt6astra` | 52.8 |
| 2 | `gpt56sol` | 47.1 |
| 3 | `gpt56terra` | 42.3 |
| 4 | `gpt54` | 39 |
| 5 | `gpt55` | 38.6 |
| 6 | `gpt56luna` | 37.5 |
| 7+ | variantes xhigh/high/medium/low/non-reasoning | `null` (nulls-last) |

- `compositeScore` sigue leyendo solo `benchlm.score`; `intelligenceIndex` es inerte (characterización 2.6 + grep de fuente sin `intelligenceIndex`). Sin branch especial ni re-sort.

## 5. Reconciliaciones sin duplicados (tarea 2.4)

- **DeepSeek:** el slug AA `deepseek-v4-pro` (“DeepSeek V4 Pro 0813”) ya está curado como alias de `deepseekv4p`, y `deepseek-v4-flash` (“V4 Flash 0731”) de `deepseekv4f`: **misma identidad, sin altas nuevas**. El slug nuevo `deepseek-v4-1-flash` (V4.1) no está curado → queda fuera (§6). Los `deepseekv4pro*`/`flashvisionexp*` del catálogo son variantes peak/off-peak de OpenCode, no filas AA.
- **MiniMax:** `minimax-m3` está curado → `minimaxm3` (II live 29.6); **verificado mismo**, no se crea nada.
- Evidencia de no-duplicación: test “DeepSeek / MiniMax reconcile by alias…” (aa-effort) + “no duplicated model names inside the AA-owned catalog” (data-integrity), ambos verdes.

## 6. Omisiones enumeradas (fail-closed, no entran al catálogo)

- Slugs live con evidencia pero sin alias curado en este slice (spec: “Uncurated slugs never enter the catalog”): `qwen3-8-27b` (+ low/xhigh/medium/non-reasoning), `qwen3-8-2-4t-a95b`, `gemini-3-8-flash` (+ low/medium), `k2-horizon-375b-a23b`, `inkling`, `inkling-small`, `nvidia-nemotron-3-super-120b-a12b` y familia Nano, `deepseek-v4-1-flash`, `glm-5-3`, `grok-4-6`, `muse-spark-1-3-xhigh`, `muse-spark-1-1`, `muse-spark`.
- Variantes de esfuerzo de filas ya curadas (existen en el payload; el one-shot no las extendió): `gpt-5-6-{sol,terra,luna}-{xhigh,high,medium,low,non-reasoning}`, `gpt-5-5-*`, `gpt-5-4-*`, `gpt-6-astra-{xhigh,high,medium}`. Las que ya tienen alias (`gpt56solXhigh`, etc.) recibirán su `intelligenceIndex`/pricing en la próxima sync programada; `gpt6astraLow` (low, curado non-AA) queda intacto.
- Motivo común: fuera del alcance de este slice por presupuesto de revisión (G2); requieren curación de alias + availability fail-closed + evidencia, en follow-up.

## 7. G3 — histórico (cerrado en Fase 1)

- Path del Intelligence Index en payload v2: `evaluations.artificial_analysis_intelligence_index` (confirmado 646/646 items en el probe live de Fase 1). Fixture regenerada desde captura real; una sola key en `FIELD_MAP`, sin cadena de paths inferidos.
