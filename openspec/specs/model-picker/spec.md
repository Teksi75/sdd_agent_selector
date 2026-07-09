# SDD Model Picker Specification

## Purpose

Defines the full behavior of the SDD Model Picker V4: a modular,
testable, auto-syncing refactor of the V3 monolithic HTML. The spec
covers the data layer (models, agent roles, request profiles,
strategies), the scoring service, the SDD-aware matching algorithm
(18 agents with hybrid minReasoning + costRatio constraints), the
twin judge constraint, the justification UI, sync workflow, build
pipeline, and test contract.

The V4 MUST produce visually identical output to V3 for the same
input data, while making the data layer, scoring logic, agent role
matrix, and sync workflow first-class concerns.

The system MUST cover all 18 agents in the gentle-ai SDD ecosystem
(11 SDD phases + 3 Judgment Day agents + 4 Review agents), not only
the 10 SDD agents the V3 file showed.

---

## Requirements

### Requirement: Data Layer — Models

The system MUST represent LLM model data as a JSON object with one
key per model. Each model MUST have the following fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Display name |
| `arena` | number \| null | No | LMSYS Arena ELO score; null if unknown |
| `swePro` | number \| null | No | SWE-Bench Pro score |
| `sweVer` | number \| null | No | SWE-Bench Verified score |
| `term` | number \| null | No | Terminal-Bench score |
| `input` | number | Yes | Input price $/1M tokens |
| `output` | number | Yes | Output price $/1M tokens |
| `cacheRead` | number | No | Cached read price $/1M tokens |
| `tier` | enum | Yes | `high` \| `balanced` \| `budget` \| `reference` |
| `isNew` | boolean | No | Marks a new addition |
| `isReference` | boolean | No | If true, excluded from pricing/charts |
| `notes` | string | No | Free-form annotation |
| `sources` | array | No | `[{url, date}]` references |

A `_meta` block at the top level MUST include:
`lastSynced` (ISO date), `source` (string), `nextSync` (ISO date),
`schemaVersion` (integer).

#### Scenario: All V3 models present in V4 data file

- GIVEN the V3 HTML defines a `MODELS` constant with N entries
- WHEN `data/models.json` is loaded
- THEN it contains exactly N model entries
- AND each model has at minimum the required fields above

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

### Requirement: Scoring Service — compositeScore

The system MUST provide a `compositeScore(model)` function that
returns a numeric score in the range [0, 100]. The score MUST be
computed as a weighted sum of available benchmark values, with
weights: Arena ELO 30%, SWE-Bench Pro 30%, Terminal-Bench 20%,
SWE-Bench Verified 20%.

SWE-Bench Verified is the de-facto standard benchmark for code
generation in the current ecosystem (2026), and many models publish
only that number when SWE-Bench Pro is not yet independently verified
(Kimi K2.7, Claude Mythos 5, and others). Excluding it from the
scoring made those models invisible in the ranking despite strong
code-generation capability.

If a benchmark is missing (`null` or `undefined`), its weight MUST
be redistributed proportionally among the available benchmarks.
If all benchmarks are missing, the function MUST return `0`.

The function MUST be pure (no side effects, deterministic for
same input).

#### Scenario: GLM-5.2 with all four benchmarks

- GIVEN a model with `arena: 1595`, `swePro: 62.1`, `term: 81.0`, `sweVer: 77.8`
- WHEN `compositeScore(model)` is called
- THEN it returns a value close to 79.4 (±0.1)

#### Scenario: Model with only Arena ELO

- GIVEN a model with `arena: 1435`, `swePro: null`, `term: null`, `sweVer: null`
- WHEN `compositeScore(model)` is called
- THEN it returns the normalized Arena score
- AND the result is non-zero

#### Scenario: All benchmarks missing

- GIVEN a model with `arena: null`, `swePro: null`, `term: null`, `sweVer: null`
- WHEN `compositeScore(model)` is called
- THEN it returns `0`

#### Scenario: Multi-benchmark model outranks single-benchmark model with similar data quality

- GIVEN a model A with only `arena: 1515` and `sweVer: 80.2` (2 benchmarks)
- AND a model B with `arena: 1510`, `swePro: 58.6`, `term: 67`, `sweVer: 89` (all 4 benchmarks)
- WHEN `compositeScore` is called for both
- THEN the absolute difference between the two scores is at most 5 points
- (i.e. a well-rounded model with strong multi-dimensional evidence is not
   systematically penalized below a model with one strong single-dimension
   score)

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
3. Compute `effectiveMaxCost = costRatio × costEstimate(referenceModel, agentProfile)` where `referenceModel` is the model with `tier: "reference"` (or the highest-scoring model if no reference exists).
4. Filter models to: not reference tier, `compositeScore ≥ minReasoning`, `costEstimate(model, agentProfile) ≤ effectiveMaxCost`.
5. If no model qualifies, return `{ key: null, reason: "..." }`.
6. Otherwise, return the highest-scoring eligible model.

The function MUST return an object: `{ key, model, score, cost, effectiveMaxCost, alternatives, reason }` where `alternatives` is the top 3 other eligible models for justification UI.

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

---

### Requirement: Justification UI

The system MUST provide a `justification-ui` component that renders
one card per agent (18 total) showing why each agent has its
assigned model. Each card MUST display:

- Agent name
- Assigned model name + tier
- Composite score of the assigned model
- Cost per request of the assigned model
- Role description
- The two checks: `score ≥ minReasoning` and `cost ≤ effectiveMaxCost`
- Top 3 alternative eligible models (model name + score)

If an agent has no eligible model, the card MUST show a critical
warning instead of an assignment.

The function signature MUST be
`render(targetEl, agentsAssignments, roleMatrix, models)`.

#### Scenario: Justification card shows valid assignment

- GIVEN `sdd-archive` is assigned to MiMo V2.5
- WHEN the justification UI renders
- THEN the `sdd-archive` card shows: assigned = MiMo V2.5, score = 48.3, cost = $0.00028, role = archival
- AND the score check shows `48.3 ≥ 50` (satisfied, with note "justo")
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

---

### Requirement: UI Component — Reference Table (pilot)

The `ref-table` component MUST render a table with one row per
non-reference model. Columns MUST include: name, tier, arena,
swePro, sweVer, term, input price, output price, source badges.
The component MUST be a pure function: `render(targetEl, models)`.

The component MUST NOT include interactive controls. It is read-only.

#### Scenario: Reference table renders all non-reference models

- GIVEN `data/models.json` with 5 non-reference and 1 reference model
- WHEN `refTable.render(targetEl, models)` is called
- THEN the table has 5 rows
- AND the reference model does not appear

#### Scenario: Source badges reflect available benchmarks

- GIVEN a model with `arena: 1500, swePro: 60, term: null`
- WHEN the table renders
- THEN the row shows `arena` and `swe` source badges
- AND does NOT show a `term` badge

---

### Requirement: UI Component — Workflow Table

The `workflow-table` component MUST render a table with one row per
core SDD phase (9 total), showing the phase name, description, and
assigned model. The model cell MUST include the model name and a
color-coded tag (`optimal` / `balanced` / `max`) based on the model's tier.

The function signature MUST be
`render(targetEl, assignments, models, phases)`.

The `assignments` argument is the result of `getBestFor` for the
9 core SDD phases (`sdd-init` through `sdd-archive`).

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

The `composite-chart` component MUST render a horizontal bar chart
of `compositeScore` for all non-reference models. The chart MUST
sort bars by score descending. Each bar MUST show the score value
and the model name.

The function signature MUST be `render(targetEl, models)`.

#### Scenario: Reference models excluded

- GIVEN models include a reference tier
- WHEN the chart renders
- THEN the reference model does not appear in the chart

#### Scenario: Bars sorted descending

- GIVEN 5 non-reference models with varying scores
- WHEN the chart renders
- THEN the top bar is the highest score
- AND the bottom bar is the lowest score

---

### Requirement: UI Component — Pricing Chart

The `pricing-chart` component MUST render a horizontal bar chart
of `costEstimate(model)` for all non-reference models. The chart
MUST sort bars by cost ascending (cheapest first). Each bar MUST
show the cost value formatted as USD and the model name.

The function signature MUST be `render(targetEl, models)`.

#### Scenario: Cheapest model appears first

- GIVEN multiple models with varying costs
- WHEN the chart renders
- THEN the top bar is the cheapest model
- AND the bottom bar is the most expensive non-reference model

#### Scenario: Cost formatted as currency

- GIVEN a model with `costEstimate` of `0.00028`
- WHEN the chart renders
- THEN the bar label shows `$0.00028` (4 decimal places)

---

### Requirement: UI Component — CLI Mirror Table

The `cli-mirror-table` component MUST render a table showing the
18 agents (11 SDD + 3 JD + 4 Review) and their real CLI mapping.
Each row MUST include: agent key, role description, and assigned
model (from the active config).

The function signature MUST be
`render(targetEl, agentsAssignments, agentRoles)`.

#### Scenario: 18 agents shown

- GIVEN the active config assigns models to all 18 agents
- WHEN `cliMirrorTable.render(targetEl, assignments, agentRoles)` is called
- THEN the table has exactly 18 rows
- AND each row shows the agent key, role, and assigned model

---

### Requirement: UI Component — Freshness Badge

The `freshness-badge` component MUST display a textual indicator
of how stale the data is. It MUST read `_meta.lastSynced` from
`data/models.json` and produce strings like:
- "Datos del 04/07/2026 — hoy" (same day)
- "Datos del 04/07/2026 — hace 1 día" (1 day old)
- "Datos del 04/07/2026 — hace 2 días" (2+ days old)

The component MUST include a "↻ Actualizar ahora" button that
triggers `dataSync.refresh()`. The component MUST show a warning
banner when staleness > 7 days.

#### Scenario: Same day shows "hoy"

- GIVEN `lastSynced` is today's date
- WHEN the badge renders
- THEN the text includes "hoy"

#### Scenario: >7 days old shows warning banner

- GIVEN `lastSynced` is 8 days before today
- WHEN the badge renders
- THEN a warning banner is visible: "Los benchmarks tienen más de
      7 días. Verificá manualmente."

---

### Requirement: Sync Service — Auto-refresh

The `data-sync` service MUST fetch the latest `data/models.json`
from a configurable URL (default: `https://raw.githubusercontent.com/Teksi75/sdd-data/main/data/models.json`).
On success, it MUST update `sessionStorage` and the in-memory cache.
On failure, it MUST fall back to the cached data and log a warning.

The fetch MUST be triggered on:
1. Page load.
2. Manual refresh button click.
3. Staleness > 7 days (forced refresh, once per session).

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

### Requirement: Testing — Scoring Service

The system MUST have at least 12 unit tests for `services/model-scorer.js`
covering:
- `compositeScore` with all benchmarks
- `compositeScore` with only one benchmark
- `compositeScore` with no benchmarks (returns 0)
- `compositeScore` produces same value as V3 reference (regression)
- `costEstimate` with default request profile
- `costEstimate` with custom request profile
- `costEstimate` with asymmetric read-only profile (5000+1000)
- `getBestFor` returns highest-scoring model within constraints
- `getBestFor` returns null when no model qualifies
- `getBestFor` with `min-cost` strategy tightens cost by 50%
- `getBestFor` with `max-quality` strategy tightens reasoning by +10
- `getBestFor` for `sdd-archive` returns the cheapest model with score ≥ 50

Coverage of `model-scorer.js` MUST be ≥ 80%.

#### Scenario: All scoring tests pass

- GIVEN the test suite is at full coverage
- WHEN `npm test` runs
- THEN all `model-scorer.test.js` tests pass
- AND coverage report shows ≥ 80% line coverage

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

The system MUST have a checksum test that compares the model count
and key fields (`name`, `arena`, `input`, `output`, `tier`) of
`data/models.json` against the V3 `MODELS` constant in
`v3-monolith-backup.html`. The test MUST fail if any field
mismatches.

#### Scenario: Models data matches V3 source

- GIVEN `v3-monolith-backup.html` exists with V3 `MODELS` constant
- WHEN the data integrity test runs
- THEN it parses V3 `MODELS` and `data/models.json`
- AND asserts equal model count
- AND asserts equal key fields per model
