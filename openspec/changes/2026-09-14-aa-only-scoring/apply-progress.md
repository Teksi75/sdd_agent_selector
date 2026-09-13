# Apply Progress — 2026-09-14-aa-only-scoring

Artifact store: **openspec** · Run: **S1 (PR 1/6 de la cadena stacked-to-main)** · Fecha de captura/evidencia: 2026-09-13 · Modo: auto · Strict TDD: **activo** (`openspec/config.yaml`: `strict_tdd: true`, runner `pnpm vitest run` focused / `pnpm test` full, CI Node 20 gobierna)

Primer run de apply para este change; este archivo es acumulativo (no existía apply-progress previo). Slice ejecutado: **S1 — Alias mass-mapping (tareas 1.1–1.7)**. Nada de S2+ fue tocado.

## S1 — Alias mass-mapping (data-only) — PR 1

- **Implementation status: complete (7/7 tareas S1).** Captura live única, manifiesto de evidencia, cierre de identidad duplicada, filas de alias con effort explícito, asserts RED/GREEN/TRIANGULATE, gate y rollback check ejecutados.
- **Delivery status: slice listo para PR 1** en la rama `feat/aa-only-s1-aliases` (base `7674ae64a782c206c7f92e170ad1f5c70c785e5d`). Se commitean **solo** las superficies permitidas. No se tocaron los archivos de trabajo pre-existentes del usuario (`.atl/*`, `.gitignore`, `openspec/specs/model-picker/spec.md`) ni PRs #72–#78.
- **Budget:** **224 líneas cambiadas** en las 4 superficies código/datos/tests (forecast S1: 180–300, riesgo Low). El manifiesto de evidencia (~150 líneas) y esta bitácora son artefactos SDD requeridos por las tareas.

### Completed tasks (persisted checkboxes `[x]` in `tasks.md`)

| Task | Summary | Persisted |
|---|---|---|
| 1.1 | Captura live `api/v2/data/llms/models` → HTTP 200, **646 items**, `fetchedAt 2026-09-13T03:53:18.345Z`; key desde `%USERPROFILE%/.config/sdd-agent-selector/aa_api_key` solo en memoria; payload en temp **fuera del repo**; manifest `evidence/aa-live-manifest.md` con slugs candidatos (`grok-4-6`, `gpt-6-astra-low`, stubs opencode) + II exactos; `git diff --stat -- data/` vacío al momento de la captura | `[x]` |
| 1.2 | Cierre de identidad DeepSeek (`v4f`/`v4p` 0731/0813 únicos; `deepseek-v4-1-flash` V4.1 y releases 0424/0420 **unmapped**) y MiniMax (`minimax-m3` = `minimaxm3`, **misma identidad**, sin duplicado) documentado en §3 del manifest; ambiguos fail-closed | `[x]` |
| 1.3 | **RED:** asserts nuevos en `_aa-safety` (mapping exacto, bare-slug ≠ max, ambiguos ignorados, `detectMissing` WARN+preserve) y `aa-effort` (esfuerzo cerrado, listas transicionales) → **8 failed / 38 passed**, todos por fila faltante | `[x]` |
| 1.4 | **GREEN:** `data/aa-aliases.json` 71→74 filas (`grok-4-6→grok46 high`, `glm-5-3→glm53 max`, `gpt-6-astra-low→gpt6astraLow low`), `_meta.version` sigue 2 → **48/48 passed** | `[x]` |
| 1.5 | **TRIANGULATE + REFACTOR:** xhigh/high no colapsan a otro effort, slug no curado no crea entrada de catálogo, identidad duplicada ignorada; constantes transicionales reubicadas y entrada muerta removida — 48/48 passed | `[x]` |
| 1.6 | **Gate:** comando focused S1 → 2 suites passed (48 tests) / 3 failed-to-collect **pre-existente**; `git diff --stat` solo superficies permitidas (sin `models.json`, sin `js/`, sin flips de scoring) | `[x]` |
| 1.7 | **Rollback check:** tabla previa (71) → 8 failed / 40 passed (missing-row; curados preservados); tabla del slice (74) → 48/48 | `[x]` |

### Files changed (slice scope)

| Path | Líneas (`git diff --numstat`) |
|---|---:|
| `data/aa-aliases.json` | +5 / −2 |
| `tests/_aa-safety.test.js` | +62 / −2 |
| `tests/aa-effort.test.js` | +113 / −8 |
| `tests/data-integrity.test.js` | +26 / −6 |
| `openspec/changes/2026-09-14-aa-only-scoring/evidence/aa-live-manifest.md` (nuevo) | ~150 |
| `openspec/changes/2026-09-14-aa-only-scoring/apply-progress.md` (nuevo, este archivo) | ~170 |
| `openspec/changes/2026-09-14-aa-only-scoring/tasks.md` (7 checkboxes) | 7 líneas |

**Cero cambios** en `data/models.json`, `data/providers.json`, `js/`, `css/`, `scripts/`. Verificado con `git diff --stat` y `git status --porcelain`.

### Test commands run (evidence)

| Command | Result |
|---|---|
| `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js` (RED, 1.3) | **8 failed / 38 passed (46)** — fallos por fila faltante: `toHaveLength(74) but got 71`, `mapAaSlug → null`, listas pending `[]` |
| `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js` (GREEN, 1.4) | **2 files passed / 46 passed** |
| `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js` (TRIANGULATE, 1.5) | **2 files passed / 48 passed** |
| S1 focused command (1.6): `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js` | **2 passed / 3 failed-to-collect (pre-existente) — 48 tests passed** |
| `pnpm dlx node@20.19.5 <espejo data-integrity>` (alias targets / AA ownership / schema 5 / II finite-or-null) | **ALL ASSERTIONS PASS** |
| `pnpm dlx node@20.19.5 <espejo availability-matrix + propagate>` | **ALL ASSERTIONS PASS** |
| Rollback 1.7: tabla previa (71) → tests S1 | **8 failed / 40 passed** (missing-row; curados preservados, slugs nuevos ignorados) |
| Rollback 1.7: tabla del slice (74) → tests S1 | **48/48 passed** |

**Nota Node/collection (pre-existente, no se parchea):** `availability-matrix`, `data-integrity` y `propagate-provider-availability` no colectan por `SyntaxError: Invalid or unexpected token` (`node:vm`) al importar `scripts/propagate-provider-availability.mjs` con vitest 1.6.1. Reproducido también bajo **Node 20.19.5** (`pnpm dlx node@20`), idéntico antes y después del slice; los invariantes que protegen se re-corrieron como espejo standalone bajo Node 20 (arriba). CI Node 20 gobierna.

### TDD Cycle Evidence (strict TDD activo)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 / 1.2 | `evidence/aa-live-manifest.md` (captura live + decisiones) | Data/manifest | N/A (data-only) | ✅ Manifest escrito y verificado contra el payload (git diff `data/` vacío en la captura) | ✅ HTTP 200 / 646 items / 74 filas decididas | ✅ Slugs candidatos extra (variantes xhigh/medium/low, stubs sin fila live, slugs curados ausentes) enumerados | ➖ Doc-only |
| 1.3 | `tests/_aa-safety.test.js`, `tests/aa-effort.test.js` | Unit | ✅ Baseline 38/38 (2 suites que colectan) | ✅ Escrito — 8 failed / 38 passed, todos por fila faltante | — (lo cierra 1.4) | — | — |
| 1.4 | `data/aa-aliases.json` + los 2 suites | Unit (datos) | ✅ 38/38 pre-edit | — | ✅ 46/46 passed (3 filas + `_meta`) | — | — |
| 1.5 | `tests/_aa-safety.test.js`, `tests/aa-effort.test.js` | Unit | ✅ 46/46 | — | — | ✅ xhigh ≠ max, slug no curado sin entrada de catálogo, identidad duplicada ignorada → 48/48 | ✅ Constantes transicionales hoisted; entrada muerta `gpt6astraLow` removida de `CURATED_NON_AA_EFFORT`; sin cambio de conducta |
| 1.6 | S1 focused command + `git diff --stat` | Gate (no test unitario) | ✅ 48/48 de las suites que colectan | — | — | — | ➖ |
| 1.7 | Rollback run (tabla previa 71 filas) | Gate de rollback | ✅ 48/48 | Tabla previa → 8 failed / 40 passed (missing-row; curados preservados) | Tabla del slice → 48/48 | — | ➖ |

Sustitución data-only (regla global de `tasks.md`): 1.1/1.2 usan **manifiesto + gate diff** en lugar de RED/GREEN productivo (no existe código productivo en el slice).

### Test Summary

- **Tests escritos en S1: 10 nuevos** (`_aa-safety`: mapping exacto, bare-slug ≠ max, duplicados/no-evidencia ignorados, xhigh nunca colapsa, `detectMissing` WARN+preserve; `aa-effort`: filas S1 exactas, bare-slug, targets con availability completa, TRIANGULATE no-catálogo, TRIANGULATE duplicados) + 3 reescrituras de invariantes existentes.
- **Tests pasando**: **48/48** en las dos suites colectables (baseline previo 38/38 → +10). Las otras 3 suites del comando focused fallan **al colectar** por causa pre-existente (no son fallos de test).
- **Capas usadas**: Unit/data 10; sin integración/E2E (slice de datos).
- **Approval tests**: ninguno (no se refactorizó código productivo existente).
- **Funciones puras creadas**: 0 (slice data-only; la superficie de producción es JSON).

### Deviations from design / tasks

1. **`tests/data-integrity.test.js` ajustado (superficie permitida explícita del parent).** La tarea 1.6 dice "solo `aa-aliases.json` + los dos test files"; dos invariantes de `data-integrity` (`AA-owned set == alias target set`, dos veces) son **estructuralmente incompatibles** con mapear stubs todavía no-AA sin tocar `models.json` (prohibido en S1). Se introdujo `AA_MAPPED_PENDING_BACKFILL` explícito (revisable) y la igualdad estricta se restaura cuando S2 materialice esos 3 ids; **ningún assert de scoring fue flipeado** (el assert de fuente del scorer sigue intacto). Se reporta como desviación consciente y acotada.
2. **Sin altas de catálogo en S1.** Los 3 alias apuntan a filas de catálogo ya existentes (stubs `scrape-opencode-prices` con `availability` completa); la regla "altas nuevas fail-closed (`availability: {}`)" queda cubierta por el write-guard existente (test de `data-integrity`) y se ejecutará en S2 cuando el scraper materialice esfuerzo/precio/II.
3. **Fallo de colección reproducido también en Node 20.19.5 local** (no solo Node 24, como asumía el contexto del parent): se documenta como pre-existente idéntico pre/post slice y se verifica por espejos; no se parchearon tests ni config.

### Remaining tasks (exact unchecked lines from `tasks.md`)

Resumen: **37 unchecked** (S2a–S4), **0 restantes en S1**. Líneas exactas:

```
- [ ] **2.1 — Pre-mutation gate: three-bucket recount.** Tabulate over `data/models.json`: II-covered (`Number.isFinite(intelligenceIndex)`), benchlm-only (finite `benchlm.score` AND not II-covered — `kimik3` precedent), fully-scoreless (neither finite); assert the sum equals catalog size and record counts in `evidence/aa-live-manifest.md`. **Blocking: S2 must not start on a two-bucket count.** <!-- sdd-owner: implementation -->
- [ ] **2.2 — Fable live-slug verdict (D4).** Run design §8 procedure against the §1.1 capture: exact predicate `entry.slug === 'claude-fable-5'`, assert at most one exact match, validate the committed alias maps to `claudeFable5` with `effort: 'max'`. Branch: present + finite II → backfill exact value + source tuple; present + non-finite → `null` + omission note; slug absent → no synthesized row, `detectMissing` warns, stays hidden. Record verdict + `fetchedAt` in the manifest; verify the `benchlm` block is byte-identical before/after. **Blocking: no Fable handling before this task closes.** <!-- sdd-owner: implementation -->
- [ ] **2.3 — Temporary candidate (no canonical mutation).** Generate the S2a alias projection (all `chatgpt-plus` + `anthropic` catalog ids incl. effort variants, Astra, Fable) outside the worktree; run `node scripts/scrape-artificialanalysis.js --alias <temp-projection> --source <temp-payload> --file <temp-models-copy> --dry-run`, then the same command without `--dry-run` on the temp copy. Gates evaluate on the candidate only. <!-- sdd-owner: implementation -->
- [ ] **2.4 — Pre-mutation gate: Astra maximum.** Compute the real maximum over finite-II, active, `chatgpt-plus` rows in the temporary candidate. If the maximum id is **not** `gpt6astra`: **stop**, record the observed maximum + live evidence in the manifest, and ask under ask-on-risk. Do not write canonical data and do not add scorer/sort exceptions. **Blocking for 2.5+.** <!-- sdd-owner: implementation -->
- [ ] **2.5 — Preservation pre-check.** On the candidate, compare `JSON.stringify(model.benchlm)` and deep-equal `availability` for every touched id; confirm `data/providers.json` byte-identical, `schemaVersion: 5`, `DATA_FILES` 6, and source tuples dedupe by `(url, date, scraper)`. Any difference blocks the slice. Evidence: diff output in the manifest. <!-- sdd-owner: implementation -->
- [ ] **2.6 — RED: provenance/coverage assertions.** Extend `tests/fixtures/aa-sample.json` with the real II path and add failing cases to `tests/scrape-artificialanalysis.test.js` (finite copied verbatim — no clamp/round; covered-but-absent → `null` + idempotent omission note; source tuple appended once), `tests/aa-effort.test.js` / `tests/data-integrity.test.js` (every finite II carries its own `sources[]`; three buckets; Fable branch per 2.2). Confirm red for the right reason via `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js tests/data-integrity.test.js`. <!-- sdd-owner: implementation -->
- [ ] **2.7 — GREEN: materialize S2a into canonical data.** Apply the selected JSON delta to `data/models.json` (merge `{...existing, ...patch, effort}`, new ids fail-closed `availability: {}`), append `{url: 'https://artificialanalysis.ai/', date, scraper: 'scrape-artificialanalysis'}` per value, and record `_meta.scrapers['scrape-artificialanalysis'].lastRun` (only because the run was valid + wrote successfully). Re-run the focused command until green. <!-- sdd-owner: implementation -->
- [ ] **2.8 — TRIANGULATE + REFACTOR.** Add a second exact-value case (live-exact beats chart rounding) and a covered-but-null case; refactor duplicated manifest/test fixture helpers; keep tests green. <!-- sdd-owner: implementation -->
- [ ] **2.9 — Per-role outcome enumeration (frozen thresholds).** Write `evidence/s2a-role-outcomes.md`: provider scope, strategy, old/new reference identity, cost-ceiling deltas, and the 18-role table classified `assigned` / `soft:designated` / `soft:cost` / `unassigned`. Add an acceptance test that **recomputes** maxima and candidate pools from `models.json` at test time (reads II directly, not the still-benchlm public scorer) and asserts classification/invariants only — no hardcoded winner key or II value. <!-- sdd-owner: implementation -->
- [ ] **2.10 — Gate: recount + matrix + benchlm hands-off.** Recount the three buckets after S2a, run the S2a focused command, and re-verify 2.5 on canonical data. Record the movement in the manifest. <!-- sdd-owner: implementation -->
- [ ] **2.11 — Rollback check (S2a).** `git checkout <slice-base> -- data/models.json` + restore manifest/expectations; re-verify availability deep-equal, `providers.json` byte-identical, `benchlm` byte-identical, schema 5, matrix green. Never run a compensating/reverse scraper. <!-- sdd-owner: implementation -->
- [ ] **3.1 — Temporary candidate for remaining ids.** Build the S2b projection (all remaining curated catalog ∩ live-AA ids) and run the scraper on a temp `models.json` copy exactly as in 2.3. <!-- sdd-owner: implementation -->
- [ ] **3.2 — RED: remaining-rows assertions.** Extend `tests/scrape-artificialanalysis.test.js`, `tests/aa-effort.test.js`, and `tests/data-integrity.test.js` with the S2b manifest rows (exact II, source tuple, omission/note idempotence, `documentAbsent` once per day). Confirm red. <!-- sdd-owner: implementation -->
- [ ] **3.3 — GREEN: materialize S2b** into `data/models.json` with the same merge/attribution/`lastRun` discipline as 2.7. Re-run the focused command until green. <!-- sdd-owner: implementation -->
- [ ] **3.4 — TRIANGULATE: nullable + omission edges.** Add cases for a covered row that is absent upstream (`null` + note, key never deleted) and an uncovered row (key stays absent, no synthesized null); REFACTOR shared fixture builders. <!-- sdd-owner: implementation -->
- [ ] **3.5 — Gate: final recount + matrix.** Final three-bucket recount recorded in the manifest; availability matrix green; `benchlm` byte-identical; `providers.json` untouched; schema 5. No scorer or UI assertion flips in this slice. <!-- sdd-owner: implementation -->
- [ ] **3.6 — Rollback check (S2b).** Exact JSON restore of `data/models.json` to the S2b base + evidence restore, then re-run the S2b focused command and the matrix suites. <!-- sdd-owner: implementation -->
- [ ] **4.1 — RED: II-core contract tests.** Add failing cases to `tests/model-scorer.test.js` for a new pure module `js/services/ii-score.js`: finite II returned; clamp high (`>100` → `100`); clamp low (`<0` → `0`); missing/`null`/numeric-string/`NaN` → `null` (never `0`); non-object input → `null`; live-exact verbatim; benchlm-inert pair (differing only in `benchlm.score` → identical result); purity (same input → same output, no mutation). Run `pnpm vitest run tests/model-scorer.test.js` and confirm failure for the missing-module reason. <!-- sdd-owner: implementation -->
- [ ] **4.2 — GREEN: create `js/services/ii-score.js`.** Implement only the final contract (`typeof !== 'number' || !Number.isFinite → null`, else `clamp(value, 0, 100)`), no `benchlm`/sister-benchmark reads, no I/O, no imports from surfaces. <!-- sdd-owner: implementation -->
- [ ] **4.3 — TRIANGULATE: clamp boundaries + inert-benchlm** with a second pair of fixtures (`99.9` vs `100.1`, `benchlm` present vs absent with identical II); REFACTOR for a single clamp path. <!-- sdd-owner: implementation -->
- [ ] **4.4 — Dark-path readiness assertion.** Add a `tests/data-integrity.test.js` readiness check: `js/services/ii-score.js` exists and contains `intelligenceIndex`; **no production module under `js/` imports `ii-score.js`** (grep assert over `js/`, tests excluded); public `compositeScore` source still contains `benchlm` and NOT `intelligenceIndex` (the `:740` flip belongs to S3b only). This assert is the executable form of the dark invariant. <!-- sdd-owner: implementation -->
- [ ] **4.5 — Dark invariant verification.** Run `pnpm vitest run tests/model-scorer.test.js tests/data-integrity.test.js` plus the surface suites that must stay untouched (`tests/ref-table.test.js tests/composite-chart.test.js tests/cli-mirror-table.test.js tests/justification-ui.test.js tests/exporter.test.js tests/freshness-badge.test.js tests/staleness-parity.test.js`); all must pass with **zero** diff in those files. <!-- sdd-owner: implementation -->
- [ ] **4.6 — Rollback check (S3a).** Delete `js/services/ii-score.js` and the added tests; no runtime change results (it is unused); full suite still green. S3a may be reverted only after S3b is reverted. <!-- sdd-owner: implementation -->
- [ ] **5.1 — RED: public scorer flip.** Flip `tests/model-scorer.test.js` public expectations (benchlm-clamp → II authority, II-inert → benchlm-inert) and `tests/data-integrity.test.js:740` (source CONTAINS `intelligenceIndex`, contains NO `benchlm` ordering reference). Confirm red. <!-- sdd-owner: implementation -->
- [ ] **5.2 — GREEN: activate `js/services/model-scorer.js`.** Delegate `compositeScore` to the proven `ii-score` core, delete benchlm ordering references, flip `findReferenceModel` to highest finite II (lifecycle priority kept, nulls last, stable input tie-break), and add **finite-II guards to both fallback paths** (role-designated and general cost-clearing) and to `alternatives`. <!-- sdd-owner: implementation -->
- [ ] **5.3 — TRIANGULATE: II-less leakage.** Add the case that proves a benchlm-only model cannot leak through the cost-only fallback or into `alternatives`; REFACTOR shared finite-II predicate. <!-- sdd-owner: implementation -->
- [ ] **5.4 — Shared ranking context `js/services/ii-ranking.js`.** RED `tests/ii-ranking.test.js` first for `resolveIiFreshness(modelsMeta)` (AA `lastRun` → fallback `lastSynced`), `buildIiRankingContext(models, modelsMeta)` (`candidate = provider-filtered AND lifecycle active`; `ranked` = finite II; `hidden` = null II; non-candidates never counted), and `formatHiddenIiNote(count, date)` (`{N} models hidden — no Artificial Analysis Intelligence Index on {date}`; `N = 0` → empty string). GREEN → TRIANGULATE (full-catalog scope builds its own context; never reuse the filtered count). <!-- sdd-owner: implementation -->
- [ ] **5.5 — ref-table + composite-chart.** RED `tests/ref-table.test.js` / `tests/composite-chart.test.js` (Score cell + sort read II; null-II rows removed from DOM — not dimmed, no placeholder; shared note rendered iff N > 0; chart drops "unavailable" rows; title/legend identify AA II). GREEN the components (keep `isNew` pin, II-desc within buckets, cheaper-input tie-break, effort-only, no Tier column). <!-- sdd-owner: implementation -->
- [ ] **5.6 — cli-mirror + justification-ui.** RED `tests/cli-mirror-table.test.js` (18 rows always; II-less/unassigned → `Sin modelo elegible` with zero badges) and `tests/justification-ui.test.js` (18 cards; II score/cost/checks; alternatives finite-II only, II-desc; critical warning for empty eligible set). GREEN both components. <!-- sdd-owner: implementation -->
- [ ] **5.7 — exporter.** RED `tests/exporter.test.js` (ranked bodies contain II-ranked rows only; score lines show II; ranked header carries the shared note as line two with providers+timestamp on line one; no unranked appendix; no tier fragment). GREEN `js/services/exporter.js` incl. the JSDoc/label update from benchlm to AA II. <!-- sdd-owner: implementation -->
- [ ] **5.8 — Freshness retarget + cache/sync wiring.** RED `tests/freshness-badge.test.js` / `tests/staleness-parity.test.js` (AA `lastRun` → `lastSynced`; `>7d` warning references AA II, never benchlm; benchlm timestamps irrelevant; sync-down shows cached II staleness and keeps ranking). GREEN `js/components/freshness-badge.js`, `js/services/data-sync.js` (consume `resolveIiFreshness`; advance AA `lastRun` only after a valid mapped observation + successful write), `js/services/data-loader.js` (`catalogRevision` envelope; equal → reuse, different/old-envelope → refetch, fetch failure → fail-soft cache), and `js/app.js` (one filtered ranking context per render transaction shared by ref-table and composite-chart). <!-- sdd-owner: implementation -->
- [ ] **5.9 — REFACTOR + atomic flip verification.** Run the S3b focused command; confirm no source under `js/` still reads `benchlm` for ordering and no ranked surface renders an II-less row. Verify 18 CLI rows, 18 justification cards, 5 config buttons, 9 workflow rows, hero-stats `"X de Y visibles"`, and `DATA_FILES` 6. <!-- sdd-owner: implementation -->
- [ ] **5.10 — Smoke checks (all five strategies).** Verify filtered and full-catalog export scopes, twin-judge equality (`jd-judge-a` === `jd-judge-b`), manual refresh, cached-failure path, and shared hidden counts across ref-table / composite-chart / ranked export. <!-- sdd-owner: implementation -->
- [ ] **5.11 — Rollback check (S3b).** Revert activation + finite-II guards + `ii-ranking` + surfaces/exporter + freshness/cache wiring **and** their flipped tests together in one commit; product returns to a coherent benchlm runtime while S2 II data remains as inert data. Never delete backfilled II; never invent fallback scores. <!-- sdd-owner: implementation -->
- [ ] **6.1 — Sync the canonical spec.** Merge the delta into `openspec/specs/model-picker/spec.md`: 3 ADDED requirements (AA Alias Mass-Mapping; Fable Conditional Ranking Rule; Three-Bucket Score Coverage Gate), all MODIFIED blocks (Scoring `compositeScore`, `getBestFor`, Data Layer Models, AA Intelligence Index Field, ref-table, composite-chart, cli-mirror, justification-ui, Filtered Export, Freshness Badge, Sync Service, Testing — Scoring, Testing — Data Integrity) with the `weighted-sum → benchlm-clamp → II-only` revert note, and the REMOVED scenario records (Astra-first-as-data-consequence; intelligenceIndex-inert scenarios). Leave the archived change untouched. <!-- sdd-owner: implementation -->
- [ ] **6.2 — Changelog + operator docs.** Document the day-one churn (Fable → hidden or real II, II-less rows leaving ranked views), the D1 hide rule + shared count/note, D2 frozen thresholds (soft-fallback/unassigned storm is expected), D3 fail-soft + no staleness contract change, and D5 inert-not-deleted benchlm ("datum, not signal"). <!-- sdd-owner: implementation -->
- [ ] **6.3 — Final gate + rollback.** Run `pnpm test` and `pnpm build` (CI Node 20 governs; note the pre-existing Node 24 collection failures, never patch tests for them). Rollback order for the whole change: **S3b → S3a → S2b → S2a → S1**, JSON restore for data slices (never a reverse migration, never fallback scores); S4 docs may be reverted first when needed. <!-- sdd-owner: implementation -->
```

### Workload / PR boundary

- **PR 1 (S1): 224 changed lines** sobre `data/aa-aliases.json` + 3 suites de test (forecast 180–300, riesgo Low) → **bajo el budget de 400**.
- PR boundary: este slice **no incluye** backfill de II (S2a/S2b), scorer (S3a/S3b) ni docs canónicas (S4); `evidence/aa-live-manifest.md` y esta bitácora acompañan al slice como evidencia de review.
- Siguiente slice: **S2a** (blocked hasta que S1 aterrice/review), luego S2b → S3a (hard gate con S2a) → S3b → S4.

### Structured status (consumed / produced) y actionContext

- **Consumido:** `applyState: ready`; change `2026-09-14-aa-only-scoring`; `artifactStore: openspec`; `actionContext.mode: repo-local`; `workspaceRoot: D:\Proyectos\sdd_agent_selector`; `allowedEditRoots: [D:\Proyectos\sdd_agent_selector]`; `warnings: []` del motor.
- **Producido:** tasks 1.1–1.7 marcadas `[x]` (persistido en `tasks.md`); este apply-progress; manifest de evidencia.
- **Warnings del parent respetados:** (a) worktree con dirt humano pre-existente intocado y fuera del commit (`.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`, `.gitignore`, `openspec/specs/model-picker/spec.md`); (b) PRs #72–#78 y ramas humanas intactas; (c) CI Node 20 gobierna, fallo de colección pre-existente solo anotado; (d) pnpm only.
- **Gate ask-on-risk de S1:** no se disparó (Astra gate es S2a; budget OK). No se requiere decisión humana para cerrar S1.

---

## S1 Verify Verdict — 2026-09-13 (slice-scoped, S1 ONLY)

- **Scope:** tasks 1.1–1.7 on branch `feat/aa-only-s1-aliases`, commit `db06727` (6 files, +472/−18 vs base `7674ae6`). S2a/S2b/S3a/S3b/S4 absence is NOT a finding. No top-level `verify-report.md` written (reserved for whole-change verification).
- **Verdict: PASS for S1.** S1 may proceed to PR 1 review; S2a unblocked (still gated on S1 landing per tasks.md).

### 1. Task → delta-spec mapping (S1)

| Task | Delta-spec scenario | Result |
|---|---|---|
| 1.1 live capture + manifest (646 items, fetchedAt 2026-09-13T03:53:18.345Z, payload outside repo, `git diff --stat -- data/` empty at capture) | Evidence base for ADDED Alias Mass-Mapping | ✅ manifest §1 confirms |
| 1.2 duplicate-identity close (DeepSeek V4.1/0424/0420 unmapped; MiniMax same-identity; ambiguous fail-closed) | Supports "Effort is never inferred" + fail-closed mapping | ✅ manifest §3 + executable asserts |
| 1.3 RED alias assertions (exact mapping, bare-slug ≠ max, ambiguous ignored, `detectMissing` WARN+preserve) | "Unknown newcomer is invisible until curated" + "Effort is never inferred" | ✅ |
| 1.4 GREEN 71→74 rows (`grok-4-6→grok46 high`, `glm-5-3→glm53 max`, `gpt-6-astra-low→gpt6astraLow low`), `_meta.version` stays 2 | Alias Mass-Mapping rows with suffix-evidenced effort | ✅ re-verified: 74 rows, version 2, 0 bad-effort, 0 dup slugs |
| 1.5 TRIANGULATE (xhigh≠max, uncurated slug → no catalog entry, duplicate identity ignored) + REFACTOR | Triangulation of the two S1 scenarios | ✅ 48/48 |
| 1.6 Gate: S1 focused command + `git diff --stat` touches only allowed surfaces | "Matrix gate stays green after mapping" (within collection limits, see note) | ✅ 2 suites 48/48 + mirrors |
| 1.7 Rollback check (prior table → missing-row failures, slice table → green) | Data-only rollback contract | ✅ procedure re-verified via `git show <base>` pattern; prior-table run reproduces missing-row failures |
| Three-bucket coverage gate | ADDED Three-Bucket requirement, S2 task 2.1 — **correctly pending, NOT due in S1** | ✅ pending, not a finding |

### 2. Focused evidence re-run (this verify)

| Command | Observed |
|---|---|
| `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js` | **2 passed, 48/48 tests passed** ✅ (expectation from parent: 48/48) |
| `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js` | **2 passed / 3 failed-to-collect, 48 tests passed** ✅ — matches the known pre-existing condition (SyntaxError `node:vm` on `scripts/propagate-provider-availability.mjs` import under vitest 1.6.1, identical pre/post slice) |
| Spot-check `data/aa-aliases.json` | 74 rows, `_meta.version` 2; `grok-4-6→grok46/high` ("Grok 4.6 (high)", bare slug NOT max), `glm-5-3→glm53/max`, `gpt-6-astra-low→gpt6astraLow/low`; closed vocabulary 100%, no duplicate slugs ✅ |

### 3. No forbidden mutation (vs base 7674ae6)

- `git diff --name-only 7674ae6..HEAD` filtered for `data/models.json|data/providers.json|js/|benchlm` → **CLEAN, zero hits** ✅
- `git diff 7674ae6..HEAD -- data/models.json data/providers.json` → empty (byte-identical) ✅ — hence no II synthesis, no `benchlm`/`minReasoning` touch, no 18/9/5 count change from this slice.
- Slice touches only: `data/aa-aliases.json` (+5/−2), `tests/_aa-safety.test.js`, `tests/aa-effort.test.js`, `tests/data-integrity.test.js`, + manifest + this log ✅

### 4. Dark invariant for future S3

- `js/services/model-scorer.js` contains **0** `intelligenceIndex` references; still reads `model.benchlm?.score` (benchlm-clamp contract intact) ✅
- `tests/data-integrity.test.js` scorer-source assert still `expect(source).not.toContain('intelligenceIndex')` (the S3b flip is correctly NOT applied) ✅

### 5. Maintainer-record items confirmed (not findings)

- **Transitional `AA_MAPPED_PENDING_BACKFILL` (`glm53`, `gpt6astraLow`, `grok46`) is explicit** in `tests/data-integrity.test.js:52` and `tests/aa-effort.test.js:37`, with the strict-equality restore documented in manifest §5 and the S2-must-empty grip stated ✅ — S2-owned, intentional.
- **size:exception for S1 accepted:** 224 review-surface lines (under the 400 budget) + 266 required SDD evidence lines (manifest + this log) ✅
- **Human-owned dirt untouched:** `.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`, `.gitignore`, `openspec/specs/model-picker/spec.md` remain **unstaged modifications** (not in the slice commit); `design.md`/`explore.md`/`proposal.md`/`specs/`/`tasks.md`/`archive/` remain **untracked**, none committed by this slice ✅

### 6. Strict-TDD spot check (data-only substitution per tasks.md global rule)

- TDD Cycle Evidence table present in apply-progress; RED (8 failed missing-row) → GREEN (48/48) → TRIANGULATE cycle is coherent; re-run confirms GREEN still true ✅
- Assertion audit over the S1 test diff: value assertions on real production calls (`mapAaSlug`, `detectMissing`); no tautologies, no `toBeDefined`-only tests, no mocks, no ghost loops (loops iterate literal non-empty arrays, not query results) ✅
- Coverage/quality tools: not run (data-only JSON slice; no production code changed) — informational only, not a finding.

### Findings (all S1-scoped; zero blockers)

1. (NOTE, pre-existing) 3 suites fail collection under local Node 24 AND Node 20.19.5 — evidence, never a blocker, tests never patched for it. **Open question flagged for the parent:** confirm CI Node 20 actually collects `data-integrity` / `availability-matrix` / `propagate-provider-availability`; if CI also fails collection, that is a pre-existing repo issue to fix OUTSIDE this change.
2. (NOTE) `tests/data-integrity.test.js` deviation (transitional pending-backfill set) is conscious, bounded, and S2-owned — accepted as documented, not a finding.

**Next:** S2a apply (blocked until S1 lands/reviews per tasks.md hard gates).
---

## S2a — Ranking-relevant II backfill (chatgpt-plus + anthropic) — PR 2 (UNCOMMITTED: budget trip)

- **Implementation status: complete (11/11 tareas S2a 2.1–2.11 ejecutadas).** Captura reuse S1, recount tres buckets, veredicto Fable, candidato temporal con gates Astra/preservación, asserts RED/GREEN/TRIANGULATE, materialización canónica quirúrgica, role-outcomes + acceptance test, gate post, rollback check.
- **Delivery status: NO commiteado — budget trip bloqueante.** Superficies de review models.json+tests = **660 líneas** vs budget 400 (models 293, aa-effort 160, data-integrity 44, fixture 59, scrape 104). Pre-split plan: **S2a-1 (chatgpt-plus, ~22 II nuevos) / S2a-2 (anthropic, ~14 II nuevos)** como dos PRs apilados; nunca inferir size:exception. Rama feat/aa-only-s2a-backfill (base cc1cab2) con trabajo sin commitear para revisión del parent.
- **Gates duros: todos PASS.** 2.1 tres buckets (8/22/58, kimik3 benchlm-only, suma 88); 2.2 Fable (1 exact match, finite 49.7, alias max OK, rama present+finite); 2.4 Astra max en candidato (gpt6astra 52.8, no trip); 2.5 preservación en candidato (benchlm 0, availability 0, providers git-clean, schema 5, DATA_FILES 6, dedupe 0).
- **Archivos pre-existentes intactos:** .atl/*, .gitignore, spec.md con el mismo diff que al inicio; archive/, .pi/, PRs no tocados; model-scorer.js intacto; cero intelligenceIndex bajo js/; sin verify-report.md top-level.

### Completed tasks (persisted checkboxes [x] in tasks.md)

| Task | Summary | Persisted |
|---|---|---|
| 2.1 | Recount tres buckets base: II 8 / benchlm-only 22 / scoreless 58 = 88; kimik3 benchlm-only; manifest 2.1 | [x] |
| 2.2 | Fable: 1 exact match claude-fable-5, finite 49.7, alias a claudeFable5 max; rama present+finite; fetchedAt en manifest 2.2 | [x] |
| 2.3 | Proyección 43 rows fuera del worktree; scraper dry-run ok:true 240 changes + run real ok:true 240 changes; solo candidato | [x] |
| 2.4 | Astra max en candidato: gpt6astra 52.8 (active chatgpt-plus finite-II); PASS, sin excepción | [x] |
| 2.5 | Pre-check candidato: benchlm 0 / availability 0 (43/43), providers byte-idéntico, schema 5, DATA_FILES 6, dedupe 0 | [x] |
| 2.6 | RED: fixture +3 filas S2a reales; scrape 2 tests nuevos; aa-effort 4 tests S2a (4 failed missing-II); data-integrity 4 tests S2a (mirror RED) | [x] |
| 2.7 | GREEN: 36 II nuevos + gpt6astraLow AA-ownership/blended + lastRun con serializeModels; pending 3 a 2; S1 test S2a-aware; 56 passed | [x] |
| 2.8 | TRIANGULATE (live-exact distinto de round, absent-key distinto de null) + REFACTOR (constantes hoisted, sin módulos nuevos); 27/27 | [x] |
| 2.9 | evidence/s2a-role-outcomes.md (3 scopes, 18 roles soft:cost, twin-judge igual) + acceptance sin winner/value; 29/29 | [x] |
| 2.10 | Recount post 44/18/26=88; focused 2 passed/3 pre-existente 56 tests; re-verif 2.5 en canónico (0/0, providers clean) | [x] |
| 2.11 | Rollback: base a 8 II + 9 failed missing-II; S2a a 44 II + 56 passed; completo a baseline 45; sin scraper reversa | [x] |

### Files changed (slice scope, UNCOMMITTED)

| Path | numstat vs cc1cab2 |
|---|---|
| data/models.json | +257 / -36 (36 II + 36 sources + gpt6astraLow AA/blended + lastRun, serializeModels canónico) |
| tests/aa-effort.test.js | +157 / -3 (S2a 4 + gpt6astraLow + triangulate 2 + acceptance 2, pending shrink, S1 S2a-aware) |
| tests/data-integrity.test.js | +43 / -1 (S2a 4 tests + pending shrink) |
| tests/fixtures/aa-sample.json | +58 / -1 (+3 filas S2a reales: astra 52.8, astra-low 46, fable 49.7) |
| tests/scrape-artificialanalysis.test.js | +104 / -0 (S2a fixture verbatim + null-idempotence) |
| evidence/aa-live-manifest.md | S2a + 2.10-2.11 (docs, fuera de budget) |
| evidence/s2a-role-outcomes.md | nuevo (docs, fuera de budget) |
| apply-progress.md (este archivo) | esta sección (docs) |
| tasks.md | 11 checkboxes (docs) |

**Review-surface total: 660 líneas (293+160+44+59+104) mayor que 400: NO COMMIT.** tests/availability-matrix + propagate sin cambios (0/0).

### Test commands run (evidence)

| Command | Result |
|---|---|
| S2a focused (baseline pre-cambio) | 2 passed / 3 failed-to-collect (pre-existente) — 45 tests passed |
| S2a RED (2.6): scrape + aa-effort | aa-effort 4 failed missing-II; scrape S2a 2 passed (conducta pre-existente, triangula live-exact) |
| S2a RED mirror data-integrity (vitest no colecta) | ii=8 vs 44 FAIL, fable undefined vs 49.7 FAIL, lastRun undefined FAIL |
| S2a GREEN (2.7): scrape + aa-effort | 1 failed (S1 desactualizado) / 50 passed, luego parche S1 S2a-aware a 25/25 |
| S2a focused (2.10): 5 suites | 2 passed / 3 failed-to-collect (pre-existente) — 56 tests passed (scrape 27 + aa-effort 29) |
| Rollback 2.11: base restaurada | II 8; aa-effort 9 failed missing-II / 20 passed (sensibilidad probada) |
| Rollback 2.11: S2a restaurada | II 44; scrape+aa-effort 56 passed |
| Dark invariant | model-scorer.js untouched (git-clean); intelligenceIndex bajo js/ = 0; js/ git-clean |

### TDD Cycle Evidence (strict TDD activo; data-only usa manifest+gate)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1/2.2/2.4/2.5 | evidence/aa-live-manifest.md S2a | Data/manifest+gate | N/A (gates) | recount 8/22/58 + Fable 1x49.7 + Astra 52.8 + preserv 0/0 | candidato ok:true 240 changes x2 | 43 filas live-exact enumeradas | Doc-only |
| 2.3 | temp candidate fuera del worktree | Gate (no test unitario) | baseline 45 | dry-run + real sobre copia | — | — | — |
| 2.6 | tests/fixtures/aa-sample.json + 3 suites | Unit | 45 pre-edit | 4 failed missing-II + mirror FAIL | — (lo cierra 2.7) | — | — |
| 2.7 | data/models.json + 2 suites | Unit (datos) | RED registrado | — | 56 passed (tras S1-aware) | — | serializeModels canónico; pending 3 a 2 |
| 2.8 | tests/aa-effort.test.js | Unit | 25/25 | — | — | round distinto de exact + absent distinto de null a 27/27 | hoisted consts; sin módulos nuevos (prohibido fuera de evidence/) |
| 2.9 | evidence/s2a-role-outcomes.md + acceptance en aa-effort | Unit/acceptance | 27/27 | — | 29/29 (recomputa II, sin winner/value) | twin-judge + churn 17+ + evidence con roles | — |
| 2.10 | S2a focused + gate10 vs base | Gate | 56 | recount 44/18/26 + 0/0 + providers clean | 2 passed/3 pre-existente 56 tests | — | — |
| 2.11 | Rollback backup/checkout/restore | Gate rollback | 56 | base a 9 failed missing-II (sensibilidad) | S2a a 56 passed; completo a baseline 45 | — | — |

Sustitución data-only (regla global tasks.md): 2.1–2.5 usan manifiesto + gate diff; 2.6–2.9 RED/GREEN productivos sobre tests; 2.10–2.11 gates.

### Test Summary

- **Tests escritos en S2a: 12 nuevos** (scrape 2; aa-effort 9: 4 S2a + 1 gpt6astraLow + 2 triangulate + 2 acceptance; integrity 4) + 2 reescrituras (pending shrink x2, S1 S2a-aware).
- **Tests pasando: 56/56** en las dos suites colectables (baseline 45 a +11). 3 suites con fallo de colección pre-existente (evidencia, no bloqueador; CI Node 20 gobierna).
- **Capas**: Unit/data 12; sin integración/E2E (slice de datos).
- **Approval tests**: baseline 45 como red de seguridad pre-edit; rollback base a 9 failed demuestra sensibilidad.
- **Funciones puras creadas**: 1 helper de test (iiOf en acceptance, solo test-scope); producción JSON-only.

### Deviations from design / tasks

1. **Delta canónico quirúrgico (II+sources+lastRun) en vez de patch completo del scraper.** El candidato temporal trae 240 cambios de campo y el writer plano del scraper expande availability a multi-línea. Diseño 3.1-p8 permite refresh opcional ("may refresh"); se aplica el delta seleccionado con serializeModels canónico (diff 293). benchlm/availability idénticos, providers clean, schema 5.
2. **lastSynced preservado (2026-09-10).** Solo se registra _meta.scrapers scrape-artificialanalysis.lastRun = S1-fetchedAt. S3b consumirá lastRun; ningún test pinnea lastSynced distinto del formato.
3. **Acceptance test en aa-effort.test.js (colectable local) en vez de data-integrity.** La suite integrity no colecta bajo Node 24 local (pre-existente); su bloque S2a existe para CI Node 20 y se verificó por espejo. El acceptance corre en verde local (29/29) y lee II directo sin scorer benchlm.
4. **Budget trip: sin commit (gate de entrega, no de corrección).** 660 mayor que 400 con las 11 tareas funcionalmente completas. No se infiere size:exception; se deja sin commitear y se propone el split pre-aprobado S2a-1/S2a-2.

### Structured status (consumed / produced)

- **Consumido:** tareas 2.1–2.11, diseño 3/8/9, captura S1 (646 items), rama nueva desde cc1cab2, superficies permitidas, budget 400, dark invariant.
- **Producido:** backfill 36 II + ownership + lastRun (sin commitear), fixture +3, 12 tests nuevos, role-outcomes.md, manifest S2a/2.10/2.11, tasks 11x[x], esta bitácora.
- **Warnings respetados:** 4 archivos dirty intactos; archive/.pi/PRs intactos; pnpm only; key solo en memoria (reuse, sin re-fetch, nunca impresa); 3 fallos colección como evidencia; model-scorer intacto; sin verify-report.md top-level.
- **Gate ask-on-risk:** budget trip a NO commit, split S2a-1/S2a-2 propuesto, reporte al parent (este archivo + handoff).

---

## S2b — Remaining II backfill — PR 3 (commit: budget 371/400 OK)

- **Implementation status: complete (6/6 tareas S2b 3.1–3.6 ejecutadas).** Re-fetch live (S2b slugs ausentes del manifiesto S1), candidato temporal con gates de preservación, asserts RED/GREEN/TRIANGULATE, materialización canónica quirúrgica vía `serializeModels`, recount final, rollback check.
- **Delivery status: listo para commit en `feat/aa-only-s2b-remainder`** (base `406b2da`). Superficies de review = **371 líneas** (models 240, aa-effort 63, data-integrity 14, scrape 54; fixture intacto) → **bajo el budget de 400, sin pre-split S2b-1/S2b-2**.
- **Gates: todos PASS.** Buckets finales **73/0/15=88**; benchlm 0 diffs (88/88); availability 0 diffs (88/88); providers git-clean; schema 5; matriz 0 problemas (espejo); pending sets **vacíos** (glm53+grok46 backfilled con ownership); dark invariant (scorer intacto, 0 II bajo `js/`).
- **Archivos pre-existentes intactos:** `.atl/*`, `.gitignore`, `spec.md` con el mismo diff que al inicio; `archive/`, `.pi/`, PRs no tocados; índice git intacto hasta el commit S2b.

### Completed tasks (persisted checkboxes [x] in tasks.md)

| Task | Summary | Persisted |
|---|---|---|
| 3.1 | Proyección 30 rows fuera del worktree; scraper dry-run ok:true 156 changes + run real ok:true 156/missing 59; gates solo-candidato (benchlm 0, availability 0, dedupe 0, no-S2b 58/58 byte-idénticos) | [x] |
| 3.2 | RED: S2B_II 29 + pending-empty + buckets 73/0/15 + fixture-probe scraper (inline source real) → 8 failed missing-II / 52 passed; mirror data-integrity RED | [x] |
| 3.3 | GREEN: 29 II + 29 tuples + ownership glm53/grok46 con `serializeModels` (lastSynced/lastRun preservados); 60/60 | [x] |
| 3.4 | TRIANGULATE: covered-but-live-absent (`deepseekv4fNonReasoning` byte-idéntico, key ausente) + uncovered (`omenalpha`, `hy4preview`) + rounding (44.9≠45, 43.8≠44); sin refactor adicional (builders S2a intactos) | [x] |
| 3.5 | Gate 3.5: recount 73/0/15 en manifiesto; focused 2 passed/3 pre-existente 60 tests; espejos integrity/matrix/benchlm/providers/schema/dark | [x] |
| 3.6 | Rollback: base a 44/18/26 + 8 failed missing-II; S2b a 73/0/15 + 60 passed + matriz 0; sin scraper reversa | [x] |

### Files changed (slice scope)

| Path | numstat vs 406b2da |
|---|---|
| data/models.json | +211 / −29 (29 II + 29 sources + ownership glm53/grok46, serializeModels canónico) |
| tests/aa-effort.test.js | +46 / −17 (S2B_II 29 + pending-empty + S1-stubs ownership + triangulaciones) |
| tests/data-integrity.test.js | +7 / −7 (buckets 73/0/15, kimik3 43.8, finite 73, pending []) |
| tests/scrape-artificialanalysis.test.js | +54 / −0 (S2b verbatim-ownership probe + live-absent probe, inline source real) |
| evidence/aa-live-manifest.md | sección S2b (docs, fuera de budget) |
| apply-progress.md (este archivo) | esta sección (docs) |
| tasks.md | 6 checkboxes (docs) |

**Review-surface total: 371 líneas ≤ 400: COMMIT SÍ.** tests/availability-matrix + propagate + fixture sin cambios (0/0/0).

### Test commands run (evidence)

| Command | Result |
|---|---|
| Safety net pre-RED (scrape + aa-effort) | 2 passed, 56/56 |
| S2b RED: `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js` | 8 failed missing-II / 52 passed (scrape 29/29 documentary) |
| S2b RED mirror data-integrity (node) | buckets 44/18/26 vs 73/0/15 FAIL, kimik3 undefined vs 43.8 FAIL |
| S2b GREEN (misma corrida) | 2 passed, 60/60 |
| S2b focused (3.5): 5 suites | 2 passed / 3 failed-to-collect (pre-existente SyntaxError `node:vm`) — 60 tests passed |
| Espejos node (integrity/matrix/benchlm/avail/providers/schema) | ALL PASS (matriz 0, benchlm 0/88, availability 0/88, providers git-clean, schema 5) |
| Rollback 3.6: base restaurada | buckets 44/18/26; aa-effort 8 failed / 23 passed (sensibilidad) |
| Rollback 3.6: S2b restaurada | buckets 73/0/15; scrape+aa-effort 60 passed; matriz 0 |
| Dark invariant | model-scorer.js untouched (git-clean); intelligenceIndex bajo js/ = 0 |

### TDD Cycle Evidence (strict TDD activo; data-only usa manifest+gate)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | temp candidate fuera del worktree | Gate (no test unitario) | baseline 56 | dry-run + real sobre copia (156 changes) | — | 30 rows + 1 veredicto ausencia | Doc-only |
| 3.2 | tests/aa-effort + integrity + scrape | Unit | 56 pre-edit | 8 failed missing-II + mirror FAIL | — (lo cierra 3.3) | — | — |
| 3.3 | data/models.json + 2 suites | Unit (datos) | RED registrado | — | 60/60 via serializeModels | — | pending [] + ownership mínima |
| 3.4 | tests/aa-effort + scrape | Unit | 60 | — | — | absent-preserve + uncovered + rounding → 60/60 | ➖ builders S2a intactos |
| 3.5 | S2b focused + espejos + diff base | Gate | 60 | recount 73/0/15 + 0/0 + providers clean | 2 passed/3 pre-existente 60 tests | — | — |
| 3.6 | Rollback backup/show/restore | Gate rollback | 60 | base a 8 failed missing-II (sensibilidad) | S2b a 60 passed + matriz 0 | — | — |

### Test Summary

- **Tests escritos en S2b: 4 nuevos** (scrape 2: verbatim-ownership + live-absent; aa-effort 2: S2B map + rounding) + 5 reescrituras (pending-empty ×3, S1-stubs ownership, buckets integrity ×2).
- **Tests pasando: 60/60** en las dos suites colectables (baseline 56 → +4). 3 suites con fallo de colección pre-existente (evidencia, no bloqueador; CI Node 20 gobierna).
- **Capas**: Unit/data 4; sin integración/E2E (slice de datos).
- **Approval tests**: baseline 56 como red de seguridad; rollback base a 8 failed demuestra sensibilidad.
- **Funciones puras creadas**: 0 (producción JSON-only; helpers de test inline).

### Deviations from design / tasks

1. **Re-fetch S2b en vez de reuse S1** (autorizado: tasks.md "re-fetch ONLY if a needed slug is missing" — los 30 slugs S2b faltan del manifiesto S1). Misma fecha UTC (2026-09-13), 646 items, valores S1 coincidentes (glm53 44.9, grok46 44.4) → sin drift.
2. **Delta canónico quirúrgico** (II+sources+ownership glm53/grok46, `serializeModels`), igual que S2a: no se copian pricing/speed/notes del candidato (`may refresh` es opcional por diseño §3.1-p8). `lastSynced`/`lastRun` preservados.
3. **Sin filas nuevas en `tests/fixtures/aa-sample.json`** (0/0): las probes S2b usan inline source con valores live reales — más barato en budget y misma autenticidad. El fixture S2a (`kimi-k3` 43.8) se reutiliza por coincidencia verificada.
4. **benchlm-only llega a 0.** Ningún test exigía el bucket no-vacío; `kimik3` deja de ser el precedente vivo y pasa a II-covered con `benchlm.score` 80.96 intacto (assert conservado como triangulación).

## S3a — Dark II scoring foundation (NO activation) — PR 4

- **Implementation status: complete (6/6 tareas S3a, 4.1–4.6).** Nuevo módulo puro `js/services/ii-score.js` (contrato final diseño §5.1) + 11 tests II-core en `tests/model-scorer.test.js` + 3 asserts de dark-readiness en `tests/data-integrity.test.js`. Runtime sigue **fully benchlm**: nada bajo `js/` importa `ii-score.js`, `compositeScore` intacto, cero diff en superficies.
- **Delivery status: slice listo para PR 4** en la rama `feat/aa-only-s3a-dark` (base `29c71b0`, tip S2b). Se commitean **solo** las 5 superficies permitidas. No se tocan los 4 archivos pre-existentes del usuario (`.atl/*`, `.gitignore`, `openspec/specs/model-picker/spec.md`), dirs archive, `.pi/`, ni nada fuera de superficies.
- **Budget:** **~195 líneas** código/tests/docs-técnicas (model-scorer +105, data-integrity +41/−1, ii-score.js 43 nuevo, tasks.md 6 checkboxes) + esta bitácora (artefacto SDD). Forecast S3a: 160–260, riesgo Low. **Bajo el techo 400.**

### Completed tasks (persisted checkboxes `[x]` in `tasks.md`)

| Task | Summary | Persisted |
|---|---|---|
| 4.1 | **RED:** 7 tests II-core (`ii-a`–`ii-g`: finite verbatim, clamp high/low, missing/null/string/NaN→null never 0, non-object→null, benchlm-inert pair, purity) + `import { iiScore }` → colección falla con `Failed to resolve import "../js/services/ii-score.js" ... Does the file exist?` (missing-module reason) | `[x]` |
| 4.2 | **GREEN:** `js/services/ii-score.js` creado (contrato mínimo: non-object→null, non-number/non-finite→null, else clamp [0,100]; sin benchlm, sin I/O, sin imports) → **61/61 passed** (54 baseline + 7 nuevos) | `[x]` |
| 4.3 | **TRIANGULATE + REFACTOR:** 4 tests (`ii-h` boundary 99.9 vs 100.1, `ii-i` segundo par inert con benchlm.score null, `ii-j` ±Infinity→null, `ii-k` cero es score real no sentinel) → **65/65**; REFACTOR confirma single clamp path ya existente, sin cambios | `[x]` |
| 4.4 | **Dark-readiness assert** en `data-integrity.test.js`: ii-score.js existe + contiene `intelligenceIndex`; ningún módulo bajo `js/` lo importa (grep de patrón import/from/require — no substring, el módulo se nombra en su propio header); `model-scorer.js` contiene `benchlm` y NO `intelligenceIndex` | `[x]` |
| 4.5 | **Dark verification:** focused + 7 surface suites → 8/9 files passed, **179/179 tests**; único fallo es colección pre-existente de data-integrity (Node 24 `node:vm`, idéntico al baseline); `git diff --stat` vacío en las 7 superficies + scorer + components; espejo node de los 3 asserts 4.4 + recount 73/0/15 ALL PASS | `[x]` |
| 4.6 | **Rollback check:** `git checkout HEAD --` tests + delete ii-score.js → **54/54 passed** (cero acoplamiento runtime); trabajo restaurado desde /tmp backup → **65/65** | `[x]` |

### Test commands run (evidence)

| Command | Result |
|---|---|
| `pnpm vitest run tests/model-scorer.test.js` (safety net, pre-edit) | **54/54 passed** |
| `pnpm vitest run tests/model-scorer.test.js` (RED, 4.1) | **collection FAIL — `Failed to resolve import "../js/services/ii-score.js" ... Does the file exist?`** (missing-module reason) |
| `pnpm vitest run tests/model-scorer.test.js` (GREEN, 4.2) | **65→61/61 passed** (54 + 7 nuevos) |
| `pnpm vitest run tests/model-scorer.test.js` (TRIANGULATE, 4.3) | **65/65 passed** |
| S3a focused + surfaces (4.5): `pnpm vitest run tests/model-scorer.test.js tests/data-integrity.test.js tests/ref-table.test.js tests/composite-chart.test.js tests/cli-mirror-table.test.js tests/justification-ui.test.js tests/exporter.test.js tests/freshness-badge.test.js tests/staleness-parity.test.js` | **8 passed / 1 failed-to-collect (pre-existente) — 179 tests passed** |
| `node --input-type=module` espejo dark-readiness (4.4: existe+contiene, ningún import bajo js/, scorer benchlm-y-no-II, contrato iiScore 11 asserts) | **ALL DARK-READINESS MIRROR ASSERTIONS PASS** |
| `node -e` recount mirror (73/0/15, schema 5, lastRun 2026-09-13T03:53:18.345Z) | **BUCKET RECOUNT MIRROR PASS** |
| `git diff --stat` superficies intactas (7 suites + model-scorer.js + components + exporter + data-sync + data-loader + app.js) | **vacío (exit 0)** |
| Rollback 4.6: sin ii-score.js + tests base | **54/54 passed** (cero acoplamiento) |
| Post-restore | **65/65 passed** |

**Nota Node/collection (pre-existente, no se parchea):** `tests/data-integrity.test.js` no colecta bajo Node 24 local (`SyntaxError: Invalid or unexpected token`, `node:vm`, sobre líneas de comentario — idéntico al baseline S1/S2 medido antes del slice). `node --check` pasa en los 3 archivos tocados; los 3 asserts nuevos se espejaron bajo node con ALL PASS. CI Node 20 gobierna.

### TDD Cycle Evidence (strict TDD activo)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `tests/model-scorer.test.js` (bloque ii-a–ii-g) | Unit | ✅ 54/54 pre-edit | ✅ Escrito — colección falla por missing-module (`Does the file exist?`) | — (lo cierra 4.2) | — | — |
| 4.2 | `js/services/ii-score.js` (nuevo, puro) | Unit | ✅ RED registrado | — | ✅ 61/61 passed (54 + 7) | — | — |
| 4.3 | `tests/model-scorer.test.js` (bloque ii-h–ii-k) | Unit | ✅ 61/61 | — | — | ✅ 4 casos distintivos (99.9/100.1, 2º par inert, ±Inf, cero-real) → 65/65 | ✅ Single clamp path ya existente, sin cambios, tests verdes |
| 4.4 | `tests/data-integrity.test.js` (dark-readiness ×3) | Unit/grep-assert | ✅ Symmetry con :740 pre-existente | ✅ Falla sin ii-score.js (existsSync false) | ✅ Espejo node ALL PASS (vitest colección pre-existente bloquea ejecución local) | ✅ Patrón import-vs-substring (self-match del header lo exige) | ➖ None needed |
| 4.5 | Gate focused + 7 surfaces + diff vacío | Gate | ✅ 4.4 mirror | 8/9 files, 179 tests, diff vacío | — | — | — |
| 4.6 | Rollback delete + restore | Gate rollback | ✅ Backup /tmp/s3a-rb | 54/54 sin el slice (sensibilidad: −11 tests, runtime idéntico) | 65/65 restaurado | — | — |

### Test Summary

- **Tests escritos en S3a: 11 nuevos** (model-scorer: ii-a–ii-k) + **3 asserts** dark-readiness (data-integrity).
- **Tests pasando: 65/65** en model-scorer (baseline 54 → +11); **179/179** en el gate 4.5 (8 suites colectables).
- **Capas**: Unit 14; sin integración/E2E (slice de fundación pura).
- **Approval tests**: baseline 54 como red de seguridad; rollback a 54 demuestra cero acoplamiento.
- **Funciones puras creadas**: 1 (`iiScore` + helper `clamp` privado, single path).

### Deviations from design / tasks

1. **Grep de imports por patrón, no substring** (tests/data-integrity): `ii-score.js` se nombra en su propio header, así que un `includes('ii-score')` da falso positivo sobre sí mismo. El assert usa regex `from/import()/require()` — más fiel al "imports" de la tarea 4.4.
2. **Sin `verify-report.md` top-level** (orden explícita del padre).

## S3b — Atomic activation (tasks 5.1–5.11) — COMPLETE con size:exception

Fecha: 2026-09-14 · Rama: `feat/aa-only-s3b-activation` · Modo: worker-fallback (sdd-apply launcher stalleado) + fix dirigido por padre.

- **Scorer**: `compositeScore` delega al núcleo `ii-score` probado; refs de orden benchlm eliminadas; `findReferenceModel` → mayor II finito (lifecycle, nulls-last, tie-break estable); guards finite-II en elegibilidad normal + ambos fallbacks + alternatives (predicado `hasFiniteIi` compartido).
- **ii-ranking.js** (nuevo): `resolveIiFreshness` (AA lastRun → lastSynced), `buildIiRankingContext` (ranked = II finito, hidden = II null), `formatHiddenIiNote` (N = 0 → vacío).
- **Superficies**: ref-table + composite-chart ocultan filas null-II (no dimmer) con nota compartida y chrome AA II; cli-mirror/justification sin cambio productivo (alcanzan los guards); exporter con nota en línea 2; freshness/sync retarget a AA lastRun; loader con `catalogRevision`; app construye UN contexto por render.
- **Bug real hallado por el padre en re-verificación**: `renderAll()` referenciaba `rankingContext` no declarado → ReferenceError que vaciaba todos los mounts (los unitarios pasaban porque no cruzan app.js). Fix: import + 2 líneas. Luego 2 tests config-selector alineados por inyección II (cero expects tocados). El worker lo había diagnosticado como test-side; era producto + resto test-side.
- **Evidencia**: RED por flips → GREEN; focused S3b 252/252 ejecutados en verde (único collect-fail pre-existente data-integrity/Node24); regresión 125/125; rollback S3b probado en ida (coherencia benchlm) y restaurado.
- **Budget**: ~673 líneas review vs cap 400 → size:exception explícita de maintainer (el corte atómico no admite split sin shipear híbrido). Rollback: revertir activación + tests en un commit; nunca borrar II backfilleado.
- **TDD Cycle Evidence — reconstructed at S3d remediation from worker handoffs** (S3b shipped prose instead of the task-level table; per-task RED failure text was not preserved and is NOT invented — RED cells restate tasks.md intent, GREEN cells quote only on-record observed evidence):
| Task | RED (tasks.md intent) | GREEN (on-record observed) | TRIANGULATE |
|---|---|---|---|
| 5.1 | scorer + integrity `:740` expects flipped to II authority | flips landed (S3b summary) | — |
| 5.2 | implements 5.1 | scorer delegates ii-score; finite-II guards on fallbacks/alternatives | shared `hasFiniteIi` predicate |
| 5.3 | benchlm-only leaks via cost-only fallback/alternatives | guard landed | benchlm-only leakage case |
| 5.4 | ii-ranking RED first (freshness/context/note) | module + suite landed | full-catalog scope builds own context |
| 5.5 | ref-table/chart Score-II, null-II removed, shared note | components landed | removed-not-dimmed + N=0-no-note |
| 5.6 | cli-mirror/justification RED (18 rows/cards, unassigned) | both landed | critical-warning empty-set case |
| 5.7 | exporter RED (II bodies, line-two note, no appendix/tier) | exporter landed | no-appendix + providers-line-one |
| 5.8 | freshness/staleness RED (AA lastRun, II warning, fail-soft) | badge/sync/loader/app landed | benchlm-timestamp-irrelevant case |
| 5.9 | gate | focused S3b 252/252; regression 125/125; no II-less row, no benchlm ordering | 18/9/5 counts + DATA_FILES 6 |
| 5.10 | gate | smoke (scopes, 5 strategies, twin-judge equality, refresh, shared counts) | filtered x full-catalog scopes |
| 5.11 | gate | rollback to benchlm coherence + restore | — |
| fix | — | parent-found `rankingContext` ReferenceError in `renderAll()` → import + 2 lines; 2 config-selector tests II-injected (cero expects tocados) | app.js transaction case unit suites could not see |
- **Notas de review**: model-card conserva display benchlm como dato inerte (fuera de superficies del slice); comentarios dark en ii-score.js intactos a propósito.

---

## S4 — Policy + docs — PR 6 (worker-fallback, rama `feat/aa-only-s4-docs`, base `7643bf3`)

Fecha: 2026-09-14 · Modo: worker-fallback (sdd-apply launcher stalleado, parent-autorizado). Slice docs-only: cero cambios de código/tests productivos.

- **Implementation status: 6.1 + 6.2 completas; 6.3 ejecutada con gate FAIL pre-existente (fuera de scope S4).** Canonical spec mergeada (worktree-only, sin commit por orden del parent); operator notes nuevas en `evidence/`; `pnpm test` rojo en 4 suites nunca flipeadas por S3b (pre-existente sobre la base, docs no pueden causarlo); `pnpm build` verde.
- **Delivery status: commit DOCS ONLY en la rama S4** (`evidence/operator-notes-day-one-churn.md` nuevo + este archivo + 3 checkboxes en `tasks.md`). `openspec/specs/model-picker/spec.md` queda **UNCOMMITTED siempre** (lleva dos changes' syncs hasta que la stack vieja mergee). Dirt humano pre-existente (`.atl/*`, `.gitignore`, `.pi/`, `archive/`) intacto y fuera del commit.

### Completed tasks (persisted checkboxes `[x]` in `tasks.md`)

| Task | Summary | Persisted |
|---|---|---|
| 6.1 | Canonical sync: 3 ADDED + 13 MODIFIED con nota `weighted-sum → benchlm-clamp → II-only` + REMOVED records; layering limpio, cero colisiones; 39 headers, sin duplicados; hunks prior-sync intactos | `[x]` |
| 6.2 | `evidence/operator-notes-day-one-churn.md` nuevo (churn day-one, D1/D2/D3/D5, rollback S3b→S3a→S2b→S2a→S1); `docs/` solo tiene `legacy/`, sin `CHANGELOG` — nombrado, no escrito fuera de superficies | `[x]` |
| 6.3 | `pnpm test` + `pnpm build` ejecutados y registrados (abajo); rollback documentado en la nota 6.2 §6. Gate test FAIL pre-existente — ver hallazgo | `[x]` (ejecución+registro; gate rojo pre-existente) |

### 6.1 — Coherence evidence

- `grep -c '^### Requirement:'` → **39** (34 prior-sync + 3 ADDED + 2 REMOVED-records); cero headers duplicados; cero escenarios muertos fuera de `## REMOVED` (solo mención nominal en línea 1499, dentro de REMOVED).
- Único título de escenario repetido: `"Unknown newcomer is invisible until curated"` en dos requirements (AA Alias Mass-Mapping nuevo + New Chart Models Fail-Closed previo) — duplicación heredada del propio delta (verbatim), no error de merge; requiere disambiguation del parent/verify si molesta.
- Prior-sync intact proof: hunks de diff vs HEAD en secciones no tocadas idénticos (spot-check Twin Judge filtering pre-pass verbatim; Pricing Chart 0 refs II); `git diff --numstat` spec.md 601+/48- (pre-S4) → 871+/106- (post-S4); ediciones solo en los 13 bloques MODIFIED + append (cada `edit` con oldText único, 1 bloque reportado).
- Normalizaciones de wrap heredadas del delta (ej. Schema-versioned a una línea, loader DATA_FILES a una línea): palabras idénticas, sin rewording de contenido prior-sync.

### 6.2 — Files

- NUEVO: `openspec/changes/2026-09-14-aa-only-scoring/evidence/operator-notes-day-one-churn.md` (85 líneas).
- Docs-convención (read-only): `docs/` = solo `legacy/`; sin `CHANGELOG*` en root.

### 6.3 — Exact gate outputs (Node local v24.20.0; CI Node 20 gobierna)

| Command | Observed |
|---|---|
| `pnpm test` | **FAIL — 7 failed / 39 passed files; 13 failed / 646 passed tests (659)**. Falla ×archivo: `availability-matrix`, `data-integrity`, `propagate-provider-availability` = **collect FAIL pre-existente conocido** (`node:vm` SyntaxError, nunca parchear); + `aa-signal` (2 tests Con-AA/Sin-AA sections), `lifecycle` (4 tests), `provider-filter-integration` (3 tests), `twin-judge` (4 tests) = **assertion FAILs pre-existentes sobre la base 7643bf3 bajo Node 24, fuera del set conocido**. Ninguna de esas 4 suites estuvo en el focused command de S3b (nunca flipeadas a II). Prueba de no-causalidad S4: `grep` confirma que ningún test bajo `tests/` lee `openspec/specs` ni `evidence/*.md` — el slice docs-only no puede alterar resultados vitest. Hallazgo para el verify whole-change, no bloqueador S4 (prohibido parchear). |
| `pnpm build` | **PASS** — esbuild 4/4 steps, `dist/index.html` + `dist/data/` escritos (`dist/` gitignored, sin dirt). |

### Files changed (slice scope)

| Path | Estado |
|---|---|
| `openspec/specs/model-picker/spec.md` | EDITADO, **UNCOMMITTED siempre** (+270 neto aprox vs pre-S4: 871+/106- vs 601+/48-) |
| `evidence/operator-notes-day-one-churn.md` | NUEVO, committed |
| `apply-progress.md` (este archivo) | ESTA sección, committed |
| `tasks.md` | 3 checkboxes 6.1–6.3, committed |

Cero cambios en `data/`, `js/`, `css/`, `scripts/`, `tests/`. `git status` post-commit debe mostrar solo `M openspec/specs/model-picker/spec.md` (+ dirt humano pre-existente).

### TDD Cycle Evidence (docs-only: sustitución por regla del parent)

Skill `strict-tdd.md` leído; por orden explícita del parent (docs-only slice) evidencia = gate commands + diff review, **sin RED/GREEN** (no hay código productivo ni tests tocados). RED: not active — strict TDD was not activated for docs. GREEN: not active — validation is reported separately (6.3 outputs arriba).

### Structured status (consumed / produced)

- **Consumido:** tasks 6.1–6.3, delta `specs/model-picker/spec.md`, diseño §11/§12, rama nueva desde `7643bf3`, superficies permitidas (4 paths), budget 400, skill strict-tdd (excepción docs-only).
- **Producido:** sync canónico worktree-only, operator notes, esta bitácora, 3 checkboxes, commit docs-only S4.
- **Gate ask-on-risk:** 6.3 test FAIL excede el set ambiental conocido (3 collect) → `status: partial` + detalle de gate; decisión del parent (whole-change verify) — nunca inferir excepción ni parchear tests.
## S3c — Suite alignment follow-up (parent-diagnosed S3b regressions) — COMPLETE

Fecha: 2026-09-14 · Rama: `feat/aa-only-s3c-suite-alignment` (base `origin/feat/aa-only-s3b-activation` = `7643bf3`) · Strict TDD activo · pnpm only.

Alcance: 4 suites verdes en base `7674ae6` y rojas en el tip S3b — `aa-signal` (2), `lifecycle` (4), `provider-filter-integration` (3), `twin-judge` (4). Slices S1–S3b intactos; `tasks.md` no se renumera (esta bitácora es el único cambio documental del slice).

### Diagnóstico por archivo (RED pre-existente = failing tests observados)

| Suite | Lado | Expectativa exacta citada | Causa |
|---|---|---|---|
| `lifecycle` (4) | test | `expected null to be 'active'/'oldActive'/'old'` | Fixtures sintéticos sin II → `compositeScore` null → `getBestFor` null. Guards finite-II correctos; tests en era benchlm. |
| `provider-filter-integration` (3) | test | `expected null not to be null` (línea 106+: baseline `betaOnly` invisible) | Mismo fixture `v5-surfaces-fixture` sin II (fixture NO editable). `app-filter` con igual fixture ya verde por inyección II en `bootWith` — precedente. |
| `twin-judge` (4) | test | `expected null not to be null`; `expected [ref,shared,p1only] to include null`; `InvalidConfigError` ausente | Fixtures premium/budget + V5 `{ref,shared,p1only,p2only}` sin II → twins null. |
| `aa-signal` (2) | producto + test | `expected +0 to be 3` / `expected +0 to be 2` | Contrato viejo Con-AA/Sin-AA por `hasAaSignal` amplio; con II-only todo es null-II → 0 filas. Diseño §7 + riesgo §12 exigen remover, no reinyectar. |

### Remoción Sin-AA (producto; sin refactor ciego)

- `js/components/ref-table.js`: fuera import `splitByAaSignal`; `orderRows` a ranked-only (active/non-active, `isRanked` finito); una sola tabla (testids `active-rows`/`non-active-rows`, `thead` 8 cols, `tbody` activo primero preservados); header/footer sin conteos Con/Sin-AA; nota compartida + hide-rule intactos; export JSON `withAa/withoutAa` → `ranked`.
- `js/components/composite-chart.js`: fuera import, `unavailableRowHtml` muerta (S3b ya la neutralizaba con `unavailableBody = []`), `chartSectionHtml` → lista única `scoredBarsHtml`; header/footer/export homólogos; `rowsFor` + summary `{scored, unavailable, maxScore}` intactos.
- `js/services/aa-signal.js` intacto: grep confirma que solo los 2 componentes lo importaban. Ningún otro test referenciaba las secciones → la maraña era solo agrupación de display.

### Alineación tests (cero expects tocados, aritmética citada)

- `lifecycle` / `twin-judge`: inyección inline `intelligenceIndex` espejando `benchlm.score` + comentario con refCost/ceiling (patrón config-selector S3b: ref 95/shared 85/p1only 70/p2only 60 → refCost 0.0175, ceiling 1.0×; premium 94/budget 91 → ceilings 0.0575/0.00575).
- `provider-filter-integration`: inyección runtime en `bootApp` (patrón `bootWith` de `app-filter`, sin tocar el fixture).
- `aa-signal`: reescrito al contrato nuevo (helper intacto + tabla/barras únicas II-desc + TRIANGULATE señal-sin-II oculta con empty-state).

### Evidencia

| Command | Result |
|---|---|
| `pnpm vitest run tests/lifecycle.test.js tests/twin-judge.test.js tests/provider-filter-integration.test.js` | 3 passed, 42/42 |
| `pnpm vitest run tests/ref-table.test.js` | 32/32 (secciones removidas, contrato S3b intacto) |
| `pnpm vitest run tests/composite-chart.test.js` | 22/22 |
| `pnpm vitest run tests/aa-signal.test.js` | 5/5 (2 helper + 2 contrato nuevo + 1 triangulación) |
| `pnpm test` (full) | 43 passed files / 3 failed-to-collect pre-existentes (availability-matrix, data-integrity, propagate-provider-availability) — 660/660 tests passed, 0 assertion FAILs |
| `git diff --quiet -- tests/data-integrity.test.js js/services/aa-signal.js data/models.json` | vacío (green-by-untouched) |

### TDD Cycle Evidence (S3c; RED pre-existente, no inventado)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| lifecycle II-injection | `tests/lifecycle.test.js` | Unit | 4 failed observados (no baseline verde posible) | ✅ Pre-existente (`null to be 'active'`, etc.) | ✅ 42/42 con test-side fix | ➖ Comportamiento invariante (espejo exacto benchlm) | ➖ None needed |
| twin-judge II-injection | `tests/twin-judge.test.js` | Unit | idem | ✅ Pre-existente (twins null, sin `InvalidConfigError`) | ✅ incluido en 42/42 | ✅ Divergencia cheap-vs-premium preservada por aritmética | ➖ None needed |
| provider-filter II-injection | `tests/provider-filter-integration.test.js` | Integration | idem | ✅ Pre-existente (`null not to be null` línea 106) | ✅ incluido en 42/42 | ➖ Precedente `bootWith` idéntico | ➖ None needed |
| Sin-AA removal | `js/components/ref-table.js` + `js/components/composite-chart.js` / `tests/aa-signal.test.js` | Integration | ✅ ref-table 32/32 + chart 22/22 post-cambio | ✅ Pre-existente (`+0 to be 3`) | ✅ 5/5 contrato nuevo | ✅ `signalOnly` (señal amplia, II null) oculta con empty-state | ✅ Solo agrupación display; `rowsFor`/summaries intactos |

### Budget y entrega

- Superficies review código/tests: **344 líneas (184+/160−) ≤ 400** — sin `size:exception`. Esta bitácora es artefacto SDD fuera de budget (precedente S1).
- Commit S3c: solo las 6 superficies código/tests + esta bitácora. `tasks.md` sin cambios; `spec.md` y dirt humano fuera del commit.

## S3d — Verify remediation (5 parent-adjudicated findings) — rama `feat/aa-only-s3d-verify-fixes` (base `33b061c`)

Fecha: 2026-09-14 · Strict TDD activo · pnpm only · budget TOTAL ≤300 líneas (`git diff --stat`, docs incluidas).

- **F1 (test-only):** dark assert `no importer` contradecía el wiring S3b correcto → reemplazado por `ii-score has exactly one production importer: the public scorer`; el assert II-only del scorer ya existía (sin duplicar). Espejo node ALL PASS (la suite no colecta local; CI gobierna).
- **F2 (producto + tests):** `render` muestra solo `rankedActive` (diseño §6); columnas a Modelo/Esfuerzo/Score/Arena/SWE-Pro/SWE-Ver/Term/Input/Output/Sources (convención fase-1, informativas, nunca sort keys); fuera Lifecycle/BenchLM-sección non-active; `rowsFor`/`orderRows`/exports intactos (load-bearing). Chart sin el defecto (solo-active + sin columnas; badges/dots fuera del hallazgo) → sin cambio.
- **F3 (producto + test):** empty-state con N>0 lleva la nota compartida; N=0 sin nota; chart sin defecto (all-II-less cae en barras+nota, `{}` en N=0). DISMISSED: export-full-catalog sin nota — no oculta nada (N/A por spec); rationale aquí contra re-litigio.
- **F4 (producto + tests):** envelope guarda `catalogRevision(modelsMeta)`; boot revalida `models.json` (`cache:no-store`): equal→reuse (1 fetch), different/old-envelope→refetch, fallo→fail-soft+warn. `data-sync.js` fuera de superficies: sus envelopes sin revisión refetchean una vez (sin loop) — follow-up del parent.
- **F5 (docs):** tabla RED/GREEN/TRIANGULATE S3b reconstruida en su sección desde handoffs, rotulada como reconstruida (sin detalle inventado).
- **TDD:** F1 espejo RED→GREEN; F2 7 RED→GREEN (+triangulación por variantes); F3 stash-RED→GREEN; F4 5 RED→GREEN (+matriz equal/different/old/fail-soft); F5 docs-only.
