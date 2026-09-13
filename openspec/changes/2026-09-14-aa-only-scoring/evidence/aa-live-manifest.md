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
