# Intake — Claude Fable 5.1 family (2026-09-14)

Change: `2026-09-14-fable51-intake` · Branch: `feat/intake-fable51`
Mandate: 5-row AA intake (base + xhigh/high/medium/low), benchmark-only + full-false fail-closed, no scorer/surface/freshness code.

## 1. Fresh live capture (this task, never quoted)

| Campo | Valor |
|---|---|
| Endpoint | `https://artificialanalysis.ai/api/v2/data/llms/models` |
| `fetchedAt` | **2026-09-13T22:21:11.276Z** (UTC) |
| HTTP | **200 OK** |
| Item count | **650** (`payload.data.length`) |
| Top-level keys | `status`, `prompt_options`, `data` |
| Payload | repo-external temp (`%TEMP%/aa-fable51-*/aa-live-payload.json`); **never committed** |
| Key | `AA_API_KEY` file-read into process memory only; never printed, logged, or committed |
| Capture UTC date | **2026-09-13** (sources[] date + banner `lastSynced`) |

`git status` at capture time: only the 3 pre-existing modified files + archive untracked (untouched by this task).

## 2. Slug → effort (verbatim display names govern)

Effort from the AA display-name suffix ONLY (closed vocabulary). Bare slug takes max ONLY via the explicit "Max Effort" token — same rule as Fable 5 → max (`Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)`); cf. `grok-4-6` → high.

| Live slug | Verbatim display name | II exact | Pricing live | Alias → key (effort) |
|---|---|---:|---|---|
| `claude-fable-5-1` | "Claude Fable 5.1 (Adaptive Reasoning, Max Effort, Default Fallback)" | **53.4** | 10/50 | → `claudeFable51` (`max` — explicit Max-Effort token) |
| `claude-fable-5-1-xhigh` | "Claude Fable 5.1 (Adaptive Reasoning, Xhigh Effort, Default Fallback)" | **53.2** | 10/50 | → `claudeFable51Xhigh` (`xhigh`) |
| `claude-fable-5-1-high` | "Claude Fable 5.1 (Adaptive Reasoning, High Effort, Default Fallback)" | **51.2** | 10/50 | → `claudeFable51High` (`high`) |
| `claude-fable-5-1-medium` | "Claude Fable 5.1 (Adaptive Reasoning, Medium Effort, Default Fallback)" | **49.1** | 10/50 | → `claudeFable51Medium` (`medium`) |
| `claude-fable-5-1-low` | "Claude Fable 5.1 (Adaptive Reasoning, Low Effort, Default Fallback)" | **47** | 10/50 | → `claudeFable51Low` (`low`) |

No `claude-fable-5-1-non-reasoning` slug exists in the 650-item payload (exact match count 0) → no 6th row, fail-closed. Fable 5 (`claude-fable-5`, 49.7) still present — base record untouched.

## 3. Catalog entry shape (per-row decisions)

- `lifecycle: benchmark-only`, `availability`: FULL-FALSE map over all 10 registry ids (never `{}` — matrix gate needs explicit cells; variants inherit the base map by `familyKey`).
- `name`: Sonnet/Opus family convention — base `Claude Fable 5.1`, variants `Claude Fable 5.1 (Adaptive Reasoning, <Effort> Effort)`. Fallback tokens (`Default Fallback`) are routing metadata, excluded exactly as Fable 5 excludes `Opus 4.8 Fallback`.
- `input: 10, output: 50, blended: 20` ((3·10+50)/4), `pricingSource: artificialanalysis`.
- Finite AA optional fields kept verbatim (`term` = ratio·100, `codingIndex`, 3 speed fields); `mathIndex` null → absent + omission note (never synthesized).
- `benchlm` null-placeholder `{score: null, verified: false, reliability: 0, categories: {}}` + `No BenchLM observation…` note, like sibling effort variants (NOT the musespark13 real-score pattern — no BenchLM observation exists for Fable 5.1).
- `intelligenceIndex` exact per §2; `sources[]` = `{url: https://artificialanalysis.ai/, date: 2026-09-13, scraper: scrape-artificialanalysis}` exactly once.
- No `tier`, no `arena/swePro/sweVer`, no `cacheRead` (AA never writes cache).

## Fable 5.1 live-exact rows

| Catalog id | Live slug | II exacto |
|---|---|---:|
| `claudeFable51` | `claude-fable-5-1` | 53.4 |
| `claudeFable51Xhigh` | `claude-fable-5-1-xhigh` | 53.2 |
| `claudeFable51High` | `claude-fable-5-1-high` | 51.2 |
| `claudeFable51Medium` | `claude-fable-5-1-medium` | 49.1 |
| `claudeFable51Low` | `claude-fable-5-1-low` | 47 |

5 finite → verbatim copy, no clamp/round. Chart rounding is irrelevant; payload governs.

## 4. Gates

- Three-bucket recount: **78 II-covered / 0 benchlm-only / 15 scoreless = 93** (73+5 new; scoreless unchanged: 14 no-alias + `deepseekv4fNonReasoning`).
- Matrix: 93/93 full registry key sets, booleans; base `claudeFable51` benchmark-only (the active-confirmed-provider rule does not apply); 4 variants inherit the base full-false map; `availabilityOverrides` stays `[]`; meta-true set unchanged.
- Manifest 1:1: `parseNewManifestRows` generalized to this third section; every 2026-09-13-tuple carrier enumerated across the three sections; every row resolves to exact II + tuple.
- Alias count 74 → **79**; benchmark-only list `['claudeFable51','claudeFable51High','claudeFable51Low','claudeFable51Medium','claudeFable51Xhigh','musespark13']` (sorted).

## 5. Banner rationale

`_meta.lastSynced`: 2026-09-10 → **2026-09-13** (capture UTC date); `nextSync`: 2026-09-15 → **2026-09-18** (+5d). Rationale: the intake IS a sync event (fresh capture materialized into the catalog). S2 held the base date only because it merged an older capture. `scrapers.scrape-artificialanalysis.lastRun` untouched (manual intake, not a scraper run; S2a preservation pin stays intact).

## 6. Visibility verdict

Probe: jsdom/node against the default provider set (`pnpm` script surface, no curation). Result: **CONFIRMED — all 5 rows invisible under default filters** (benchmark-only excluded from selector eligibility, Composite ranking, and Pricing views; all-false availability filtered by every provider gate). Rows remain visible only in separated comparison/catalog surfaces. No availability curated to force visibility.

## 7. Curation follow-up (2026-09-14) — Anthropic availability + active lifecycle

Evidence (USER-CONFIRMED product input, not inference): the Fable 5.1 family is served via Anthropic — family parity with `claudeFable5` (anthropic-only; the user runs it there).

- Availability: `anthropic: true`, other 9 providers `false`, on all 5 ids (`claudeFable51`, `claudeFable51Xhigh`, `claudeFable51High`, `claudeFable51Medium`, `claudeFable51Low`); variants still inherit the base map; `availabilityOverrides` stays `[]`. II / sources / pricing untouched.
- Visibility probe (node + real `provider-filter` + `model-scorer` + `ii-ranking` + `composite-chart.rowsFor` + `ref-table.rowsFor`, post-availability / pre-lifecycle): all 5 rows provider-eligible under BOTH the default (all-enabled) set and the anthropic-only filter, yet `refRanked=false`, `chartScored=false`, `iiRanked=false` for every row under both filters. Verdict: **benchmark-only lifecycle still hides the rows from every ranked view even with `anthropic:true`** — the pre-authorized conditional fired.
- Lifecycle therefore flipped `benchmark-only` → `active` on the 5 ids. Rationale recorded: user-confirmed production usage via Anthropic + AA lists them as current models + family precedent `claudeFable5` is active; the fail-closed rationale no longer applies once provider evidence exists.
- Post-flip probe: all 5 rows `refRanked=true`, `chartScored=true`, `iiRanked=true` under BOTH filters. Benchmark-only list is now `['musespark13']` only.
- Assignment impact (frozen thresholds, `balanced` strategy, `getBestFor` per role, before vs after, both filters): **none — 0 of 18 agents change assignment**. Why: 17/18 roles carry `minReasoning` 60–95, above the top Fable II 53.4 (reasoning floor fails); the one role that clears II (`sdd-archive`, min 50) fails cost (Fable 10/50 → $0.0340 vs ceiling $0.0009, ~38× over). Winners unchanged (default: `glm53`/`claudeOpus5`/`gpt56luna`; anthropic-only: `sonnet5`/`haiku45Reasoning`/`claudeOpus5`; twin judges stay equal). No threshold or matrix changes — report only.
- Validation: `pnpm test` 46 files / 750 tests green; matrix gate green.
