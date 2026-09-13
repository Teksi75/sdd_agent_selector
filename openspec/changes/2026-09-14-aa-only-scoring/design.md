# Design — AA Intelligence Index as the only ranking score

Date: 2026-09-14 · Phase: design · Store: openspec · Mode: auto  
Delivery: ask-on-risk · Review budget: 400 changed lines per PR · Chain: stacked-to-main  
Research: UNSELECTED (D0) · skill_resolution: paths-injected

## 1. Outcome and fixed boundaries

The implementation will make Artificial Analysis Intelligence Index (`intelligenceIndex`, abbreviated II) the only score used by selection and ranked views. It will first establish enough live-backed II coverage to make the cutover usable, then activate the scorer and every consumer together. Models with null, absent, or non-finite II remain in the catalog but do not participate in ranking, assignments, alternatives, or ranked exports.

The design does not reopen proposal decisions D0–D7.

| Topic | Design decision |
|---|---|
| Score authority | `compositeScore(model)` accepts only finite `model.intelligenceIndex`, clamps it to `[0, 100]`, and otherwise returns `null`. The explicit history is weighted-sum → benchlm-clamp → II-only. |
| Missing II | Hide it from ranking. Never substitute `benchlm`, another benchmark, or zero. |
| Thresholds | Keep all numeric `minReasoning` values unchanged. Existing soft-fallback and unassigned states expose the resulting mismatch. |
| Fable | Resolve `claudeFable5` only from a fresh live slug lookup. Present means map/backfill its real II; absent means hidden. |
| Other benchmarks | Keep `benchlm`, `codingIndex`, `mathIndex`, `arena`, `swePro`, `sweVer`, and `term` as inert data. Do not delete them. |
| Freshness | Use `_meta.scrapers['scrape-artificialanalysis'].lastRun`; fall back to `_meta.lastSynced`. Per-model `sources[]` remains audit evidence, not the badge clock. |
| Schema | Keep `data/models.json` at schema version 5. II already exists in schema 5; this change alters authority and coverage, not the stored model shape. |
| Delivery | S1 → S2a → S2b → S3a → S3b → S4, every review slice at or below 400 changed lines. S3 is hard-blocked until S2a is complete. |

Out of scope: threshold recalibration, new fallback tiers, last-finite II retention, a separate unevaluated section, provider availability inference, deletion of benchmark fields, CSS token work, archived changes, branches, PRs, and worktree management.

## 2. Architecture at a glance

### 2.1 Module dependency graph

```text
live AA v2 payload
  │  authenticated outside the repo; exact slug + exact II
  ▼
data/aa-aliases.json ──> scripts/_aa-safety.mjs
  │                         ├─ loadAaAliases: explicit {slug,to,effort}
  │                         ├─ mapAaSlug: unknown slug → ignored
  │                         └─ detectMissing: WARN + preserve
  ▼
scripts/scrape-artificialanalysis.js
  ├─ FIELD_MAP: evaluations.artificial_analysis_intelligence_index
  ├─ buildAaPatch: finite exact / non-finite → null + omission
  ├─ sources[] attribution dedupe
  └─ scripts/_scraper-utils.mjs
       ├─ read-modify-write
       ├─ preserveManualModelFields(availability)
       └─ atomic temp + rename
  ▼
data/models.json (schemaVersion 5; II + source dates + AA lastRun)
  ▼
js/services/data-loader.js
  ├─ same-schema cache revision from lastSynced/AA dates
  └─ runtime modelsMeta
  ▼
js/services/provider-filter.js
  ▼
provider-filtered model set
  ├────────────────────────────────────────────────────────────┐
  ▼                                                            ▼
js/services/model-scorer.js                         js/services/ii-ranking.js
  ├─ compositeScore: II only                         ├─ active/non-reference universe
  ├─ findReferenceModel: highest II                 ├─ ranked vs hidden projection
  ├─ getBestFor: finite-II candidates only          ├─ shared hidden count/note
  └─ alternatives and fallbacks                     └─ shared AA as-of date
  │                                                            │
  ▼                                                            ▼
config-selector → 18 assignments                    app.js render transaction
  │                                                            │
  ├─ cli-mirror-table.js                                       ├─ ref-table.js
  ├─ justification-ui.js                                      ├─ composite-chart.js
  └─ exporter.js                                               └─ ranked exporter paths

modelsMeta ──> ii-ranking freshness resolver
  ├─ freshness-badge.js
  ├─ data-sync.js staleness/forced refresh
  ├─ composite-chart stale state
  └─ hidden-row note date
```

There is no dependency from browser scoring code back into the scraper. Provider filtering remains a caller-side hard pre-pass. The existing `js/services/aa-signal.js` is deliberately not reused for II coverage: it treats pricing and other AA metrics as a broad signal, while this change requires the narrower finite-II predicate.

### 2.2 Test grips on each edge

| Edge | Invariant held at the edge | Test grip | Slice |
|---|---|---|---|
| Live payload → aliases | Slug is exact, effort is explicit and in the six-value vocabulary; unknown slugs do not enter the catalog. | `tests/_aa-safety.test.js`, `tests/aa-effort.test.js` | S1 |
| Aliases → scraper patch | One confirmed II path; finite values copied exactly; absent/non-finite values become `null` only for covered rows. | `tests/scrape-artificialanalysis.test.js`, real subset fixture | S2a/S2b |
| Patch → catalog | Availability is deep-equal, `providers.json` is unchanged, source tuples dedupe, omission notes are idempotent, and `benchlm` is unchanged. | `tests/scrape-artificialanalysis.test.js`, `tests/data-integrity.test.js`, `tests/availability-matrix.test.js`, `tests/propagate-provider-availability.test.js` | S2a/S2b |
| Catalog → cache/runtime | Schema remains 5; changed `lastSynced`/AA evidence dates invalidate same-schema cache; network failure keeps the previous cache. | `tests/data-loader.test.js`, `tests/data-sync.test.js` | S3b |
| Provider filter → scorer | Returned key and alternatives are members of the passed set; every returned model has finite II. | `tests/model-scorer.test.js`, `tests/config-selector.test.js` | S3a/S3b |
| Scorer → assignments | Normal selection, both fallbacks, and alternatives are II-ordered; null-II models cannot leak through the cost-only fallback. | `tests/model-scorer.test.js`, S2a outcome acceptance | S3a/S3b |
| Ranked projection → table/chart | Both surfaces receive the same active, provider-filtered projection and therefore the same hidden count and date. | new `tests/ii-ranking.test.js`, `tests/ref-table.test.js`, `tests/composite-chart.test.js` | S3b |
| Assignments → CLI/justification/export | Scores are II; 18 rows/cards remain; empty sets render unassigned; ranked markdown contains no II-less row. | `tests/cli-mirror-table.test.js`, `tests/justification-ui.test.js`, `tests/exporter.test.js` | S3b |
| Metadata → badge/note/sync | AA `lastRun` wins over `lastSynced`; both badge and sync use identical UTC age; stale cache remains visible on failure. | `tests/freshness-badge.test.js`, `tests/staleness-parity.test.js`, `tests/data-sync.test.js`, `tests/app-filter.test.js` | S3b |

## 3. II backfill data flow

### 3.1 Safe, sliceable execution

The full authenticated payload is captured once to a private temporary path outside the repository. The API key is loaded into `AA_API_KEY`, is never printed, and is never written into evidence. The full payload is not committed; committed evidence contains only fetch time, item count, relevant slugs, exact II values, and decisions.

S2 uses the existing scraper behavior rather than hand-transcribing scores:

1. Parse `{ data: [...] }` and reject malformed entries before reading the target catalog.
2. Load a version-2 alias document and validate every `{slug, to, effort}` row.
3. Map only curated slugs. Unknown live rows are ignored; missing curated targets are reported and preserved.
4. Validate required pricing fields for each mapped live row.
5. `buildAaPatch` reads only `evaluations.artificial_analysis_intelligence_index` for II.
6. If the raw II is a finite number, copy it verbatim. Storage does not clamp or round; clamping belongs to `compositeScore`.
7. If a covered row has absent or non-finite II, write `intelligenceIndex: null` and add it to the daily omission note. Never write a synthetic zero.
8. Merge `{...existing, ...patch, effort}`. Optional non-nullable AA fields may refresh, but curated and separately owned fields remain intact.
9. Deduplicate the attribution tuple by `(url, date, scraper)` and append `{url: 'https://artificialanalysis.ai/', date, scraper: 'scrape-artificialanalysis'}` when not already present.
10. `documentAbsent` appends `AA sync {date}: omitted ...` at most once per day.
11. The write guard restores existing `availability` exactly and forces new ids to `{}` until the full provider matrix is curated. `data/providers.json` is never written.
12. Before and after each slice, compare `JSON.stringify(model.benchlm)` for every touched id. Any difference blocks the slice. Sister benchmarks may be refreshed only where already owned by the AA scraper; none becomes a ranking input.
13. Write atomically, preserving `schemaVersion: 5`, and record the successful AA observation timestamp in `_meta.scrapers['scrape-artificialanalysis'].lastRun`.

To keep S2a and S2b data-only, use the scraper's existing `--alias` option with temporary version-2 alias projections:

- **S2a projection:** all catalog ids in the `chatgpt-plus` and `anthropic` families, including their effort variants, reference rows, Astra, and Fable.
- **S2b projection:** all remaining curated catalog ∩ live-AA ids.

Each projection is generated outside the worktree from the committed alias table. The scraper is first run against a temporary copy of `models.json`; gates are evaluated on that candidate. Only after the gates pass is the corresponding selected JSON delta materialized in canonical `data/models.json`. This avoids adding a permanent scraper mode solely for a one-time review split.

### 3.2 Coverage and mutation gates

Before S2a, record exactly three disjoint buckets:

```text
II-covered      = Number.isFinite(model.intelligenceIndex)
benchlm-only    = finite model.benchlm.score AND not II-covered
fully-scoreless = neither score is finite
```

The sum must equal the catalog size; `kimik3` must classify as benchlm-only at the pre-backfill gate. Recount after S2a and S2b so reviewers can see coverage movement rather than infer it from a large JSON diff.

Before mutating canonical data for S2a, compute the real maximum over finite-II, active `chatgpt-plus` rows in the temporary candidate. If the maximum id is not `gpt6astra`, stop, record the observed maximum and live evidence, and ask under the existing ask-on-risk policy. Do not write canonical data and do not add scorer or sort exceptions.

### 3.3 Evidence records

S2 maintains two compact review artifacts:

- `openspec/changes/2026-09-14-aa-only-scoring/evidence/aa-live-manifest.md`: fetch timestamp, item count, alias/effort evidence, exact `(model, II, source tuple)` rows, three-bucket counts, duplicate-identity decisions, and the Fable verdict.
- `openspec/changes/2026-09-14-aa-only-scoring/evidence/s2a-role-outcomes.md`: provider scope, strategy, old/new reference identities, cost-ceiling deltas, and the 18-role outcome table.

The raw payload stays outside the repository. Tests parse only the compact manifest rows required to prove exact values and provenance.

## 4. Data shape, metadata, and cache versioning

### 4.1 Stored shape

```js
{
  _meta: {
    lastSynced: 'YYYY-MM-DD',
    nextSync: 'YYYY-MM-DD',
    schemaVersion: 5,
    scrapers: {
      'scrape-artificialanalysis': { lastRun: 'ISO-8601 timestamp' }
    },
    sources: ['scrape-artificialanalysis', /* preserved tags */]
  },
  models: {
    modelId: {
      intelligenceIndex: 42.3, // number|null when AA covered; absent if never covered
      benchlm: { /* retained, separately owned, inert */ },
      availability: { /* curated full boolean map */ },
      sources: [
        { url: 'https://artificialanalysis.ai/', date: 'YYYY-MM-DD', scraper: 'scrape-artificialanalysis' }
      ]
    }
  }
}
```

`schemaVersion` remains **5** because the optional `intelligenceIndex: number|null` field, its source tuple, and the open `scrapers` metadata map already exist in schema 5. Ranking authority is behavior, not a storage-shape migration. `CURRENT_SCHEMA_VERSION` remains 5, `CACHE_KEY` remains `sdd-models-v6`, and `DATA_FILES` remains six.

### 4.2 Same-schema cache invalidation

A schema bump would invalidate compatible data for the wrong reason. Instead, cache freshness uses a source revision:

```text
catalogRevision =
  _meta.lastSynced
  + _meta.scrapers['scrape-artificialanalysis'].lastRun
  + max date among sources[] where scraper == 'scrape-artificialanalysis'
```

`data-loader` retains the raw models metadata as runtime `modelsMeta` and stores `catalogRevision` in the session cache envelope. On boot it revalidates `data/models.json` with `cache: 'no-store'`:

- equal revision → reuse the compatible schema-5 payload;
- newer/different revision or an old cache envelope with no revision → fetch/compose all six files and replace the cache;
- fetch failure → warn and use the existing compatible cache, preserving fail-soft behavior.

The full timestamp in AA `lastRun` distinguishes two successful same-day slices. The per-model AA source date is a fallback/audit grip and proves which numbers belong to the observation. It does not replace the freshness badge's run-level clock.

## 5. Scoring and selection contracts

### 5.1 `compositeScore`

Final implementation:

```js
if (!model || typeof model !== 'object') return null;
const score = model.intelligenceIndex;
if (typeof score !== 'number' || !Number.isFinite(score)) return null;
return clamp(score, 0, 100);
```

The function does not inspect `benchlm` or any sister benchmark. It is pure and leaves the exact stored value untouched.

### 5.2 `findReferenceModel` and `effectiveMaxCost`

Reference selection keeps lifecycle priority but changes its ordering signal:

1. If reference-lifecycle models exist, order that reference set by finite II descending, with null II after finite II and stable input order for a complete null tie.
2. If no reference-lifecycle model exists, choose the highest finite-II model from the passed provider-filtered set.
3. If neither set supplies a usable cost anchor, return `null`; `effectiveMaxCost` becomes zero and the existing unassigned path handles it.

For every role and strategy:

```text
refCost(role) = costEstimate(referenceModel, requestProfile[role])
effectiveMaxCost(role) = adjustedCostRatio(strategy) × refCost(role)
```

The S2a evidence report compares the old benchlm-era and new II-era reference identity for these scopes: all-enabled (the default), `chatgpt-plus`, and `anthropic`. It then records, for all 18 roles, old/new `effectiveMaxCost`, the delta, and every model that crosses the gate.

Two identities must not be conflated:

- The current active ranking maximum is Fable under benchlm; the expected finite-II active maximum is Astra when Fable is absent or below it. In the checked-in catalog both currently have input/output prices `10/50`, so that identity change alone would move **zero** numeric cost gates. Live S2a pricing is authoritative and the report recomputes rather than assuming.
- The all-enabled `findReferenceModel` currently prefers reference-lifecycle `opus48` under benchlm. The new reference is the highest-II reference after S2a, not necessarily Astra. If it changes from `opus48` (`5/25`) to a GPT-5.5 reference (`5/30`), all 18 profiles have positive output tokens, so all 18 role ceilings increase by `costRatio × 5 × outputTokens / 1e6` (half that under `min-cost`). If the reference remains `opus48`, no cost gate moves. The evidence table records the actual branch.

Thus an identity flip always triggers recomputation, but a gate is reported as moved only when its numeric ceiling changes.

### 5.3 Normal eligibility, fallbacks, and alternatives

Define the scorer candidate universe as provider-filtered, active-lifecycle models with finite `compositeScore`.

- Normal eligible: candidate score meets the frozen threshold and cost meets `effectiveMaxCost`.
- Role-designated fallback: the designated model must be in the passed set, active, finite-II, and cost-clearing.
- General fallback: drop only the reasoning threshold; retain active lifecycle, finite II, provider membership, and cost ceiling.
- Alternatives: draw only from the same finite-II eligible or cost-clearing pool and order by II descending, then lower cost.
- Unassigned: return `{key: null, reason, effectiveMaxCost}` when neither normal nor fallback pools contain a model.

The finite-II checks on both fallback paths are required because the current cost-clearing fallback admits null-score active models. Without this correction, a benchlm-only model could still become an assignment after the nominal scorer switch.

## 6. Shared ranked projection, hidden count, and note

Add a small pure service, `js/services/ii-ranking.js`, with three responsibilities:

```js
resolveIiFreshness(modelsMeta)
buildIiRankingContext(providerFilteredModels, modelsMeta)
formatHiddenIiNote(hiddenCount, asOfDate)
```

`buildIiRankingContext` uses this exact universe:

```text
candidate = provider-filtered AND lifecycle == active
ranked    = candidate AND compositeScore(model) != null
hidden    = candidate AND compositeScore(model) == null
```

Reference, legacy, benchmark-only, and provider-ineligible records are not ranked candidates and therefore are not counted as hidden. For the explicit full-catalog export, build a second context over the full-catalog scope; never reuse the filtered count under a different scope.

The exact note is:

```text
{N} models hidden — no Artificial Analysis Intelligence Index on {date}
```

Rules:

- `{date}` is the normalized `YYYY-MM-DD` date from the same freshness resolver used by the badge: AA `lastRun`, then `lastSynced`.
- `N > 0`: render exactly one adjacent note in `ref-table` and one in `composite-chart`; add it as the second header line of ranked markdown exports, preserving the existing providers+timestamp comment as line one.
- `N = 0`: return an empty note and emit no note node, no blank export line, and no permanent explanatory copy.
- `cli-mirror-table` and `justification-ui` do not render this catalog-level note because they preserve all 18 role rows/cards and express loss as `unassigned` instead of hiding roles.
- Assignment markdown likewise keeps 18 role blocks. Only ranked model exports carry the hidden-model header note.

`app.js` computes the filtered ranking context once inside the existing render transaction and passes it to ref-table and composite-chart. Direct component tests may let the component call the same helper as a fallback, but production does not compute independent counts.

## 7. Surface and freshness changes

| Consumer | Final behavior |
|---|---|
| `ref-table.js` | Consume ranked entries only; Score is II; preserve `isNew` bucket pin, II-desc ordering within buckets, lower-input tie-break, effort-only display, and explicit export scopes. Remove the separate broad “Sin-AA” ranked section and all copy implying BenchLM is the score. Benchmark columns/badges may remain informational only where required by the delta, never sort keys. |
| `composite-chart.js` | Render finite-II active bars only; remove unavailable rows; title/legend identify AA II; keep neutral bar color; remove BenchLM verified/reliability cues from the score axis; render the shared note and shared freshness state. |
| `cli-mirror-table.js` | Continue rendering exactly 18 rows. Assigned keys come from finite-II scorer results; null results show `Sin modelo elegible`. Any score added or exported is II. |
| `justification-ui.js` | Score/checks/alternatives consume the scorer result; alternatives are finite-II only and II-desc; preserve 18 cards and critical unassigned state. |
| `exporter.js` and component export builders | Update JSDoc and labels from benchlm/composite to AA II; ranked bodies receive only ranked entries and the shared note; no unranked appendix. Provider/timestamp first-line semantics and full-catalog opt-in remain unchanged. |

### Freshness source

`resolveIiFreshness` chooses `_meta.scrapers['scrape-artificialanalysis'].lastRun` and falls back to `_meta.lastSynced`. This is preferable to `max(sources[].date)` for the badge because:

- `lastRun` represents the latest successful complete AA observation, including a successful no-data-change run;
- `sources[]` is per-number history, so an old retained value or partial family could incorrectly define catalog freshness;
- `lastSynced` provides backward compatibility for existing schema-5 documents before AA-specific metadata exists.

A successful AA run advances `lastRun` only after payload validation, alias loading, at least one valid mapped row, merge construction, and successful write. A no-model-diff run still writes the new run metadata. Fetch, parse, validation, missing-secret, or write failure does not advance it. The badge, composite stale state, forced-refresh decision, and hidden note all consume the same resolver. The `> 7 days` threshold, cached-data warning, and fail-soft ranking behavior do not change.

## 8. Fable live-slug verdict

S2a closes D4 in this order:

1. Load the AA key from the user config into `AA_API_KEY`; never echo it.
2. Fetch the live v2 endpoint once and record only `fetchedAt`, HTTP success, and item count in the manifest.
3. Search the payload with the exact predicate `entry.slug === 'claude-fable-5'`. Also assert there is at most one exact match.
4. Validate that the committed alias maps that slug to `claudeFable5` with explicit `effort: 'max'`.
5. **Present + finite II:** run it through `buildAaPatch`, backfill the exact value, attach the source tuple, and include it in S2a outcome calculations.
6. **Present + absent/non-finite II:** apply the normal covered-row contract (`null` + omission note), keep it hidden, and record the malformed/omitted field as evidence. Do not use benchlm.
7. **Slug absent:** do not synthesize a payload row or a null key. Let `detectMissing` warn and preserve the catalog record; record `absent in live payload at {fetchedAt}` in the manifest. Fable remains hidden.
8. In every branch, compare the `benchlm` block before/after and reject any change. There is no benchlm fallback branch in scorer, UI, or tests.

## 9. Per-role outcome enumeration under frozen thresholds

### 9.1 How outcomes are computed and recorded

The S2a candidate snapshot is the provider-filtered union of `chatgpt-plus` and `anthropic`, with only S2a-backed finite II rows admitted. For each of the five strategies and all 18 roles:

1. Apply the unchanged strategy modifier to `minReasoning` and `costRatio`.
2. Resolve the II reference and recompute `effectiveMaxCost` from the role request profile.
3. Compute normal finite-II candidates.
4. If empty, test role-designated fallback, then general finite-II cost-clearing fallback.
5. Classify the result as `assigned`, `soft:designated`, `soft:cost`, or `unassigned`.
6. Record threshold, reference id, effective cost ceiling, candidate counts, classification, and selected id in `evidence/s2a-role-outcomes.md`.

The acceptance suite recomputes maxima and candidate pools from `models.json` at test time. It asserts invariants and classification, not a hardcoded winner or II value. The evidence table is a review snapshot, not ranking law.

### 9.2 Expected signal from the verified S2a range

The currently verified maximum is Astra at 52.8. If the fresh S2a gate confirms a maximum below 60, these are the expected normal-set outcomes under `balanced`/`tier-based`:

| Role | Frozen minReasoning | Expected normal set before cost filtering |
|---|---:|---|
| gentle-orchestrator | 95 | empty; designated finite-II fallback first, else general fallback/unassigned |
| sdd-init | 60 | empty |
| sdd-explore | 70 | empty |
| sdd-propose | 85 | empty |
| sdd-spec | 80 | empty |
| sdd-design | 88 | empty |
| sdd-tasks | 65 | empty |
| sdd-apply | 75 | empty |
| sdd-verify | 80 | empty |
| sdd-archive | 50 | potentially non-empty; final result depends on the 5% cost ceiling |
| sdd-onboard | 60 | empty |
| jd-judge-a | 90 | empty |
| jd-judge-b | 90 | empty; must remain identical to judge A |
| jd-fix-agent | 80 | empty |
| review-risk | 85 | empty |
| review-readability | 70 | empty |
| review-reliability | 80 | empty |
| review-resilience | 78 | empty |

`max-quality` and `experimental` add 10, so all 18 normal sets are expected empty at that range. `min-cost` keeps the thresholds but tightens every cost ceiling, making fallback/unassigned more likely. Seventeen roles are therefore expected to flip from normal benchlm-era assignments to soft fallback or unassigned; `sdd-archive` is the sole role that can still clear the observed II threshold and may nevertheless flip because of cost.

This churn is an honest signal, not a failure: D2 intentionally preserves thresholds calibrated to another scale. A test failure occurs only if the algorithm invents a score, returns an II-less model, violates cost/provider boundaries, breaks twin-judge equality, or disagrees with the independently computed candidate pools.

## 10. Slice architecture and atomic test flips

### 10.1 Dependency chain and line budgets

```text
S1 aliases
  └─> S2a chatgpt-plus + anthropic II backfill
        ├─ HARD GATE ─> S3a scorer foundation
        └─> S2b remaining II backfill ─> S3a
                                      S3a ─> S3b atomic activation/surfaces
                                                   └─> S4 policy/docs
```

| Slice | Scope | Planned changed lines | Depends on | Exit condition |
|---|---|---:|---|---|
| S1 | Alias data only: explicit live slugs/efforts, duplicate identity closure, alias safety assertions. | 180–300 | proposal/spec | Alias/safety and availability matrix gates green; no model score or runtime change. |
| S2a | Ranking-relevant data only: chatgpt-plus + anthropic families, Fable verdict, source tuples, metadata, bucket and role evidence. | 180–340 | S1 | Astra maximum gate passes; per-role/reference report recorded; benchlm and availability unchanged. **S3 cannot proceed without this.** |
| S2b | Remaining catalog ∩ live AA data only, provenance and omission records. | 160–340 | S2a | Remaining mapped rows reconciled; three-bucket recount and matrix green. |
| S3a | Add the II scoring core and scorer/integrity readiness tests without activating it in production. | 160–260 | S2a and ordered after S2b | II clamp/null/purity/inert-benchlm path and finite-II fallback rules proven; runtime still fully benchlm. |
| S3b | Atomically bind public scorer to II, add shared ranking/freshness context, update five score consumers/exporter, cache/sync wiring, and flip all consumer tests. | 280–390 | S3a | Runtime and all tests are fully II-only; no unavailable ranked rows or BenchLM score copy remains. |
| S4 | Canonical policy/docs: sync the delta, changelog, migration note, scenario removals, operational instructions. | 120–240 | S3b | 3 ADDED + MODIFIED blocks + two scenario removals reflected; archived change untouched. |

Line counts are checked before each slice starts. If any actual slice exceeds 400 changed lines, stop under ask-on-risk and request a further split; never infer `size:exception`.

### 10.2 No half-benchlm/half-II state

Changing `compositeScore` in S3a while leaving current surface labels, unavailable rows, and tests for S3b would create a misleading intermediate runtime. Therefore S3a is a dark preparation slice:

- add a pure `js/services/ii-score.js` function that implements the final finite/clamp/null contract;
- test it from the scorer suite and add a readiness integrity assertion against that module;
- leave public `compositeScore` and all rendered behavior on the old contract.

S3b performs the activation as one review slice: `model-scorer.js` delegates `compositeScore` to the proven II function, removes benchlm ordering references, adds finite-II guards to both fallback paths, and flips every surface/export/freshness consumer and test in the same PR. After S3a the product is consistently benchlm; after S3b it is consistently II. No releasable commit exposes II ordering with BenchLM labels or permits benchlm-era rendering with an II scorer.

### 10.3 Suite ownership by slice

| Slice | Suites added or flipped |
|---|---|
| S1 | `_aa-safety`, `aa-effort`, `data-integrity`, `availability-matrix`, `propagate-provider-availability`: mass aliases, effort vocabulary, no duplicate identity, fail-closed matrix. No scoring assertion flips. |
| S2a | `scrape-artificialanalysis`, `aa-effort`, `data-integrity`, and new readiness/outcome coverage: exact II, source tuple, omission, three buckets, Fable, Astra gate, role/reference report. The Astra gate reads II directly; it does not depend on the still-benchlm public scorer. |
| S2b | Same data/integrity suites for remaining manifest rows and final bucket recount. No scorer or UI assertion flips. |
| S3a | `model-scorer` adds II-core clamp/high/low/null/live-exact/purity/benchlm-inert cases; `data-integrity` adds the dark-path source check. Existing public composite and surface expectations remain green. |
| S3b | `model-scorer` replaces benchlm-clamp and II-inert cases with public II authority and finite-II fallback cases; `data-integrity:740` flips to contains `intelligenceIndex` and not `benchlm`; `ref-table`, `composite-chart`, `cli-mirror-table`, `justification-ui`, `exporter`, `freshness-badge`, `staleness-parity`, `data-loader`, `data-sync`, `app-filter`, and `config-selector` flip atomically. |
| S4 | Spec/document checks only; no behavioral test source changes. Full `pnpm test`, coverage, and build are the final gate. |

Focused commands use pnpm only. CI Node 20 is authoritative; the known Node 24 collection failures remain pre-existing and are documented rather than “fixed” in this change.

## 11. Rollout and rollback

### Rollout

1. Land S1 aliases after live evidence and identity review.
2. Land S2a data only after the three-bucket, Fable, Astra, provenance, availability, benchlm-preservation, reference-cost, and role-outcome gates pass.
3. Land S2b data only and repeat integrity/recount gates.
4. Land S3a dark scorer foundation; it has no user-visible change.
5. Land S3b as the single activation boundary. Smoke-check filtered and full-catalog scopes, all five strategies, 18 CLI rows, 18 justification cards, shared hidden counts, ranked exports, freshness, manual refresh, and cached failure.
6. Land S4 policy/docs and run the full CI/build gate.

### Rollback order

Rollback proceeds **S3 → S2 → S1**; S4 documentation can be reverted first when necessary.

- **S3b:** revert public scorer activation, finite-II fallback guards, shared projection, surfaces/exporter, freshness/cache wiring, and their flipped tests together. This restores a coherent benchlm runtime. Leave S2 II data in place as inert data.
- **S3a:** after S3b is gone, revert the dark II scoring helper and readiness tests. It is safe but unused if temporarily retained.
- **S2b, then S2a:** restore the previous `data/models.json` JSON and restore the matching manifest/integrity expectations. Do not run a compensating scraper. Verify availability, `providers.json`, benchmark blocks, schema 5, and matrix after each restore.
- **S1:** restore the previous `data/aa-aliases.json` and alias/safety test expectations. Confirm unknown slugs remain ignored and known records are preserved.

If S3 reveals ranking collapse or leakage, the preferred emergency rollback is S3b then S3a; do not delete backfilled II and do not invent fallback scores. Data-only slices are rolled back by exact JSON restore plus exact test/evidence restore, not by a reverse migration.

## 12. Risks and mitigations

| Risk | Mitigation / gate |
|---|---|
| Live AA identity or effort ambiguity | Exact slug/display suffix evidence; no alias until effort is proven; duplicate DeepSeek/MiniMax decisions close before backfill. |
| Fable is absent or malformed | Manifest the verdict; hide it; never read its 83.68 benchlm value as fallback. |
| Astra is no longer the live chatgpt-plus II maximum | Evaluate the temporary candidate before mutation; stop and ask, with no scorer exception. |
| Frozen thresholds cause fallback/unassigned walls | Publish the 18-role report and preserve explicit UI empty states; do not rescale. |
| Cost-only fallback leaks II-less models | Require finite II in designated and general fallback pools and alternatives. |
| Reference identity is mistaken for a cost change | Record identity and numeric ceiling separately; Fable/Astra currently share 10/50 pricing, so recomputation may yield zero delta. |
| Same-schema cache masks the backfill | Revalidate a date/timestamp-based catalog revision; old envelopes without a revision are stale; network failure remains fail-soft. |
| Freshness advances on a failed or structurally empty AA run | Advance AA `lastRun` only after a valid mapped observation and successful metadata/data write. |
| Different surfaces compute different hidden counts | Compute one filtered ranking context in `app.js`; use the same helper for explicit full-catalog scope. |
| Broad AA signal is confused with II coverage | Do not use `aa-signal.js` for ranking visibility; finite II is the sole predicate. |
| S3a creates a half-switched product | Keep the II core dark in S3a and activate scorer plus all consumers/tests in S3b. |
| Mechanical JSON or test churn exceeds 400 lines | Pre-count each slice; stop under ask-on-risk and split further, never infer an exception. |
| Local Node 24 noise obscures regressions | Use focused pnpm suites locally and Node 20 CI as the governing full gate. |

---

## SDD result contract

- **status:** design-complete
- **executive_summary:** Backfill exact live AA Intelligence Index values behind explicit aliases, preserve schema 5 and all inert benchmark data, then activate an II-only scorer and every ranked consumer atomically. A shared II ranking context owns finite-II visibility, the deterministic hidden-row note, and the AA freshness date; frozen thresholds deliberately produce visible soft-fallback/unassigned outcomes. Delivery is S1 aliases → S2a ranking-relevant data → S2b remaining data → S3a dark scorer foundation → S3b atomic scorer/surface/freshness cutover → S4 policy/docs, with S3 hard-blocked until S2a and every PR capped at 400 changed lines.
- **artifacts:** [`openspec/changes/2026-09-14-aa-only-scoring/design.md`](openspec/changes/2026-09-14-aa-only-scoring/design.md)
- **next_recommended:** tasks (turn S1–S4 into file-level TDD work units, include the pre-mutation Astra/Fable gates, preserve the S3a-dark/S3b-activation boundary, and attach focused pnpm commands plus rollback checks to every slice)
- **risks:** live AA slug/value drift; frozen-threshold fallback and unassigned storm; II-less leakage through existing cost-only fallback; reference identity changes that may or may not move numeric cost ceilings; same-schema cache staleness; S2/S3 changed-line overruns requiring ask-on-risk splitting
- **skill_resolution:** paths-injected
