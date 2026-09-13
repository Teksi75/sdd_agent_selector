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
