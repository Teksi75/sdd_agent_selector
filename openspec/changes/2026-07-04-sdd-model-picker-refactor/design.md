# Design: sdd-model-picker-refactor

## Technical Approach

The V4 refactor decomposes the V3 monolithic HTML into a layered,
modular architecture: data layer (models, agent roles, request
profiles, strategies) → services (scoring, sync, data-loader) →
components (per-section renderers, including the new justification
UI) → bootstrap (app.js wires it all).

The system covers the **18-agent SDD ecosystem** (11 SDD + 3
Judgment Day + 4 Review agents) sourced from the gentle-ai
`sdd-overlay-multi.json` overlay — not only the 10 agents the V3
file showed. The agent role matrix uses a **hybrid constraint
model**: `minReasoning` (absolute capacity threshold) +
`costRatio` (relative to the reference model cost), so the system
adapts to the market while keeping reasoning capacity stable.

The **twin judge constraint** (`jd-judge-a` = `jd-judge-b`)
prevents drift between blind twin reviewers caused by model
differences instead of code differences.

The V3 file becomes an immutable reference
(`v3-monolith-backup.html`) used only for regression testing.

Build is esbuild (single bundle), tests are vitest (with jsdom for
DOM-touching tests), deploy is GitHub Pages. Tailwind utility
classes remain in markup; a thin `tokens.css` layer adds CSS custom
properties for semantic colors shared between CSS and JS.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Data source of truth | `data/*.json` files in repo | DB, remote API, localStorage-only | Versioned, diff-able, GitHub Actions can commit updates; no server needed for static deploy |
| Bundler | esbuild | Vite, Webpack, Parcel, no build | Single binary, ~10ms builds, zero config needed for this shape; no HMR/dev-server complexity we don't need |
| Test framework | vitest | Jest, Mocha, no tests | Pablo already uses vitest in `monitor-calibration-web`; jsdom support out-of-the-box; same DX |
| Tailwind strategy | Keep utility classes + add `tokens.css` | Full CSS-pure rewrite | Minimize visual-diff risk during migration; tokens layer is the bridge for JS color access |
| Cache layer | sessionStorage with versioned key | localStorage, in-memory only, no cache | SessionStorage auto-clears on tab close (no stale data across sessions); versioned key handles schema changes |
| Migration order | Pilot-vertical (ref-table first) | Big-bang, smallest first | De-risks modular architecture before committing to all 8 sections; first success sets the pattern |
| V3 preservation | `v3-monolith-backup.html` snapshot | Delete V3 after V4 ships | Zero-risk rollback: V3 is always available, never modified by V4 work |
| **Constraint model** | **Hybrid: minReasoning (abs) + costRatio (rel to ref)** | minReasoning + maxCost (abs), or minReasoning only | Reasoning capacity is stable; cost scales with the market. costRatio adapts automatically when the reference model changes price |
| **Reference model** | Model with `tier: "reference"` (Opus 4.8 today) | Fixed model name, highest-scoring model | Reference models are designed as quality benchmarks; if one disappears, the next reference takes over via tier matching |
| **Config strategy** | 5 strategies (min-cost, balanced, max-quality, tier-based, experimental) modifying the role matrix | Hardcoded assignments (V3 approach) | Hardcoded assignments don't justify WHY each model is where. Strategies make the constraint model explicit and auditable |
| **Twin judge constraint** | `selectConfig` throws if jd-judge-a ≠ jd-judge-b | Allow different models | Two blind judges must use the same model; differences between their verdicts must come from the code, not the model |
| **Justification UI** | Visible per-agent section with score, cost, role, checks, alternatives | Hidden / API-only | The justification is the only way to validate that each assignment respects role + cost constraints |
| Sync trigger sources | OpenCode Go pricing + GLM-5.2 blog (auto); LMSYS/SWE-Bench (UI warning only) | Sync everything automatically | Some sources are SPAs/anti-bot (LMSYS, llm-stats) — auto-sync would fail; UI warning is honest about data freshness |
| Distribution | Single self-contained HTML via esbuild bundle | Multi-file, CDN-served | Self-contained = no CORS, no CDN flakiness, easy to share as a single file attachment |

## Module Dependency Graph

```
index.html
  └── js/app.js (bootstrap)
        ├── services/data-loader.js  (fetch + cache)
        │     └── data/*.json (fetched at runtime)
        ├── services/data-sync.js    (freshness + manual refresh)
        │     └── services/data-loader.js
        ├── services/model-scorer.js (compositeScore, costEstimate, getBestFor, findReferenceModel)
        │     ├── data/agent-roles.json
        │     ├── data/agent-request-profiles.json
        │     └── data/configs.json (strategies)
        ├── components/config-selector.js
        │     └── services/model-scorer.js
        ├── components/workflow-table.js
        │     ├── services/model-scorer.js
        │     └── utils/formatters.js
        ├── components/cli-mirror-table.js  (18 agents, not 14)
        │     ├── services/model-scorer.js
        │     └── utils/formatters.js
        ├── components/composite-chart.js
        │     ├── services/model-scorer.js
        │     └── utils/formatters.js
        ├── components/pricing-chart.js
        │     ├── services/model-scorer.js
        │     └── utils/formatters.js
        ├── components/ref-table.js
        │     └── utils/formatters.js
        ├── components/model-card.js
        │     └── services/model-scorer.js
        ├── components/freshness-badge.js
        │     └── services/data-sync.js
        ├── components/justification-ui.js  (NEW: per-agent justification)
        │     ├── services/model-scorer.js
        │     └── utils/formatters.js
        └── utils/export.js
```

**Dependency rules:**
- `components/*` MAY import from `services/*` and `utils/*`.
- `services/*` MUST NOT import from `components/*`.
- `utils/*` MUST NOT import from `services/*` or `components/*`.
- No circular dependencies.
- `justification-ui` depends on the FULL `getBestFor` result (including
  `effectiveMaxCost` and `alternatives`); therefore the scoring service
  must expose the full return shape, not just the model key.

## Data Flow

### App boot

```
index.html loads
  → app.js runs
    → dataLoader.load() (fetch all 5 data/*.json files with cache)
       → success: hydrate services + render components
       → failure: show error + cached data
    → app.js calls component.render(targetEl, data) for each section
    → dataSync.refresh() triggered if lastSynced > 7 days
```

### Config selection (with twin judge validation)

```
User clicks config button
  → configSelector.selectConfig(key)
    → loadConfig(key) → strategy from data/configs.json
    → for each of 18 agents: getBestFor(agent, models, roleMatrix, profiles, strategy)
    → validateTwinJudge(assignments['jd-judge-a'], assignments['jd-judge-b'])
      → if different: throw InvalidConfigError
    → on success: update active state + render workflow-table + render justification-ui
```

### Manual refresh

```
User clicks "↻ Actualizar ahora"
  → freshnessBadge.handleClick()
    → dataSync.refresh()
      → fetch latest data/*.json from GitHub raw URL
        → success: update sessionStorage + re-render freshnessBadge + re-validate configs
        → failure: log warning, keep cached data
```

### Auto-sync (GitHub Actions)

```
Cron: every 5 days
  → .github/workflows/sync-benchmarks.yml runs
    → node scripts/scrape-opencode-prices.js
      → fetch opencode.ai/docs/es/go/
      → parse pricing table
      → update data/models.json
    → node scripts/scrape-glm-blog.js
      → fetch huggingface.co/blog/zai-org/glm-52-blog
      → parse benchmarks
      → update data/models.json
    → commit changes (if any) to main with [skip ci]
    → users see updated data on next page load
```

### getBestFor decision flow (NEW in V4)

```
getBestFor(agent, models, roleMatrix, profiles, strategy)
  → roleReq = roleMatrix[agent]
  → strategyMod = applyStrategy(roleReq, strategy)
    → min-cost: costRatio *= 0.5
    → max-quality: minReasoning += 10
    → experimental: minReasoning += 10 (and skip isNew filter)
    → balanced: no change
    → tier-based: delegate to tier-based filter (separate path)
  → refModel = findReferenceModel(models) || highestScore(models)
  → agentProfile = profiles[agent]
  → effectiveMaxCost = costRatio * costEstimate(refModel, agentProfile)
  → eligible = models
    .filter(m => !m.isReference)
    .filter(m => compositeScore(m) >= minReasoning)
    .filter(m => costEstimate(m, agentProfile) <= effectiveMaxCost)
    .sort(by compositeScore desc)
  → if eligible.length === 0: return { key: null, reason: "..." }
  → else: return { key, model, score, cost, effectiveMaxCost, alternatives: top 3 }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `data/models.json` | New | Extract from V3 `MODELS`; add `_meta` block; schema version 1 |
| `data/phases.json` | New | 9 core SDD phases: init, explore, propose, spec, design, tasks, apply, verify, archive |
| `data/configs.json` | New | 5 strategies (economico, balanceado, maximo, hibrido, experimental); no hardcoded assignments |
| `data/agent-roles.json` | **New** | **Role matrix for 18 agents: minReasoning (abs) + costRatio (rel) + role desc** |
| `data/agent-request-profiles.json` | **New** | **Per-agent inputTokens + outputTokens; asymmetric for read-only reviewers** |
| `css/tokens.css` | New | CSS custom properties: `--color-emerald`, `--tag-optimal-bg`, etc. |
| `css/components.css` | New | Component classes shared between sections |
| `js/app.js` | New | Bootstrap: load all 5 data files, render components, wire events |
| `js/services/data-loader.js` | New | `loadAll()` function: fetch + sessionStorage cache (key: `sdd-models-v1`) |
| `js/services/data-sync.js` | New | `refresh()`, `getStalenessDays(meta)`, `isStale(meta, thresholdDays)` |
| `js/services/model-scorer.js` | New | `compositeScore`, `costEstimate`, `getBestFor`, `findReferenceModel`, `applyStrategy` (pure functions) |
| `js/components/config-selector.js` | New | `render(targetEl, configs, onSelect)` |
| `js/components/workflow-table.js` | New | `render(targetEl, assignments, models, phases)` |
| `js/components/cli-mirror-table.js` | New | `render(targetEl, agentsAssignments, agentRoles)` — **18 agents** |
| `js/components/composite-chart.js` | New | `render(targetEl, models)` — bar chart |
| `js/components/pricing-chart.js` | New | `render(targetEl, models)` — bar chart |
| `js/components/ref-table.js` | New | `render(targetEl, models)` — pilot section |
| `js/components/model-card.js` | New | Reusable card component |
| `js/components/freshness-badge.js` | New | `render(targetEl, meta)` + click handler |
| `js/components/justification-ui.js` | **New** | **`render(targetEl, agentsAssignments, roleMatrix, models)` — per-agent justification with score, cost, role, checks, alternatives** |
| `js/utils/formatters.js` | New | `toCurrency`, `toPercent`, `formatReq`, `formatDate` |
| `js/utils/export.js` | New | `exportWorkflow(config, models, phases)` → clipboard |
| `tests/model-scorer.test.js` | New | **12+ tests (TDD-first)**: compositeScore, costEstimate, getBestFor, findReferenceModel, applyStrategy, twin judge scenarios |
| `tests/config-selector.test.js` | New | 4+ tests with jsdom |
| `tests/data-loader.test.js` | New | 3+ tests for cache + schema-version logic |
| `tests/data-integrity.test.js` | New | 1 test: V3 `MODELS` ≡ `data/models.json` |
| `tests/role-matrix-completeness.test.js` | **New** | **1 test: data/agent-roles.json covers all 18 agents from canonical list** |
| `tests/twin-judge.test.js` | **New** | **1 test: selectConfig throws when jd-judge-a ≠ jd-judge-b** |
| `index.html` | New | Shell: `<div id="app"></div>` + `<script type="module" src="js/app.js">` |
| `v3-monolith-backup.html` | New (snapshot) | V3 file copied unchanged |
| `tailwind.config.js` | New | `content`, `darkMode: 'class'`, theme extension for semantic colors |
| `esbuild.config.js` | New | Bundle, inline CSS+JS, minify, target `dist/index.html` |
| `vitest.config.js` | New | `environment: 'jsdom'`, `globals: true` |
| `package.json` | New | Deps: esbuild, vitest, tailwindcss, jsdom; scripts: `dev`, `build`, `test`, `sync` |
| `scripts/scrape-opencode-prices.js` | New | GitHub Actions scraper for OpenCode Go pricing |
| `scripts/scrape-glm-blog.js` | New | GitHub Actions scraper for GLM-5.2 blog |
| `.github/workflows/sync-benchmarks.yml` | New | Cron: every 5 days + manual dispatch |
| `.github/workflows/deploy-pages.yml` | New | On push to main: build + deploy to Pages |
| `Modelos SDD - V3 - Lucide.html` | Preserved | Untouched source of truth |

## Interfaces / Contracts

```javascript
// js/services/model-scorer.js

/**
 * @typedef {Object} Model
 * @property {string} name
 * @property {number|null} arena
 * @property {number|null} swePro
 * @property {number|null} sweVer
 * @property {number|null} term
 * @property {number} input
 * @property {number} output
 * @property {number} [cacheRead]
 * @property {'high'|'balanced'|'budget'|'reference'} tier
 * @property {boolean} [isNew]
 * @property {boolean} [isReference]
 * @property {string} [notes]
 * @property {Array<{url: string, date: string}>} [sources]
 */

/**
 * @typedef {Object} AgentRole
 * @property {number} minReasoning - absolute score threshold (0-100)
 * @property {number} costRatio - relative to reference model cost (0.0-1.0+)
 * @property {string} role - free-form description
 */

/**
 * @typedef {Object} AgentRequestProfile
 * @property {number} inputTokens
 * @property {number} outputTokens
 */

/**
 * @typedef {Object} BestForResult
 * @property {string|null} key - model key, or null if no model qualifies
 * @property {Model} [model] - the assigned model (if key is non-null)
 * @property {number} [score] - compositeScore of the assigned model
 * @property {number} [cost] - costEstimate of the assigned model
 * @property {number} effectiveMaxCost - computed max for this agent+strategy
 * @property {Array<{key: string, model: Model, score: number}>} [alternatives] - top 3 other eligible
 * @property {string} [reason] - if key is null, explains why
 */

/**
 * Compute weighted score in [0, 100].
 * Weights: arena 40%, swePro 35%, term 25%.
 * Missing benchmarks redistribute weight proportionally.
 * @param {Model} model
 * @returns {number} score in [0, 100]
 */
export function compositeScore(model) {}

/**
 * Estimate USD cost of a request.
 * @param {Model} model
 * @param {{inputTokens: number, outputTokens: number}} [requestProfile]
 * @returns {number} cost in USD
 */
export function costEstimate(model, requestProfile = { inputTokens: 1000, outputTokens: 500 }) {}

/**
 * Find the reference model in the dataset.
 * Prefers tier: "reference"; falls back to highest compositeScore.
 * @param {Object<string, Model>} models
 * @returns {Model|null}
 */
export function findReferenceModel(models) {}

/**
 * Apply a config strategy to a role requirement.
 * @param {AgentRole} roleReq
 * @param {'min-cost'|'balanced'|'max-quality'|'tier-based'|'experimental'} strategy
 * @returns {AgentRole} modified role
 */
export function applyStrategy(roleReq, strategy) {}

/**
 * Pick the best model for an agent, considering role + strategy + cost.
 * @param {string} agent - agent id (e.g., "sdd-apply", "jd-judge-a")
 * @param {Object<string, Model>} models
 * @param {Object<string, AgentRole>} roleMatrix
 * @param {Object<string, AgentRequestProfile>} agentRequestProfiles
 * @param {string} strategy - config strategy
 * @returns {BestForResult}
 */
export function getBestFor(agent, models, roleMatrix, agentRequestProfiles, strategy) {}


// js/components/config-selector.js

/**
 * Thrown when a config violates a hard constraint (e.g., twin judge).
 */
export class InvalidConfigError extends Error {}

/**
 * Select a config and update the UI.
 * @param {string} key - config key (e.g., "balanceado")
 * @throws {InvalidConfigError} if the config violates the twin judge constraint
 *                              or if the config does not exist
 */
export function selectConfig(key) {}


// js/components/justification-ui.js

/**
 * Render per-agent justification cards.
 * @param {HTMLElement} targetEl
 * @param {Object<string, BestForResult>} agentsAssignments - key: agent id
 * @param {Object<string, AgentRole>} roleMatrix
 * @param {Object<string, Model>} models
 */
export function render(targetEl, agentsAssignments, roleMatrix, models) {}
```

## Testing Strategy

| Layer | What to Test | Approach | Coverage Target |
|-------|--------------|----------|-----------------|
| Unit | `compositeScore` (all variations) | Table-driven vitest | 100% branches |
| Unit | `costEstimate` (default, custom, asymmetric) | vitest with fixture models | 100% |
| Unit | `findReferenceModel` (with/without reference tier) | vitest | 100% |
| Unit | `applyStrategy` (5 strategies × role matrix) | vitest with all 5 strategies | 100% |
| Unit | `getBestFor` (all 18 agents, all 5 strategies, edge cases) | vitest with mock models | 90% |
| Unit | `data-loader` (cache hit, cache miss, schema mismatch) | vitest with mock fetch | 90% |
| Unit | `data-sync` (refresh, staleness, isStale) | vitest with mock fetch | 90% |
| Unit | `config-selector` (select, switch, idempotent, twin judge violation) | vitest with jsdom | 90% |
| Unit | `twin-judge` (rejects when jd-judge-a ≠ jd-judge-b) | vitest with manipulated data | 100% |
| Unit | `role-matrix-completeness` (all 18 agents present) | vitest reading data/agent-roles.json | 100% |
| Integration | `data-integrity`: V3 MODELS ≡ data/models.json | vitest parsing both, asserting equality | n/a |
| E2E (manual) | Visual diff V3 vs V4 per section | Playwright screenshot diff | 0 pixels per section |
| Build | `npm run build` produces valid single HTML | Shell test, `ls dist/index.html` | n/a |

**TDD contract**: For every `services/model-scorer.js` function,
the test file is written FIRST (RED), the implementation is written
to pass (GREEN), then refactored (REFACTOR). The same contract
applies to `data-loader.js`, `data-sync.js`, and `config-selector.js`.

**Coverage gate**: `services/model-scorer.js` ≥ 80% line coverage.
Failure to meet gate blocks the merge.

## Migration / Rollout

**Phase 0 (tooling)**: Repo created with `package.json`, `tailwind.config.js`,
`esbuild.config.js`, `vitest.config.js`. Empty `index.html` shell.
V3 file untouched.

**Phase 1 (skeleton + pilot)**: V3 file copied to
`v3-monolith-backup.html` (verbatim). Data extracted to 5 JSON files:
- `data/models.json` (from V3 MODELS)
- `data/phases.json` (9 core SDD phases)
- `data/configs.json` (5 strategies)
- `data/agent-roles.json` (NEW: 18-agent role matrix)
- `data/agent-request-profiles.json` (NEW: per-agent profiles)

`services/model-scorer.js` written TDD-first with 12+ tests
passing. `components/ref-table.js` written and verified to
render identically to V3's reference table. PR merged.

**Phase 2 (sections)**: One section per PR:
- `config-selector` (5 buttons, validation)
- `workflow-table` (9 rows, for the 9 core SDD phases)
- `composite-chart` (bar chart)
- `pricing-chart` (bar chart)
- `cli-mirror-table` (18 agents)
- `model-card` (reusable)
- `freshness-badge` (with mock meta)
- `justification-ui` (NEW: per-agent justification with effectiveMaxCost)

**Phase 3 (sync)**: `services/data-sync.js` + `data-integrity` test.
GitHub Actions workflow with two scraper scripts. UI freshness
indicator wired up. Manual refresh button functional.

**Phase 4 (build + deploy)**: esbuild bundle produces
`dist/index.html`. `deploy-pages.yml` workflow publishes on merge
to main.

**Phase 5 (verify + archive)**: `sdd-verify` runs:
- Full test suite (must pass)
- Build (must succeed, < 30s)
- Visual diff V3 vs V4 (must be 0 pixels)
- Coverage ≥ 80% on `model-scorer.js`
- Role matrix completeness test (all 18 agents)
- Twin judge constraint test (rejects divergent twins)

`sdd-archive` merges delta specs into main
`openspec/specs/model-picker/spec.md`.

## Open Questions

- [x] ✅ Resolved: agent enumeration (18 agents: 11 SDD + 3 JD + 4 Review)
- [x] ✅ Resolved: scoring weights (40/35/25, redistribute on missing)
- [x] ✅ Resolved: cost model (hybrid: minReasoning + costRatio)
- [x] ✅ Resolved: reference model (tier: "reference" with fallback)
- [x] ✅ Resolved: twin judge constraint (same model mandatory)
- [x] ✅ Resolved: config strategies (5 strategies modifying role matrix)
- [ ] V3 backup location: copy to repo + keep in OneDrive, or just one?
- [ ] Data repo split: commit `data/*.json` to `sdd-model-picker` or to a
      separate `sdd-data` repo? Current plan: same repo (overkill to split
      for a single-file data layer).
- [ ] Lucide icon set: enumerate the ~10 icons V3 uses (Phase 1 task).
- [ ] Strategy "tier-based" implementation: how does it interact with the
      costRatio model? Option A: tier-based overrides the role matrix
      entirely. Option B: tier-based is a SECONDARY filter after role
      matrix passes. Plan: B (role matrix first, then tier as a sanity
      check).
- [ ] When the reference model disappears, the effective max cost of
      all agents drops. Is this the right behavior, or should the
      previous max be sticky? Plan: not sticky — fresh data should
      produce fresh ceilings. (UX-wise: show a "reference model
      changed" warning in the freshness badge.)
