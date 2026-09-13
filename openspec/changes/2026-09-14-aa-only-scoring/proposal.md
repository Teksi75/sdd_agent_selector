# Proposal — 2026-09-14-aa-only-scoring

Date: 2026-09-14 · Phase: proposal · skill_resolution: none
Seed: `openspec/changes/archive/2026-09-13-aa-intelligence-refresh/followup-aa-only-scoring.md` (authoritative problem statement)
Explore: `openspec/changes/2026-09-14-aa-only-scoring/explore.md` (read first, normative input)
Canonical spec: `openspec/specs/model-picker/spec.md` (34 requirements, benchlm-clamp contract — this change explicitly reverts it)
Research: UNSELECTED by confirmed pre-proposal handoff. Evidence = archived follow-up + explore.md + Engram topics `sdd/aa-only-scoring` and `sdd/2026-09-14-aa-only-scoring/preproposal`. No `sdd-research` lane.

> Pre-proposal handoff is user-confirmed. This proposal does NOT re-interview the user and does NOT infer consent beyond the handoff. The four confirmed picks (hide rule, keep thresholds, no staleness contract change, conditional Fable) are recorded as confirmed decisions in §8.

## 1. Problem

The ranking claims to compare models but currently orders by `benchlm.score` (clamped contract synced in the archived change) while the product's trusted external reference is the Artificial Analysis (AA) Intelligence Index (II). The visible symptom (user screenshot 2026-09-13): the ranking shows dozens of rows without data and excludes models that exist in AA — presence without data destroys comparability.

Concretely:

- Catalog `data/models.json`: 88 models, only 8 carry `intelligenceIndex` (all with 2026-09-13 AA `sources[]`); ~58 `benchlm.score` null / ~58 with neither score at explore snapshot (proposal gate must recount three buckets: II-covered / benchlm-only / fully-scoreless — explore §10.5 found `kimik3` is benchlm-scored-but-II-less, so a two-bucket count is wrong).
- Upstream AA live: 646 items, II path `evaluations.artificial_analysis_intelligence_index` present 646/646 (2026-09-13 probe). Alias coverage: `data/aa-aliases.json` v2, ~71 slugs — mapping gap of hundreds of AA items without alias, and ~80 catalog models without II in the reverse direction.
- Ranking distortion: `claudeFable5` (benchlm 83.68, no II, anthropic-only availability) outranks everything globally, covering `gpt6astra` (II 52.8); with the chatgpt-plus filter Astra is first, without it Fable wins — an artifact of the benchlm scale, not of intelligence.
- Zero references to `intelligenceIndex` exist under `js/` (verified by grep in explore): the scorer, all five surfaces (ref-table, composite-chart, cli-mirror, justification-ui, exporter), and the inertness test asserts are all benchlm-wired. Switching the reference therefore touches scorer + surfaces + tests atomically.

## 2. Target users and situations

| User / situation | Moment | Urgency |
|---|---|---|
| Curator comparing models in ref-table / composite-chart | Picks a model for a role, scans Score column or bars | High — a null row rendered as ranked, or Fable on top via a dead scale, directly misleads the pick |
| Operator using cli-mirror / exporter output | Copies the 18-agent assignment or pastes the markdown export into a runbook | High — wrong reference propagates into assignments |
| Reviewer reading justification-ui cards | Checks score/cost/alternatives per agent before approving | Medium — alternatives ordered by the wrong scale erode trust |
| Maintainer running the 5-day AA sync | Sync succeeds, partially covers, or fails; a model gains or loses II | Medium — needs a predictable, no-surprise rule for what the ranking does next |

Out of scope as users: upstream AA itself, provider pricing pages (availability sources stay unchanged).

## 3. Business rules (normative for spec phase)

1. **AA II is the sole ordering input.** `compositeScore(model)` reads only `model.intelligenceIndex`, clamped to `[0,100]`; missing/non-finite → `null` (never 0, never synthesized); pure/deterministic. `benchlm`, `codingIndex`, `mathIndex`, `term`, `arena`, `swePro`, `sweVer` are inert for ordering — kept as data, never deleted.
2. **Never present-without-data.** A row with `intelligenceIndex` null or absent MUST NOT render as a ranked bar/row with a pseudo-score. Confirmed pick: **HIDE from ranking** (see D1).
3. **Explicit effort only.** New alias rows carry `{slug, to, effort}` with effort from the AA display-name suffix (closed vocabulary `max | xhigh | high | medium | low | non-reasoning`); bare slug ≠ max. Never infer effort from pricing, family, or benchlm rank.
4. **Fail-closed catalog growth.** Unknown newcomers land with empty `availability` and `benchmark-only` lifecycle until a provider source is evidenced. `mapAaSlug` ignores uncurated slugs; `detectMissing` WARNs + preserves. No silent duplication.
5. **Per-number provenance.** Every `intelligenceIndex` value carries its own `sources[]` entry `{url: https://artificialanalysis.ai/, date, scraper: scrape-artificialanalysis}`; live-exact payload wins over chart rounding; zero synthesis.
6. **Nullable II contract (unchanged).** Covered model: finite → exact number; absent/non-finite → `null` + idempotent omission note, key never deleted. Uncovered model: key stays absent. Catalog invariant stays finite-or-null, never fabricated 0.
7. **Sync fail-soft (unchanged).** AA sync down → fall back to cached data + console warning + freshness badge shows cached staleness; ranking continues on last II values. No fail-closed hiding of II-ranked views.
8. **Threshold numbers frozen (confirmed).** Numeric `minReasoning` values are unchanged by this change even though their scale meaning shifts (see D2 and §6).
9. **Benchlm-clamp revert is explicit.** The delta chain must record `weighted-sum → benchlm-clamp → II-only` as an explicit MODIFIED requirement, never a silent reinterpretation (non-goal guard for the archived change).

## 4. Product outcome

After this change:

- Every ranked view (ref-table Score column + sort, composite-chart bars + sort + unavailable handling, cli-mirror assigned scores, justification-ui card scores + alternatives ordering, exporter score lines) orders by AA II only. A reader can trust that position N > position M means higher AA Intelligence Index, full stop.
- Rows without II are gone from ranked views, and the UI says exactly how many vanished and why (count/note UX in §5) instead of showing `—` rows that read as ranked.
- `benchlm` and sister benchmarks remain visible as data where they are data, but nothing about ordering, eligibility, reference-model choice, or freshness depends on them.
- The freshness signal tracks the AA II sync, not the benchlm run (retarget note in §6), so "stale" means "II is stale".
- Fable is either a ranked citizen with a real II (mapped + backfilled because live AA lists it) or it is absent from ranked views — never a benchlm-powered ghost at the top. Keeping benchlm as a fallback score is NOT an option.

## 5. Current-state gap

| Area | Today (benchlm-clamp, 34-req canonical) | Gap under AA-only goal |
|---|---|---|
| Scorer `js/services/model-scorer.js:136-143` | `compositeScore` = `benchlm.score` clamped; II inert (zero `js/` references) | Must read `intelligenceIndex` clamped; benchlm → inert; revert is explicit MODIFIED |
| `getBestFor` (~ll.273-430) | Eligible = `score >= minReasoning && cost <= effectiveMaxCost`; thresholds calibrated to benchlm magnitudes (e.g. archive 50, orchestrator 95) | Same flow, new scale meaning; numbers frozen → eligibility collapses where II < benchlm (accepted, absorbed by soft-fallback/unassigned — §6) |
| `findReferenceModel` (ll.183-196) | Highest benchlm score sets `effectiveMaxCost` for all cost-gated roles | Identity flips to highest-II model → every cost ceiling moves even where II values look sane |
| ref-table `js/components/ref-table.js` | Score cell renders `benchlm.score` 1-decimal, null → `—`; sort is composite desc | Score cell + sort swap to II; null-II rows hidden + count/note (not `—` rows) |
| composite-chart `js/components/composite-chart.js` | Bars + scored-desc sort + nulls-last "unavailable" rows; freshness badge tracks `_meta.scrapers.benchlm.lastRun` (7-day threshold) | Bars + sort swap to II; no "unavailable" ranked rows (hidden instead); badge retargets to AA II sync source (spec must name: scraper lastRun vs. per-model `sources[]` max date) |
| cli-mirror / justification-ui / exporter | Assigned/card/export scores read benchlm; exporter JSDoc l.126 carries `benchlm.score` | All swap to II; effort-only, eligible-only, 18/9/5 counts, header providers+timestamp semantics unchanged |
| Scraper `scripts/scrape-artificialanalysis.js` | `FIELD_MAP` single confirmed II path; `NULLABLE_FIELDS = {intelligenceIndex}`; `buildAaPatch` finite-exact / absent→null+note; never writes benchlm/providers | Reused as-is; II backfill must not touch `benchlm` values (mirror discipline of the 2026-09-13 one-shot benchlm curation) |
| Aliases `data/aa-aliases.json` + `scripts/_aa-safety.mjs` | 71 slugs covering GPT-5.x/5.6 ladders, Claude ladders, qwen/kimi/grok/hy3/Fable/Astra/Spark bases | ~20-40 new rows needed (grok46, Astra-Low, opencode stubs once live slugs known); effort-explicit, fail-closed, green matrix gate |
| Tests | `model-scorer` clamp/null/inert-pair suites benchlm-wired; `data-integrity:740` asserts scorer source does NOT contain `intelligenceIndex`; freshness/staleness suites pin benchlm metadata | All flip deliberately and atomically per slice (scorer reads II, assert contains II not benchlm, freshness pins II source) |
| Data | 8 II-covered; ~58 benchlm-null / ~58 neither (snapshot; recount at gate; three buckets, not two) | Backfill ~80 models with per-number `sources[]` before S3 lands, or ranking collapses to near-empty |

## 6. Implications and impact

**Day-one ranking churn (user-visible, needs changelog/note).**
- Fable 83.68 → hidden (unless the live-AA verdict in D4 says it maps + backfills, in which case it re-enters with its real II — never 83.68).
- ~58 fully-scoreless rows leave ranked views until backfilled; benchlm-only high scorers (e.g. `kimik3` benchlm 80.96, II-less) also drop to hidden on the scorer switch. The ranked catalog looks smaller on day one — that is the intended consequence of "never present-without-data", not a bug, but it needs the count/note UX below or users file "where did my model go".
- **Count/note UX (normative):** every surface that hides rows MUST render an explicit, deterministic note adjacent to the ranked content: the count of hidden rows and the reason in one line (e.g. `N models hidden — no Artificial Analysis Intelligence Index on <date>`), using the same count source in ref-table, composite-chart, and ranked exports. The note appears if and only if N > 0; N = 0 renders no note (no permanent dead copy). Exact string is a spec-phase pick; the presence + count + reason + shared-source rule is fixed here. Exporter places the note in the ranked-export header so a pasted export is self-explaining.

**Threshold freeze → empty-eligible-set consequences (accepted collapse risk).**
- Keeping numeric `minReasoning` unchanged while the scale changes from benchlm magnitudes to II magnitudes means roles whose threshold was calibrated high on the benchlm scale (notably orchestrator-class ~95) will find few or zero II values clearing it, because II magnitudes run lower (observed II range ~37-53 for the 8 covered models). Consequences across the 18 agents, in order:
  1. Roles with II-covered candidates below threshold produce empty eligible sets.
  2. Empty sets fall into the existing `getBestFor` soft-fallback chain (#1 role-designated fallback, #2 cost-clearing fallback — both inside the eligible set only, flow otherwise unchanged) or, where no fallback clears, render `unassigned` (`cli-mirror` "Sin modelo elegible", justification-ui empty-state, exporter unassigned line).
  3. Expect a soft-fallback storm and `unassigned` walls on high-threshold roles until and unless a future change recalibrates thresholds — that future recalibration is explicitly OUT of this change (no spec change to thresholds, no role-matrix data change here).
- **Absorption without a spec change:** no new fallback tier, no threshold edit, no "II-adjusted" scaling factor. The existing eligible-only + soft-fallback + unassigned semantics absorb the collapse visibly and honestly: users see fewer assignments and explicit unassigned states rather than silently lowered bars. The spec phase must enumerate, per role, which of the 18 agents go empty/fallback/unassigned under frozen thresholds with the S2a-backfilled II set, so reviewers accept the storm with eyes open.

**Reference-model flip shifting `effectiveMaxCost`.**
- `findReferenceModel` fallback (highest score) changes identity from highest-benchlm to highest-II. Every role's `effectiveMaxCost` (derived from the reference) moves, so cost-gated eligibility shifts even for models whose own II looks sane. Spec must delete/replace (not edit) the two prior-delta scenarios that assumed benchlm maxima (Astra-first-as-data-consequence; `intelligenceIndex`-inert scenario).

**Freshness badge retarget (part of the scorer switch, not a contract change).**
- The badge currently tracks benchlm metadata (`_meta.scrapers.benchlm.lastRun`, 7-day warning; composite-chart stale badge likewise). Under AA-only it MUST track the AA II sync. Spec must name the source (recommended: the `scrape-artificialanalysis` lastRun; alternative: per-model `sources[]` max date) and `staleness-parity` pins whatever is chosen. Behavior (fail-soft to cache + warning + cached-staleness badge) is unchanged — only the tracked source moves.

**Test-churn conflation.**
- The scorer-untouched assert (`data-integrity.test.js:740`), the inert-pair suites, and all surface/freshness suites flip deliberately; a partial flip fails loud. Slices flip them atomically (S3a scorer+tests, S3b surfaces+exporter+freshness).

## 7. Edge cases

1. **II lost after being finite** → `null` + omission note per the unchanged nullable contract; model drops out per the hide rule at the next render/sync. No last-finite-value retention (that would be a contract change — rejected in D3).
2. **AA sync down** → cached II values + warning + badge shows cached staleness; ranking continues. No fail-closed hiding.
3. **Model never covered (key absent vs. null)** → both hidden identically; absent stays absent (no synthesized null), null stays null with note. Count/note UX counts both buckets together.
4. **Live AA lists a catalog model under an unknown slug** → ignored by `mapAaSlug`, WARN + preserve by `detectMissing`; model stays hidden until a curated alias row lands. No silent mapping.
5. **Effort-ambiguous slug** → no alias row until chart/payload evidence fixes effort; bare slug never defaults to max (precedent `gpt-5-5→gpt55` xhigh).
6. **Non-AA models** (e.g. `musespark13contributor`, xhigh, non-AA, no slug) → stay untouched and hidden from ranked views; no slug invented.
7. **Duplicate-identity risk** (DeepSeek `v4f/v4p` vs. `0813/V4.1`; `minimaxm3` same-or-distinct) → resolved at the alias gate before any backfill touches those rows.
8. **Empty eligible set on all 18 agents** → all-unassigned rendering via existing empty states; never an invented score to fill the board.
9. **Exporter with hidden rows** → ranked export contains II-ranked rows only + the shared count/note in the header; no unranked appendix (that would be section-B, rejected in D1).
10. **S2a lands but S3 hasn't** → no visible change (data-only slices); **S3 lands without S2a** → forbidden sequence (ranking collapses to near-empty) — chain gates enforce S2a-before-S3.

## 8. Decision log

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D0 | Research lane UNSELECTED; evidence = archived follow-up + explore.md + Engram `sdd/aa-only-scoring`, `sdd/2026-09-14-aa-only-scoring/preproposal` | **confirmed** (pre-proposal handoff) | Sufficient verified evidence exists; no `sdd-research` lane needed |
| D1 | No-data rows: **HIDE from ranking.** Null/absent-II rows disappear from ref-table, composite-chart, and ranked exports. Explicit count/note UX (§6) covers vanished rows. Section-B "without evaluation" rejected. | **confirmed** (pre-proposal handoff) | Ranking stays clean and comparable; smallest UI delta (reuse eligible-set + empty-state machinery); never present-without-data in all options, hide is the cheapest honest one |
| D2 | Thresholds: **KEEP numeric `minReasoning` unchanged** (cheapest path; collapse risk accepted). No spec change to thresholds, no role-matrix data change, no rescaling factor. Empty sets absorbed by existing soft-fallback/unassigned semantics (§6). | **confirmed** (pre-proposal handoff) | Avoids the bigger blast radius of recalibration (spec + role-matrix data change); storm is visible and honest rather than silently re-barred |
| D3 | Staleness: **NO contract change.** Keep nullable contract (II lost → null + omission note, model drops out per D1) and fail-soft sync (cached data + warning + freshness badge). Badge retargets from benchlm metadata to the AA II sync as part of the scorer switch (§6). Last-finite-value and fail-closed options rejected. | **confirmed** (pre-proposal handoff) | Current contract already supports AA-only; changing it would add badge design + expiry rules + empty states for no product gain now |
| D4 | Fable (`claudeFable5`, benchlm 83.68, no II): **CONDITIONAL** — if live AA lists it, map + backfill and it stays ranked with its real II; if not, hidden under D1. Benchlm-as-fallback-score is NOT an option. | **confirmed** (pre-proposal handoff) | Only live AA can settle presence; either branch is consistent with D1; fallback scoring would violate the AA-only definition |
| D5 | `benchlm` + all other benchmarks (`codingIndex`, `mathIndex`, `term`, `arena`, `swePro`, `sweVer`) become **inert for ordering; kept as data, not deleted** | confirmed via handoff scope (inert-not-deleted) | Preserves history and non-ranking uses; deletes would orphan surfaces/tests that still read them as data |
| D6 | Delta records **`weighted-sum → benchlm-clamp → II-only`** as an EXPLICIT MODIFIED requirement on the scoring contract | required by handoff non-goals clause | The benchlm-clamp text was itself the revert of the weighted sum; silent reinterpretation would corrupt the delta chain and the archived change |
| D7 | Delivery: ask-on-risk, 400-line budget per PR, stacked-to-main; slice plan S1 → S2a/S2b (split before starting, never inferred `size:exception`) → S3a → S3b → S4; **S3 must not land before ranking-relevant backfill S2a** | confirmed via handoff delivery clause | S2 is the only intrinsic overrun risk (mechanical JSON lines); S3-before-S2a collapses the ranking to near-empty |

## 9. First-slice scope boundaries (S1; the rest is sequenced, not scoped away)

**S1 — Alias mapping (data-only, ≈150-250 lines, fits one PR).**
- In: `data/aa-aliases.json` (+~20-40 rows for grok46, Astra-Low, opencode stubs once live slugs are known) + `aa-effort` / `data-integrity` / `_aa-safety` asserts; explicit `{slug, to, effort}` + chart/payload evidence per row; fail-closed availability; green matrix gate (availability-matrix + propagate-provider-availability green; 18/9/5 counts intact).
- Out (later slices, not this PR): any `models.json` II value, any scorer/surface/test score-source change, any freshness rewiring.
- Gate: live AA capture with key from env only (never print/log/commit); DeepSeek/minimax identity checks closed before backfill touches those rows.

**S2a / S2b — II backfill (data-only, ≈300-600 lines total → pre-split, each ≈150-300).**
- S2a (ranking-relevant first): chatgpt-plus + anthropic families incl. Fable verdict branch (present → map+backfill; absent → omission note path closed with no value written).
- S2b (rest): remaining catalog ∩ live-AA rows.
- Per number: live-exact value + `sources[]` {AA url, date, scraper}; absent → null + omission note; uncovered → key absent; never touch `benchlm`; matrix stays green per slice.
- Gate S2a: recount of the three buckets (II-covered / benchlm-only / fully-scoreless) + recorded real maximum (ask-on-risk gate: if real maximum is not Astra, stop, record follow-up, do not mutate).

**S3a — Scorer switch + scorer/integrity tests (≈150-250 of the ≈300-450 S3 total).**
- `model-scorer.js` (~10 lines: `compositeScore` reads II clamped; `getBestFor` flow unchanged; reference-model flip acknowledged) + `model-scorer` clamp/null/inert-pair suite flips + `data-integrity:740` flip (contains II, not benchlm). Includes the explicit benchlm-clamp→II-only MODIFIED requirement text.

**S3b — Surfaces + exporter + freshness retarget.**
- ref-table / composite-chart / cli-mirror / justification-ui / exporter score-source swaps (1-3 lines each + comments) + surface suites with II fixtures (null-II → hidden, not `—`/unavailable) + freshness-badge + staleness-parity suites pointed at the II source + D1 count/note UX in all three ranked surfaces/exports.

**S4 — Policy + docs (≈150-250 lines).**
- Spec delta (Scoring, `getBestFor`, surfaces, Data Layer Models, Sync + Testing — all MODIFIED with revert note; prior-delta Astra-first and inert-II scenarios deleted/replaced), changelog entry for day-one churn, docs for hide rule + frozen thresholds + fail-soft. Near-zero code unless the count/note needs consolidation.

## 10. Non-goals

- Do NOT touch the archived change (`2026-09-13-aa-intelligence-refresh`), PRs #72-#78, any branch, or the dirty worktree (human-owned; rebase/sequencing is the parent's call).
- Do NOT recalibrate `minReasoning`, add fallback tiers, rescale II, or retain last-finite II values.
- Do NOT build a "without evaluation" section, unranked appendix, or benchlm-fallback score.
- Do NOT delete `benchlm` or sister benchmark data; do NOT write `benchlm` from the AA scraper; do NOT write `providers.json` from the merge.
- Do NOT change sync cadence/ownership (5-day AA stays), provider availability sources, effort vocabulary, or the 18/9/5 surface counts.
- Do NOT infer `size:exception` — any slice exceeding 400 lines splits further with explicit acceptance.

## 11. Product constraints

- **pnpm only** (all slices, all scripts, all CI).
- **AA key env-only** — read from `%USERPROFILE%/.config/sdd-agent-selector/aa_api_key` into env; never print, log, or commit. Live captures record timestamp + II values + slugs, never the key.
- **CI Node 20 governs** — 3 suites fail collection under local Node 24 (pre-existing); local red on those suites under Node 24 is not a gate failure, CI is.
- **400-line budget per PR**, stacked-to-main, ask-on-risk gates: (a) S2a real maximum is not Astra → stop/record follow-up/do not mutate; (b) any slice exceeds 400 → split further, never exception without explicit `size:exception` acceptance; (c) S3-before-S2a sequencing violation → hold S3.

## 12. Tradeoffs

| Choice | What we gain | What we pay |
|---|---|---|
| Hide (D1) over section-B | Clean comparable ranking; smallest UI delta; no "reads-as-ranked" misread | Catalog looks smaller day one (~58 rows out); "where did my model go" needs the count/note; Fable vanishing may surprise |
| Frozen thresholds (D2) over recalibration | Cheapest path; no role-matrix data change; honest visible storm instead of silent re-barring | Empty eligible sets + soft-fallback storm + unassigned walls on high-threshold roles until a future recalibration change |
| No staleness contract change (D3) | Reuses proven nullable + fail-soft machinery; no new badge/expiry design | II-lost models vanish rather than linger with a staleness badge; cached-II ranking continues while stale (badge is the only signal) |
| Conditional Fable (D4) over deciding now | Grounded in live AA truth, not speculation | Fable verdict blocks S2a closure for that row; proposal gate must run the live-slug search |
| Inert-not-deleted (D5) | History preserved; smaller diff; no orphaned data readers | Readers may wonder why benchlm data sits next to an II ranking (docs must say: datum, not signal) |
| Pre-split S2a/S2b over one backfill PR | Stays in budget; ranking-relevant rows land first so S3 is safe | Two review passes over mechanical JSON; manifest/notes must stay consistent across halves |

## 13. Rollback plan

- **S1/S2a/S2b (data-only):** revert the slice PR; aliases and II values are additive/overlay (merge preserves availability, never writes providers/benchlm), so revert restores prior JSON + asserts. Matrix gate re-verified on revert.
- **S3a (scorer):** revert to benchlm-clamp restores today's canonical contract; the explicit MODIFIED text makes the forward and reverse deltas unambiguous. Surface suites revert with it (atomic flip per slice — no half-benchlm/half-II state ships).
- **S3b (surfaces):** revert restores benchlm cells + benchlm freshness source; count/note UX reverts with the surfaces that carry it.
- **Worst case (S3 landed, backfill incomplete):** hold-forward is forbidden from inventing scores; rollback is revert S3b then S3a (ranking returns to benchlm-clamp, II data stays inert in the catalog for the next attempt). No data migration to undo because no values are deleted or overwritten across scales — II and benchlm occupy distinct keys.
- **Trigger:** S2a gate trip (real max not Astra), S3-before-S2a sequence break, or any slice that cannot split under 400 without `size:exception` acceptance.

---

## SDD result contract

- **status:** proposal-complete
- **executive_summary:** Switch ranking to AA Intelligence Index only: hide II-less rows with an explicit count/note, freeze minReasoning numbers (soft-fallback/unassigned absorbs the collapse), keep the nullable + fail-soft staleness contract while retargeting the freshness badge to the AA II sync, resolve Fable conditionally on live AA, and ship as S1 aliases → S2a/S2b backfill → S3a scorer → S3b surfaces → S4 policy+docs with S3 gated on S2a and the benchlm-clamp→II-only revert recorded explicitly.
- **artifacts:** [`openspec/changes/2026-09-14-aa-only-scoring/proposal.md`](openspec/changes/2026-09-14-aa-only-scoring/proposal.md)
- **next_recommended:** spec (Scoring + getBestFor + surfaces + Data Layer Models + Sync/Testing MODIFIED deltas with weighted-sum → benchlm-clamp → II-only chain; three-bucket recount; per-role empty/fallback/unassigned table under frozen thresholds; freshness source pick; Fable live verdict; S1→S2a/S2b→S3a/S3b→S4 slice plan)
- **risks:** day-one churn (Fable 83.68→hidden, ~58 rows out until backfilled); threshold-scale mismatch → soft-fallback storm / unassigned walls across the 18 agents; reference-model flip shifting every effectiveMaxCost; S2 budget overrun without pre-split; stack collision with PRs #72–#78 and the dirty worktree (do not touch — parent owns sequencing)
- **skill_resolution:** none
