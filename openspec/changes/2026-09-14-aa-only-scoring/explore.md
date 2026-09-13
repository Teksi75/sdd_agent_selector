# Explore — 2026-09-14-aa-only-scoring

Date: 2026-09-14 · Phase: explore (read-only, no implementation) · skill_resolution: none

Seed: `openspec/changes/archive/2026-09-13-aa-intelligence-refresh/followup-aa-only-scoring.md` (authoritative problem statement).
Canonical spec: `openspec/specs/model-picker/spec.md` (34 requirements).
Prior delta (closed, do NOT reopen): `openspec/changes/archive/2026-09-13-aa-intelligence-refresh/specs/model-picker/spec.md` (4 ADDED / 6 MODIFIED / 5 REMOVED, benchlm-clamp scorer contract).
Prior explore (format reference): `openspec/changes/archive/2026-09-13-aa-intelligence-refresh/explore.md`.

## 1. Objective restated

Replace the ranking reference with **ONLY the AA Intelligence Index**. `compositeScore` reads `model.intelligenceIndex` (clamped, null fail-soft); every other benchmark (`benchlm`, `codingIndex`, `mathIndex`, `term`, `arena`, `swePro`, `sweVer`) becomes inert for ordering. Scope includes:

- (a) Mass alias mapping covering catalog ∩ live AA (646 items) with explicit effort, never inferred; new entries fail-closed + green matrix gate.
- (b) `intelligenceIndex` backfill with per-number `sources[]` {AA url, date, scraper}; live-exact wins over chart rounding; zero synthesis.
- (c) Scorer switch — explicitly REVERTS the just-synced benchlm-clamp contract (requires explicit MODIFIED) — plus re-verification of ref-table, composite-chart, cli-mirror, justification-ui, exporter.
- (d) Rule for rows without data: hide from ranking vs. separate "unevaluated" section — never present-without-data. Fable case gets an explicit decision.
- (e) Fail-soft / staleness rule when the AA sync is down or a model loses its II.

Constraints: pnpm only; AA key at `%USERPROFILE%/.config/sdd-agent-selector/aa_api_key` (env only in memory, forbidden to print/commit); CI Node 20 governs (3 suites fail to collect under local Node 24, pre-existing). Delivery: ask-on-risk, 400-line budget per PR, stacked-to-main chain. No git/branch/PR/worktree actions in this phase.

## 2. Current scorer contract + files/lines

**Contract (executable today):** `compositeScore(model)` = `model.benchlm.score` clamped to `[0,100]`; missing/non-finite → `null` (never 0, never synthesized); pure/deterministic. `intelligenceIndex`, `arena`, `swePro`, `sweVer`, `term`, `codingIndex`, `mathIndex` are inert. Verified by grep: **zero** references to `intelligenceIndex` anywhere under `js/` — the field exists in data only.

| Piece | File | Lines / anchors |
|---|---|---|
| Scorer | `js/services/model-scorer.js` | `compositeScore` ll.136–143 (`model.benchlm?.score` + clamp); `getBestFor` ll.273–~430 (eligible = `score >= minReasoning && cost <= effectiveMaxCost`; soft fallbacks #1 role-designated, #2 cost-clearing); `findReferenceModel` ll.183–196; `lifecycleOf`/`isActive` ll.71–109 |
| Ref-table | `js/components/ref-table.js` | import l.25; sort `rowsFor` ll.125–143 (`compositeScore` desc, input tie-break, isNew pin); row score cell l.202/l.310 (`benchlm.score` 1-decimal, null → `—`) |
| Composite-chart | `js/components/composite-chart.js` | import l.33; score l.106; scored-desc sort + nulls-last "unavailable" rows; BenchLM freshness badge (`_meta.scrapers.benchlm.lastRun`, 7-day threshold) |
| CLI mirror | `js/components/cli-mirror-table.js` | `render(targetEl, agentsAssignments, agentRoles)` ll.1–40 contract; assigned cell = model name + at most effort tag; null → "Sin modelo elegible" |
| Justification UI | `js/components/justification-ui.js` | `render(targetEl, agentsAssignments, roleMatrix, models)`; per-card score/cost/checks/alternatives; effort-only, no tier/soft |
| Exporter | `js/services/exporter.js` | `agentsMarkdown` + `markdownTable` + `exportHeader`; assignments JSDoc l.126 carries `benchlm.score`; body is tier-free, score+cost remain |
| AA scraper | `scripts/scrape-artificialanalysis.js` | `FIELD_MAP` ll.77–92 (single confirmed II path `evaluations.artificial_analysis_intelligence_index`); `NULLABLE_FIELDS = {intelligenceIndex}`; `buildAaPatch` (finite exact, absent → `null` + omission note); merge preserves `availability`, never writes `benchlm`/`providers.json` |
| Alias safety | `scripts/_aa-safety.mjs` | `loadAaAliases` / `mapAaSlug` (uncurated slugs ignored) / `detectMissing` (WARN + preserve) |
| Inertness tests | `tests/model-scorer.test.js:765+`, `tests/data-integrity.test.js:740` (`expect(source).not.toContain('intelligenceIndex')`), `tests/aa-effort.test.js:321+`, `tests/data-integrity.test.js:685+` | These asserts **flip** under this change — tracked in §6 |

## 3. Catalog ∩ AA gap analysis

Verified data state (parent preflight, spot-checked in this explore):

- `data/models.json` shape `{_meta, models:{...}}`: **88 models**; `_meta.lastSynced 2026-09-10`, `schemaVersion 5`. **8 carry `intelligenceIndex`** (all with 2026-09-13 AA `sources[]`): `gpt55` 38.6 (reference lifecycle), `gpt56terra` 42.3, `gpt56luna` 37.5, `gpt56sol` 47.1, `gpt6astra` 52.8, `gpt54` 39, `claudeOpus5` 50.7, `musespark13` 48.2 (benchmark-only). **58 `benchlm.score` null / 58 with neither score** per preflight snapshot (counts drift with curation; proposal must recount at gate).
- `data/aa-aliases.json` shape `{_meta, aliases:[...]}` (`_meta.version 2`, ~71 slugs): covers all GPT-5.x/5.6 effort ladders, Claude Sonnet/Opus ladders, plus `qwen3-8-max→qwen38max`, `kimi-k3→kimik3`, `grok-4-5→grok45`, `hy3→opencodeHy3`, `claude-fable-5→claudeFable5`, `gpt-6-astra→gpt6astra`, `muse-spark-1-3→musespark13`.
- Upstream AA live: **646 items**, II path present 646/646 (2026-09-13 probe). Mapping gap ≈ hundreds of AA items without alias — but the binding constraint is the reverse: **~80 catalog models without II**.

Families (grouped for the proposal):

- **Alias-covered, II-missing (backfill-only, no alias work):** `qwen38max` (alias exists; `benchlm null`, no II — pricing/scrape fields present, e.g. `term`/`codingIndex` from 08-17 sync); all GPT-5.5/5.6 effort variants except the max bases (e.g. `gpt55Medium`, `gpt56terraXhigh`, `gpt56lunaXhigh`, `gpt56solXhigh` — aliases exist, II only on bases); all Claude Sonnet 5 / Opus 5 effort variants except `claudeOpus5` max (aliases exist for high/xhigh/medium/low/non-reasoning + `haiku45Reasoning`); `kimik3` max (alias exists; `benchlm` 80.96 but **no II** — note: follow-up lists it among scoreless rows; strictly it is II-less, not scoreless; proposal recount must classify benchlm-only vs. fully-scoreless separately); `grok45`, `opencodeHy3`, `gpt54Low`/`gpt54NonReasoning` (aliases exist).
- **No alias (needs slug discovery + curation before any backfill):** `grok46` (only `grok-4-5` mapped; `benchlm null`, stub notes, no II); `gpt6astraLow` (only base `gpt-6-astra` mapped); `musespark13contributor` (xhigh, non-AA, no slug — must stay untouched); opencode-prices stubs (`omenalpha`, `longcat20`, `hy4preview`, DeepSeek peak/off-peak/vision variants, `glm53flash`/`qwen38flash` if distinct slugs) — need live-slug lookup.
- **Fable case (explicit decision, §7):** `claudeFable5` — alias `claude-fable-5→claudeFable5` (max) exists; `benchlm.score` **83.68** verified, `codingIndex` 76.5, availability anthropic-only; **no `intelligenceIndex` key at all**. Today it outranks everything globally (`gpt6astra` 52.8). Under AA-only it scores `null`. Options are product decisions (map + backfill if AA lists it, vs. null/unavailable vs. separate section) — but "stays on top via benchlm" is off the table by definition of this change.

## 4. Alias-mapping strategy

- **Explicit effort only.** Effort comes from the AA display-name suffix (authoritative), closed vocabulary `max | xhigh | high | medium | low | non-reasoning`; bare slug ≠ max (precedent: `gpt-5-5→gpt55` is xhigh, `gpt-5-4→gpt54` is xhigh). New alias rows need `{slug, to, effort}` + chart/payload evidence. Never infer effort from pricing tier, model family, or benchlm rank.
- **Fail-closed creation.** Unknown newcomers land with `availability: {}` (or explicit false where no `sourceOfTruth` exists) and `lifecycle: benchmark-only` until a provider source is evidenced (precedent: `musespark13`). `mapAaSlug` ignores uncurated slugs; `detectMissing` WARNs + preserves. No silent duplication (DeepSeek `v4f/v4p` vs. `0813/V4.1` reconciliation and `minimaxm3` same-or-distinct check carry over as alias-gate items).
- **Green matrix gate.** `availability-matrix.test.js` + `propagate-provider-availability.test.js` must stay green: full `families × providers` boolean matrix, exact-id overrides flagged, `DATA_FILES` count intact, cli-mirror 18 rows / workflow 9 rows / 5 config buttons / hero-stats `"X de Y visibles"`.
- **Alias slice is data-only** (`data/aa-aliases.json` + tests `aa-effort`, `data-integrity`, `_aa-safety`); no scorer or UI code changes.

## 5. Backfill strategy

- **Per-number `sources[]`.** Every `intelligenceIndex` value carries its own `{url: https://artificialanalysis.ai/, date, scraper: scrape-artificialanalysis}` entry (dedup by url+date+scraper). No number enters on chart rumor alone — screenshot-legible row or live v2 payload required.
- **Live-exact precedence.** Stored value = exact live payload, not chart rounding. Precedents: 53→52.8 (Astra), 48→48.2 (Spark), 51→50.7 (Opus 5). The scraper already implements this (`buildAaPatch` copies finite verbatim, no clamp/normalization; `term` ×100 is the only scaled field and does not apply to II).
- **Nullable contract (already in scraper, reuse as-is).** Covered model: finite → exact number; absent/non-finite → `null` + omission note in `notes` (idempotent per day), key never deleted. Uncovered model: key stays absent (no synthesized null). Catalog-wide invariant stays finite-or-null, never fabricated 0 (`aa-effort.test.js:328`, `data-integrity.test.js:716` remain valid).
- **Read-modify-write.** Merge overlays only AA-owned fields + local `blended` + `pricingSource`; preserves curated `availability`; never writes `data/providers.json`; never consults `pricingSource` for availability. `benchlm` stays untouched by the scraper (the 2026-09-13 benchlm backfill was a one-shot manual curation, not scraper-owned — same discipline applies in reverse: the II backfill must not touch `benchlm` values).

## 6. Scorer-switch impact (explicit MODIFIED)

This change **reverts the just-synced benchlm-clamp contract** — the delta must say so explicitly (no silent reinterpretation):

- **Spec — Scoring `compositeScore` (MODIFIED, revert note).** New authority: only score input is `model.intelligenceIndex`, clamped `[0,100]`; missing/non-finite → `null`; pure. `benchlm`, `arena`, `swePro`, `sweVer`, `term`, `codingIndex`, `mathIndex` inert. Previously: benchlm-clamp (this text was itself the revert of the weighted sum — the delta chain must record both).
- **Spec — `getBestFor` (MODIFIED).** Flow unchanged (role lookup → strategy → `effectiveMaxCost` → filter `score >= minReasoning` → highest wins; pre-filtered callers; soft fallbacks inside eligible set only), but the **score scale changes meaning**: `minReasoning` thresholds were calibrated against benchlm magnitudes (e.g. archive 50, orchestrator 95). Proposal must decide: keep numeric thresholds (cheapest path, but eligibility collapses where II < benchlm) vs. recalibrate (spec + role-matrix data change, bigger blast radius). Either way the Astra-first-as-data-consequence scenario and the `intelligenceIndex`-inert scenario from the prior delta are **deleted/replaced**, not edited.
- **Spec — surfaces (MODIFIED, display source swap).** ref-table Score column + sort, composite-chart bars + sort + unavailable rows + freshness badge source (`_meta.scrapers.benchlm.lastRun` → AA II freshness — decide whether the badge tracks the AA scraper run or a new II timestamp), cli-mirror assigned scores, justification-ui card scores + alternatives ordering, exporter score lines. Effort-only, eligible-only, 18/9/5 counts, header providers+timestamp semantics: unchanged.
- **Spec — Data Layer Models (MODIFIED).** `intelligenceIndex: number | null` becomes the ranking field; `sources[]` shape gains the scraper evidence requirement; `benchlm` becomes inert datum (kept, not deleted).
- **Spec — Sync + Testing (MODIFIED).** Sync cadence/ownership stays (5-day AA), but freshness/staleness assertions and the scorer test contract flip (see tests below).
- **Tests that must change:** `model-scorer.test.js` (clamp + null + inert-pair suites swap benchlm→II, plus new benchlm-inert suite); `data-integrity.test.js:740` (assert `compositeScore` source **contains** `intelligenceIndex` and **not** `benchlm`); `aa-effort`/`data-integrity` II suites stay; ref-table / composite-chart / cli-mirror / justification-ui / exporter suites swap score fixtures to II (null-II fixtures render `—`/`unavailable`); `freshness-badge` + `staleness-parity` suites point at the II freshness source; `scrape-artificialanalysis.test.js` + fixture already cover II (no change expected unless FIELD_MAP drifts).

## 7. No-data-rows options (no recommendation imposed)

Hard rule (from seed, non-negotiable in any option): **never present-without-data** — a row with `intelligenceIndex: null` (or key absent) MUST NOT render as a ranked bar/row with a pseudo-score.

- **Option A — Hide from ranking.** Null-II models disappear from ref-table / composite-chart / ranked exports (still exist in catalog, still selectable via provider filter for pricing views if those stay price-driven). Pros: ranking stays clean and comparable; smallest UI delta (reuse eligible-set + empty-state machinery). Cons: catalog looks smaller (58+ rows vanish on day one); Fable vanishes globally, which may surprise users; "where did my model go" needs an explicit count/note.
- **Option B — Separate "without evaluation" section.** Ranked section (II-finite only, score-desc) + trailing unranked section (null-II, clearly labelled, no bars/scores, e.g. alphabetical or input-price order). Pros: presence without distortion; Fable stays visible but unranked; easier migration narrative. Cons: new section contract in 2–3 surfaces + exporter (ranked vs. unranked blocks); sort/label/empty-state rules to specify; risk of users reading the second section as ranked anyway.
- **Fable sub-decision (required regardless):** (i) AA lists Fable → map + backfill, stays ranked; (ii) AA does not list it → null/unavailable (hide or section B per the chosen option). "Keep benchlm 83.68 as fallback score" is **not** an option under AA-only. Proposal owns the product pick; explore records only the tradeoff.

## 8. Staleness / fail-soft options

- **Sync-down behavior (options):** (i) fail-soft to cached data + warning (current `data-sync` contract: fallback to cache, console warning, freshness badge shows cached staleness) — ranking continues on last II values; (ii) fail-closed (hide II-ranked views until sync recovers) — maximal correctness, maximal disruption. Current contract is (i); changing to (ii) is a contract change needing spec + UI empty-states.
- **II-lost behavior (options, contract-sensitive):** (i) `null` + omission note (current nullable contract; model drops out of ranking per §7); (ii) last-finite-value with staleness badge (ranking continuity, but reintroduces stale-data-as-score — needs explicit spec change, badge design, and expiry rule). Explore does not pick; proposal must, because (ii) changes the scorer contract's null rule.
- **Freshness signal:** `freshness-badge` (>7d warning) and composite-chart stale badge currently track benchlm metadata; under AA-only they must track the AA II sync (decide: `scrape-artificialanalysis` lastRun vs. per-model `sources[]` max date). `staleness-parity.test.js` pins whatever is chosen.

## 9. Size estimate vs 400-line budget + slice proposal

Estimates in changed lines (code + tests + JSON deltas; JSON backfill lines are mechanical but count):

- **S1 — Alias mapping (≈150–250 lines).** `aa-aliases.json` (+~20–40 rows for grok46, Astra-Low, opencode stubs once slugs are known) + `aa-effort`/`data-integrity`/`_aa-safety` asserts. Fits one PR.
- **S2 — II backfill (≈300–600 lines, the overrun risk).** N models × (~4-line `intelligenceIndex` + `sources[]` + notes) + manifest/omission notes. If N ≈ 80 it exceeds budget alone → split S2a (chatgpt-plus + anthropic families, ranking-relevant) / S2b (rest). Each half ≈ 150–300 lines. All fail-closed + matrix green per slice.
- **S3 — Scorer switch + surfaces + tests (≈300–450 lines).** `model-scorer.js` (~10 lines) + 5 surfaces (score-source swaps, mostly 1–3 lines each + comments) + test flips (the bulk: scorer/integrity/ref-table/chart/cli/justification/exporter/freshness suites). Likely needs S3a (scorer + tests) / S3b (surfaces + exporter + freshness) to stay ≤400.
- **S4 — No-data rule + staleness + spec delta (≈150–250 lines).** Section-B UI if chosen (else near-zero code) + freshness wiring + `proposal.md`/`spec.md` delta + docs. Fits one PR.

Proposed chain (stacked-to-main, each ≤400, each green): **S1 aliases → S2a/S2b backfill → S3a scorer → S3b surfaces → S4 policy+docs**. S1/S2 are data-only and independent of S3 code; S3 must not land before the ranking-relevant backfill (S2a) or the ranking will collapse to near-empty — sequence the chain accordingly. Ask-on-risk gates: (a) S2a real maximum is not Astra (stop, record follow-up, do not mutate); (b) any slice exceeds 400 (split further, never exception without explicit `size:exception` acceptance).

## 10. Evidence gaps (live AA capture needed)

1. **Fresh live capture** of `api/v2/data/llms/models` with II values for every catalog key in §3 (exact numbers + fetch timestamp); confirms the II path hasn't drifted and yields slugs for `grok46`, `gpt6astraLow`, opencode stubs, and any 646-item newcomers worth aliasing. Key handling: `AA_API_KEY` from `%USERPROFILE%/.config/sdd-agent-selector/aa_api_key`, env only — never print, log, or commit.
2. **Chart-legible values + date** for any row the live payload doesn't cover (screenshot suffices as `sources[]` date evidence; live-exact still wins on conflict).
3. **Fable verdict:** live-slug search for `claude-fable-5` II value (present → backfill; absent → explicit null decision per §7).
4. **Scale comparability note:** II vs. benchlm magnitudes for threshold calibration (proposal input to the `minReasoning` keep-vs-recalibrate decision in §6).
5. **Recount at proposal gate:** exact counts of II-covered / benchlm-only / fully-scoreless (this explore spotted one classification nuance — `kimik3` is benchlm-scored but II-less — so the proposal must tabulate three buckets, not two).

## 11. Risks

- **Ranking churn on day one:** global top flips (Fable 83.68 and any benchlm-only high scorer drop to null); ~58 fully-scoreless rows leave the ranking until backfilled — user-visible discontinuity needs a changelog/note.
- **Threshold mismatch:** `minReasoning` calibrated to benchlm scale may yield empty eligible sets under II scale → soft-fallback storm or `unassigned` walls across the 18 agents; the keep-vs-recalibrate decision is the highest-leverage proposal call.
- **Reference-model flip:** `findReferenceModel` fallback (highest score) changes identity, shifting every `effectiveMaxCost` — cost-gated eligibility moves even where II values look sane.
- **Test-churn conflation:** the scorer-untouched assert (`data-integrity.test.js:740`) and inert-pair suites must flip deliberately; a partial flip (scorer reads II but a test still asserts benchlm) fails loud — good, but the PR must flip them atomically per slice.
- **Backfill budget:** S2 is the only slice with intrinsic overrun pressure (mechanical JSON lines); pre-split into S2a/S2b before starting.
- **Stack collision:** branch `feat/aa-b4-effort-chart-tokens` (stack A1→B4, PRs #72–#78 OPEN/MERGEABLE/CLEAN) is human-owned — this change must not touch branches, PRs, or the dirty worktree; rebase/sequencing is the parent's call at proposal time.

---

## SDD result contract

- **status:** explore-complete
- **executive_summary:** AA-only ranking is feasible with the existing nullable-II scraper contract, but it reverts the just-synced benchlm-clamp scorer, needs ~20–40 new aliases plus an ~80-model II backfill (split to respect the 400-line budget), flips the scorer/surface/test score source in 5 surfaces, and forces explicit product decisions on no-data rows (hide vs. separate section, Fable included) and on staleness (null+note vs. last-finite). Threshold-scale mismatch (`minReasoning` vs. II magnitudes) is the top proposal risk.
- **artifacts:** [`openspec/changes/2026-09-14-aa-only-scoring/explore.md`](openspec/changes/2026-09-14-aa-only-scoring/explore.md)
- **next_recommended:** proposal (with recount of the three score buckets, the keep-vs-recalibrate threshold decision, the hide-vs-section product pick, the Fable verdict, and the S1→S2a/S2b→S3a/S3b→S4 slice plan)
- **risks:** ranking churn (Fable 83.68→null, ~58 rows out until backfilled); empty eligible sets from threshold-scale mismatch; reference-model flip shifting all cost ceilings; S2 budget overrun without pre-split; stack collision with PRs #72–#78 (do not touch)
- **skill_resolution:** none
