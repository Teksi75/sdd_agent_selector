# Delta for Model Picker — 2026-09-13-aa-intelligence-refresh

Source: `openspec/changes/2026-09-13-aa-intelligence-refresh/proposal.md` (decisions D1–D4, NO reabrir).
Canonical: `openspec/specs/model-picker/spec.md` (30 requirements).
Scope note: `tier` data field and `tier-based` strategy logic are preserved (non-goal); this delta removes only tier/soft **display**. `intelligenceIndex` is inert to the scorer in this slice (proposal D1-A). Astra-primera is evaluated as a data consequence of the traced `benchlm` backfill over the complete post-backfill catalog — the acceptance test asserts the real eligible maximum, never a ranking-code change (proposal D2-B). Slice PR-A/PR-B is a delivery plan, not a spec requirement.

## ADDED Requirements

### Requirement: AA Intelligence Index Field

The system MUST support an AA-owned model field `intelligenceIndex` of type `number | null` (`null` when unknown). The scraper (`scripts/scrape-artificialanalysis.js` `FIELD_MAP` + `buildAaPatch`) MUST map the live AA v2 payload Intelligence Index path into `intelligenceIndex`. The merge MUST be read-modify-write preserving curated `availability` (never clobber; scrapers MUST NOT write `data/providers.json` nor consult `pricingSource` for availability). The field MUST be inert to `compositeScore`/`getBestFor` in this change. The fixture `tests/fixtures/aa-sample.json` MUST be extended with the real field and covered by `tests/scrape-artificialanalysis.test.js`.

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

#### Scenario: intelligenceIndex is inert to the scorer

- GIVEN two models identical except for `intelligenceIndex`
- WHEN `compositeScore` is called for both
- THEN both scores are equal
- AND `getBestFor` ordering over the pair is unchanged by the field

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

### Requirement: Model Card Effort-Only (no canonical predecessor)

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

## MODIFIED Requirements

### Requirement: Scoring Service — compositeScore

The system MUST provide a `compositeScore(model)` function whose only score input is `model.benchlm.score`. A finite score MUST be returned clamped to `[0, 100]` (values below `0` clamp to `0`, values above `100` clamp to `100`). A missing model, a missing `benchlm` block, or an absent/non-finite score MUST return `null` — never `0` and never a synthesized replacement. The function MUST be pure (no side effects, deterministic for the same input). `arena`, `swePro`, `sweVer`, `term`, and `intelligenceIndex` MUST be inert: none of them may influence the returned score or any ordering derived from it.

(Previously: the canonical weighted sum — Arena ELO 30% + SWE-Bench Pro 30% + Terminal-Bench 20% + SWE-Bench Verified 20%, with missing weights redistributed proportionally and `0` returned when all benchmarks were missing. That formula is declared obsolete: the executable authority is the BenchLM clamp contract above. This delta changes no production code — `js/services/model-scorer.js` already implements the clamp contract and remains untouched in both slices.)

#### Scenario: BenchLM score is returned directly

- GIVEN a model with `benchlm.score: 53`
- WHEN `compositeScore(model)` is called
- THEN it returns `53`

#### Scenario: High values clamp to 100

- GIVEN a model with `benchlm.score: 124.5`
- WHEN `compositeScore(model)` is called
- THEN it returns `100`

#### Scenario: Low values clamp to 0

- GIVEN a model with `benchlm.score: -3`
- WHEN `compositeScore(model)` is called
- THEN it returns `0`

#### Scenario: Missing or non-finite score fails soft to null

- GIVEN models whose `benchlm.score` is absent, `null`, a numeric string, or `NaN`
- WHEN `compositeScore(model)` is called for each
- THEN every call returns `null`
- AND no call returns `0`

#### Scenario: Two models differing only in intelligenceIndex score identically

- GIVEN two models identical except that one carries `intelligenceIndex: 53` and the other `intelligenceIndex: null`
- WHEN `compositeScore` is called for both and `getBestFor` orders the pair
- THEN both scores are equal
- AND the winner is identical, driven only by the untouched BenchLM contract

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

Callers MUST pre-filter the `models` argument with `applyProviderFilter`
before invoking `getBestFor`; the function signature is unchanged. Soft
fallbacks MUST resolve only within the pre-filtered eligible set.

The function MUST return an object: `{ key, model, score, cost, effectiveMaxCost, alternatives, reason }` where `alternatives` is the top 3 other eligible models for justification UI.

The ranking logic and `compositeScore` formula MUST be unchanged by this change. Astra-first MUST be evaluated as a data consequence over the complete catalog produced by the traced AA 2026-09-13 backfill: the acceptance test MUST compute the real maximum `compositeScore` of the `chatgpt-plus` eligible set at test time and assert the top row is that maximum — never assume a hardcoded value such as `53` or a hardcoded winner. No candidate's `benchlm.score` may be lowered, hidden, or altered without its own AA 2026-09-13 `sources[]` evidence, and no ranking branch, re-sort, or scorer tweak may be added to force the outcome. If the real maximum is not Astra, the change stops at the data gate (ask-on-risk) and records a follow-up instead of mutating the catalog. `intelligenceIndex` MUST be inert to scoring/ranking in this slice. No global re-sort by intelligence is introduced.

(Previously: callers passed the full catalog; fallbacks could resolve to any model. This delta adds: Astra-first-as-data-consequence + scorer-intact + intelligence-inert rules; all prior behavior preserved.)

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

#### Scenario: Astra-first holds as the real eligible maximum of the traced backfill (scorer intact)

- GIVEN the complete catalog after the traced AA 2026-09-13 backfill over the same snapshot (every legible chart row carries its own `sources[]`; rows without legible evidence or a curated slug stay out and are listed in omission notes)
- WHEN `applyProviderFilter` runs with `chatgpt-plus` enabled and the eligible set is ordered by the unchanged `compositeScore` desc
- THEN the first row is the model whose `compositeScore` equals the real maximum computed over that eligible set at test time (the assertion compares against the computed maximum, never against a hardcoded `53` or a hardcoded winner key)
- AND no candidate's `benchlm.score` is lowered or altered without its own AA 2026-09-13 `sources[]` evidence, and no scorer or ranking branch is added to force the result
- AND if that real maximum is not Astra's, the run stops at gate G1 (ask-on-risk) and records a follow-up instead of mutating the catalog
- AND `compositeScore` source contains no reference to `intelligenceIndex`

#### Scenario: Scorer ignores intelligenceIndex

- GIVEN a fixture pair differing only in `intelligenceIndex`
- WHEN `compositeScore` and `getBestFor` run over both
- THEN scores are identical and the winner is identical
- AND vitest asserts this by grepping scorer source for absence of the field or by behavioral equality

### Requirement: Justification UI

The system MUST provide a `justification-ui` component that renders
one card per agent (18 total) showing why each agent has its
assigned model. Each card MUST display:

- Agent name
- Assigned model name + effort tag only (`data-effort`, closed vocabulary `max | xhigh | high | medium | low | non-reasoning`); the card MUST NOT display tier
- Composite score of the assigned model
- Cost per request of the assigned model
- Role description
- The two checks: `score ≥ minReasoning` and `cost ≤ effectiveMaxCost`
- Top 3 alternative eligible models (model name + score)

Cards MUST render only eligible models; alternatives MUST be drawn from the
eligible set. If an agent has no eligible model (including the empty eligible
set), the card MUST show a critical warning instead of an assignment, with
`unassigned` semantics. Fallback assignments MUST render as the model name only, with no badge. The card, its header (`assignmentHeader`), and its markdown export MUST NOT render `.tier-tag`/`data-tier`, `.soft-badge`/`~`, a `.soft-summary` banner (`[data-test=soft-summary]`), or an `Estado: soft fallback` column.

The function signature MUST be
`render(targetEl, agentsAssignments, roleMatrix, models)`.

(Previously: cards showed `Assigned model name + tier` with no effort-only rule, and tier/soft/summary displays were allowed. This delta replaces the tier display with effort-only and bans all soft displays; eligible-only and signature rules are unchanged.)

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

#### Scenario: Justification hides ineligible models

- GIVEN model H is ineligible under the current filter
- WHEN the justification UI renders
- THEN H appears in neither assignments nor alternatives on any card

#### Scenario: Justification is effort-only with no tier or soft traces

- GIVEN any assignment rendering 18 cards
- WHEN the justification UI DOM and its markdown export are inspected
- THEN no element matches `.tier-tag`, `[data-tier]`, `.soft-badge`, `[data-test=soft-summary]`, and no text matches `~` soft prefix or `Estado: soft fallback`
- AND every assigned-model header shows at most one tag: `[data-effort]` with a closed-vocabulary value
- AND a soft-fallback assignment renders the model name with zero badges

### Requirement: UI Component — Reference Table (pilot)

The `ref-table` component MUST render a table with one row per
eligible non-reference model (eligible set ∩ non-reference). Columns MUST include: name, effort (`Esfuerzo`, `data-effort`), arena,
swePro, sweVer, term, input price, output price, source badges — and MUST NOT include a `Tier` column or header. Each row MUST show at most the effort badge; the row MUST NOT render `tierCell`, `.tier-tag`, `data-tier`, or any soft marker. The component MUST be a pure function: `render(targetEl, models)`.
Ineligible models MUST be removed from the DOM, not dimmed.

The component MUST NOT include interactive controls. It is read-only.

(Previously: columns included `tier` with one row per non-reference model of the full catalog; this delta swaps the Tier column for effort-only and carries over the eligible-only rule.)

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

#### Scenario: Ineligible models are hidden, not dimmed

- GIVEN 5 non-reference models of which 2 are ineligible
- WHEN `refTable.render(targetEl, eligibleModels)` is called
- THEN the table has 3 rows
- AND no hidden-model placeholder remains in the DOM

#### Scenario: `isNew` models pin to the top of the active group

- GIVEN eligible non-reference models including `isNew === true` rows with lower or null scores and non-`isNew` rows with higher scores
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

### Requirement: UI Component — CLI Mirror Table

The `cli-mirror-table` component MUST render a table showing the
18 agents (11 SDD + 3 JD + 4 Review) and their real CLI mapping.
Each row MUST include: agent key, role description, and assigned
model (from the active config over the eligible set) with at most the effort badge (`data-effort`, closed vocabulary). The assigned cell MUST NOT render `.tier-tag`/`data-tier`, `softBadge`/`.soft-badge`, or a `~` prefix. Ineligible models
MUST never appear; unassigned agents MUST show the empty-state warning.
The table MUST still render exactly 18 rows.

The function signature MUST be
`render(targetEl, agentsAssignments, agentRoles)`.

(Previously: assignments drawn from the full catalog with tier/soft badges allowed. This delta adds the effort-only ban on tier/soft displays; eligible-only, 18-row, and signature rules are unchanged.)

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

#### Scenario: CLI mirror assigned cells are effort-only

- GIVEN assignments covering fallback and normal rows
- WHEN the table DOM is inspected
- THEN every assigned-model cell shows at most `[data-effort]` with a closed-vocabulary value
- AND no cell matches `.tier-tag`, `[data-tier]`, `.soft-badge`, or contains a `~` soft prefix
- AND null assignments render the empty-state text with zero badges

### Requirement: Filtered Export

The exporter MUST export the filtered view by default with a header line
stating active providers + timestamp. An explicit opt-in flag MUST produce the
full-catalog export instead. Rationale: export must reproduce what the user saw. The export body and any `agentsMarkdown` per-model line MUST NOT include tier (no `Tier` column, no `(tier · score · costo)` fragment); score and cost MAY remain. The header providers+timestamp line and the full-catalog flag semantics MUST be preserved.

(Previously: exporter body could include tier; this delta bans tier from the body while keeping header and flag behavior.)

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

#### Scenario: Export body carries no tier

- GIVEN any filtered or full-catalog export
- WHEN the body lines are inspected
- THEN no line contains a `Tier` column or the fragment `(tier · score · costo)`
- AND no line contains `tier-tag` / `data-tier` markup
- AND the header line still names active providers + timestamp

## REMOVED Requirements

### Requirement: Tier Column and Header Display

(Reason: tier suggests fixed quality and duplicates the scorer ranking; the effort tag is the only decision-relevant label. Data field `tier` and `tier-based` strategy logic are retained — only display is removed.)
(Migration: delete `Tier` header/`tierCell` from `ref-table` + `exportRowsFrom` md header; delete `Tier` column from justification/exporter markdown; update `ref-table.test.js`, `justification-ui.test.js`, `exporter.test.js` asserts to expect `Esfuerzo` without `Tier`.)

#### Scenario: No Tier column survives

- GIVEN any of ref-table, justification export, or exporter body output
- WHEN headers and body are inspected
- THEN no `Tier` header or column exists
- AND vitest asserts absence explicitly

### Requirement: Tier Badge Elements (`.tier-tag`, `.model-tier-tag`, `data-tier`)

(Reason: same as above; tier badges add visual noise without decision value.)
(Migration: delete `model-tier-tag` from `model-card`, `tier-tag` spans from `cli-mirror-table`/`justification-ui`; delete `tierOf`/`barColor`, the `data-tier` attribute, the tier text in the legend and the `Tier` column of the markdown export from `composite-chart`, replacing bar fills with the neutral `--composite-score-fill` token; delete `--composite-tier-*` plus `--just-tier-*`/`--cli-tier-*` tokens from `css/tokens.css` only if unused elsewhere, retaining `--pricing-tier-*`, `.tier-tag` and its shapes still consumed by workflow-table/pricing-chart; update `model-card.test.js`, `cli-mirror-table.test.js`, `justification-ui.test.js` and `composite-chart.test.js` (tier-color/DOM/legend/export asserts become neutral-color + absence asserts).)

#### Scenario: No tier badge survives

- GIVEN model-card, cli-mirror-table, justification-ui, and composite-chart rendered over any fixture
- WHEN the DOM is queried for `.tier-tag`, `.model-tier-tag`, `[data-tier]`, and the chart legend and its markdown export are inspected
- THEN zero elements match in every surface
- AND every composite-chart bar uses only the neutral `--composite-score-fill` fill with no tier-derived color, no tier legend text and no `Tier` column in the export
- AND no computed style depends on `--just-tier-*` / `--cli-tier-*` / `--composite-tier-*`

### Requirement: Soft Fallback Badge (`.soft-badge`, `~` prefix)

(Reason: `~` exposes internal fallback mechanics; the fallback decision is conveyed by the model name alone.)
(Migration: delete `softBadge` from `cli-mirror-table`, `.soft-badge` from `justification-ui` cards, `~` prefix rules from `css/tokens.css`; render fallback as model name with zero badges; update `cli-mirror-table.test.js`, `justification-ui.test.js`.)

#### Scenario: No soft badge survives

- GIVEN an assignment produced by soft fallback within the eligible set
- WHEN cli-mirror and justification render it
- THEN the DOM contains no `.soft-badge` and no `~`-prefixed label
- AND the model name appears as plain text with at most the effort badge

### Requirement: Soft Summary Banner and Estado Column (`[data-test=soft-summary]`, `soft fallback`)

(Reason: banner and Estado column narrate fallback mechanics the user did not ask for; empty-state and per-card warnings already cover unassigned cases.)
(Migration: delete `.soft-summary` banner block and `Estado: soft fallback` export column from `justification-ui`; keep empty-set message + `enable-all` CTA and `unassigned` semantics untouched; update `justification-ui.test.js:278` banner asserts.)

#### Scenario: No soft summary survives

- GIVEN a config with at least one fallback assignment
- WHEN justification-ui renders and its markdown export is inspected
- THEN no `[data-test=soft-summary]` element exists and no `soft fallback` Estado value exists
- AND empty-eligible rendering still shows the message + `enable-all` CTA with `unassigned` assignments

### Requirement: Exporter `(tier · score · costo)` Fragment

(Reason: coherence with effort-only — tier must not leak back through the exporter body.)
(Migration: remove the fragment from `js/services/exporter.js:134 agentsMarkdown`; keep score/cost and header providers+timestamp; update `exporter.test.js`.)

#### Scenario: Fragment is gone but header survives

- GIVEN any export without flags
- WHEN the output text is searched
- THEN `(tier · score · costo)` has zero matches
- AND the first header line still names active providers + timestamp
