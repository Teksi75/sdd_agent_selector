# Delta for Model Picker — 2026-09-14-aa-only-scoring

Source: `openspec/changes/2026-09-14-aa-only-scoring/proposal.md` (decisions D0–D7, all confirmed — do NOT re-interview, do NOT reopen).
Canonical: `openspec/specs/model-picker/spec.md` (34 requirements).
Scope note: `tier` data field and `tier-based` strategy logic are preserved (non-goal); effort-only display, 18/9/5 surface counts, and header providers+timestamp semantics are unchanged; the archived change `2026-09-13-aa-intelligence-refresh`, PRs #72–#78, all branches, and the worktree are untouched (parent owns sequencing). Fable live verdict and per-model II values are NOT normative in this spec — acceptance asserts against computed maxima / live-traced values with `sources[]`; the numbers 52.8 / 50.7 / 48.2 appear below ONLY as data examples of live-exact precedence, never as ranking law.

## ADDED Requirements

### Requirement: AA Alias Mass-Mapping (catalog ∩ live AA)

The system MUST cover catalog ∩ live AA with explicit alias rows `{slug, to, effort}` in `data/aa-aliases.json`. Each row's `effort` MUST come from the AA display-name suffix under the closed vocabulary `max | xhigh | high | medium | low | non-reasoning` and MUST never be inferred from pricing, family, or benchlm rank. `mapAaSlug` MUST ignore uncurated slugs; `detectMissing` MUST WARN + preserve. Every new catalog entry created through this mapping MUST land fail-closed (`availability: {}` or explicit `false` for every registered provider lacking `sourceOfTruth` evidence, exact-id overrides flagged per the Family Availability rule) until provider evidence is curated. The integrity gate (`availability-matrix`, `propagate-provider-availability`) MUST stay green after mapping: full `families × providers` boolean matrix, `DATA_FILES` count intact, cli-mirror 18 rows, workflow 9 rows, 5 config buttons, hero-stats `"X de Y visibles"`.

#### Scenario: Unknown newcomer is invisible until curated

- GIVEN a live AA slug with no entry in `data/aa-aliases.json`
- WHEN `mapAaSlug` + merge run and `applyProviderFilter` runs with any provider enabled
- THEN no new catalog entry is created for that slug
- AND `detectMissing` emits WARN and preserves existing data

#### Scenario: Matrix gate stays green after mapping

- GIVEN the mapped `data/aa-aliases.json` + `data/models.json` + `data/providers.json`
- WHEN the vitest integrity suite runs
- THEN every `(base family, provider)` cell holds an explicit boolean
- AND cli-mirror renders 18 rows, workflow renders 9 rows, config selector renders 5 buttons
- AND hero-stats shows `"X de Y visibles"`

#### Scenario: Effort is never inferred

- GIVEN a live AA slug with no chart/payload effort evidence (bare slug)
- WHEN a curator proposes an alias row for it
- THEN no row lands until evidence fixes effort (bare slug ≠ `max`)
- AND `aa-effort` asserts reject any row whose effort is not in the closed vocabulary

### Requirement: Fable Conditional Ranking Rule (claudeFable5, D4)

The system MUST resolve `claudeFable5` conditionally on live AA (D4). If live AA lists it under a curated slug, the system MUST map + backfill its real `intelligenceIndex` with its own `sources[]` entry and it ranks by that II like any covered model. If live AA does not list it, it MUST stay hidden from ranked views under the D1 hide rule with no pseudo-score. `benchlm.score` MUST never serve as a fallback score for Fable or any model (the data example 83.68 is illustrative of the old distortion, not a normative value).

#### Scenario: Fable present in live AA ranks with its real II

- GIVEN live AA lists `claudeFable5` under a curated alias slug with a finite II payload
- WHEN the alias row + backfill land with `sources[]` `{url: https://artificialanalysis.ai/, date, scraper: scrape-artificialanalysis}`
- THEN `claudeFable5` carries a finite `intelligenceIndex`
- AND it appears in ranked views ordered by that II

#### Scenario: Fable absent from live AA stays hidden with no pseudo-score

- GIVEN live AA carries no slug mapping to `claudeFable5`
- WHEN any ranked surface renders
- THEN `claudeFable5` does not appear in ranked rows, bars, assignments, alternatives, or ranked exports
- AND it is counted in the shared hidden-rows note, never rendered with a score

#### Scenario: Benchlm-as-fallback is forbidden

- GIVEN any model with a finite `benchlm.score` and null-or-absent `intelligenceIndex`
- WHEN `compositeScore` runs and any ranked surface renders
- THEN the score is `null` and the model is hidden from ranked views
- AND no scorer, surface, or test branch substitutes the benchlm value

### Requirement: Three-Bucket Score Coverage Gate (proposal-gate data gate)

Before S2 slices start, the system MUST recount three coverage buckets over the catalog: II-covered (finite `intelligenceIndex`) / benchlm-only (finite `benchlm.score`, II null-or-absent) / fully-scoreless (neither score finite). S2 MUST NOT start on a two-bucket count. The `kimik3` precedent is normative for classification: benchlm-scored-but-II-less is benchlm-only, never scoreless.

#### Scenario: Three-bucket recount gates S2

- GIVEN the catalog at the proposal gate
- WHEN coverage is tabulated
- THEN counts are reported as three buckets (II-covered / benchlm-only / fully-scoreless)
- AND a model like `kimik3` (finite benchlm, no II) lands in benchlm-only, not fully-scoreless

#### Scenario: Two-bucket count blocks S2

- GIVEN a coverage report with only two buckets (II-covered vs. rest)
- WHEN the S2 gate is evaluated
- THEN S2 MUST NOT start
- AND the gate trips until the three-bucket recount lands

## MODIFIED Requirements

### Requirement: Scoring Service — compositeScore

The system MUST provide a `compositeScore(model)` function whose only score input is `model.intelligenceIndex`. A finite value MUST be returned clamped to `[0, 100]` (values below `0` clamp to `0`, values above `100` clamp to `100`). A missing model, a missing `intelligenceIndex` key, or an absent/non-finite value MUST return `null` — never `0` and never a synthesized replacement. The function MUST be pure (no side effects, deterministic for the same input). `benchlm`, `arena`, `swePro`, `sweVer`, `term`, `codingIndex`, and `mathIndex` MUST be inert: none of them may influence the returned score or any ordering derived from it. Stored II values MUST be preserved verbatim (live-exact wins over chart rounding; no rounding in the store — rounding, if any, is display-only).

(Previously: benchlm-clamp — the only score input was `model.benchlm.score` clamped `[0, 100]` with null fail-soft and `intelligenceIndex` inert (itself the revert of the canonical weighted sum: Arena ELO 30% + SWE-Bench Pro 30% + Terminal-Bench 20% + SWE-Bench Verified 20%, with missing weights redistributed proportionally and `0` returned when all benchmarks were missing). Delta chain: weighted-sum → benchlm-clamp → II-only. This delta explicitly reverts the benchlm-clamp contract: `js/services/model-scorer.js` MUST read II, and the data-integrity grep assert flips to CONTAINS `intelligenceIndex` and NOT `benchlm`.)

#### Scenario: Intelligence Index is returned directly

- GIVEN a model with `intelligenceIndex: 42.3`
- WHEN `compositeScore(model)` is called
- THEN it returns `42.3`

#### Scenario: High values clamp to 100

- GIVEN a model with `intelligenceIndex: 124.5`
- WHEN `compositeScore(model)` is called
- THEN it returns `100`

#### Scenario: Low values clamp to 0

- GIVEN a model with `intelligenceIndex: -3`
- WHEN `compositeScore(model)` is called
- THEN it returns `0`

#### Scenario: Missing or non-finite II fails soft to null

- GIVEN models whose `intelligenceIndex` is absent, `null`, a numeric string, or `NaN`
- WHEN `compositeScore(model)` is called for each
- THEN every call returns `null`
- AND no call returns `0`

#### Scenario: Two models differing only in benchlm score identically

- GIVEN two models identical except that one carries `benchlm.score: 83.68` and the other `benchlm.score: null`
- WHEN `compositeScore` is called for both and `getBestFor` orders the pair
- THEN both scores are equal
- AND the winner is identical, driven only by the II contract

#### Scenario: Live-exact II values are preserved verbatim

- GIVEN a model with `intelligenceIndex: 52.8` (data example of live-exact precedence — the value is illustrative, not normative)
- WHEN the value is stored and `compositeScore(model)` is called
- THEN the store holds `52.8` exactly (not the chart-rounded `53`)
- AND the call returns `52.8`

### Requirement: Scoring Service — getBestFor (Hybrid Role-Aware Matching)

The system MUST provide a `getBestFor(agent, models, roleMatrix, agentRequestProfiles, configStrategy)` function that returns the model key best suited for a given agent, considering the hybrid constraint model.

The function MUST:

1. Look up the role requirements from `roleMatrix[agent]`.
2. Apply the config strategy modifier to the requirements:
   - `min-cost`: multiply `costRatio` by 0.5
   - `max-quality`: add 10 to `minReasoning`
   - `experimental`: same as `max-quality`, no `isNew` filter
   - `tier-based`: skip tier-based filter (handled separately)
   - `balanced`: no modification
3. Compute `effectiveMaxCost = costRatio × costEstimate(referenceModel, agentProfile)` where `referenceModel` is the model with `tier: "reference"` (or the highest-scoring model — now highest-II — if no reference exists).
4. Filter models to: not reference tier, `compositeScore ≥ minReasoning`, `costEstimate(model, agentProfile) ≤ effectiveMaxCost`.
5. If no model qualifies, return `{ key: null, reason: "..." }`.
6. Otherwise, return the highest-scoring eligible model.

Callers MUST pre-filter the `models` argument with `applyProviderFilter` before invoking `getBestFor`; the function signature is unchanged. Soft fallbacks MUST resolve only within the pre-filtered eligible set.

The function MUST return an object: `{ key, model, score, cost, effectiveMaxCost, alternatives, reason }` where `alternatives` is the top 3 other eligible models for justification UI.

Numeric `minReasoning` values MUST stay frozen (D2: no rescaling, no role-matrix data change, no II-adjusted scaling factor in this change). The score scale meaning shifts from benchlm magnitudes to II magnitudes; eligibility collapse under frozen thresholds is absorbed by the existing soft-fallback + `unassigned` semantics — no new fallback tier is introduced. No ranking branch, re-sort, or scorer tweak may be added to force a winner: acceptance asserts computed maxima over the live-traced II set at test time, never hardcoded winners or values.

(Previously: identical flow with the benchlm-clamp score scale, plus the Astra-first-as-data-consequence scenario and the intelligenceIndex-inert scenario. Both scenarios are deleted by this delta — not edited — because they assumed benchlm maxima: under AA-only the eligible maximum is computed over II and the reference-model identity flips to highest-II, shifting every `effectiveMaxCost`. All other behavior preserved.)

#### Scenario: sdd-archive resolves to cheapest eligible

- GIVEN the role matrix says `sdd-archive: { minReasoning: 50, costRatio: 0.05 }`
- AND the reference model is Opus 4.8 ($0.048/request for archive profile)
- WHEN `getBestFor('sdd-archive', models, roleMatrix, profiles, 'balanced')` is called
- THEN `effectiveMaxCost` is `$0.0024` ($0.048 × 0.05)
- AND the returned model has `score ≥ 50` AND `cost ≤ $0.0024`
- AND the returned model is the highest-scoring among eligible

#### Scenario: sdd-orchestrator requires highest reasoning

- GIVEN the role matrix says `gentle-orchestrator: { minReasoning: 95, costRatio: 1.0 }`
- WHEN `getBestFor('gentle-orchestrator', models, roleMatrix, profiles, 'balanced')` is called
- THEN only models with `score ≥ 95` are eligible
- AND the returned model is the one with the highest score among those

#### Scenario: min-cost strategy tightens cost constraints

- GIVEN config strategy is `min-cost`
- WHEN `getBestFor('sdd-apply', models, roleMatrix, profiles, 'min-cost')` is called
- THEN `effectiveMaxCost` is 50% of the `balanced` value
- AND fewer (cheaper) models are eligible

#### Scenario: max-quality strategy tightens reasoning constraints

- GIVEN config strategy is `max-quality`
- WHEN `getBestFor('sdd-archive', models, roleMatrix, profiles, 'max-quality')` is called
- THEN `minReasoning` is 60 (was 50, +10 from strategy)
- AND only models with `score ≥ 60` are eligible

#### Scenario: No model qualifies

- GIVEN no model has `score ≥ 95` (sdd-orchestrator requirement)
- WHEN `getBestFor('gentle-orchestrator', models, roleMatrix, profiles, 'balanced')` is called
- THEN the result is `{ key: null, reason: 'No model meets minReasoning=95' }`
- AND the UI must show a critical warning for that agent

#### Scenario: Pre-filtered callers never return ineligible models

- GIVEN the eligible set E excludes model H (highest scorer overall)
- WHEN `getBestFor` is called with E for any agent
- THEN the returned `key` is in E or `null`
- AND `alternatives` contains only members of E

#### Scenario: Empty eligible set under frozen thresholds resolves via existing fallback/unassigned semantics

- GIVEN frozen numeric `minReasoning` thresholds and an II set where no model clears the threshold for the role
- WHEN `getBestFor` runs for that role
- THEN soft fallbacks #1 (role-designated) and #2 (cost-clearing) resolve only within the eligible set
- AND where no fallback clears, the result is `{ key: null, reason: ... }` with `unassigned` rendering downstream
- AND no score is invented to fill the board

#### Scenario: Per-role empty/fallback/unassigned expectations are enumerated at test time

- GIVEN the S2a-backfilled II set with frozen thresholds
- WHEN the acceptance suite runs over all 18 agents
- THEN each role records its expected outcome (assigned key / soft-fallback / `unassigned`) computed against the live-traced II set at test time (proposal §6 absorption order)
- AND no expectation hardcodes a winner key or II value as ranking law

#### Scenario: No ranking branch may force a winner

- GIVEN the eligible set ordered by the unchanged II `compositeScore` desc
- WHEN `getBestFor` selects the top row
- THEN the winner is the computed maximum of that eligible set
- AND no scorer tweak, re-sort, or special-case branch alters the outcome

### Requirement: Data Layer — Models

The system MUST represent LLM model data as a JSON object with one key per model. Each model MUST have the following fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Display name |
| `intelligenceIndex` | number \| null | No | AA Intelligence Index — THE ranking field consumed by `compositeScore`; null if unknown |
| `benchlm` | object \| null | No | Inert datum (kept, not deleted); MUST NOT influence ordering |
| `arena` | number \| null | No | LMSYS Arena ELO score; null if unknown; inert for ordering |
| `swePro` | number \| null | No | SWE-Bench Pro score; inert for ordering |
| `sweVer` | number \| null | No | SWE-Bench Verified score; inert for ordering |
| `term` | number \| null | No | Terminal-Bench score; inert for ordering |
| `input` | number | Yes | Input price $/1M tokens |
| `output` | number | Yes | Output price $/1M tokens |
| `cacheRead` | number | No | Cached read price $/1M tokens |
| `tier` | enum | Yes | `high` \| `balanced` \| `budget` \| `reference` (data field preserved; strategy logic preserved; display untouched by this delta) |
| `availability` | map | Yes | `{ "<provider-id>": boolean }` per Family Availability requirement; curated per base family, inherited by effort variants; fail-closed on missing keys |
| `isNew` | boolean | No | Marks a new addition |
| `isReference` | boolean | No | If true, excluded from pricing/charts |
| `notes` | string | No | Free-form annotation |
| `sources` | array | No | `[{url, date}]` references |

Every finite `intelligenceIndex` value MUST carry its own `sources[]` entry of shape `{url: https://artificialanalysis.ai/, date, scraper: scrape-artificialanalysis}`; live-exact payload wins over chart rounding; zero synthesis (no number enters without AA payload/chart evidence). The catalog invariant stays finite-or-null, never fabricated `0`. `benchlm` and sister benchmarks (`codingIndex`, `mathIndex`, `arena`, `swePro`, `sweVer`, `term`) are kept as inert data and MUST NOT be deleted. The AA merge MUST be read-modify-write preserving curated `availability`; scrapers MUST NOT write `data/providers.json` nor consult `pricingSource` for availability.

A `_meta` block at the top level MUST include: `lastSynced` (ISO date), `source` (string), `nextSync` (ISO date), `schemaVersion` (integer).

The data loader MUST fetch `data/providers.json` alongside the model data (`DATA_FILES` 5 → 6; `CACHE_KEY sdd-models-v6` registry-aware) and MUST extend the schema-version check to the registry.

(Previously: no `intelligenceIndex` row in the Models table and no ranking-field designation; `benchlm` was the ordering input via the benchlm-clamp contract. This delta designates `intelligenceIndex` as THE ranking field with per-number provenance and demotes `benchlm` to inert datum; availability, loader, and `_meta` rules unchanged.)

#### Scenario: Reference models excluded from pricing display

- GIVEN a model with `tier: "reference"` exists in `data/models.json`
- WHEN the pricing chart is rendered
- THEN that model does not appear in the chart
- AND does not appear in the pricing reference table

#### Scenario: Schema-versioned cache invalidation

- GIVEN `sessionStorage` contains a cached `data/models.json` with `schemaVersion: 1`
- WHEN the loader fetches new data with `schemaVersion: 2`
- THEN the loader discards the cached data
- AND uses the freshly fetched data

#### Scenario: Every entry carries a full availability map

- GIVEN the registry holds P providers
- WHEN `data/models.json` is loaded
- THEN every entry has an explicit boolean for all P provider ids
- AND the integrity gate fails otherwise

#### Scenario: Every II value carries its own sources[] entry

- GIVEN a model with finite `intelligenceIndex`
- WHEN `data/models.json` is inspected
- THEN the entry carries a `sources[]` item `{url: https://artificialanalysis.ai/, date, scraper: scrape-artificialanalysis}`
- AND no finite II value in the file lacks its own entry

#### Scenario: Live-exact wins over chart rounding

- GIVEN the live AA payload holds `52.8` for a model while the public chart renders `53` (data example — values illustrative, not normative)
- WHEN the backfill lands
- THEN the store holds `52.8` exactly
- AND the chart rounding never enters the store

#### Scenario: Benchlm is kept as inert datum, never deleted

- GIVEN a model with a `benchlm` block
- WHEN the II backfill or AA sync merges
- THEN the `benchlm` block is byte-identical before and after the run
- AND no surface, scorer, or test reads it for ordering

#### Scenario: Merge preserves availability and never writes providers.json

- GIVEN a stored entry with `availability: { "chatgpt-plus": true }`
- WHEN any AA sync merges fresh II fields over that id
- THEN the resulting entry retains the identical `availability` map
- AND `data/providers.json` is byte-identical before and after the run

### Requirement: AA Intelligence Index Field

The system MUST support an AA-owned model field `intelligenceIndex` of type `number | null` (`null` when unknown). The scraper (`scripts/scrape-artificialanalysis.js` `FIELD_MAP` + `buildAaPatch`) MUST map the live AA v2 payload Intelligence Index path into `intelligenceIndex`. The merge MUST be read-modify-write preserving curated `availability` (never clobber; scrapers MUST NOT write `data/providers.json` nor consult `pricingSource` for availability). The field IS the sole ordering input to `compositeScore`/`getBestFor` in this change. The fixture `tests/fixtures/aa-sample.json` MUST be extended with the real field and covered by `tests/scrape-artificialanalysis.test.js`.

(Previously: the field MUST be inert to `compositeScore`/`getBestFor` in this slice (proposal D1-A of the archived change). That inertness is explicitly reverted by this delta — delta chain weighted-sum → benchlm-clamp → II-only. The inert-II scenarios in this requirement, in Scoring `compositeScore`, and in `getBestFor` die here and are replaced by the II-authority + benchlm-inert scenarios.)

#### Scenario: Scraper maps Intelligence Index without clobbering availability

- GIVEN a stored entry with `availability: { "chatgpt-plus": true }` and an AA payload carrying an Intelligence Index value
- WHEN `buildAaPatch` merges the payload
- THEN the resulting entry carries `intelligenceIndex` as `number`
- AND the `availability` map is byte-identical to the stored one

#### Scenario: Missing Intelligence Index stays null and is noted, never synthesized

- GIVEN an AA payload without a recognizable Intelligence Index path
- WHEN the scraper merges what is available
- THEN the entry keeps `intelligenceIndex: null`
- AND the run records an omission note instead of inventing a number

#### Scenario: intelligenceIndex drives the scorer

- GIVEN two models identical except that one carries `intelligenceIndex: 52.8` and the other `intelligenceIndex: 48.2` (data examples — values illustrative, not normative)
- WHEN `compositeScore` is called for both
- THEN the scores differ and follow the II values
- AND `getBestFor` ordering over the pair follows the higher II

### Requirement: UI Component — Reference Table (pilot)

The `ref-table` component MUST render a table with one row per II-covered eligible non-reference model (eligible set ∩ non-reference ∩ finite `intelligenceIndex`). The Score column MUST render `intelligenceIndex` as stored (no rounding in the store) and sorting MUST be `compositeScore` (II) descending with the existing input-price tie-break and `isNew` pin. Rows with null-or-absent II MUST be removed from the DOM under the D1 hide rule (not dimmed, no placeholder) and counted in the shared hidden-rows note. Columns MUST include: name, effort (`Esfuerzo`, `data-effort`), Score (II), arena, swePro, sweVer, term, input price, output price, source badges — and MUST NOT include a `Tier` column or header. Each row MUST show at most the effort badge; the row MUST NOT render `tierCell`, `.tier-tag`, `data-tier`, or any soft marker. The component MUST be a pure function: `render(targetEl, models)`.

Every surface that hides rows MUST render the deterministic shared note adjacent to the ranked content iff the hidden count N > 0: `"{N} models hidden — no Artificial Analysis Intelligence Index on {date}"` where `{date}` is the AA II sync date shown by the freshness badge; N = 0 renders no note. The count source MUST be shared across ref-table, composite-chart, and ranked exports.

The component MUST NOT include interactive controls. It is read-only.

(Previously: Score cell rendered `benchlm.score` with null → `—` rows kept in the DOM; this delta swaps the display source to II and hides null-II rows with the shared count/note. Effort-only, eligible-only, `isNew`-pin, and read-only rules unchanged.)

#### Scenario: Reference table renders II-covered non-reference models

- GIVEN `data/models.json` with 5 non-reference and 1 reference model, all II-covered and eligible
- WHEN `refTable.render(targetEl, models)` is called
- THEN the table has 5 rows
- AND the reference model does not appear

#### Scenario: Score column reads II and sorts descending

- GIVEN eligible II-covered models with distinct II values
- WHEN `refTable.render(targetEl, eligibleModels)` is called
- THEN each Score cell shows the stored `intelligenceIndex`
- AND rows order by `compositeScore` desc with the cheaper-input tie-break

#### Scenario: Source badges reflect available benchmarks

- GIVEN a model with `arena: 1500, swePro: 60, term: null`
- WHEN the table renders
- THEN the row shows `arena` and `swe` source badges
- AND does NOT show a `term` badge

#### Scenario: Null-II models are hidden with the shared note, not dimmed

- GIVEN 5 non-reference eligible models of which 2 have null-or-absent II
- WHEN `refTable.render(targetEl, eligibleModels)` is called
- THEN the table has 3 rows
- AND no hidden-model placeholder remains in the DOM
- AND the shared note `"2 models hidden — no Artificial Analysis Intelligence Index on {date}"` renders adjacent to the table

#### Scenario: Zero hidden rows renders no note

- GIVEN all eligible models II-covered (N = 0)
- WHEN the table renders
- THEN no hidden-rows note appears

#### Scenario: `isNew` models pin to the top of the active group

- GIVEN eligible II-covered non-reference models including `isNew === true` rows with lower scores and non-`isNew` rows with higher scores
- WHEN `refTable.render(targetEl, eligibleModels)` is called
- THEN every `isNew === true` active row appears before every non-`isNew` active row
- AND within each bucket rows keep score-descending order with cheaper-input tie-break
- AND the pin never moves rows across lifecycle groups

#### Scenario: Reference table is effort-only with no Tier column

- GIVEN eligible models with mixed `tier` and `effort` values
- WHEN `refTable.render(targetEl, eligibleModels)` is called and headers plus `exportRowsFrom` output are inspected
- THEN headers contain `Esfuerzo` and do not contain `Tier`
- AND each row contains `[data-effort]` with a closed-vocabulary value
- AND no row or export contains `tierCell`, `[data-tier]`, or `.tier-tag`

### Requirement: UI Component — Composite Chart

The `composite-chart` component MUST render a horizontal bar chart of `compositeScore` (AA Intelligence Index) for II-covered eligible non-reference models. The chart MUST sort bars by score descending. Each bar MUST show the II score value and the model name. Models with null-or-absent II MUST NOT appear (no "unavailable" ranked rows — hidden under D1 with the shared count/note). Ineligible models MUST NOT appear. An empty eligible set MUST render an empty chart with the empty-state label. The chart's stale badge MUST track the AA II sync source (same source as the Freshness Badge requirement), not benchlm metadata.

The function signature MUST be `render(targetEl, models)`.

(Previously: bars rendered benchlm scores with nulls-last "unavailable" rows and the badge tracked `_meta.scrapers.benchlm.lastRun`. This delta swaps bars + sort to II, hides null-II rows, and retargets the badge to the AA II sync. Empty-state and signature rules unchanged.)

#### Scenario: Reference models excluded

- GIVEN models include a reference tier
- WHEN the chart renders
- THEN the reference model does not appear in the chart

#### Scenario: Bars sorted descending by II

- GIVEN 5 II-covered non-reference models with varying II values
- WHEN the chart renders
- THEN the top bar is the highest II
- AND the bottom bar is the lowest II

#### Scenario: Null-II and ineligible models excluded; empty set labelled

- GIVEN 2 of 5 models ineligible and 1 of the remaining 3 II-less
- WHEN the chart renders over the eligible set
- THEN only 2 bars appear, sorted descending
- AND the shared hidden-rows note counts the II-less row
- AND with zero eligible models the chart shows the empty-state label

#### Scenario: Stale badge tracks the AA II sync

- GIVEN the AA II sync timestamp is > 7 days old
- WHEN the chart renders
- THEN the stale badge is visible and references II staleness, not benchlm
- AND with a fresh II sync no stale badge appears

### Requirement: UI Component — CLI Mirror Table

The `cli-mirror-table` component MUST render a table showing the 18 agents (11 SDD + 3 JD + 4 Review) and their real CLI mapping. Each row MUST include: agent key, role description, and assigned model (from the active config over the eligible set, resolved by II-ordered `getBestFor`) with at most the effort badge (`data-effort`, closed vocabulary). Any score shown MUST be the AA Intelligence Index. The assigned cell MUST NOT render `.tier-tag`/`data-tier`, `softBadge`/`.soft-badge`, or a `~` prefix. Ineligible models MUST never appear; II-less models MUST never appear as assignments; unassigned agents (including empty-eligible under frozen thresholds) MUST show the empty-state warning. The table MUST still render exactly 18 rows.

The function signature MUST be `render(targetEl, agentsAssignments, agentRoles)`.

(Previously: assignments resolved by the benchlm-clamp ordering. This delta swaps resolution + displayed scores to II; effort-only, eligible-only, 18-row, and signature rules unchanged.)

#### Scenario: 18 agents shown

- GIVEN the active config assigns models to all 18 agents
- WHEN `cliMirrorTable.render(targetEl, assignments, agentRoles)` is called
- THEN the table has exactly 18 rows
- AND each row shows the agent key, role, and assigned model

#### Scenario: Filtered assignments preserve row count

- GIVEN 3 agents have no eligible model under the current filter
- WHEN the table renders
- THEN it still has 18 rows
- AND those 3 rows show the `unassigned` warning

#### Scenario: Assignments resolve by II with II-less agents unassigned

- GIVEN an II-ordered eligible set where one agent has no II-covered candidate clearing its frozen threshold
- WHEN the table renders
- THEN that agent's row shows the `unassigned` warning with zero badges
- AND no benchlm-only model appears as a substitute assignment

#### Scenario: CLI mirror assigned cells are effort-only

- GIVEN assignments covering fallback and normal rows
- WHEN the table DOM is inspected
- THEN every assigned-model cell shows at most `[data-effort]` with a closed-vocabulary value
- AND no cell matches `.tier-tag`, `[data-tier]`, `.soft-badge`, or contains a `~` soft prefix
- AND null assignments render the empty-state text with zero badges

### Requirement: Justification UI

The system MUST provide a `justification-ui` component that renders one card per agent (18 total) showing why each agent has its assigned model. Each card MUST display:

- Agent name
- Assigned model name + effort tag only (`data-effort`, closed vocabulary `max | xhigh | high | medium | low | non-reasoning`); the card MUST NOT display tier
- Composite score (AA Intelligence Index) of the assigned model
- Cost per request of the assigned model
- Role description
- The two checks: `score ≥ minReasoning` and `cost ≤ effectiveMaxCost`
- Top 3 alternative eligible models (model name + II score), ordered by II descending

Cards MUST render only II-covered eligible models; alternatives MUST be drawn from the II-covered eligible set. Null-or-absent-II models MUST appear in neither assignments nor alternatives. If an agent has no eligible model (including the empty eligible set under frozen thresholds), the card MUST show a critical warning instead of an assignment, with `unassigned` semantics. Fallback assignments MUST render as the model name only, with no badge. The card, its header (`assignmentHeader`), and its markdown export MUST NOT render `.tier-tag`/`data-tier`, `.soft-badge`/`~`, a `.soft-summary` banner (`[data-test=soft-summary]`), or an `Estado: soft fallback` column.

The function signature MUST be `render(targetEl, agentsAssignments, roleMatrix, models)`.

(Previously: card scores and alternatives ordering read benchlm. This delta swaps them to II and bans II-less models from cards/alternatives; effort-only, eligible-only, warning, badge-ban, and signature rules unchanged.)

#### Scenario: Justification card shows valid assignment

- GIVEN `sdd-archive` is assigned to an II-covered model with II 48.2 and cost $0.00028 (values illustrative, not normative)
- WHEN the justification UI renders
- THEN the `sdd-archive` card shows the assigned model, score = 48.2, cost = $0.00028, role = archival
- AND the score check shows `48.2 ≥ 50` semantics against the frozen threshold
- AND the cost check shows `$0.00028 ≤ $0.0024` (satisfied)
- AND the top 3 alternatives are listed

#### Scenario: Justification card shows warning when no model qualifies

- GIVEN `gentle-orchestrator` has no eligible model (no II-covered model scores ≥ 95)
- WHEN the justification UI renders
- THEN the `gentle-orchestrator` card shows a critical warning
- AND displays the reason from `getBestFor` (e.g., "No model meets minReasoning=95")
- AND the rest of the UI continues to work (no crash)

#### Scenario: Justification shows effectiveMaxCost dynamically

- GIVEN the reference model is Opus 4.8 ($0.048/request)
- WHEN the justification UI renders for `sdd-archive`
- THEN `effectiveMaxCost` displayed is `$0.0024` ($0.048 × 0.05)
- AND if the reference model price changes, the displayed value updates

#### Scenario: Justification hides ineligible and II-less models

- GIVEN model H is ineligible under the current filter and model W is benchlm-only (II-less)
- WHEN the justification UI renders
- THEN neither H nor W appears in assignments nor alternatives on any card

#### Scenario: Alternatives order by II descending

- GIVEN an agent with 4+ II-covered eligible candidates
- WHEN its card renders
- THEN the top 3 alternatives are the 3 highest-II candidates after the assigned model
- AND each alternative line shows name + II score

#### Scenario: Justification is effort-only with no tier or soft traces

- GIVEN any assignment rendering 18 cards
- WHEN the justification UI DOM and its markdown export are inspected
- THEN no element matches `.tier-tag`, `[data-tier]`, `.soft-badge`, `[data-test=soft-summary]`, and no text matches `~` soft prefix or `Estado: soft fallback`
- AND every assigned-model header shows at most one tag: `[data-effort]` with a closed-vocabulary value
- AND a soft-fallback assignment renders the model name with zero badges

### Requirement: Filtered Export

The exporter MUST export the filtered view by default with a header line stating active providers + timestamp. An explicit opt-in flag MUST produce the full-catalog export instead. Rationale: export must reproduce what the user saw. Ranked export bodies MUST contain II-ranked rows only (finite II, eligible set); score lines MUST show the AA Intelligence Index. The ranked-export header MUST carry the shared hidden-rows note (`"{N} models hidden — no Artificial Analysis Intelligence Index on {date}"`) iff N > 0, so a pasted export is self-explaining; there MUST be no unranked appendix. The export body and any `agentsMarkdown` per-model line MUST NOT include tier (no `Tier` column, no `(tier · score · costo)` fragment); score and cost MAY remain. The header providers+timestamp line and the full-catalog flag semantics MUST be preserved.

(Previously: score lines read benchlm and II-less rows could appear with `—`; this delta swaps scores to II, hides II-less rows with the shared header note, and adds the no-appendix rule. Tier ban, header, and flag semantics unchanged.)

#### Scenario: Default export matches the visible view

- GIVEN providers P enabled and Q disabled
- WHEN the user exports without flags
- THEN the file contains only models eligible under P
- AND the first header line names the active providers and the export timestamp

#### Scenario: Full-catalog opt-in works

- GIVEN the same filtered state
- WHEN the user exports with the full-catalog flag
- THEN the file contains the whole catalog
- AND the header records that the full-catalog option was used

#### Scenario: Ranked export carries II scores with the shared hidden note and no appendix

- GIVEN a filtered view with R II-covered ranked rows and N > 0 hidden II-less rows
- WHEN the ranked export is produced
- THEN every score line shows the II value
- AND the header carries the shared note with count N from the shared count source
- AND no unranked appendix section exists

#### Scenario: Export body carries no tier

- GIVEN any filtered or full-catalog export
- WHEN the body lines are inspected
- THEN no line contains a `Tier` column or the fragment `(tier · score · costo)`
- AND no line contains `tier-tag` / `data-tier` markup
- AND the header line still names active providers + timestamp

### Requirement: UI Component — Freshness Badge

The `freshness-badge` component MUST display a textual indicator of how stale the AA Intelligence Index data is. It MUST track the AA II sync timestamp — primary source `_meta.scrapers['scrape-artificialanalysis'].lastRun`, falling back to `_meta.lastSynced` from `data/models.json` when the scraper timestamp is absent (per-model `sources[]` max date is audit trail only, never the badge source) — and produce strings like:

- "Datos del 04/07/2026 — hoy" (same day)
- "Datos del 04/07/2026 — hace 1 día" (1 day old)
- "Datos del 04/07/2026 — hace 2 días" (2+ days old)

The component MUST include a "↻ Actualizar ahora" button that triggers `dataSync.refresh()`. The component MUST show a warning banner when staleness > 7 days; the warning MUST reference AA Intelligence Index staleness, never benchlm. The 7-day threshold and fail-soft cached-staleness display are unchanged (D3: no contract change — only the tracked source moves).

(Previously: the badge tracked benchlm metadata (`_meta.scrapers.benchlm.lastRun` for the chart badge). This delta retargets both badges to the AA II sync; strings, button, threshold, and fail-soft behavior unchanged.)

#### Scenario: Same day shows "hoy"

- GIVEN the AA II sync timestamp is today's date
- WHEN the badge renders
- THEN the text includes "hoy"

#### Scenario: >7 days old shows warning banner

- GIVEN the AA II sync timestamp is 8 days before today
- WHEN the badge renders
- THEN a warning banner referencing Artificial Analysis Intelligence Index staleness is visible
- AND no benchlm reference appears

#### Scenario: Badge tracks the AA II sync, not benchlm metadata

- GIVEN a fresh AA II sync with stale benchlm metadata (or vice versa)
- WHEN the badge renders
- THEN staleness is computed from the AA II sync timestamp
- AND benchlm timestamps do not influence the badge

#### Scenario: Sync-down shows cached II staleness

- GIVEN the AA sync fails and cached II data is used
- WHEN the badge renders
- THEN it shows the cached II staleness with the console warning logged
- AND ranked views continue on last II values (no fail-closed hiding)

### Requirement: Sync Service — Auto-refresh

The `data-sync` service MUST fetch the latest `data/models.json` from a configurable URL (default: `https://raw.githubusercontent.com/Teksi75/sdd-data/main/data/models.json`). On success, it MUST update `sessionStorage` and the in-memory cache. On failure, it MUST fall back to the cached data and log a warning.

The fetch MUST be triggered on:

1. Page load.
2. Manual refresh button click.
3. Staleness > 7 days (forced refresh, once per session).

The 5-day AA sync cadence and ownership are unchanged. An II value lost after being finite MUST become `null` + idempotent omission note per the unchanged nullable contract, and the model MUST drop out of ranked views per D1 at the next render/sync — last-finite-value retention is rejected (D3). Sync-down MUST fail soft to cached II values + warning + cached-staleness badge (D3: no fail-closed hiding of II-ranked views).

All 8 scrapers MUST implement the availability write-guard: read-modify-write keyed by model id, merging fresh scraped fields over the stored entry while preserving `availability`. Unknown new models MUST land with `availability: {}` (fail-closed) and trip the integrity gate. The AA scraper MUST NOT touch `benchlm` values and MUST NOT write `data/providers.json`.

(Previously: identical fetch/trigger/write-guard contract with benchlm-era freshness wiring. This delta adds the II-loss dropout rule, the fail-soft-to-cache ranking rule, and the AA-scraper benchlm hands-off rule; cadence, triggers, and write-guard unchanged.)

#### Scenario: Successful fetch updates cache

- GIVEN network is available
- WHEN `dataSync.refresh()` resolves successfully
- THEN `sessionStorage["sdd-models-v1"]` is updated
- AND the freshness badge re-renders with the new timestamp

#### Scenario: Network failure falls back to cache

- GIVEN network is unavailable
- WHEN `dataSync.refresh()` rejects
- THEN the cached data is used
- AND a console warning is logged
- AND the freshness badge shows the cached staleness

#### Scenario: II lost after being finite drops out with a note

- GIVEN a model with finite II whose fresh AA payload carries no recognizable II path
- WHEN the sync merges
- THEN the entry holds `intelligenceIndex: null` with an idempotent omission note
- AND the model is absent from ranked views at the next render

#### Scenario: Sync-down keeps ranking on cached II

- GIVEN the AA sync is down with cached finite II values
- WHEN ranking renders
- THEN it continues on the cached II values with warning + cached-staleness badge
- AND no II-ranked view is hidden fail-closed

#### Scenario: Scraper dry-run preserves availability

- GIVEN a stored entry with `availability: { "opencode-go": true }`
- WHEN any scraper runs a dry-run sync over that id
- THEN the resulting entry retains the identical `availability` map
- AND only scraped benchmark/pricing fields change

### Requirement: Testing — Scoring Service

The system MUST have at least 12 unit tests for `services/model-scorer.js` covering:

- `compositeScore` reading `intelligenceIndex` (finite II returned, clamped)
- `compositeScore` with high II (clamps to 100)
- `compositeScore` with low II (clamps to 0)
- `compositeScore` with missing/non-finite II (returns `null`, never `0`)
- `compositeScore` benchlm-inert pair (models differing only in benchlm score identically)
- `compositeScore` live-exact verbatim (no rounding in store)
- `costEstimate` with default request profile
- `costEstimate` with custom request profile
- `costEstimate` with asymmetric read-only profile (5000+1000)
- `getBestFor` returns highest-II model within constraints under frozen thresholds
- `getBestFor` returns null when no model qualifies (unassigned semantics)
- `getBestFor` with `min-cost` strategy tightens cost by 50%
- `getBestFor` with `max-quality` strategy tightens reasoning by +10
- `getBestFor` for `sdd-archive` under frozen thresholds

Coverage of `model-scorer.js` MUST be ≥ 80%.

(Previously: the scorer suite was benchlm-wired with a "no benchmarks returns 0" case. This delta flips the suite to the II contract with null fail-soft and the benchlm-inert pair; coverage gate unchanged.)

#### Scenario: All scoring tests pass

- GIVEN the test suite is at full coverage
- WHEN `npm test` runs
- THEN all `model-scorer.test.js` tests pass
- AND coverage report shows ≥ 80% line coverage

#### Scenario: Scorer suite pins the II contract

- GIVEN fixtures with finite II, missing/non-finite II, and benchlm-only pairs
- WHEN the scorer suite runs
- THEN finite II asserts clamp correctly, missing/non-finite asserts are `null` (never `0`)
- AND benchlm-only pairs score identically

### Requirement: Testing — Data Integrity

The system MUST have an integrity suite asserting the full `families × providers` availability matrix (every base family has an explicit boolean for every registered provider), effort-variant inheritance (mutating a family row propagates; exact-id overrides flagged), `DATA_FILES` count 6, `CURRENT_SCHEMA_VERSION` expectations, ≥25 models, `AA_ALIAS_TARGETS`, hero-stats visible count, cli-mirror 18 rows, workflow 9 rows, and 5 config buttons with recomputed assignments. The suite MUST assert that `pricingSource` is never consulted for availability and that a scraper dry-run preserves `availability` for all 8 scrapers. The suite MUST assert that the `compositeScore` source CONTAINS `intelligenceIndex` and does NOT contain `benchlm` (explicit flip of the prior assert). Freshness/staleness suites (`freshness-badge`, `staleness-parity`) MUST pin the AA II sync source, not benchlm metadata.

(Previously: the suite asserted the scorer source does NOT contain `intelligenceIndex` with freshness pinned to benchlm metadata. This delta flips both asserts deliberately and atomically per slice.)

#### Scenario: Full availability matrix enforced

- GIVEN `data/providers.json` and `data/models.json`
- WHEN the integrity suite runs
- THEN every `(base family, provider)` cell holds an explicit boolean
- AND any missing cell fails the suite naming the cell

#### Scenario: Fixed counts updated and green

- GIVEN the V5 tree
- WHEN the suite runs
- THEN `DATA_FILES` count is 6, cli-mirror has 18 rows, workflow has 9 rows, config selector has 5 buttons
- AND hero-stats asserts the `"X de Y visibles"` counter, not a static total

#### Scenario: Scorer source pins the II contract

- GIVEN `js/services/model-scorer.js`
- WHEN the integrity suite greps the scorer source
- THEN the source contains `intelligenceIndex`
- AND the source contains no `benchlm` ordering reference

#### Scenario: Freshness suites pin the II sync

- GIVEN the freshness/staleness suites
- WHEN they run
- THEN they assert against the AA II sync timestamp
- AND no assert depends on benchlm metadata

## REMOVED Requirements

No canonical requirement is removed wholesale in this delta. The entries below record scenario-level deletions already applied in the MODIFIED blocks above (stated here explicitly per the change brief: which requirement they belonged to and why they die under AA-only).

### Requirement: Astra-first-as-data-consequence scenario (scenario removal, not a requirement removal)

(Reason: the scenario belonged to `Scoring Service — getBestFor (Hybrid Role-Aware Matching)` in the prior delta and assumed benchlm maxima over the traced 2026-09-13 benchlm backfill. Under AA-only the eligible maximum is computed over II, the reference-model identity flips to highest-II, and every `effectiveMaxCost` moves — a benchlm-maximum acceptance would assert the wrong winner.)
(Migration: replaced by the computed-maximum scenarios in MODIFIED `getBestFor` — `Empty eligible set under frozen thresholds`, `Per-role empty/fallback/unassigned expectations`, `No ranking branch may force a winner` — which assert against the live-traced II set at test time with no hardcoded winner or value. Slices S3a/S3b flip the corresponding vitest asserts atomically.)

#### Scenario: Dead scenario stays dead

- GIVEN the MODIFIED `getBestFor` requirement above
- WHEN its scenarios are inspected
- THEN no Astra-first / benchlm-maximum scenario exists
- AND acceptance compares against the computed II maximum at test time

### Requirement: intelligenceIndex-inert scenarios (scenario removal, not a requirement removal)

(Reason: the inertness scenarios belonged to three requirements — `Scoring Service — compositeScore` ("Two models differing only in intelligenceIndex score identically"), `Scoring Service — getBestFor` ("Scorer ignores intelligenceIndex"), and `AA Intelligence Index Field` ("intelligenceIndex is inert to the scorer"). They encoded the archived change's D1-A inertness rule, which this delta explicitly reverts: II is now the sole ordering input.)
(Migration: replaced by the benchlm-inert scenario in MODIFIED `compositeScore` ("Two models differing only in benchlm score identically") and the II-authority scenario in MODIFIED `AA Intelligence Index Field` ("intelligenceIndex drives the scorer"). The `data-integrity` grep assert flips in the same slices — S3a flips scorer+integrity, S3b flips surfaces+exporter+freshness; no half-benchlm/half-II state ships.)

#### Scenario: Inert-II asserts stay dead

- GIVEN the MODIFIED `compositeScore`, `getBestFor`, and `AA Intelligence Index Field` requirements above
- WHEN their scenarios are inspected
- THEN no scenario asserts II-inertness
- AND vitest asserts II authority plus benchlm inertness instead
