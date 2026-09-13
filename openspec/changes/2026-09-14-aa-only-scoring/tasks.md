# Tasks — 2026-09-14-aa-only-scoring (AA Intelligence Index as the only ranking score)

Date: 2026-09-14 · Phase: tasks · Store: openspec · Mode: auto
Authoritative inputs (do NOT reopen): `proposal.md` (D0–D7), `explore.md`, `design.md`, `specs/model-picker/spec.md` (3 ADDED + MODIFIED + REMOVED scenario records).
Delivery: **ask-on-risk** · Review budget: **400 changed lines per PR** · Chain: **stacked-to-main**
Slice chain: **S1 → S2a → S2b → S3a → S3b → S4** · Hard gate: **S3 blocked until S2a lands.**

## Review Workload Forecast

| Slice | Scope | Est. changed lines | 400-line budget risk | PR |
|---|---|---:|---|---|
| S1 | `data/aa-aliases.json` rows + `_aa-safety` / `aa-effort` / `data-integrity` asserts | 180–300 | Low | PR 1 |
| S2a | chatgpt-plus + anthropic II backfill + Fable verdict + sources[] + `_meta.scrapers` + evidence manifests + provenance tests | 180–340 | Medium | PR 2 |
| S2b | remaining catalog ∩ live-AA II backfill + provenance/omission records + recount | 160–340 | Medium | PR 3 |
| S3a | **dark** `js/services/ii-score.js` + dark-path readiness tests (no activation) | 160–260 | Low | PR 4 |
| S3b | activation: scorer delegation + finite-II fallbacks + `ii-ranking` + 5 surfaces + exporter + freshness/cache + all test flips | 280–390 | **High** (near ceiling) | PR 5 |
| S4 | canonical spec delta sync + changelog/docs | 120–240 | Low | PR 6 |
| **Total** | | **≈1080–1870** | | 6 stacked PRs |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

**Why risk is High overall:** S3b is budgeted at 280–390 and is the single atomic cutover; S2a/S2b are mechanical JSON that drift upward with coverage. No slice may be inferred `size:exception`.

**Pre-split plan (mandatory, never inferred at runtime):**
- S2a and S2b are **already pre-split** by family (design §3.1). If a measured S2a delta exceeds 400 lines, split S2a into S2a-1 (`chatgpt-plus` family incl. Astra/Astra-Low) and S2a-2 (`anthropic` family incl. Fable) as two stacked PRs; same rule for S2b into S2b-1 (opencode/GLM/Qwen/Kimi/Grok) and S2b-2 (DeepSeek/MiniMax/remainder).
- **S3b must NOT be split into a half-switched runtime.** If S3b measures over 400, stop and ask under ask-on-risk (options: accept explicit `size:exception`, or move the docs-only freshness comment out). Never ship II ordering with BenchLM labels, and never ship an II scorer with BenchLM-era rendering.

**Hard sequencing gates:** (a) three-bucket recount gates all S2 mutation; (b) Astra-maximum check gates S2a mutation; (c) Fable live-slug verdict gates any Fable handling; (d) S3a cannot start before S2a; (e) S3b cannot start before S3a.

## Global execution rules (apply to every task below)

- **pnpm only.** Never `npm`. (The canonical spec text says `npm test`; all execution in this change is `pnpm`.)
- **Strict TDD is ON** (`openspec/config.yaml` → `strict_tdd: true`). Non-negotiable per code/test task: **RED** (write the failing test, run it, confirm it fails for the expected reason) → **GREEN** (minimal implementation to pass) → **TRIANGULATE** (add a second, distinguishing case that would fail a wrong implementation) → **REFACTOR** (clean up with tests green). Never write production code before its failing test.
- **Data-only tasks** (S1 JSON rows, S2a/S2b JSON mutation) substitute **manifest + gate evidence** for RED/GREEN: record the evidence row, run the pre/post gate diff, and keep the benchlm/availability byte-comparison proof.
- **AA key**: load from `%USERPROFILE%/.config/sdd-agent-selector/aa_api_key` into `AA_API_KEY`; never print, log, or commit. Raw payload stays outside the repo.
- **CI Node 20 governs the full gate.** Three suites fail collection under local Node 24 (pre-existing). Every verification task MUST note this; never "fix" it by editing tests.
- **Do not touch**: archived change `2026-09-13-aa-intelligence-refresh`, branches, PRs #72–#78, or the dirty worktree (parent owns sequencing).
- **Never modify** `data/providers.json`, `benchlm` blocks, `minReasoning` values, or the 18/9/5 counts.

---

## S1 — Alias mass-mapping (data-only) — PR 1

Depends on: proposal/spec/design. **Blocks:** S2a, S2b. Est. 180–300 lines · risk Low.

- [x] **1.1 — Live AA capture + evidence manifest.** Fetch `api/v2/data/llms/models` once into a private temp path outside the repo; write `openspec/changes/2026-09-14-aa-only-scoring/evidence/aa-live-manifest.md` with fetch timestamp, HTTP success, item count, candidate slugs (incl. `grok46`, `gpt-6-astra` low variant, opencode stubs), exact II values, and the duplicate-identity decisions (DeepSeek `v4f/v4p` vs `0813/V4.1`; `minimaxm3` same-or-distinct). Never commit the payload or the key. Data-only evidence: manifest + `git diff --stat` showing no canonical data change. <!-- sdd-owner: implementation -->
- [x] **1.2 — Close duplicate identity** for DeepSeek and MiniMax in the manifest before any alias row touches those ids; unmapped/ambiguous slugs stay unmapped (fail-closed). Evidence: manifest decision lines. <!-- sdd-owner: implementation -->
- [x] **1.3 — RED: alias assertions.** Add failing expectations to `tests/_aa-safety.test.js` (exact `slug → to` mapping, unknown slug ignored by `mapAaSlug`, `detectMissing` WARN + preserve) and `tests/aa-effort.test.js` (every new row's effort ∈ `max | xhigh | high | medium | low | non-reasoning`; bare slug never defaults to `max`). Run `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js` and confirm each fails for the missing-row reason. <!-- sdd-owner: implementation -->
- [x] **1.4 — GREEN: alias rows.** Add `{slug, to, effort}` rows to `data/aa-aliases.json` (keep `_meta.version 2` semantics), effort taken only from the AA display-name suffix with manifest evidence per row; add no row without effort evidence. Re-run the focused command until green. <!-- sdd-owner: implementation -->
- [x] **1.5 — TRIANGULATE: effort-and-ambiguity edges.** Add cases proving a chart/payload-evidenced `xhigh` row is not accepted as `max`, an uncurated slug produces no catalog entry, and a duplicate-identity slug is ignored; then REFACTOR (row ordering/dedupe, no behavior change). <!-- sdd-owner: implementation -->
- [x] **1.6 — Gate: matrix + no-scope-leak.** Run `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js`; assert `git diff --stat` touches only `data/aa-aliases.json` + the two test files (no `models.json`, no `js/`, no score assertion flips). <!-- sdd-owner: implementation -->
- [x] **1.7 — Rollback check (S1).** `git checkout <slice-base> -- data/aa-aliases.json` restores the prior table; confirm unknown slugs are ignored again and known records are preserved via `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js`. <!-- sdd-owner: implementation -->

**S1 focused command:** `pnpm vitest run tests/_aa-safety.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js`

---

## S2a — Ranking-relevant II backfill (chatgpt-plus + anthropic) — PR 2

Depends on: S1 (blocking). **Blocks:** S3a (hard gate), S2b. Est. 180–340 lines · risk Medium.

- [x] **2.1 — Pre-mutation gate: three-bucket recount.** Tabulate over `data/models.json`: II-covered (`Number.isFinite(intelligenceIndex)`), benchlm-only (finite `benchlm.score` AND not II-covered — `kimik3` precedent), fully-scoreless (neither finite); assert the sum equals catalog size and record counts in `evidence/aa-live-manifest.md`. **Blocking: S2 must not start on a two-bucket count.** <!-- sdd-owner: implementation -->
- [x] **2.2 — Fable live-slug verdict (D4).** Run design §8 procedure against the §1.1 capture: exact predicate `entry.slug === 'claude-fable-5'`, assert at most one exact match, validate the committed alias maps to `claudeFable5` with `effort: 'max'`. Branch: present + finite II → backfill exact value + source tuple; present + non-finite → `null` + omission note; slug absent → no synthesized row, `detectMissing` warns, stays hidden. Record verdict + `fetchedAt` in the manifest; verify the `benchlm` block is byte-identical before/after. **Blocking: no Fable handling before this task closes.** <!-- sdd-owner: implementation -->
- [x] **2.3 — Temporary candidate (no canonical mutation).** Generate the S2a alias projection (all `chatgpt-plus` + `anthropic` catalog ids incl. effort variants, Astra, Fable) outside the worktree; run `node scripts/scrape-artificialanalysis.js --alias <temp-projection> --source <temp-payload> --file <temp-models-copy> --dry-run`, then the same command without `--dry-run` on the temp copy. Gates evaluate on the candidate only. <!-- sdd-owner: implementation -->
- [x] **2.4 — Pre-mutation gate: Astra maximum.** Compute the real maximum over finite-II, active, `chatgpt-plus` rows in the temporary candidate. If the maximum id is **not** `gpt6astra`: **stop**, record the observed maximum + live evidence in the manifest, and ask under ask-on-risk. Do not write canonical data and do not add scorer/sort exceptions. **Blocking for 2.5+.** <!-- sdd-owner: implementation -->
- [x] **2.5 — Preservation pre-check.** On the candidate, compare `JSON.stringify(model.benchlm)` and deep-equal `availability` for every touched id; confirm `data/providers.json` byte-identical, `schemaVersion: 5`, `DATA_FILES` 6, and source tuples dedupe by `(url, date, scraper)`. Any difference blocks the slice. Evidence: diff output in the manifest. <!-- sdd-owner: implementation -->
- [x] **2.6 — RED: provenance/coverage assertions.** Extend `tests/fixtures/aa-sample.json` with the real II path and add failing cases to `tests/scrape-artificialanalysis.test.js` (finite copied verbatim — no clamp/round; covered-but-absent → `null` + idempotent omission note; source tuple appended once), `tests/aa-effort.test.js` / `tests/data-integrity.test.js` (every finite II carries its own `sources[]`; three buckets; Fable branch per 2.2). Confirm red for the right reason via `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js tests/data-integrity.test.js`. <!-- sdd-owner: implementation -->
- [x] **2.7 — GREEN: materialize S2a into canonical data.** Apply the selected JSON delta to `data/models.json` (merge `{...existing, ...patch, effort}`, new ids fail-closed `availability: {}`), append `{url: 'https://artificialanalysis.ai/', date, scraper: 'scrape-artificialanalysis'}` per value, and record `_meta.scrapers['scrape-artificialanalysis'].lastRun` (only because the run was valid + wrote successfully). Re-run the focused command until green. <!-- sdd-owner: implementation -->
- [x] **2.8 — TRIANGULATE + REFACTOR.** Add a second exact-value case (live-exact beats chart rounding) and a covered-but-null case; refactor duplicated manifest/test fixture helpers; keep tests green. <!-- sdd-owner: implementation -->
- [x] **2.9 — Per-role outcome enumeration (frozen thresholds).** Write `evidence/s2a-role-outcomes.md`: provider scope, strategy, old/new reference identity, cost-ceiling deltas, and the 18-role table classified `assigned` / `soft:designated` / `soft:cost` / `unassigned`. Add an acceptance test that **recomputes** maxima and candidate pools from `models.json` at test time (reads II directly, not the still-benchlm public scorer) and asserts classification/invariants only — no hardcoded winner key or II value. <!-- sdd-owner: implementation -->
- [x] **2.10 — Gate: recount + matrix + benchlm hands-off.** Recount the three buckets after S2a, run the S2a focused command, and re-verify 2.5 on canonical data. Record the movement in the manifest. <!-- sdd-owner: implementation -->
- [x] **2.11 — Rollback check (S2a).** `git checkout <slice-base> -- data/models.json` + restore manifest/expectations; re-verify availability deep-equal, `providers.json` byte-identical, `benchlm` byte-identical, schema 5, matrix green. Never run a compensating/reverse scraper. <!-- sdd-owner: implementation -->

**S2a focused command:** `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js`
(Note: local Node 24 collection failures in 3 suites are pre-existing; CI Node 20 governs.)

---

## S2b — Remaining II backfill — PR 3

Depends on: S2a (blocking). **Blocks:** S3a. Est. 160–340 lines · risk Medium.

- [ ] **3.1 — Temporary candidate for remaining ids.** Build the S2b projection (all remaining curated catalog ∩ live-AA ids) and run the scraper on a temp `models.json` copy exactly as in 2.3. <!-- sdd-owner: implementation -->
- [ ] **3.2 — RED: remaining-rows assertions.** Extend `tests/scrape-artificialanalysis.test.js`, `tests/aa-effort.test.js`, and `tests/data-integrity.test.js` with the S2b manifest rows (exact II, source tuple, omission/note idempotence, `documentAbsent` once per day). Confirm red. <!-- sdd-owner: implementation -->
- [ ] **3.3 — GREEN: materialize S2b** into `data/models.json` with the same merge/attribution/`lastRun` discipline as 2.7. Re-run the focused command until green. <!-- sdd-owner: implementation -->
- [ ] **3.4 — TRIANGULATE: nullable + omission edges.** Add cases for a covered row that is absent upstream (`null` + note, key never deleted) and an uncovered row (key stays absent, no synthesized null); REFACTOR shared fixture builders. <!-- sdd-owner: implementation -->
- [ ] **3.5 — Gate: final recount + matrix.** Final three-bucket recount recorded in the manifest; availability matrix green; `benchlm` byte-identical; `providers.json` untouched; schema 5. No scorer or UI assertion flips in this slice. <!-- sdd-owner: implementation -->
- [ ] **3.6 — Rollback check (S2b).** Exact JSON restore of `data/models.json` to the S2b base + evidence restore, then re-run the S2b focused command and the matrix suites. <!-- sdd-owner: implementation -->

**S2b focused command:** `pnpm vitest run tests/scrape-artificialanalysis.test.js tests/aa-effort.test.js tests/data-integrity.test.js tests/availability-matrix.test.js tests/propagate-provider-availability.test.js`

---

## S3a — Dark II scoring foundation (NO activation) — PR 4

Depends on: S2a (hard gate) and ordered after S2b. Est. 160–260 lines · risk Low.

**Boundary rule:** after S3a the runtime is still **fully benchlm**. New II code must be unreachable by every consumer. No task in this slice may change `compositeScore` behavior, any surface, or any freshness source.

- [ ] **4.1 — RED: II-core contract tests.** Add failing cases to `tests/model-scorer.test.js` for a new pure module `js/services/ii-score.js`: finite II returned; clamp high (`>100` → `100`); clamp low (`<0` → `0`); missing/`null`/numeric-string/`NaN` → `null` (never `0`); non-object input → `null`; live-exact verbatim; benchlm-inert pair (differing only in `benchlm.score` → identical result); purity (same input → same output, no mutation). Run `pnpm vitest run tests/model-scorer.test.js` and confirm failure for the missing-module reason. <!-- sdd-owner: implementation -->
- [ ] **4.2 — GREEN: create `js/services/ii-score.js`.** Implement only the final contract (`typeof !== 'number' || !Number.isFinite → null`, else `clamp(value, 0, 100)`), no `benchlm`/sister-benchmark reads, no I/O, no imports from surfaces. <!-- sdd-owner: implementation -->
- [ ] **4.3 — TRIANGULATE: clamp boundaries + inert-benchlm** with a second pair of fixtures (`99.9` vs `100.1`, `benchlm` present vs absent with identical II); REFACTOR for a single clamp path. <!-- sdd-owner: implementation -->
- [ ] **4.4 — Dark-path readiness assertion.** Add a `tests/data-integrity.test.js` readiness check: `js/services/ii-score.js` exists and contains `intelligenceIndex`; **no production module under `js/` imports `ii-score.js`** (grep assert over `js/`, tests excluded); public `compositeScore` source still contains `benchlm` and NOT `intelligenceIndex` (the `:740` flip belongs to S3b only). This assert is the executable form of the dark invariant. <!-- sdd-owner: implementation -->
- [ ] **4.5 — Dark invariant verification.** Run `pnpm vitest run tests/model-scorer.test.js tests/data-integrity.test.js` plus the surface suites that must stay untouched (`tests/ref-table.test.js tests/composite-chart.test.js tests/cli-mirror-table.test.js tests/justification-ui.test.js tests/exporter.test.js tests/freshness-badge.test.js tests/staleness-parity.test.js`); all must pass with **zero** diff in those files. <!-- sdd-owner: implementation -->
- [ ] **4.6 — Rollback check (S3a).** Delete `js/services/ii-score.js` and the added tests; no runtime change results (it is unused); full suite still green. S3a may be reverted only after S3b is reverted. <!-- sdd-owner: implementation -->

**S3a focused command:** `pnpm vitest run tests/model-scorer.test.js tests/data-integrity.test.js`

---

## S3b — Atomic activation: scorer + all consumers + freshness — PR 5

Depends on: S3a (blocking). Est. 280–390 lines · risk **High** (one atomic PR; never half-switched).

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

**S3b focused command:**
`pnpm vitest run tests/model-scorer.test.js tests/ii-ranking.test.js tests/ref-table.test.js tests/composite-chart.test.js tests/cli-mirror-table.test.js tests/justification-ui.test.js tests/exporter.test.js tests/freshness-badge.test.js tests/staleness-parity.test.js tests/data-loader.test.js tests/data-sync.test.js tests/app-filter.test.js tests/config-selector.test.js tests/data-integrity.test.js`
(Local Node 24: 3 suites fail collection — pre-existing; CI Node 20 governs this gate.)

---

## S4 — Policy + docs — PR 6

Depends on: S3b (blocking). Est. 120–240 lines · risk Low.

- [ ] **6.1 — Sync the canonical spec.** Merge the delta into `openspec/specs/model-picker/spec.md`: 3 ADDED requirements (AA Alias Mass-Mapping; Fable Conditional Ranking Rule; Three-Bucket Score Coverage Gate), all MODIFIED blocks (Scoring `compositeScore`, `getBestFor`, Data Layer Models, AA Intelligence Index Field, ref-table, composite-chart, cli-mirror, justification-ui, Filtered Export, Freshness Badge, Sync Service, Testing — Scoring, Testing — Data Integrity) with the `weighted-sum → benchlm-clamp → II-only` revert note, and the REMOVED scenario records (Astra-first-as-data-consequence; intelligenceIndex-inert scenarios). Leave the archived change untouched. <!-- sdd-owner: implementation -->
- [ ] **6.2 — Changelog + operator docs.** Document the day-one churn (Fable → hidden or real II, II-less rows leaving ranked views), the D1 hide rule + shared count/note, D2 frozen thresholds (soft-fallback/unassigned storm is expected), D3 fail-soft + no staleness contract change, and D5 inert-not-deleted benchlm ("datum, not signal"). <!-- sdd-owner: implementation -->
- [ ] **6.3 — Final gate + rollback.** Run `pnpm test` and `pnpm build` (CI Node 20 governs; note the pre-existing Node 24 collection failures, never patch tests for them). Rollback order for the whole change: **S3b → S3a → S2b → S2a → S1**, JSON restore for data slices (never a reverse migration, never fallback scores); S4 docs may be reverted first when needed. <!-- sdd-owner: implementation -->

---

## Open decisions owned by the parent (ask-on-risk)

1. **S3b near ceiling (280–390).** If the measured diff exceeds 400, stop and ask; do not split the runtime half-way and do not infer `size:exception`.
2. **S2a Astra gate (task 2.4)** may trip → stop, record, ask; do not mutate and do not add a scorer exception.
3. **Fable verdict (task 2.2)** sets the S2a data branch; both branches are pre-approved, the manifest records which one happened.
4. **Values are never normative:** 52.8 / 50.7 / 48.2 and 83.68 appear only as data examples; acceptance asserts computed maxima over the live-traced II set with `sources[]`.
