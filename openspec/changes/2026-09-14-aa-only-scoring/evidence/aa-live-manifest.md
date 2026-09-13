# Manifest de evidencia — S1 AA alias mass-mapping

Change: `2026-09-14-aa-only-scoring` · Store: openspec · Slice: **S1 (tareas 1.1–1.7, PR 1/6)** · Branch: `feat/aa-only-s1-aliases`
Fuente primaria: captura live única del endpoint AA v2 `https://artificialanalysis.ai/api/v2/data/llms/models` (autenticada `x-api-key`).

Reglas aplicadas en este slice: **pnpm only**, strict TDD, datos-only (ninguna mutación de `data/models.json`), effort **solo** desde el sufijo del display name AA (vocabulario cerrado `max | xhigh | high | medium | low | non-reasoning`), slugs ambiguos **unmapped (fail-closed)**.

---

## 1. Captura live (tarea 1.1)

| Campo | Valor |
|---|---|
| Endpoint | `https://artificialanalysis.ai/api/v2/data/llms/models` |
| `fetchedAt` | **2026-09-13T03:53:18.345Z** (UTC) |
| HTTP | **200 OK** |
| Item count | **646** (`payload.data.length`) |
| Top-level keys | `status`, `prompt_options`, `data` |
| Payload | guardado en un path temporal **privado fuera del repo** (`%TEMP%/aa-s1-capture-…/aa-live-payload.json`); **no se commitea** |
| Key | `AA_API_KEY` cargada desde `%USERPROFILE%/.config/sdd-agent-selector/aa_api_key` **solo en memoria del proceso de fetch**; nunca impresa, logueada ni commiteada |

`git diff --stat -- data/` en el momento de la captura: **vacío** (0 archivos). La única mutación de datos de este slice llega en 1.4 y es `data/aa-aliases.json` (§4). `data/models.json` y `data/providers.json` quedan byte-idénticos.

## 2. Candidatos live ↔ catálogo (valores II exactos)

`II` = `evaluations.artificial_analysis_intelligence_index` (path único confirmado, 646/646). El chart público redondea; acá vale el valor exacto del payload.

| Slug live | Display name AA | II exacto | Decisión S1 |
|---|---|---:|---|
| `grok-4-6` | Grok 4.6 (high) | **44.4** | **ALIAS → `grok46` (effort `high`)** |
| `grok-4-6-low` | Grok 4.6 (low) | 35.4 | unmapped — sin catalog key en S1 |
| `grok-4-6-medium` | Grok 4.6 (medium) | 43 | unmapped — sin catalog key en S1 |
| `grok-4-6-xhigh` | Grok 4.6 (xhigh) | 44.3 | unmapped — sin catalog key en S1 |
| `gpt-6-astra` | GPT-6 Astra (max) | 52.8 | ya mapeado (`gpt6astra`) |
| `gpt-6-astra-low` | GPT-6 Astra (low) | **46** | **ALIAS → `gpt6astraLow` (effort `low`)** |
| `gpt-6-astra-high` | GPT-6 Astra (high) | 51 | unmapped — sin catalog key en S1 |
| `gpt-6-astra-medium` | GPT-6 Astra (medium) | 49.7 | unmapped — sin catalog key en S1 |
| `gpt-6-astra-xhigh` | GPT-6 Astra (xhigh) | 52.5 | unmapped — sin catalog key en S1 |
| `glm-5-3` | GLM-5.3 (max) | **44.9** | **ALIAS → `glm53` (effort `max`)** |
| `glm-5-3-flash` | GLM-5.3-Flash | 41.9 | unmapped — display name sin sufijo de effort |
| `qwen3-8-flash-next` | Qwen3.8-Flash-Next | 39.9 | unmapped — sin sufijo + drift de nombre vs stub `qwen38flash` |
| `longcat-2-0` | LongCat 2.0 | 19.7 | unmapped — display name sin sufijo de effort |
| `hy3` | Hy3 | 25.8 | ya mapeado (`opencodeHy3`) |
| `hy3-preview` | Hy3-preview (Reasoning) | 22.7 | unmapped — sin catalog key |
| `muse-spark-1-3` | Muse Spark 1.3 (max) | 48.2 | ya mapeado (`musespark13`) |
| `muse-spark-1-3-xhigh` | Muse Spark 1.3 (xhigh) | 45.2 | unmapped — sin catalog key (el stub `musespark13contributor` es otra identidad OpenCode) |
| `minimax-m3` | MiniMax-M3 | 29.6 | ya mapeado (`minimaxm3`) — cierre de identidad §3 |
| `minimax-m2-7` | MiniMax-M2.7 | 23.2 | ya mapeado (`minimaxm27`) |
| `deepseek-v4-flash` | DeepSeek V4 Flash 0731 (Reasoning, Max Effort) | 34.5 | ya mapeado (`deepseekv4f`) |
| `deepseek-v4-pro` | DeepSeek V4 Pro 0813 (Reasoning, Max Effort) | 36.3 | ya mapeado (`deepseekv4p`) |
| `deepseek-v4-1-flash` | DeepSeek V4.1 Flash (Reasoning, Max Effort) | 39.5 | unmapped — V4.1 ≠ V4 Flash 0731 (§3) |
| `deepseek-v4-flash-0420` | DeepSeek V4 Flash (Reasoning, Max Effort) | 24.6 | unmapped — release viejo (§3) |
| `deepseek-v4-flash-0420-high` | DeepSeek V4 Flash (Reasoning, High Effort) | 24.8 | unmapped — release viejo (§3) |
| `deepseek-v4-flash-0420-non-reasoning` | DeepSeek V4 Flash (Non-reasoning) | 18.9 | unmapped — release viejo (§3) |
| `deepseek-v4-pro-0424` | DeepSeek V4 Pro (Reasoning, Max Effort) | 30.9 | unmapped — release viejo (§3) |
| `deepseek-v4-pro-0424-high` | DeepSeek V4 Pro (Reasoning, High Effort) | 30.1 | unmapped — release viejo (§3) |
| `deepseek-v4-pro-0424-non-reasoning` | DeepSeek V4 Pro (Non-reasoning) | 20.8 | unmapped — release viejo (§3) |
| `deepseek-v4-flash-vision` | DeepSeek V4 Flash Vision (Reasoning, Max Effort) | 35 | unmapped — los stubs `deepseekv4flashvisionexp*` son tiers de precio OpenCode, no identidades AA |

### Stubs del catálogo sin fila live AA (búsqueda exacta por slug/nombre)

`omenalpha`, `hy4preview`, `deepseekv4propeak`, `deepseekv4prooffpeak`, `deepseekv4flashpeak`, `deepseekv4flashoffpeak`, `deepseekv4flashvisionexp`, `deepseekv4flashvisionexppeak`, `deepseekv4flashvisionexpoffpeak`, `musespark13contributor`, `musespark12contributor`: **sin contraparte live** — permanecen unmapped (fail-closed). `detectMissing` los WARNeará y preservará en el próximo run AA.

### Slugs curados hoy ausentes del payload live (WARN + preserve, no fatal)

`deepseek-v4-flash-non-reasoning` y `deepseek-v4-pro-non-reasoning` no aparecen en esta captura; `detectMissing` debe WARNear y el registro curado se preserva (contrato existente, sin cambios en S1).

## 3. Cierre de identidad duplicada (tarea 1.2)

Decisiones cerradas **antes** de que cualquier alias toque esos ids; los ambiguos quedan unmapped:

- **DeepSeek `v4f`/`v4p` vs `0813`/`V4.1`:**
  - `deepseek-v4-pro` (0813) sigue siendo la única identidad de `deepseekv4p`; `deepseek-v4-flash` (0731) la única de `deepseekv4f`. Sin cambios.
  - `deepseek-v4-1-flash` (V4.1) es un release **distinto** → **unmapped**. No se crea ningún id nuevo por alias (prohibido en S1: cero mutación de `models.json`).
  - `deepseek-v4-pro-0424*` y `deepseek-v4-flash-0420*` son releases **viejos** → **unmapped** (no colapsan al id 0813/0731).
  - Los stubs `deepseekv4*peak`/`*offpeak`/`*visionexp*` son variantes de precio OpenCode, no filas AA → **unmapped**.
- **MiniMax `minimaxm3` same-or-distinct:** existe **una sola** fila AA `minimax-m3` (display "MiniMax-M3", precio 0.3/1.2) que coincide en nombre y precio con el registro curado `minimaxm3` → **misma identidad**, ya mapeada; no se crea ni se toca nada. No hay fila `M3.x`/`0813` alternativa en el payload.

Evidencia ejecutable: `tests/_aa-safety.test.js` ("duplicate-identity / no-evidence slugs stay uncurated") + `tests/aa-effort.test.js` ("TRIANGULATE — duplicate-identity slugs stay ignored (V4.1 / 0424 / xhigh)").

## 4. Filas de alias agregadas (tarea 1.4)

`data/aa-aliases.json` pasa de **71 → 74** filas (`_meta.version` sigue **2**; `_meta.lastUpdated` 2026-09-13 con notas del slice). Effort tomado **solo** del sufijo del display name (evidencia §2):

| Slug | `to` | `effort` | Evidencia (display name live) |
|---|---|---|---|
| `grok-4-6` | `grok46` | `high` | "Grok 4.6 (high)" — bare slug NO es `max` |
| `glm-5-3` | `glm53` | `max` | "GLM-5.3 (max)" |
| `gpt-6-astra-low` | `gpt6astraLow` | `low` | "GPT-6 Astra (low)" |

Los tres targets son filas de catálogo **existentes** (stubs auto-creados por `scrape-opencode-prices` con `availability` completa), así que el gate de matriz no cambia y no hay altas nuevas. El backfill de II/precio de estos tres es de **S2** (no de este slice); la disponibilidad fail-closed para altas nuevas sigue cubierta por el write-guard del scraper (test existente en `data-integrity`).

## 5. Gate S1 (tarea 1.6)

Comando focused (tal como en `tasks.md`):

```
pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js
```

Resultado: **2 passed / 3 failed-to-collect** (48 tests passed). Las 3 suites no colectan por un fallo pre-existente de resolución de vitest 1.6.1 al importar `scripts/propagate-provider-availability.mjs` (reproducido también con Node 20 vía `pnpm dlx node@20.19.5`; **idéntico antes y después de este slice**, sin parche de tests per instrucción). Los invariantes que esas 3 suites protegen se re-corrieron como espejo standalone bajo Node 20 (§6).

`git diff --stat` del slice (solo superficies permitidas; sin `models.json`, sin `js/`):

```
 data/aa-aliases.json      |  7 +-
 tests/_aa-safety.test.js  | 64 +-
 tests/aa-effort.test.js   | 121 +-
 tests/data-integrity.test.js | 32 +-
```

Nota de alcance: `tests/data-integrity.test.js` se ajusta (superficie permitida explícita) porque sus dos invariantes de "AA-owned set == alias target set" son estructuralmente incompatibles con mapear stubs aún no-AA; el contrato transicional queda explícito (`AA_MAPPED_PENDING_BACKFILL`) y S2 debe vaciarlo. No hay flips de aserciones de scoring (el assert de fuente del scorer en `data-integrity` queda intacto).

## 6. Espejos de invariantes bajo Node 20 (suites no colectables)

Scripts standalone (fuera del repo, no commiteados) sobre los mismos datos:

- Espejo `data-integrity` (alias targets / AA ownership / schema 5 / II finite-or-null / las 3 filas nuevas): **ALL ASSERTIONS PASS**.
- Espejo `availability-matrix` + `propagate` (cero celdas faltantes, booleans, herencia de variantes, overrides honorados): **ALL ASSERTIONS PASS**.

`data/models.json` y `data/providers.json` no fueron tocados por el slice, por lo que esos gates son byte-estables.

## 7. Rollback check S1 (tarea 1.7)

Procedimiento probado con `git show <slice-base>:data/aa-aliases.json` (no toca el índice):

- Tabla previa restaurada (**71 filas**): `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js` → **8 failed | 40 passed**. Los 8 fallos son exactamente las aserciones S1 en modo "missing row" (`mapAaSlug → null`, pending lists `[]`); el resto de las suites previas sigue verde → los registros curados se preservan y los slugs nuevos vuelven a ser ignorados.
- Tabla del slice restaurada (**74 filas**): misma corrida → **48/48 passed**.

No se ejecuta ningún scraper "de reversa"; el rollback es restore exacto del JSON + expectativas de test (contrato de slices data-only).

---

# S2a — Ranking-relevant II backfill (chatgpt-plus + anthropic) — tareas 2.1–2.11

Slice: **S2a (PR 2/6)** · Rama: `feat/aa-only-s2a-backfill` (base `cc1cab2`) · Captura reuse: **S1 live capture `2026-09-13T03:53:18.345Z`, 646 items, HTTP 200** (misma fecha UTC que la materialización `2026-09-13`; no stale, sin re-fetch; key solo en memoria, payload fuera del repo).
Reglas: pnpm only, strict TDD (data JSON usa manifest+gate), sin tocar `providers.json`/`benchlm`/`minReasoning`/counts, `model-scorer.js` intacto, cero `intelligenceIndex` bajo `js/`.

## 2.1 — Pre-mutation gate: three-bucket recount (BLOCKING, two-bucket bloquea S2)

Tabulado sobre `data/models.json` base (88 ids, `Number.isFinite`):

| Bucket | Definición | Count |
|---|---|---:|
| II-covered | `Number.isFinite(intelligenceIndex)` | **8** |
| benchlm-only | finite `benchlm.score` AND NOT II-covered (`kimik3` precedent) | **22** |
| fully-scoreless | neither finite | **58** |
| **Total** | suma = catálogo | **88** |

II-covered (8): `gpt55:38.6`, `gpt56terra:42.3`, `gpt56luna:37.5`, `gpt56sol:47.1`, `gpt6astra:52.8`, `gpt54:39`, `claudeOpus5:50.7`, `musespark13:48.2`.
`kimik3` clasifica **benchlm-only** (`benchlm.score 80.96`, sin key `intelligenceIndex`) — precedente verificado. Suma 8+22+58=88 = catálogo. **Gate PASS: conteo de tres buckets, S2 puede empezar.**

## 2.2 — Fable live-slug verdict D4 (BLOCKING, sin handling antes del cierre)

Procedimiento diseño §8 contra la captura §1.1 (`entry.slug === 'claude-fable-5'`):

- Exact matches: **1** (≤1 OK). Slug: `claude-fable-5` · Display: `Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)` · II exacto: **49.7** (finite) · pricing live 10/50.
- Alias comprometido: `claude-fable-5 → claudeFable5` con `effort: 'max'` — validado en `data/aa-aliases.json`.
- Rama: **present + finite II → backfill valor exacto 49.7 + source tuple**; incluido en cálculos S2a. `benchlm` queda byte-idéntico (83.68 verificado en 2.5/2.10).
- `fetchedAt`: **2026-09-13T03:53:18.345Z**.

## 2.3 — Temporary candidate (sin mutación canónica)

Proyección S2a generada fuera del worktree (`s2a-projection.json`, 43 rows: todos los catalog ids con `availability chatgpt-plus|anthropic`, incl. effort variants, Astra, Fable) desde la tabla comprometida. Payload: copia S1 `aa-live-payload.json` (646 items). Copia: `models-copy.json` de `data/models.json` base.

- `node scripts/scrape-artificialanalysis.js --alias <temp-projection> --source <temp-payload> --file <temp-models-copy> --dry-run` → **ok:true, dryRun:true, changes:240** (missing = 45 ids no-S2a preservados, WARN+preserve).
- Mismo comando sin `--dry-run` sobre la copia → **ok:true, changes:240**. Gates 2.4/2.5 evalúan SOLO sobre este candidato.
- Nota de formato: el candidato usa `JSON.stringify` plano (availability multi-línea); el canónico usa `serializeModels` inline. El delta canónico (2.7) es quirúrgico II+sources+lastRun con el formatter canónico, no copia del candidato.

## 2.4 — Pre-mutation gate: Astra maximum (BLOCKING para 2.5+)

Máximo real sobre finite-II + active + `chatgpt-plus` en el candidato temporal: **`gpt6astra` 52.8** (chatgpt-plus active finite-II max; runner-up `gpt56sol` 47.1 / `gpt6astraLow` 46). **Máximo id === `gpt6astra` → Gate PASS.** Sin mutación canónica pendiente, sin excepciones de scorer/sort. Si max ≠ gpt6astra el slice se detiene (no ocurrió).

## 2.5 — Preservation pre-check (sobre el candidato; cualquier diff bloquea)

- `JSON.stringify(model.benchlm)` para los 43 ids S2a: **0 diffs** (incl. Fable 83.68 byte-idéntico).
- `availability` deep-equal 43/43: **0 diffs** (write-guard intacto).
- `data/providers.json`: **byte-idéntico** (scraper nunca lo nombra; verificado `git diff --stat` vacío para ese path).
- `schemaVersion`: **5** (origen y candidato); `DATA_FILES`: **6** (`data-loader.js`).
- Source tuples dedupe por `(url,date,scraper)`: **0 duplicados** en los 43 ids.
- `lastSynced` candidato 2026-09-13 vs base 2026-09-10: bump esperado del write path (no es señal de ranking; freshness S3b lo consume).
- **Pre-check PASS → 2.7 puede materializar el delta seleccionado.**

## S2a live-exact rows (43/43 finite, fuente §1.1)

| Catalog id | Live slug | II exacto |
|---|---|---:|
| `opus48` | `claude-opus-4-8` | 42 |
| `gpt55` | `gpt-5-5` | 38.6 |
| `gpt55High` | `gpt-5-5-high` | 37.3 |
| `gpt55Medium` | `gpt-5-5-medium` | 34.2 |
| `gpt55Low` | `gpt-5-5-low` | 30.7 |
| `gpt55NonReasoning` | `gpt-5-5-non-reasoning` | 23.2 |
| `gpt56terra` | `gpt-5-6-terra` | 42.3 |
| `gpt56terraXhigh` | `gpt-5-6-terra-xhigh` | 38.2 |
| `gpt56terraHigh` | `gpt-5-6-terra-high` | 34.5 |
| `gpt56terraMedium` | `gpt-5-6-terra-medium` | 30.4 |
| `gpt56terraLow` | `gpt-5-6-terra-low` | 27.9 |
| `gpt56terraNonReasoning` | `gpt-5-6-terra-non-reasoning` | 22.3 |
| `gpt56luna` | `gpt-5-6-luna` | 37.5 |
| `gpt56lunaXhigh` | `gpt-5-6-luna-xhigh` | 34.8 |
| `gpt56lunaHigh` | `gpt-5-6-luna-high` | 32.4 |
| `gpt56lunaMedium` | `gpt-5-6-luna-medium` | 25.5 |
| `gpt56lunaLow` | `gpt-5-6-luna-low` | 21.5 |
| `gpt56lunaNonReasoning` | `gpt-5-6-luna-non-reasoning` | 16.8 |
| `gpt56sol` | `gpt-5-6-sol` | 47.1 |
| `gpt56solXhigh` | `gpt-5-6-sol-xhigh` | 44.1 |
| `gpt56solHigh` | `gpt-5-6-sol-high` | 42.5 |
| `gpt56solMedium` | `gpt-5-6-sol-medium` | 39.5 |
| `gpt56solLow` | `gpt-5-6-sol-low` | 33.8 |
| `gpt56solNonReasoning` | `gpt-5-6-sol-non-reasoning` | 28.3 |
| `gpt6astra` | `gpt-6-astra` | 52.8 |
| `gpt6astraLow` | `gpt-6-astra-low` | 46 |
| `gpt54` | `gpt-5-4` | 39 |
| `gpt54Low` | `gpt-5-4-low` | 27.6 |
| `gpt54NonReasoning` | `gpt-5-4-non-reasoning` | 18.2 |
| `claudeFable5` | `claude-fable-5` | 49.7 |
| `sonnet5` | `claude-sonnet-5` | 38.4 |
| `sonnet5High` | `claude-sonnet-5-high` | 32 |
| `sonnet5Xhigh` | `claude-sonnet-5-xhigh` | 34.7 |
| `sonnet5Medium` | `claude-sonnet-5-medium` | 28.4 |
| `sonnet5Low` | `claude-sonnet-5-low` | 24.7 |
| `sonnet5NonReasoning` | `claude-sonnet-5-non-reasoning` | 28.9 |
| `haiku45` | `claude-4-5-haiku` | 15.4 |
| `haiku45Reasoning` | `claude-4-5-haiku-reasoning` | 17.6 |
| `claudeOpus5` | `claude-opus-5` | 50.7 |
| `claudeOpus5High` | `claude-opus-5-high` | 48.2 |
| `claudeOpus5Xhigh` | `claude-opus-5-xhigh` | 49.7 |
| `claudeOpus5Medium` | `claude-opus-5-medium` | 45.1 |
| `claudeOpus5Low` | `claude-opus-5-low` | 39.8 |

De los 43, 7 ya tenían II (`gpt55`, `gpt56terra`, `gpt56luna`, `gpt56sol`, `gpt6astra`, `gpt54`, `claudeOpus5`); **36 son backfill nuevo**. Todos finite → copia verbatim, sin clamp/round. Chart público redondea; acá vale el payload exacto.

## 2.10 — Gate: recount + matrix + benchlm hands-off (sobre datos canónicos)

- Recount post-S2a sobre `data/models.json`: **II-covered 44 / benchlm-only 18 / fully-scoreless 26 = 88**. Movimiento desde 2.1: **8→44 (+36 nuevo backfill), 22→18 (−4: `opus48`, `claudeFable5`, `sonnet5`, `haiku45` pasan a II-covered), 58→26 (−32)**. `kimik3` sigue benchlm-only (80.96, sin key II). Suma 88 = catálogo.
- S2a focused command: `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js` → **2 passed / 3 failed-to-collect (pre-existente) — 56 tests passed** (scrape 27 + aa-effort 29). Las 3 suites no colectan por el fallo pre-existente de vitest 1.6.1 con `scripts/propagate-provider-availability.mjs` (idéntico pre/post slice; verificado por espejos standalone en S1 §6 y re-verificado aquí por comparación directa base↔canónico).
- Re-verificación 2.5 sobre canónico vs base `cc1cab2`: **benchlm 0 diffs (43/43, incl. Fable 83.68), availability 0 diffs (43/43), `providers.json` git-clean, `schemaVersion` 5, `DATA_FILES` 6, sources dedupe 0 duplicados, ids no-S2a byte-idénticos (45/45)**. `lastSynced` base 2026-09-10 → S2a conserva la fecha del documento base en esta materialización quirúrgica (el bump del write path del scraper no se aplica al canónico; S3b consumirá `lastRun` AA).
- Movimiento registrado: este §2.10 + tabla S2a (§S2a live-exact rows) + `evidence/s2a-role-outcomes.md`.

## 2.11 — Rollback check (S2a)

Procedimiento con backup (sin scraper de reversa, nunca compensar):

- `cp data/models.json /tmp/s2a-rollback-backup-models.json` → `git checkout HEAD -- data/models.json` → base restaurada: **II-covered 8, Fable II undefined, schema 5, lastRun ausente**; `pnpm vitest run tests/aa-effort.test.js` → **9 failed / 20 passed** — los 9 fallos son exactamente las aserciones S2a en modo "missing II" (live-exact, Fable, shrink, gpt6astraLow, triangulación, acceptance); registros curados preservados, slugs siguen mapeados.
- `cp /tmp/s2a-rollback-backup-models.json data/models.json` → S2a restaurada: **II-covered 44**; `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js` → **56 passed**.
- Rollback completo (datos + expectativas base) = baseline registrado al inicio del slice: **2 passed / 3 failed-to-collect, 45 tests passed** (scrape 25 + aa-effort 20). El restore es JSON exacto + expectativas exactas, nunca migración reversa ni scores inventados.
- **Budget trip (bloqueante para commit):** superficies de review `models.json`+tests = **660 líneas cambiadas** (numstat vs `cc1cab2`: models 257+36=293, aa-effort 157+3=160, data-integrity 43+1=44, fixture 58+1=59, scrape 104+0=104) — **excede el budget de 400**. **NO se commitea.** Pre-split plan (tasks.md): dividir en **S2a-1 (`chatgpt-plus` incl. Astra/Astra-Low, ~22 II nuevos)** y **S2a-2 (`anthropic` incl. Fable, ~14 II nuevos)** como dos PRs apilados; nunca inferir `size:exception`. Trabajo dejado sin commitear en `feat/aa-only-s2a-backfill` para revisión del parent.
