# Operator notes — AA-only scoring day-one churn (S4, change 2026-09-14-aa-only-scoring)

Date: 2026-09-14 · Slice: S4 (docs-only) · Depends on: S3b activation landed.
Scope: what an operator sees on day one after the II-only cutover, and what to do about it.
Nothing in this note changes behavior; for the executable contract see
`openspec/specs/model-picker/spec.md` (canonical sync, worktree-only) and
`openspec/changes/2026-09-14-aa-only-scoring/specs/model-picker/spec.md` (delta).

## 1. Day-one churn (expected, not a bug)

- Final coverage buckets after S2b: **73 II-covered / 0 benchlm-only / 15 fully-scoreless = 88**
  (see `evidence/aa-live-manifest.md`). The 15 II-less rows drop out of every ranked
  view at the cutover; ranked views show the 73 II-covered rows only.
- **Fable (`claudeFable5`) ranks on its real II of 49.7** (S2a live-slug verdict:
  present + finite → backfill exact value + source tuple). It is ordered by that II
  like any covered model — never by its old 83.68 benchlm value (illustrative of the
  old distortion, not a normative value).
- Assignments under frozen thresholds collapse visibly: most of the 18 roles resolve
  via soft fallback or `unassigned` (S2a outcome report enumerates all 18 roles × 5
  strategies in `evidence/s2a-role-outcomes.md`). A board full of fallbacks on day one
  is the honest signal of D2 — do not "fix" it by rescaling thresholds or inventing scores.

## 2. D1 hide rule + shared count/note (the only visibility mechanism)

- Rule: provider-filtered AND lifecycle-active AND finite `compositeScore` (II) → ranked;
  null-or-absent II → hidden from ranking, assignments, alternatives, and ranked exports.
  Never substitute `benchlm`, another benchmark, or zero. Non-candidates (reference,
  legacy, provider-ineligible) are never counted as hidden.
- Every surface that hides rows renders the deterministic shared note iff N > 0:
  `{N} models hidden — no Artificial Analysis Intelligence Index on {date}`
  where `{date}` is the AA II sync date from the freshness resolver
  (AA `lastRun`, fallback `lastSynced`). N = 0 renders no note, no blank line, no copy.
- The count source is shared across ref-table, composite-chart, and ranked exports;
  full-catalog scope builds its own context — never reuse the filtered count.
- `cli-mirror-table` (18 rows) and `justification-ui` (18 cards) keep all rows/cards and
  express loss as `unassigned` (`Sin modelo elegible`, critical warning) instead of hiding.

## 3. D2 frozen thresholds (soft-fallback/unassigned storm is expected)

- All numeric `minReasoning` values are unchanged. The score scale meaning shifts from
  benchlm magnitudes to II magnitudes, so eligibility collapse under frozen thresholds is
  absorbed by the existing soft-fallback + `unassigned` semantics. No new fallback tier
  was introduced, and no ranking branch, re-sort, or scorer tweak may be added to force
  a winner.
- Twin-judge equality (`jd-judge-a` === `jd-judge-b`) still holds, including mutual
  `unassigned`.

## 4. D3 fail-soft + staleness contract (unchanged, only the tracked source moved)

- 7-day threshold, cached-data warning, and fail-soft ranking behavior are unchanged.
  Freshness now tracks the AA II sync (`_meta.scrapers['scrape-artificialanalysis'].lastRun`,
  fallback `_meta.lastSynced`); per-model `sources[]` dates are audit trail only.
- Sync-down fails soft to cached II values + warning + cached-staleness badge — ranked
  views are never hidden fail-closed.
- An II value lost after being finite becomes `null` + idempotent omission note and drops
  out of ranked views at the next render/sync. Last-finite-value retention is rejected.

## 5. D5 benchlm inert-datum-not-signal

- `benchlm` (and `codingIndex`, `mathIndex`, `arena`, `swePro`, `sweVer`, `term`) are kept
  as inert data and MUST NOT be deleted. The AA merge leaves every `benchlm` block
  byte-identical. No scorer, surface, exporter, freshness check, or test reads them for
  ordering. If a number looks stale in a benchlm column, that is correct: it is a datum,
  not a signal.

## 6. Rollback order (whole change)

**S3b → S3a → S2b → S2a → S1.** S4 docs may be reverted first when needed.

- **S3b:** revert activation + finite-II guards + `ii-ranking` + surfaces/exporter +
  freshness/cache wiring **and** their flipped tests together in one commit; product
  returns to a coherent benchlm runtime. Never delete backfilled II; never invent
  fallback scores.
- **S3a:** after S3b is gone, delete `js/services/ii-score.js` + readiness tests (unused).
- **S2b, then S2a:** exact JSON restore of `data/models.json` to the slice base + evidence
  restore; re-verify availability deep-equal, `providers.json` byte-identical, `benchlm`
  byte-identical, schema 5, matrix green. Never run a compensating/reverse scraper.
- **S1:** restore previous `data/aa-aliases.json`; unknown slugs ignored again.

## 7. Repo docs-convention check (read-only, S4 task 6.2)

- `docs/` contains only `legacy/` — no operator-docs convention to follow.
- No `CHANGELOG*` at repo root. Per the S4 slice boundary, no file was written outside
  `openspec/changes/2026-09-14-aa-only-scoring/evidence/`; the convention gap is named
  here for the parent, not filled.
