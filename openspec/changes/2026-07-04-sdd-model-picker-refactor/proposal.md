# Proposal: sdd-model-picker-refactor

## Intent

The current SDD Model Picker is a 880-line monolithic HTML that mixes
markup, CSS, JS data and JS logic in a single file, with zero tests for
critical scoring code and no way to update benchmarks without manual HTML
editing. This change refactors it into a modular, testable, auto-syncing
V4 that preserves visual parity 1:1 with V3 while making the data layer,
scoring logic, and sync workflow first-class concerns.

## Scope

### In Scope

- New repository `Teksi75/sdd-model-picker` (separate from pre-utn).
- Modular project: ES modules, Tailwind, esbuild bundler, vitest tests.
- Data layer extracted to `data/{models,phases,configs,agent-roles,agent-request-profiles}.json`
  (source of truth for the complete SDD ecosystem — 18 agents).
- Scoring service `services/model-scorer.js` with full test coverage.
- Role matrix (`data/agent-roles.json`) with hybrid constraint model:
  `minReasoning` (absolute) + `costRatio` (relative to the reference model).
- Component-based JS architecture (`config-selector`, `workflow-table`,
  `composite-chart`, `pricing-chart`, `ref-table`, `freshness-badge`,
  `justification-ui`).
- Twin Judge Constraint: `jd-judge-a` and `jd-judge-b` MUST always resolve
  to the same model (blind twin judges).
- GitHub Actions auto-sync for OpenCode Go pricing and GLM-5.2 blog.
- UI freshness indicator + manual refresh button.
- Build pipeline producing a single self-contained HTML.
- Deploy via GitHub Pages.
- V3 stays as `v3-monolith-backup.html` until V4 is verified.

### Out of Scope

- UI/UX redesign (V4 must look identical to V3, visual parity).
- Changing the scoring weights (40/35/25) or the 9 SDD phases.
- Adding new models beyond what V3 has.
- Offline-first / PWA (only step toward offline: local Lucide bundle).
- Migrating V1/V2 HTMLs (kept as historical reference only).
- Multi-user / collaboration features.

## Capabilities

### New Capabilities

- `data-layer`: JSON-backed source of truth for models, phases, configs,
  agent roles, and agent request profiles. Schema-versioned, with `_meta`
  block (`lastSynced`, `source`, `nextSync`, `schemaVersion`).
- `role-matrix`: `data/agent-roles.json` defines `minReasoning` (absolute
  capacity threshold) + `costRatio` (relative to reference model cost)
  for each of the 18 SDD/JD/Review agents. Hybrid constraint model
  keeps reasoning capacity stable while cost scales with the market.
- `agent-request-profile`: `data/agent-request-profiles.json` defines
  per-agent `inputTokens` and `outputTokens` (asymmetric for read-only
  reviewers: 5000 input + 1000 output, etc.). Used to compute realistic
  per-agent cost.
- `scoring-service`: Pure functions `compositeScore(model)`,
  `costEstimate(model, requestProfile)`, `getBestFor(agent, models, roleMatrix, profiles)`.
  All weights in one place. Fully unit-tested.
- `twin-judge-constraint`: `selectConfig` enforces that `jd-judge-a` and
  `jd-judge-b` resolve to the SAME model. Configs violating this are
  rejected with a clear error.
- `config-strategy`: 5 configs (`economico`, `balanceado`, `maximo`,
  `hibrido`, `experimental`) become STRATEGIES that adjust role-matrix
  constraints, not hardcoded assignments. `getBestFor` derives the
  actual assignment from `minReasoning` + `costRatio` per agent.
- `justification-ui`: Per-agent section shows assigned model with
  score, cost, role, and the two checks (minReasoning satisfied,
  effectiveMaxCost satisfied). Effective max cost is computed
  dynamically as `costRatio * costEstimate(referenceModel, agentProfile)`.
- `component-rendering`: One module per V3 section. Each module exports
  a `render(targetEl, data)` function. Markup is data-driven, not hand-written.
- `sync-service`: Auto-fetch latest `data/models.json` from GitHub raw URL
  with staleness detection and manual refresh. sessionStorage cache with
  versioned key.
- `build-pipeline`: `npm run build` produces `dist/index.html` with
  inlined CSS+JS. No runtime CDN dependencies.
- `github-actions-sync`: Scheduled workflow (every 5 days) that scrapes
  OpenCode Go pricing page and GLM-5.2 blog, commits updates to
  `data/models.json`.

### Modified Capabilities

- `model-picker-ui`: V3's inline `MODELS` constant is replaced by a
  fetch from `data/models.json`. V3's `compositeScore` and `selectConfig`
  inline functions are replaced by imports from the new services.
  Visual output is unchanged.

## Approach

Six-phase implementation following pilot-vertical strategy (de-risk by
completing one section end-to-end before committing to the full migration):

1. **Phase 0 — Tooling foundation**: Create `Teksi75/sdd-model-picker`
   repo, `package.json` with esbuild + vitest + tailwindcss deps, `tailwind.config.js`,
   `esbuild.config.js`, test runner config. V3 stays untouched.

2. **Phase 1 — Skeleton + pilot**: Snapshot V3 as
   `v3-monolith-backup.html`. Extract data from V3 to `data/*.json`.
   Build `services/model-scorer.js` with 8+ tests (TDD). Build
   `components/ref-table.js` as the first fully-migrated section.
   Acceptance: ref-table renders identically in V3 and V4 for same data.

3. **Phase 2 — Section-by-section migration**: Migrate the remaining
   7 components (`config-selector`, `workflow-table`, `composite-chart`,
   `pricing-chart`, `cli-mirror-table`, `model-card`, `freshness-badge`).
   V3 markup stays commented out as fallback until each section's
   visual parity is verified.

4. **Phase 3 — Auto-sync**: `services/data-sync.js` + GitHub Actions
   workflow `sync-benchmarks.yml`. First scraper: OpenCode Go pricing.
   Second: GLM-5.2 blog. UI freshness indicator + manual refresh button.
   Warning banner when staleness > 7 days.

5. **Phase 4 — Build & deploy**: esbuild bundle producing single
   `dist/index.html` with inlined CSS+JS. GitHub Pages deploy via
   Actions. Custom domain optional (not in scope).

6. **Phase 5 — Verify & archive**: `sdd-verify` with visual diff
   harness (V3 vs V4), full test suite, build validation, and
   acceptance criteria check. `sdd-archive` merges delta specs into
   main `openspec/specs/model-picker/spec.md`.

Key architecture decisions:

- **Tailwind with custom tokens layer**: Tailwind utility classes stay
  in markup (no rewrite of `bg-slate-900/60` etc). `tokens.css` adds
  CSS custom properties for semantic colors shared with JS.
- **JSON as source of truth**: Updating benchmarks = editing JSON, not
  HTML surgery. Scraper commits JSON; data-loader reads JSON.
- **Pilot-vertical migration**: ref-table first (most data-driven,
  least interactive), validates the modular architecture before
  committing to all 8 components.

## Affected Areas

| Area | Action | Description |
|------|--------|-------------|
| `data/models.json` | New | Extract from V3 `MODELS` constant; add `_meta` block |
| `data/phases.json` | New | Extract from V3 `PHASES` constant |
| `data/configs.json` | New | 5 strategies (economico, balanceado, maximo, hibrido, experimental), not hardcoded assignments |
| `data/agent-roles.json` | New | Role matrix for 18 agents: `minReasoning` (abs) + `costRatio` (rel to reference) |
| `data/agent-request-profiles.json` | New | Per-agent `inputTokens` + `outputTokens` (asymmetric for read-only reviewers) |
| `css/tokens.css` | New | CSS custom properties for semantic colors |
| `css/components.css` | New | Component classes shared across sections |
| `js/app.js` | New | Bootstrap: load data, render sections, wire events |
| `js/services/data-loader.js` | New | fetch + sessionStorage cache (versioned key) |
| `js/services/data-sync.js` | New | Freshness check + manual refresh + UI warning |
| `js/services/model-scorer.js` | New | compositeScore, costEstimate, getBestFor |
| `js/components/config-selector.js` | New | 5 preset buttons |
| `js/components/workflow-table.js` | New | SDD phase → model assignment table |
| `js/components/cli-mirror-table.js` | New | Real CLI mapping (18 SDD/JD/Review agents) |
| `js/components/composite-chart.js` | New | Score bars (filtered: non-reference) |
| `js/components/pricing-chart.js` | New | Cost bars |
| `js/components/ref-table.js` | New | Reference table (pilot) |
| `js/components/model-card.js` | New | Reusable model card |
| `js/components/freshness-badge.js` | New | "X días" + manual refresh |
| `js/components/justification-ui.js` | New | Per-agent justification: score, cost, role, effective max cost, top-3 alternatives |
| `js/utils/formatters.js` | New | toCurrency, toPercent, formatReq |
| `js/utils/export.js` | New | exportWorkflow → clipboard |
| `tests/model-scorer.test.js` | New | 8+ tests for scoring service |
| `tests/config-selector.test.js` | New | 4+ tests for config selection |
| `tests/data-loader.test.js` | New | Cache + schema-version tests |
| `index.html` | New | Shell: load modules, mount components |
| `v3-monolith-backup.html` | New (snapshot) | V3 file preserved unchanged |
| `tailwind.config.js` | New | Tailwind config (dark mode, content paths) |
| `esbuild.config.js` | New | Build config (bundle, minify, inline) |
| `vitest.config.js` | New | Vitest config (jsdom env) |
| `package.json` | New | Deps + scripts (dev, build, test) |
| `.github/workflows/sync-benchmarks.yml` | New | Scheduled sync + manual dispatch |
| `.github/workflows/deploy-pages.yml` | New | GitHub Pages deploy |
| `Modelos SDD - V3 - Lucide.html` | Preserved | Untouched source of truth |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tailwind classes spread through V3 markup make extraction messy | Med | Pilot section first; visual-regression harness before bulk migration |
| Encoding of V3 is Windows-1252 (broken chars: "Qu", "LMSYS Arena") | Med | Read V3 with explicit encoding; emit all new files as UTF-8; do not copy-paste |
| GitHub Actions scrapers break on upstream HTML changes | Med | Scrapers fail-loud (non-zero exit); UI shows "stale" warning within 7 days; document manual fallback |
| `sessionStorage` cache serves stale JSON after schema change | Low | Versioned cache key (`sdd-models-v1`) + `_meta.schemaVersion` check; mismatch → discard |
| User wants to keep using V3 while V4 is built | Low | V3 stays as `v3-monolith-backup.html`; never deleted until V4 verified |
| Repo permissions / GH Pages not enabled | Low | Phase 0 includes repo bootstrap checklist (Settings → Pages → main branch / root) |
| Visual drift between V3 and V4 in section migration | Med | Per-section visual diff harness (Playwright screenshot); V3 stays as fallback until diff is clean |
| 400-line PR budget exceeded when applying tasks | Med | `sdd-tasks` review workload forecast splits into per-phase PRs (Phase 0-5 each ≤ 400 lines) |

## Rollback Plan

1. **Phase 0 (repo + tooling)**: Delete `sdd-model-picker` repo. No
   code change to V3. Zero risk.
2. **Phase 1 (skeleton + pilot)**: Revert the PR. V3 file untouched;
   pilot section (`ref-table.js`) is a new file in the repo, not a
   V3 modification. Delete the new files; no rollback needed.
3. **Phase 2 (section migration)**: Each section is a separate PR.
   Revert one PR = one section reverts. V3 markup remains commented
   out as fallback until all sections migrated.
4. **Phase 3 (auto-sync)**: Disable the GitHub Actions workflow
   (Actions → workflow → Disable). Manual refresh button still works.
   UI freshness indicator shows static "manual update required".
5. **Phase 4 (build + deploy)**: Revert to last good build. The
   previous bundle lives in GH Pages history (redeployable).
6. **Full revert**: `git revert` all PRs in reverse order. The
   V3 file is always present and unchanged in the original directory
   (`Modelos SDD - V3 - Lucide.html`); the new repo is additive.

## Dependencies

- `Teksi75/sdd-model-picker` GitHub repo (created in Phase 0).
- GitHub Pages enabled on the repo (Settings → Pages).
- OpenCode Go pricing page structure (`opencode.ai/docs/es/go/`)
  remains stable for the scraper. If it changes, scraper fails
  loud and UI shows staleness warning.
- HuggingFace blog page structure (`huggingface.co/blog/zai-org/glm-52-blog`)
  remains stable. Same fallback.
- esbuild 0.20+ for `metafile` + `inject` build options.
- Tailwind 3.4+ for `darkMode: 'class'` + JIT.
- vitest 1.0+ with `jsdom` for DOM-touching tests (config-selector).
- SessionStorage + `fetch()` available in target browsers (Chrome 90+,
  Firefox 90+, Safari 14+).

## Success Criteria

- [ ] `data/models.json` matches V3 `MODELS` constant 1:1 (validated
      by checksum test).
- [ ] `compositeScore()` produces the same number as V3 for every
      model in `data/models.json` (regression test).
- [ ] All 8+ tests in `tests/model-scorer.test.js` pass.
- [ ] All 4+ tests in `tests/config-selector.test.js` pass.
- [ ] All 3+ tests in `tests/data-loader.test.js` pass.
- [ ] `npm run build` produces a single self-contained HTML that
      opens in a browser and renders identically to V3.
- [ ] No CDN dependencies at runtime (Tailwind + Lucide bundled
      locally).
- [ ] Freshness badge shows correct "X días" string on load.
- [ ] GitHub Actions workflow runs on schedule and on `workflow_dispatch`.
- [ ] Coverage of `services/model-scorer.js` ≥ 80%.
- [ ] `data/models.json` has a `_meta` block with `lastSynced`,
      `source`, `nextSync`, `schemaVersion` fields.
- [ ] `data/agent-roles.json` covers all 18 agents (11 SDD + 3 JD + 4 Review)
      with `minReasoning` and `costRatio`.
- [ ] `selectConfig` rejects any config where `jd-judge-a` and
      `jd-judge-b` resolve to different models (twin judge constraint).
- [ ] Justification UI shows effective max cost per agent as
      `costRatio * costEstimate(referenceModel, agentProfile)`.
- [ ] PR size per phase ≤ 400 lines (review budget compliance).
- [ ] Visual diff V3 vs V4: zero pixel diff per migrated section.
