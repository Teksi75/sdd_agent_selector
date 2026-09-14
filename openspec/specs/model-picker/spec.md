# SDD Model Picker Specification

## Purpose

Defines the full behavior of the SDD Model Picker V4: a modular,
testable, auto-syncing refactor of the V3 monolithic HTML. The spec
covers the data layer (models, agent roles, request profiles,
strategies), the scoring service, the SDD-aware matching algorithm
(18 agents with hybrid minReasoning + costRatio constraints), the
twin judge constraint, the justification UI, sync workflow, build
pipeline, and test contract.

The system MUST cover all 18 agents in the gentle-ai SDD ecosystem
(11 SDD phases + 3 Judgment Day agents + 4 Review agents), not only
the 10 SDD agents the V3 file showed.

---

## Requirements

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

- GIVEN `sessionStorage` contains a cached `data/models.json` with
  `schemaVersion: 1`
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

---

### Requirement: Data Layer — Agent Roles (Role Matrix)

The system MUST represent agent role constraints in
`data/agent-roles.json`. The file MUST define one entry per agent
across the 18-agent SDD ecosystem (11 SDD + 3 JD + 4 Review).

Each agent entry MUST have:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `minReasoning` | number | Yes | Absolute score threshold (0-100); measures capacity, stable over time |
| `costRatio` | number | Yes | Relative to the reference model cost (0.0-1.0); scales with market |
| `role` | string | Yes | Free-form description: `orchestration`, `design`, `apply`, `archive`, etc. |

The 18 agents MUST be present:

```
SDD agents (11): gentle-orchestrator, sdd-init, sdd-explore, sdd-propose,
                 sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify,
                 sdd-archive, sdd-onboard
JD agents (3):   jd-judge-a, jd-judge-b, jd-fix-agent
Review agents (4): review-risk, review-readability, review-reliability,
                   review-resilience
```

The `costRatio` for `gentle-orchestrator` and `sdd-apply` MUST be 1.0
(ceiling). The `costRatio` for `sdd-archive` MUST be ≤ 0.05 (cheapest).
`minReasoning` for `gentle-orchestrator` MUST be ≥ 90.

#### Scenario: All 18 agents defined

- GIVEN `data/agent-roles.json` is loaded
- WHEN the role matrix is consumed by `getBestFor`
- THEN it contains exactly 18 entries
- AND all 18 are valid agents from the canonical list

#### Scenario: costRatio scales with reference model cost

- GIVEN the reference model (Opus 4.8) costs $0.048 per default request
- WHEN computing the effective max cost for `sdd-archive` (costRatio: 0.05)
- THEN the effective max is $0.0024
- AND if the reference model price drops 50%, the effective max drops to $0.0012

#### Scenario: minReasoning is absolute, not scaled

- GIVEN `sdd-orchestrator.minReasoning` is 95
- WHEN the reference model changes from Opus 4.8 to a cheaper model
- THEN the `minReasoning` for `sdd-orchestrator` remains 95
- AND only the cost constraint changes

#### Scenario: sdd-archive has the lowest cost ratio

- GIVEN all 18 agent costRatios
- WHEN sorted ascending
- THEN `sdd-archive` is at or below 0.05
- AND `sdd-archive` is the cheapest cost ratio in the matrix

---

---

### Requirement: Data Layer — Agent Request Profiles

The system MUST represent per-agent request size profiles in
`data/agent-request-profiles.json`. Each profile MUST define
`inputTokens` and `outputTokens` representing the typical request
size for that agent.

For read-only reviewers (`jd-judge-a`, `jd-judge-b`, `review-risk`,
`review-readability`, `review-reliability`, `review-resilience`), the
profile MUST be asymmetric (`inputTokens` ≥ 3× `outputTokens`) because
they read more than they write.

For executors (`sdd-apply`, `jd-fix-agent`), the profile MUST allow
substantially more input than the default (5000+ input tokens).

For summarizers (`sdd-archive`, `sdd-init`), the profile MUST be
short (≤ 1500 total tokens).

#### Scenario: Read-only reviewers have asymmetric profiles

- GIVEN `jd-judge-a` is a read-only adversarial reviewer
- WHEN `data/agent-request-profiles.json` is loaded
- THEN `jd-judge-a.inputTokens` is at least 3× `jd-judge-a.outputTokens`
- AND `jd-judge-b` has the identical profile (twin judges)

#### Scenario: sdd-archive has a short profile

- GIVEN `sdd-archive` summarizes completed changes
- WHEN its profile is loaded
- THEN `inputTokens + outputTokens` is ≤ 1500
- AND the profile is the shortest in the dataset

---

---

### Requirement: Data Layer — Phases and Configs

The system MUST represent the 9 core SDD phases in `data/phases.json`
as an array of objects with `id`, `name`, `desc`. The 11th SDD agent
(`sdd-onboard`) and the JD/Review agents are covered by the role matrix
directly, not as phases.

The system MUST represent the 5 configuration presets in
`data/configs.json`. Each config MUST have:
- `key` (string slug)
- `name` (display name)
- `description` (short text)
- `strategy` (one of: `min-cost`, `balanced`, `max-quality`, `tier-based`, `experimental`)

Configs MUST NOT contain hardcoded `assignments` — assignments are
derived at runtime by `getBestFor` from the role matrix.

The 5 strategy presets are:

| Strategy | Behavior |
|----------|----------|
| `min-cost` | Reduces all `costRatio` values by 50% (more restrictive cost) |
| `balanced` | Uses role matrix defaults as-is |
| `max-quality` | Increases all `minReasoning` values by 10 points (more restrictive reasoning) |
| `tier-based` | Filters models by `tier` per role: `high`/`reference` for orchestrator/design, `balanced` for apply/spec, `budget` for archive |
| `experimental` | Same as `max-quality` but also includes new/isNew models |

#### Scenario: Configs use strategies, not assignments

- GIVEN `data/configs.json` is loaded
- WHEN inspecting any config
- THEN the config has a `strategy` field
- AND the config does NOT contain an `assignments` object mapping phases to models

#### Scenario: 9 core SDD phases defined

- GIVEN `data/phases.json` is loaded
- WHEN the workflow table is rendered for any config
- THEN it has exactly 9 rows (init, explore, propose, spec, design, tasks, apply, verify, archive)
- AND each row shows the phase name, description, and assigned model

#### Scenario: 5 configuration presets defined

- GIVEN `data/configs.json` is loaded
- WHEN the config selector is rendered
- THEN it shows exactly 5 buttons (economico, balanceado, maximo, hibrido, experimental)
- AND each button displays the preset's name and description

---

---

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
---

---

### Requirement: Scoring Service — costEstimate

The system MUST provide a `costEstimate(model, requestProfile)` function
that estimates the cost of a single request. The `requestProfile`
parameter MUST be an object with `inputTokens` and `outputTokens`
fields. The function MUST return a number representing USD cost.

The default `requestProfile` when not provided MUST be
`{ inputTokens: 1000, outputTokens: 500 }`.

#### Scenario: GLM-5.2 default request

- GIVEN a model with `input: 1.40`, `output: 4.40`
- WHEN `costEstimate(model)` is called with default profile
- THEN it returns `0.0036` ($0.001 input + $0.0005 output × 4.40)

#### Scenario: MiMo V2.5 default request

- GIVEN a model with `input: 0.14`, `output: 0.28`
- WHEN `costEstimate(model)` is called with default profile
- THEN it returns `0.00028`

#### Scenario: Custom request profile

- GIVEN `requestProfile = { inputTokens: 5000, outputTokens: 2000 }`
- AND a model with `input: 1.40`, `output: 4.40`
- WHEN `costEstimate(model, requestProfile)` is called
- THEN it returns `0.0158` ($0.007 + $0.0088)

---

---

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

Callers MUST pre-filter the `models` argument with `applyProviderFilter`
before invoking `getBestFor`; the function signature is unchanged. Soft
fallbacks MUST resolve only within the pre-filtered eligible set.

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
---

### Requirement: Twin Judge Constraint

The system MUST enforce that `jd-judge-a` and `jd-judge-b` always
resolve to the SAME model key when a config is selected. The two
judges are blind twins: using different models would make
discrepancies between them attributable to the model, not the code.

The function `selectConfig(key)` MUST:
1. Call `getBestFor` for both `jd-judge-a` and `jd-judge-b`.
2. If the two results differ, throw an `InvalidConfigError` with
   message: `"jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)"`.
3. If the two results are the same, proceed normally.

Filtering MUST be a pre-pass: both judges MUST draw from the same eligible
set, and the invariant MUST hold under any filter state. An empty eligible
set MUST yield identical `unassigned` results for both judges, not an error.

(Previously: invariant stated without filtering; no empty-set rule.)

#### Scenario: Twin judges resolve to the same model

- GIVEN config `balanceado` is selected
- WHEN `selectConfig('balanceado')` is called
- THEN `getBestFor('jd-judge-a', ...)` and `getBestFor('jd-judge-b', ...)` return the same key
- AND the function does not throw
- AND the workflow table shows the same model assigned to both judges

#### Scenario: Twin judges would resolve to different models

- GIVEN the data is manipulated so the only models that satisfy
  `jd-judge-a.minReasoning` and `jd-judge-b.minReasoning` differ
- WHEN `selectConfig(...)` is called
- THEN it throws `InvalidConfigError`
- AND the error message is the exact string `"jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)"`
- AND no UI state is mutated

#### Scenario: Twin judges stay identical under filtering

- GIVEN any non-empty eligible set E
- WHEN `selectConfig(anyValidKey)` runs over E
- THEN both judges resolve to the same key in E (or both `unassigned` if E
  yields nothing)
- AND the existing twin test rerun on a filtered fixture passes

---

### Requirement: Configuration Management — selectConfig

The system MUST provide a `selectConfig(key)` function that:
1. Validates the config exists in `data/configs.json`.
2. Calls `getBestFor` for all 18 agents using the config's `strategy`.
3. Validates the twin judge constraint (see Twin Judge Constraint requirement).
4. Updates the active config state.
5. Updates the DOM to mark the selected config button as active.
6. Triggers re-render of the workflow table (for the 9 core SDD phases).
7. Triggers re-render of the justification UI (for all 18 agents).

The function MUST be idempotent: calling it twice with the same
key produces the same DOM state and assignments.

If the function throws `InvalidConfigError`, the UI MUST display
the error and revert to the previously active config (or the empty
state if none).

The function MUST recompute assignments on every filter-change event; the
config selector MUST still render exactly 5 buttons (economico, balanceado,
maximo, hibrido, experimental) — button count is unchanged, only assignments
recompute.

(Previously: no filter-change recompute rule.)

#### Scenario: Selecting a config updates UI

- GIVEN no config is currently selected
- WHEN `selectConfig("balanceado")` is called
- THEN the `balanceado` button has the `.active` CSS class
- AND the workflow table is re-rendered with `balanceado` assignments
- AND the justification UI is re-rendered for all 18 agents

#### Scenario: Switching configs replaces assignments

- GIVEN `balanceado` is currently selected
- WHEN `selectConfig("economico")` is called
- THEN the `balanceado` button loses `.active`
- AND the `economico` button gains `.active`
- AND the workflow table now shows economico's assignments (likely cheaper)
- AND the justification UI updates all 18 agents

#### Scenario: Idempotent selection

- GIVEN `economico` is already selected
- WHEN `selectConfig("economico")` is called again
- THEN the DOM state is unchanged
- AND no error is raised
- AND no unnecessary re-renders occur

#### Scenario: Invalid config throws

- GIVEN config `invalid` does not exist in `data/configs.json`
- WHEN `selectConfig("invalid")` is called
- THEN it throws `InvalidConfigError`
- AND the previously active config (if any) remains selected
- AND the UI shows the error message

#### Scenario: Filter change recomputes assignments

- GIVEN `balanceado` is active with provider P enabled
- WHEN the user disables P
- THEN `selectConfig("balanceado")` semantics re-run over the new eligible
  set
- AND all 5 buttons remain visible with `balanceado` still `.active`

---

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

- GIVEN `gentle-orchestrator` has no eligible model (no model scores ≥ 95)
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
---

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
---

### Requirement: UI Component — Workflow Table

The `workflow-table` component MUST render a table with one row per
core SDD phase (9 total), showing the phase name, description, and
assigned model. The model cell MUST include the model name and a
color-coded tag (`optimal` / `balanced` / `max`) based on the model's tier.

The function signature MUST be
`render(targetEl, assignments, models, phases)`.

The `assignments` argument is the result of `getBestFor` over the eligible
set for the 9 core SDD phases (`sdd-init` through `sdd-archive`). A phase
with no eligible assignment MUST show a warning indicator (empty-state
`unassigned` semantics); the table MUST still render 9 rows.

(Previously: assignments drawn from the full catalog.)

#### Scenario: Workflow table shows 9 phases

- GIVEN a config with 9 phase assignments
- WHEN `workflowTable.render(targetEl, assignments, models, phases)` is called
- THEN the table has 9 rows
- AND each row shows the phase, description, and assigned model

#### Scenario: Model tier determines tag color

- GIVEN a model with `tier: "high"`
- WHEN the workflow table renders
- THEN the assigned model cell shows a `max` tag (amber)

#### Scenario: Phase with no assignment shows warning

- GIVEN a config has no eligible model for `sdd-onboard`
- WHEN the workflow table renders
- THEN the `sdd-onboard` row shows a warning indicator
- AND the rest of the table continues normally

---

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

---

### Requirement: UI Component — Pricing Chart

The `pricing-chart` component MUST render a horizontal bar chart
of `costEstimate(model)` for all eligible non-reference models. The chart
MUST sort bars by cost ascending (cheapest first). Each bar MUST
show the cost value formatted as USD and the model name, plus the vendor per-1M input/output rates as a subtitle (omitted when the model has neither rate). Ineligible models
MUST NOT appear. An empty eligible set MUST render an empty chart with the
empty-state label.

The function signature MUST be `render(targetEl, models)`.

(Previously: chart covered all non-reference models.)

#### Scenario: Cheapest model appears first

- GIVEN multiple models with varying costs
- WHEN the chart renders
- THEN the top bar is the cheapest model
- AND the bottom bar is the most expensive non-reference model

#### Scenario: Cost formatted as currency

- GIVEN a model with `costEstimate` of `0.00028`
- WHEN the chart renders
- THEN the bar label shows `$0.00028` (4 decimal places)

#### Scenario: Ineligible models excluded; empty set labelled

- GIVEN the eligible set excludes the cheapest catalog model
- WHEN the chart renders
- THEN the top bar is the cheapest eligible model
- AND with zero eligible models the chart shows the empty-state label

---

### Requirement: UI Component — Task Cost Table

The `task-cost-table` component MUST render one row per agent with the
cost of its assigned model computed with the agent’s own request profile
(`data/agent-request-profiles.json`) via `costEstimate(model, profile)`.
Each row MUST show the agent key, the profile as `inputTokens/outputTokens`,
the assigned model name, and the cost formatted as USD. Agents without an
eligible assignment MUST render the `Sin modelo elegible` warning and
contribute 0. Agents without a profile MUST fall back to the default
request profile (1000/500). The table MUST show the workflow total (sum
over assigned agents) in the footer. Rows MUST follow the canonical
18-agent order. An empty role matrix MUST render the empty-state label.

The function signature MUST be `render(targetEl, assignments, agentRoles, profiles)`.

#### Scenario: Per-agent cost uses the agent profile

- GIVEN `sdd-apply` (profile 6000/3500) assigned to a model with `input: 1.40`, `output: 4.40`
- WHEN the table renders
- THEN the `sdd-apply` row shows profile `6000/3500` and cost `$0.0238`

#### Scenario: Workflow total sums assigned agents

- GIVEN two assigned agents costing `$0.0238` and `$0.000266` plus one unassigned agent
- WHEN the table renders
- THEN the footer shows `$0.024066`

#### Scenario: Unassigned agents warn and add nothing

- GIVEN an agent with `{ key: null }`
- WHEN the table renders
- THEN its row shows `Sin modelo elegible` with no cost
- AND the workflow total excludes it

---
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
---

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

---

---

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

---

### Requirement: Build & Distribution

The system MUST be built with esbuild. The build command MUST
produce a single self-contained `dist/index.html` file with all
CSS and JS inlined. The build MUST:
- Bundle all JS modules into one file.
- Inline CSS (Tailwind output + custom CSS).
- Minify output.
- NOT use any CDN dependencies at runtime.

`npm run build` MUST complete in under 30 seconds.

#### Scenario: Build produces single HTML file

- GIVEN the project source is at the current state
- WHEN `npm run build` runs
- THEN `dist/index.html` exists
- AND it is a single file with no external `<script>` or `<link>` tags
      pointing to CDNs

---

---

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

---

---

### Requirement: Testing — Twin Judge Constraint

The system MUST have a unit test verifying that `selectConfig`
rejects any config where `jd-judge-a` and `jd-judge-b` resolve to
different models. The test MUST use a manipulated dataset (mock
models with different score ranges) to force the divergence.

#### Scenario: Twin judge constraint enforced

- GIVEN a test dataset where `jd-judge-a` resolves to model X
  AND `jd-judge-b` resolves to model Y (X ≠ Y)
- WHEN `selectConfig(anyValidKey)` is called
- THEN it throws `InvalidConfigError`
- AND the error message matches the exact string

---

---

### Requirement: Testing — Role Matrix Completeness

The system MUST have a test verifying that `data/agent-roles.json`
contains all 18 agents from the canonical list. The test MUST
fail if any agent is missing, renamed, or has invalid field types.

#### Scenario: All 18 agents present in role matrix

- GIVEN `data/agent-roles.json` is loaded
- WHEN the completeness test runs
- THEN the keys of the loaded object match exactly the canonical
      18-agent list (case-sensitive)

---

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
- THEN `DATA_FILES` count is 6, cli-mirror has 18 rows, workflow has 9 rows,
  config selector has 5 buttons
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

---

### Requirement: Provider Registry — `data/providers.json`

The system MUST provide a closed, manually-owned provider registry at
`data/providers.json`. Each provider record MUST have exactly the shape
`{ id, name, tier, url, updated }` where `id` is the stable closed key
consumed by UI, tests and the integrity gate, `name` is the display label,
`tier` is the subscription tier label, `url` is the `sourceOfTruth` URL, and
`updated` is the last manual curation date (ISO). The file MUST include a
`_meta` block with `schemaVersion`. A provider ships in the registry ONLY with
a recorded `sourceOfTruth` URL (`url`); any cell that cannot be confirmed from
that source is curated `false` with a `TODO(source)` note. The registry is
manual: scrapers MUST NOT write to `data/providers.json`. Adding a provider
MUST require only one registry record plus one availability column — no code
change.

#### Scenario: Registry covers all detected providers with closed id set

- GIVEN the current catalog's detected providers (at minimum Opencode Go,
  ChatGPT Plus, MiniMax plus every other detected provider)
- WHEN `data/providers.json` is loaded
- THEN every detected provider has one record with `id`, `name`, `tier`,
  `url`, `updated`
- AND `_meta.schemaVersion` is present
- AND the `id` set is the closed set consumed by the selector, filter and
  integrity gate

#### Scenario: Scrapers are prohibited from writing the registry

- GIVEN any of the 8 sequential scrapers runs (5-day `sync-benchmarks.yml`
  cadence)
- WHEN the scraper completes a read-modify-write cycle
- THEN `data/providers.json` is byte-identical before and after the run
- AND no scraper creates, renames or deletes a provider `id`

#### Scenario: `pricingSource` is not a provider signal

- GIVEN a model with `pricingSource: "artificialanalysis"` or absent
- WHEN availability is resolved
- THEN the value of `pricingSource` MUST NOT influence eligibility
- AND only the explicit `availability` map decides

---

### Requirement: Family Availability with Inheritance

Every entry in `data/models.json` MUST carry an explicit `availability` map of
the form `{ "<provider-id>": boolean }` covering every registered provider id.
Humans MUST curate only the ~25 base families; effort variants (`Xhigh` /
`High` / `Medium` / `Low` / `NonReasoning`) MUST inherit the base-family map
mechanically via the deterministic rule: family key = entry id minus the
effort suffix. An exact-id override WINS over inheritance but MUST be flagged
for review. Missing key or unknown model MUST be treated as unavailable
(fail-closed). A build-time integrity gate MUST fail the build if any base
family lacks an explicit boolean for any registered provider, so absence can
never reach prod quietly.

#### Scenario: Effort variants inherit the base-family map

- GIVEN base family `foo` has `availability: { "opencode-go": true,
  "chatgpt-plus": false }`
- WHEN entries `foo-Xhigh`, `foo-High`, `foo-Medium`, `foo-Low`,
  `foo-NonReasoning` are loaded
- THEN each variant resolves the identical map unless it carries an explicit
  exact-id override

#### Scenario: Exact-id override wins and is flagged

- GIVEN variant `foo-High` carries its own explicit `availability` differing
  from family `foo`
- WHEN the propagation check runs
- THEN `foo-High` resolves its own map
- AND the override is reported for human review

#### Scenario: Incomplete matrix fails the build

- GIVEN one base family lacks a boolean for one registered provider
- WHEN the integrity gate runs
- THEN the build fails loud
- AND names the missing `(family, provider)` cell

---

### Requirement: Hard Provider Filter — `applyProviderFilter`

The system MUST provide a pure function
`applyProviderFilter(models, availability, enabledSet)` applied as a
pre-pass BEFORE `getBestFor`, charts, tables, counts and export. Hidden
providers MUST disappear from `ref-table`, `composite-chart`,
`pricing-chart`, workflow / cli-mirror / justification (via assignments),
`config-selector` recompute and hero-stats visible count. Hidden means removed
from DOM/data, NOT dimmed. The `enabledSet` derives from the selector state;
fallbacks resolve ONLY within the eligible set. The system MUST NEVER fall
back silently to the unfiltered catalog.

#### Scenario: Missing availability key is fail-closed

- GIVEN a model lacks an `availability` key for an enabled provider (or is an
  unknown new model with `availability: {}`)
- WHEN `applyProviderFilter` runs
- THEN that model is excluded from the eligible set
- AND the integrity gate reports the gap

#### Scenario: Filter is a pre-pass over scoring

- GIVEN an eligible set E smaller than the full catalog
- WHEN any caller invokes `getBestFor`
- THEN the candidate list passed to `getBestFor` is exactly E
- AND `getBestFor`'s signature is unchanged

#### Scenario: Fallbacks stay within the eligible set

- GIVEN the top eligible model is excluded by role constraints
- WHEN soft fallbacks resolve
- THEN every fallback candidate is drawn from the eligible set
- AND no ineligible model is ever returned, even if it scores higher

---

### Requirement: Subscription Selector UI — Tier-1 Sticky

The system MUST render a Tier-1 sticky selector component in `index.html`
(mount point, always visible) with one multi-checkbox control per registry
provider, plus "all / none" shortcuts. Toggling a provider MUST hide (not
attenuate) its exclusive models across every surface listed in the Hard
Provider Filter requirement. The component MUST emit filter-change events that
trigger `config-selector` recompute and re-render of tables, charts,
assignments, justification, hero-stats and exporter input. The exporter input
MUST be the filtered view.

#### Scenario: Toggling hides models everywhere

- GIVEN all providers enabled and model M is exclusive to provider P
- WHEN the user unchecks P
- THEN M disappears from `ref-table`, `composite-chart`, `pricing-chart`,
  workflow / cli-mirror / justification assignments and hero-stats count
- AND no dimmed placeholder of M remains in the DOM

#### Scenario: Selector renders one control per registry provider

- GIVEN `data/providers.json` holds N providers
- WHEN the selector mounts
- THEN it renders exactly N checkbox controls
- AND "all / none" shortcuts set all N on / off respectively

---

### Requirement: Provider Preference Persistence

The system MUST persist the selector state in versioned `localStorage` under
key `sdd-providers-v1` with shape
`{ version: 1, enabled: { "<provider-id>": true } }`, separate from the
`data-loader.js` sessionStorage `CACHE_KEY sdd-models-v6`. Default MUST be all
enabled (current unfiltered behavior preserved until the user opts in).
Version mismatch or unknown ids MUST reset to all-enabled and rewrite the key
(unknown ids are discarded). When `localStorage` is unavailable
(private mode), the system MUST fall back to in-memory state: the filter works
for the session, nothing persists.

#### Scenario: Reload restores selection

- GIVEN the user disables provider P and `sdd-providers-v1` stores
  `{ version: 1, enabled: { ... P: false ... } }`
- WHEN the page reloads
- THEN P remains disabled
- AND the visible set matches the pre-reload eligible set

#### Scenario: Version mismatch or unknown ids reset to all-enabled

- GIVEN stored `{ version: 0, enabled: {...} }` or stored ids not in the
  registry
- WHEN the selector initialises
- THEN the state resets to all registry ids enabled
- AND the key is rewritten with `version: 1` containing only known ids

---

### Requirement: Empty Eligible State

When the eligible set is empty, the system MUST render an explicit empty state:
a message plus model count 0 plus an "enable all providers" action
(`enable-all` / clear-filter CTA). Assignments MUST show `unassigned`, charts
MUST render empty with a label — never stale prior results. The system MUST
NEVER silently revert to the unfiltered catalog.

#### Scenario: All deselected shows empty state with CTA

- GIVEN the user unchecks every provider
- WHEN the filter recomputes
- THEN tables show zero rows with the empty-state message
- AND charts render empty with the empty label
- AND every assignment reads `unassigned`
- AND an "enable all providers" CTA is visible
- AND clicking it restores all-enabled

#### Scenario: No silent unfiltered fallback

- GIVEN the eligible set is empty
- WHEN any surface renders or `getBestFor` is invoked
- THEN no ineligible model appears anywhere
- AND no cached pre-filter result leaks through

---

### Requirement: Filtered Export

The exporter MUST export the filtered view by default with a header line stating active providers + timestamp. An explicit opt-in flag MUST produce the full-catalog export instead. Rationale: export must reproduce what the user saw. Ranked export bodies MUST contain II-ranked rows only (finite II, eligible set); score lines MUST show the AA Intelligence Index. The ranked-export header MUST carry the shared hidden-rows note (`"{N} models hidden — no Artificial Analysis Intelligence Index on {date}"`) iff N > 0, so a pasted export is self-explaining; there MUST be no unranked appendix. The export body and any `agentsMarkdown` per-model line MUST NOT include tier (no `Tier` column, no `(tier · score · costo)` fragment); score and cost MAY remain. The header providers+timestamp line and the full-catalog flag semantics MUST be preserved.

(Previously: score lines read benchlm and II-less rows could appear with `—`; this delta swaps scores to II, hides II-less rows with the shared header note, and adds the no-appendix rule. Tier ban, header, and flag semantics unchanged.)

#### Scenario: Default export matches the visible view

- GIVEN providers P enabled and Q disabled
- WHEN the user exports without flags
- THEN the file contains only models eligible under P
- AND the first header line names the active providers and the export
  timestamp

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
---

### Requirement: Hero Stats Visible Count

The hero-stats component MUST replace the static "24 activos" count with a
live `"X de Y visibles"` counter where X is the eligible-model count and Y is
the total catalog count under the current filter state.

#### Scenario: Counter tracks the filter

- GIVEN a catalog of Y models with X eligible under the current selection
- WHEN hero-stats renders
- THEN it displays `"X de Y visibles"`
- AND toggling any provider updates X immediately

---

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

---

### Requirement: AA Chart Backfill 2026-09-13 with sources[]

The system MUST backfill the catalog from the live AA v2 payload dated 2026-09-13 (fetched 2026-09-13T01:11:12.045Z; exact values stored — GPT-6 Astra (max) 52.8, Muse 1.3 (max) 48.2, Claude Opus 5 (max effort) 50.7; the public chart renders the rounded 53/48/51), plus every other chart row with a legible screenshot/payload value. Each backfilled number MUST carry its own `sources[]` entry of shape `{ url: https://artificialanalysis.ai/, date: 2026-09-13 (or real payload date), scraper: scrape-artificialanalysis }`. No AA number (Intelligence Index / `benchlm` / coding / math) SHALL enter without screenshot AA 2026-09-13 or live AA v2 payload. The Astra-primera criterion MUST be evaluated via traced `benchlm.score` backfill consumed by the unchanged `compositeScore` ordering: the acceptance test asserts the real maximum of the eligible set at test time (never a hardcoded value), no candidate's score may be lowered without its own AA evidence, and the scorer formula MUST NOT change in this slice. For Muse Spark 1.3: the system MUST either create a new `max` entry (48.2, AA-traced, fail-closed) preserving `musespark13contributor` xhigh non-AA intact, or re-attribute with an explicit note; effort MUST NEVER change by inference. Chart models without evidence or without a curated `aa-aliases.json` slug (explicit effort) MUST stay out of the catalog and be listed in omission notes; `mapAaSlug` MUST ignore uncurated slugs and `detectMissing` MUST WARN+preserve.

#### Scenario: Astra backfill is traced and drives chatgpt-plus ranking

- GIVEN `data/models.json` with the backfill applied
- WHEN inspecting the Astra entry
- THEN `benchlm.score` is the exact live-payload value `52.8` (the public chart displays the rounded `53`) with a `sources[]` entry `{ url: https://artificialanalysis.ai/, date: 2026-09-13, scraper: scrape-artificialanalysis }`
- AND no backfilled number in the file lacks its own `sources[]` entry

#### Scenario: Spark max does not corrupt contributor xhigh by inference

- GIVEN the catalog before backfill has `musespark13contributor` with effort `xhigh` and no AA trace
- WHEN the Spark 48.2 backfill lands
- THEN either a distinct max entry exists with `48.2` + AA `sources[]`, with the contributor entry unchanged — OR the contributor entry carries effort `max` plus an explicit re-attribution note with AA `sources[]`
- AND in neither case does effort change without an AA source

#### Scenario: Uncurated slugs never enter the catalog

- GIVEN an AA slug with no entry in `data/aa-aliases.json`
- WHEN `mapAaSlug` + merge run
- THEN no new catalog entry is created for that slug
- AND `detectMissing` emits WARN and preserves existing data

---

### Requirement: New Chart Models Fail-Closed with Green Matrix

Every model entry created by this backfill (Qwen3.8 variants, K2 Horizon, Inkling, Nemotron 3 Ultra, Gemini 3.8 Flash, DeepSeek 0813/V4.1 reconciliations, MiniMax-M3 verification, or any other chart newcomer) MUST land with `availability: {}` or explicit `false` for every registered provider lacking `sourceOfTruth` evidence, inherited or overridden per the Family Availability rule (exact-id overrides flagged). The integrity gate (`availability-matrix`, `propagate-provider-availability`) MUST be green: full `families × providers` boolean matrix, `DATA_FILES` count intact, cli-mirror 18 rows, workflow 9 rows, 5 config buttons, hero-stats `"X de Y visibles"`. DeepSeek `deepseekv4f*/v4p*` MUST be reconciled against AA slugs (rename-as-alias vs. distinct-variant) without silent duplication; `minimaxm3` MUST be verified as same-or-distinct before any creation.

#### Scenario: Unknown newcomer is invisible until curated

- GIVEN a newly created chart entry with `availability: {}` and provider `chatgpt-plus` enabled
- WHEN `applyProviderFilter` runs
- THEN that entry is excluded from the eligible set
- AND the integrity gate names the gap instead of passing quietly

#### Scenario: Matrix gate stays green after backfill

- GIVEN the backfilled `data/models.json` + `data/providers.json`
- WHEN the vitest integrity suite runs
- THEN every `(base family, provider)` cell holds an explicit boolean
- AND cli-mirror renders 18 rows, workflow 9 rows, config selector 5 buttons
- AND hero-stats shows `"X de Y visibles"`

---

### Requirement: UI Component — Model Card (effort-only)

The `model-card` component MUST display at most one reasoning tag: the effort badge (`data-effort`, closed vocabulary `max | xhigh | high | medium | low | non-reasoning`). It MUST NOT render any tier badge (`.model-tier-tag`, `data-tier`), any soft badge (`~` prefix), or any tier-derived color/label. There is no canonical model-card requirement to modify; this is a new display contract for this surface.

#### Scenario: Model card shows effort and nothing else

- GIVEN a model with `effort: "max"` and `tier: "high"`
- WHEN `model-card` renders
- THEN the DOM contains `[data-effort="max"]`
- AND the DOM contains no `[data-tier]`, no `.model-tier-tag`, no `~` soft marker

#### Scenario: Effort vocabulary is closed

- GIVEN any catalog model
- WHEN `model-card` renders its effort badge
- THEN the `data-effort` value is one of `max | xhigh | high | medium | low | non-reasoning`
- AND a model without curated effort renders no effort badge rather than an invented label

---

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

---

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

---

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

---

## REMOVED Requirements

No canonical requirement is removed wholesale in this delta. The entries below record scenario-level deletions applied in the MODIFIED blocks above (which requirement they belonged to and why they die under AA-only).

### Requirement: Astra-first-as-data-consequence scenario (scenario removal, not a requirement removal)

(Reason: the scenario belonged to `Scoring Service — getBestFor (Hybrid Role-Aware Matching)` in the prior delta and assumed benchlm maxima over the traced 2026-09-13 benchlm backfill. Under AA-only the eligible maximum is computed over II, the reference-model identity flips to highest-II, and every `effectiveMaxCost` moves — a benchlm-maximum acceptance would assert the wrong winner.)
(Migration: replaced by the computed-maximum scenarios in MODIFIED `getBestFor` — `Empty eligible set under frozen thresholds`, `Per-role empty/fallback/unassigned expectations`, `No ranking branch may force a winner` — which assert against the live-traced II set at test time with no hardcoded winner or value. Slices S3a/S3b flip the corresponding vitest asserts atomically.)

#### Scenario: Dead scenario stays dead

- GIVEN the MODIFIED `getBestFor` requirement above
- WHEN its scenarios are inspected
- THEN no Astra-first / benchlm-maximum scenario exists
- AND acceptance compares against the computed II maximum at test time

---

### Requirement: intelligenceIndex-inert scenarios (scenario removal, not a requirement removal)

(Reason: the inertness scenarios belonged to three requirements — `Scoring Service — compositeScore` ("Two models differing only in intelligenceIndex score identically"), `Scoring Service — getBestFor` ("Scorer ignores intelligenceIndex"), and `AA Intelligence Index Field` ("intelligenceIndex is inert to the scorer"). They encoded the archived change's D1-A inertness rule, which this delta explicitly reverts: II is now the sole ordering input.)
(Migration: replaced by the benchlm-inert scenario in MODIFIED `compositeScore` ("Two models differing only in benchlm score identically") and the II-authority scenario in MODIFIED `AA Intelligence Index Field` ("intelligenceIndex drives the scorer"). The `data-integrity` grep assert flips in the same slices — S3a flips scorer+integrity, S3b flips surfaces+exporter+freshness; no half-benchlm/half-II state ships.)

#### Scenario: Inert-II asserts stay dead

- GIVEN the MODIFIED `compositeScore`, `getBestFor`, and `AA Intelligence Index Field` requirements above
- WHEN their scenarios are inspected
- THEN no scenario asserts II-inertness
- AND vitest asserts II authority plus benchlm inertness instead
