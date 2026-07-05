# Tasks: sdd-model-picker-refactor

**Total tasks**: 53
**Estimated PR count**: 10 (one per phase, ≤ 400 lines per PR)
**Review budget per PR**: ≤ 400 changed lines

**Tags**:
- `[RED]` — write failing test first
- `[GREEN]` — implement to pass tests
- `[REFACTOR]` — clean up after tests pass
- `[TEST]` — test-only task (no production code)
- `[DOCS]` — documentation only
- `[INFRA]` — tooling, config, or CI changes

---

## Phase 0 — Tooling Foundation (1 PR, ~150 lines)

- [ ] 0.1 **[INFRA]** Create GitHub repo `Teksi75/sdd-model-picker` (public, MIT license, no template)
- [ ] 0.2 **[INFRA]** Enable GitHub Pages: Settings → Pages → Source: GitHub Actions
- [ ] 0.3 **[INFRA]** Create `package.json` with deps: `esbuild@^0.20`, `vitest@^1.0`, `tailwindcss@^3.4`, `jsdom@^24`; scripts: `dev`, `build`, `test`, `test:coverage`
- [ ] 0.4 **[INFRA]** Create `tailwind.config.js` with `content: ['./index.html', './js/**/*.{js,html}']`, `darkMode: 'class'`, theme extension for semantic colors
- [ ] 0.5 **[INFRA]** Create `esbuild.config.js` with bundle, minify, inline CSS+JS, target `dist/index.html`
- [ ] 0.6 **[INFRA]** Create `vitest.config.js` with `environment: 'jsdom'`, `globals: true`, coverage reporter
- [ ] 0.7 **[INFRA]** Create `.gitignore` with `node_modules/`, `dist/`, `.DS_Store`, `coverage/`
- [ ] 0.8 **[INFRA]** Create empty `index.html` shell with `<div id="app"></div>` and `<script type="module" src="js/app.js"></script>`
- [ ] 0.9 **[INFRA]** Create empty `js/app.js` that logs "SDD Model Picker V4 — boot"
- [ ] 0.10 **[TEST]** Run `npm install` and `npm test` — both succeed (placeholder test passes)
- [ ] 0.11 **[INFRA]** Create `README.md` with project description, build instructions, link to V3 file

---

## Phase 1 — Skeleton + Pilot Section (1 PR, ~350 lines)

### 1a. Snapshot V3

- [ ] 1.1 **[INFRA]** Copy `Modelos SDD - V3 - Lucide.html` to `v3-monolith-backup.html` (verbatim, including any encoding artifacts)
- [ ] 1.2 **[DOCS]** Add a comment in `index.html` pointing to `v3-monolith-backup.html` as the source of truth

### 1b. Extract data (5 JSON files)

- [ ] 1.3 **[REFACTOR]** Manually transcribe V3 `MODELS` constant to `data/models.json`; add `_meta` block with `lastSynced: "2026-07-04"`, `source: "manual-import"`, `nextSync: "2026-07-09"`, `schemaVersion: 1`
- [ ] 1.4 **[REFACTOR]** Manually transcribe V3 `PHASES` constant to `data/phases.json` (9 core SDD phases only)
- [ ] 1.5 **[REFACTOR]** Create `data/configs.json` with 5 strategies (economico, balanceado, maximo, hibrido, experimental) — **NO hardcoded assignments**
- [ ] 1.6 **[REFACTOR]** Create `data/agent-roles.json` with 18 entries (11 SDD + 3 JD + 4 Review); each with `minReasoning`, `costRatio`, `role` — derived from the table in design.md
- [ ] 1.7 **[REFACTOR]** Create `data/agent-request-profiles.json` with 18 entries; asymmetric profiles for read-only reviewers (5000+1000)
- [ ] 1.8 **[TEST]** Add `tests/data-integrity.test.js`: parse V3 `MODELS` from `v3-monolith-backup.html` and `data/models.json`; assert equal model count, equal key fields per model

### 1c. Scoring service (TDD) — 12+ tests

- [ ] 1.9 **[RED]** Write failing tests in `tests/model-scorer.test.js` for `compositeScore`: all benchmarks, only arena, no benchmarks (returns 0), regression vs V3 reference value
- [ ] 1.10 **[GREEN]** Implement `compositeScore(model)` in `js/services/model-scorer.js` to pass 1.9
- [ ] 1.11 **[REFACTOR]** Extract weights to a `SCORING_WEIGHTS` constant at top of file
- [ ] 1.12 **[RED]** Write failing tests for `costEstimate`: default request, custom request, asymmetric read-only profile (5000+1000)
- [ ] 1.13 **[GREEN]** Implement `costEstimate(model, requestProfile)` to pass 1.12
- [ ] 1.14 **[RED]** Write failing tests for `findReferenceModel`: returns tier:reference, falls back to highest score when no reference
- [ ] 1.15 **[GREEN]** Implement `findReferenceModel(models)` to pass 1.14
- [ ] 1.16 **[RED]** Write failing tests for `applyStrategy`: 5 strategies × representative role (min-cost halves costRatio, max-quality +10 reasoning, experimental same as max-quality, balanced no change, tier-based passes through)
- [ ] 1.17 **[GREEN]** Implement `applyStrategy(roleReq, strategy)` to pass 1.16
- [ ] 1.18 **[RED]** Write failing tests for `getBestFor`: sdd-archive picks cheapest, sdd-orchestrator picks highest reasoning, returns null when no model qualifies, effectiveMaxCost is correct
- [ ] 1.19 **[GREEN]** Implement `getBestFor(agent, models, roleMatrix, profiles, strategy)` to pass 1.18
- [ ] 1.20 **[TEST]** Run `npm test -- --coverage` — model-scorer coverage ≥ 80%

### 1d. Role matrix & twin judge tests

- [ ] 1.21 **[TEST]** Add `tests/role-matrix-completeness.test.js`: load `data/agent-roles.json`, assert keys match exactly the 18-agent canonical list
- [ ] 1.22 **[TEST]** Add `tests/twin-judge.test.js`: with manipulated mock data, assert that calling `selectConfig` (after Phase 2) throws when jd-judge-a ≠ jd-judge-b

### 1e. Pilot section: ref-table

- [ ] 1.23 **[REFACTOR]** Extract V3 `buildRefTable()` logic; identify inputs and target element
- [ ] 1.24 **[GREEN]** Create `js/components/ref-table.js` exporting `render(targetEl, models)`
- [ ] 1.25 **[REFACTOR]** Extract table-row HTML template to a template literal inside `ref-table.js`
- [ ] 1.26 **[INFRA]** Wire `refTable.render(targetEl, models)` into `js/app.js` (with placeholder data)
- [ ] 1.27 **[TEST]** Manual visual diff: open V3 and V4 side-by-side; assert 0 pixel diff in the reference table section

### 1f. Data loader (TDD)

- [ ] 1.28 **[RED]** Write failing tests in `tests/data-loader.test.js` for: cache hit (no fetch), cache miss (fetch all 5 files), schema mismatch (discard cache)
- [ ] 1.29 **[GREEN]** Implement `data-loader.js` with `loadAll()` function and `CACHE_KEY = 'sdd-models-v1'`
- [ ] 1.30 **[REFACTOR]** Add JSDoc to all exported functions

---

## Phase 2 — Section Migration (5 PRs, ~300-400 lines each)

### 2a. config-selector (PR 1 of Phase 2)

- [ ] 2.1 **[REFACTOR]** Extract V3 config-selector rendering logic (5 buttons)
- [ ] 2.2 **[RED]** Write failing tests in `tests/config-selector.test.js` for: selectConfig updates DOM, switches configs, idempotent, **throws InvalidConfigError when twin judge constraint violated**
- [ ] 2.3 **[GREEN]** Implement `js/components/config-selector.js` exporting `render(targetEl, configs, onSelect)` and `selectConfig(key)` with twin judge validation
- [ ] 2.4 **[INFRA]** Wire `configSelector.render(...)` into `js/app.js`
- [ ] 2.5 **[TEST]** Manual visual diff: V3 vs V4 config buttons; assert identical layout + active state

### 2b. workflow-table (PR 2 of Phase 2)

- [ ] 2.6 **[REFACTOR]** Extract V3 workflow-table logic (9 rows)
- [ ] 2.7 **[GREEN]** Implement `js/components/workflow-table.js` exporting `render(targetEl, assignments, models, phases)` for the 9 core SDD phases
- [ ] 2.8 **[GREEN]** Wire `selectConfig()` callback to re-render `workflow-table`
- [ ] 2.9 **[TEST]** Manual visual diff: V3 vs V4 workflow table; assert identical rows for each of 5 configs

### 2c. composite-chart (PR 3 of Phase 2)

- [ ] 2.10 **[REFACTOR]** Extract V3 `buildCompositeChart()` logic
- [ ] 2.11 **[GREEN]** Implement `js/components/composite-chart.js` exporting `render(targetEl, models)` (uses `compositeScore` from service)
- [ ] 2.12 **[TEST]** Manual visual diff: V3 vs V4 composite chart; assert identical bar order and widths

### 2d. pricing-chart (PR 4 of Phase 2)

- [ ] 2.13 **[REFACTOR]** Extract V3 `buildPricingChart()` logic
- [ ] 2.14 **[GREEN]** Implement `js/components/pricing-chart.js` exporting `render(targetEl, models)` (uses `costEstimate` from service with default profile)
- [ ] 2.15 **[TEST]** Manual visual diff: V3 vs V4 pricing chart; assert identical bar order and widths

### 2e. cli-mirror-table, model-card, freshness-badge, justification-ui (PR 5 of Phase 2)

- [ ] 2.16 **[GREEN]** Implement `js/components/cli-mirror-table.js` (render of **18 agents** with their assignments + roles)
- [ ] 2.17 **[GREEN]** Implement `js/components/model-card.js` exporting `render(targetEl, model)` (reusable)
- [ ] 2.18 **[GREEN]** Implement `js/components/freshness-badge.js` exporting `render(targetEl, meta)` with mock meta (real data wiring in Phase 3)
- [ ] 2.19 **[GREEN]** **Implement `js/components/justification-ui.js`** exporting `render(targetEl, agentsAssignments, roleMatrix, models)` — per-agent cards with score, cost, role, checks, alternatives; critical warning when no model qualifies
- [ ] 2.20 **[INFRA]** Wire `justification-ui` into `selectConfig` callback (re-renders when config changes)
- [ ] 2.21 **[TEST]** Manual visual diff: V3 vs V4 for all 4 components; assert 0 pixel diff for the migrated ones + justification shows valid cards for all 18 agents

---

## Phase 3 — Auto-Sync (1 PR, ~400 lines)

### 3a. Sync service

- [ ] 3.1 **[RED]** Write failing tests for `data-sync.js`: `refresh()` success, `refresh()` failure, `getStalenessDays(meta)`, `isStale(meta, thresholdDays)`
- [ ] 3.2 **[GREEN]** Implement `js/services/data-sync.js` with `DEFAULT_DATA_URL`, `STALENESS_THRESHOLD_DAYS = 7`, and the 4 functions
- [ ] 3.3 **[REFACTOR]** Extract URL constants to a config object; add JSDoc

### 3b. UI wiring

- [ ] 3.4 **[GREEN]** Update `freshness-badge.js` to call `dataSync.refresh()` on button click
- [ ] 3.5 **[GREEN]** Add forced refresh on page load when `isStale(meta, 7)` returns true
- [ ] 3.6 **[GREEN]** Add warning banner DOM when staleness > 7 days
- [ ] 3.7 **[GREEN]** Wire `dataSync.refresh()` success path to re-validate all 18 agents and re-render justification-ui (in case reference model price changed)
- [ ] 3.8 **[TEST]** Manual: load page with cached data from 8 days ago → verify forced refresh + warning banner + justification re-renders

### 3c. GitHub Actions scrapers

- [ ] 3.9 **[INFRA]** Create `scripts/scrape-opencode-prices.js`: fetch `opencode.ai/docs/es/go/`, parse pricing table, output `data/models.json` patch
- [ ] 3.10 **[INFRA]** Create `scripts/scrape-glm-blog.js`: fetch `huggingface.co/blog/zai-org/glm-52-blog`, parse benchmarks, output `data/models.json` patch
- [ ] 3.11 **[INFRA]** Create `.github/workflows/sync-benchmarks.yml` with cron `*/5 * * * *` (every 5 days) + `workflow_dispatch`; runs both scrapers; commits `data/models.json` with `[skip ci]`
- [ ] 3.12 **[INFRA]** Add `[skip ci]` to commit message in scraper scripts to prevent infinite loop
- [ ] 3.13 **[TEST]** Manual: trigger workflow via `workflow_dispatch`; verify commit lands and data updates

---

## Phase 4 — Build & Deploy (1 PR, ~200 lines)

- [ ] 4.1 **[INFRA]** Update `esbuild.config.js` to bundle all JS modules + inline Tailwind CSS + Lucide icons; minify; target `dist/index.html`
- [ ] 4.2 **[INFRA]** Download Lucide icon set (~10 icons used by V3) and save to `assets/icons/*.svg` or inline as JS data
- [ ] 4.3 **[INFRA]** Add `build` script to `package.json`: `node esbuild.config.js && npm run css:build`
- [ ] 4.4 **[TEST]** Run `npm run build`; verify `dist/index.html` exists, has no `<script src="https://...">`, no `<link href="https://...">`, and opens offline
- [ ] 4.5 **[INFRA]** Create `.github/workflows/deploy-pages.yml`: on push to main, run `npm run build`, upload `dist/`, deploy to GitHub Pages
- [ ] 4.6 **[INFRA]** Update README with the GitHub Pages URL once first deploy succeeds
- [ ] 4.7 **[TEST]** Manual: push to main; verify GitHub Pages deploys within 2 minutes; verify live URL renders identically to dev
- [ ] 4.8 **[INFRA]** Update `pre-utn` references (separate small PR) to point at the new GitHub Pages URL

---

## Phase 5 — Verify & Archive (1 PR, ~50 lines)

- [ ] 5.1 **[TEST]** Run `npm test` — all tests pass (12+ scoring, 1 role-matrix completeness, 1 twin-judge, 4 config-selector, 3 data-loader, 1 data-integrity, 4 data-sync = ~26 tests)
- [ ] 5.2 **[TEST]** Run `npm run build` — completes in < 30s, produces `dist/index.html`
- [ ] 5.3 **[TEST]** Run `npm test -- --coverage` — `model-scorer.js` coverage ≥ 80%
- [ ] 5.4 **[TEST]** Visual diff V3 vs V4 for all 9 sections (ref-table + 8 V3 sections) — 0 pixel diff per section
- [ ] 5.5 **[TEST]** Role matrix completeness: all 18 agents present in `data/agent-roles.json`
- [ ] 5.6 **[TEST]** Twin judge constraint: selectConfig rejects divergent twins
- [ ] 5.7 **[DOCS]** Write `verify-report.md` with results of 5.1-5.6 + acceptance criteria check from proposal.md
- [ ] 5.8 **[INFRA]** Mark `v3-monolith-backup.html` as the snapshot reference in README
- [ ] 5.9 **[INFRA]** Run `sdd-archive` to move `openspec/changes/2026-07-04-sdd-model-picker-refactor/` to `openspec/changes/archive/2026-07-04-sdd-model-picker-refactor/` and merge delta specs into `openspec/specs/model-picker/spec.md`

---

## PR Schedule

| PR | Phase | Lines | Description |
|----|-------|-------|-------------|
| 1 | 0 | ~150 | Tooling foundation |
| 2 | 1 | ~350 | Skeleton + pilot (5 JSON files, 12+ scoring tests, role matrix tests, ref-table) |
| 3 | 2a | ~150 | config-selector (with twin judge validation) |
| 4 | 2b | ~200 | workflow-table (9 core SDD phases) |
| 5 | 2c | ~150 | composite-chart |
| 6 | 2d | ~150 | pricing-chart |
| 7 | 2e | ~350 | cli-mirror (18 agents) + model-card + freshness-badge + **justification-ui** |
| 8 | 3 | ~400 | Auto-sync + scrapers + freshness wiring + re-validation |
| 9 | 4 | ~200 | Build + deploy to GitHub Pages + pre-utn reference update |
| 10 | 5 | ~50 | Verify + archive |

**Total**: 10 PRs, all ≤ 400 lines per review budget.

**New in V4 vs V3 spec**:
- **3 new data files**: `agent-roles.json`, `agent-request-profiles.json`, `configs.json` (now strategies, not assignments)
- **2 new tests**: role matrix completeness, twin judge constraint
- **1 new component**: `justification-ui` (per-agent justification)
- **Scoring service expanded**: from 8 tests to 12+ tests, includes `findReferenceModel` + `applyStrategy`
- **cli-mirror-table expanded**: from 14 agents to 18 agents (added sdd-onboard, jd-judge-a, jd-judge-b, jd-fix-agent, review-risk, review-readability, review-reliability, review-resilience)

---

## Dependencies

- Phase 0 → Phase 1: tooling must work before any code
- Phase 1 → Phase 2: pilot section must validate the architecture + all 5 data files must be in place
- Phase 2 → Phase 3: all sections rendering + justification UI working before sync re-validation makes sense
- Phase 3 → Phase 4: sync validated before build pipeline depends on data shape
- Phase 4 → Phase 5: deployment must work before final verification

Tasks within a phase MAY be parallelized (e.g., 2c and 2d can be done in the
same PR or split, depending on review capacity).
