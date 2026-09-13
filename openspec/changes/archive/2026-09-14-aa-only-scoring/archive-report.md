# Archive Report — 2026-09-14-aa-only-scoring (FINAL, closed)

Date closed: 2026-09-14 · Store: openspec · Mode: worker-fallback archive
(live `sdd-archive` role assumed stalled like its siblings; parent-authorized fallback).
No code/test/data changes in this slice. No network. pnpm only (no commands
needed beyond read-only checks).

Source of every value below: the archived artifacts themselves
(`verify-report.md` Rev 2, `sync-report.md`, `apply-progress.md` S1→S3e,
`tasks.md`, `evidence/operator-notes-day-one-churn.md`) plus read-only
`git log --oneline` / branch confirmation. Nothing is invented; where the
artifacts are silent, this report says so.

## 1. What was archived

Entire live change dir `openspec/changes/2026-09-14-aa-only-scoring/` copied
verbatim to `openspec/changes/archive/2026-09-14-aa-only-scoring/`,
preserving structure (11 files, `diff -r` identical at copy time):

- `explore.md`, `proposal.md`, `design.md`
- `specs/model-picker/spec.md` (delta spec)
- `tasks.md` (all tasks `[x]`)
- `apply-progress.md` (S1 → S2a → S2b → S3a → S3b → S4 → S3c → S3d → S3e)
- `verify-report.md` (Rev 2 PASS)
- `sync-report.md`
- `evidence/aa-live-manifest.md`, `evidence/s2a-role-outcomes.md`,
  `evidence/operator-notes-day-one-churn.md`

This `archive-report.md` is the single added file (12 files total in archive).

## 2. Commit chain per slice (SHAs confirmed via `git log --oneline`)

All SHAs below were observed in the local repo log on 2026-09-14, in this
bottom-up order (oldest → newest), each also confirmed on its slice branch:

| Slice | Commits | Observed subject |
|---|---|---|
| S1 aliases | `db06727` + `a9a3c7f` + `0240152` + `cc1cab2` | feat(aa-aliases) S1 mass-mapping; docs(s1) S1 verify verdict (PASS); docs(change) SDD artifacts; docs(proposal) qualify II-monotonicity trust claim (JD-A-001) |
| S2a-1 chatgpt-plus | `bf0164d` | feat(aa) S2a-1 chatgpt-plus II backfill (22 new II, live-exact + sources) |
| S2a-2 anthropic | `406b2da` | feat(aa) S2a-2 anthropic II backfill incl. Fable 49.7 + acceptance (14 new II) |
| S2b remainder | `29c71b0` | feat(aa) S2b remaining II backfill (29 new II, pending emptied, buckets 73/0/15) |
| S3a dark | `22ee76c` | feat(aa) S3a dark II scoring foundation, no activation (ii-score + readiness) |
| S3b activation | `7643bf3` | feat(aa) S3b atomic II-only activation (scorer+surfaces+freshness, size:exception) |
| S4 docs | `c0a53fd` | docs(aa) S4 policy sync notes + progress (spec stays worktree-only, size:ok) |
| S3c alignment | `33b061c` | feat(aa) S3c suite alignment — remove Sin-AA sections, inject finite II in regressed suites |
| S3d verify fixes | `c6262bd` | fix(aa) S3d verify remediation — wiring pin, ref-table contract, note gaps, loader envelope (size:exception) |
| S3e export fix | `c521910` + `32f5817` | fix(aa) S3e filtered export mirrors visible ranked set (10 cols, no Lifecycle, no reference rows); docs(verify) whole-change verification report Rev 2 PASS |
| Sync | `5526393` + `603c7a6` | docs(spec) sync canonical model-picker spec — prior benchlm-clamp sync + AA-only II delta (size:exception); docs(sync) sync report with re-attestation gate on sync tip (667/667, build PASS) |

Branch confirmation (all present locally): `feat/aa-only-s1-aliases`,
`feat/aa-only-s2a1-chatgpt`, `feat/aa-only-s2a2-anthropic`,
`feat/aa-only-s2b-remainder`, `feat/aa-only-s3a-dark`,
`feat/aa-only-s3b-activation`, `feat/aa-only-s3c-suite-alignment`,
`feat/aa-only-s3d-verify-fixes`, `feat/aa-only-s3e-export-fix`,
`feat/aa-only-s4-docs`, `feat/aa-only-sync-canonical` (current HEAD `603c7a6`).

## 3. PRs (on-record only — remote numbers/bases not verified locally)

The artifacts name the slice chain as 6 stacked PRs (tasks.md + apply-progress):
PR 1/6 S1 → PR 2/6 S2a → PR 3/6 S2b → PR 4/6 S3a → PR 5/6 S3b → PR 6/6 S4,
plus follow-ups S3c/S3d/S3e and the canonical sync. `sync-report.md` states
the sync branch `feat/aa-only-sync-canonical` is stacked on #88, and names the
merge sequence as human-owned bottom-up #72 → #89 with CI green as the merge
gate. Per-PR remote numbers #79→#89 with bases are **not recorded in the
change artifacts and were not verified here** (no network in this slice);
the parent owns that mapping.

## 4. Verify Rev 2 — PASS (from `verify-report.md`)

- **Verdict: PASS.** Rev 1 FAIL's single blocker (F2 filtered export carried a
  `Lifecycle` column + reference rows) was remediated in S3e (`c521910`,
  scope-conditional `buildExportPayload`: filtered scope projects `rankedActive`
  with the 10 DOM-contract columns; full-catalog 6-column projection unchanged;
  stale pinning test replaced by two contract tests, zero expects weakened).
- Rev 2 evidence (parent-observed on tip `c521910`): full `pnpm test`
  **667/667 passed** (43 files; 3 pre-existing collection failures only —
  `availability-matrix`, `data-integrity`, `propagate-provider-availability`,
  vitest-1.6.1 vs `.mjs` import, identical pre/post, CI governs); focused
  `ref-table + aa-signal + composite-chart + exporter` **86/86**; DOM/export
  probe **11/11**; S3e commit 3 files, 79+/8− = 87 lines (≤300 rescope cap).
- Slices confirmed: S1 74 alias rows fail-closed; S2a/S2b 73/0/15 buckets,
  Astra top chatgpt-plus 52.8, Fable ranked 49.7; S3a/S3b scorer delegates to
  `ii-score.js` with finite-II guards, hidden-not-dimmed surfaces, ranked
  exports with shared note, freshness on AA lastRun; S3c suites green;
  S3d wiring pin + DOM rebuild + empty-state note + loader envelope + TDD table.
- Reservations carried forward: (1) 3 suites don't collect locally, CI Node 20
  authoritative; (2) one transient single-test flake, never reproduced;
  (3) S3d prose says `≤300` but measures 522 (accepted exception, prose stale);
  (4) `ii-score.js` retains stale S3a DARK commentary (docs debt);
  (5) no normative II values hardcoded (52.8/49.7/44.9 are data examples only).
- CI Node 20 checklist still open (required before merge): 3 suites collect +
  full green + build green + S3b focused command + DOM/export probe re-run.

## 5. Sync scope (from `sync-report.md`)

- Sync tip `5526393` on `feat/aa-only-sync-canonical` (stacked on #88).
- Single-file commit of `openspec/specs/model-picker/spec.md` (871+/106−):
  prior archived change's benchlm-clamp sync (uncommitted dirt, preserved
  verbatim) + this change's AA-only delta (3 ADDED + 13 MODIFIED with the
  `weighted-sum → benchlm-clamp → II-only` chain + 2 REMOVED records).
  Coherence audit: 39 requirement headers, zero duplicates, no dead scenarios
  outside REMOVED. No code, test, or data changes in this slice.
- Re-attestation gate re-run on the sync tip (spec prose only; no test reads
  spec/evidence markdown): full `pnpm test` 43 passed / 3 failed-to-collect,
  **667/667**; `pnpm build` PASS (esbuild 4/4); buckets 73/0/15 unchanged.

## 6. Budget ledger per slice (in-budget vs accepted exceptions)

| Slice | Lines (stated) | Disposition |
|---|---|---|
| S1 | 490 (`db06727`: 472+/18− observed) | in-budget (PR-1 forecast 180–300 review + required SDD evidence) |
| S2a attempt (unsplit) | 942 | **budget trip — NOT committed**; pre-split into S2a-1/S2a-2, never inferred `size:exception` |
| S2a-1 | 425 (`bf0164d`: 419+/27− observed) | in-budget path after split |
| S2a-2 | (`406b2da`: 511+/65− observed) | stacked PR per pre-split plan |
| S2b | 371 review | in-budget (≤400, no split needed) |
| S3a | ~195 | in-budget (forecast 160–260) |
| S3b | ~673 (`7643bf3`: 560+/153− observed) | **accepted `size:exception`** (atomic cutover; split would ship a hybrid runtime) |
| S3c | 344 (184+/160−) | in-budget (≤400, no exception) |
| S3d | 522 (`c6262bd`: 311+/211− observed) | **accepted `size:exception`** (prose still says ≤300 — stale, see open threads) |
| S3e | 87 (`c521910`: 79+/8− observed) | in-budget (≤300 rescope cap, no exception) |
| Sync | 871+/106− spec + 43 report | **`size:exception`** (canonical two-change sync; docs-only) |

## 7. Judgment Day

**APPROVED.** Finding JD-A-001 (II-monotonicity trust claim) fixed in
`cc1cab2` (proposal claim qualified to bucket scope) and verified; the 5
WARNINGs stand as design-neutralized (informational). Recorded in
`apply-progress.md` S1-verify and the commit chain above.

## 8. Worktree-only / canonical two-sync note

`openspec/specs/model-picker/spec.md` carries **two changes' syncs** (the prior
benchlm-clamp sync + this AA-only delta) and stayed **worktree-only** through
S4 by parent order (committed only in the sync slice `5526393` on the sync
branch). Pre-existing dirt (`.atl/*`, `.gitignore`, `.pi/`, prior archive
dirs) was preserved verbatim out of every commit. Merge sequencing is
human-owned.

## 9. Open threads (owned elsewhere, not blockers for this close)

1. **CI Node 20 checklist** (verify-report.md §CI checklist) — required before merge.
2. **Merges bottom-up human-owned** (#72 → #89) with CI green as the gate.
3. **`data-sync.js` envelope without `catalogRevision`** (safe full refetch; follow-up, not a blocker).
4. **Stale S3d prose** (`≤300` vs measured 522) — accepted exception resolves delivery; prose fix optional.
5. **DARK comments in `ii-score.js`** — non-executable docs debt.
6. **Transient flake watch** — one single-test flake seen once, never reproduced.

## 10. Rollback map per slice

Order for the whole change: **S3b → S3a → S2b → S2a → S1** (S4 docs may be
reverted first when needed; from `evidence/operator-notes-day-one-churn.md` §6):

- **S3b:** revert activation + finite-II guards + `ii-ranking` + surfaces /
  exporter + freshness/cache wiring **and** their flipped tests together in one
  commit; product returns to a coherent benchlm runtime. Never delete
  backfilled II; never invent fallback scores.
- **S3a:** after S3b is gone, delete `js/services/ii-score.js` + readiness tests (unused).
- **S2b, then S2a:** exact JSON restore of `data/models.json` to the slice base
  + evidence restore; re-verify availability deep-equal, `providers.json`
  byte-identical, `benchlm` byte-identical, schema 5, matrix green. Never run a
  compensating/reverse scraper.
- **S1:** restore previous `data/aa-aliases.json`; unknown slugs ignored again.

## 11. Parity proof (this archive slice)

- Live file count: **11**; archive file count after copy, before this report: **11**.
- `diff -r` live vs archive at copy time: **identical** (zero differences).
- This report is the only added file (archive total now **12**).
- `git status --short` after this slice shows **only** pre-existing dirt plus the
  new untracked archive dir (see handoff git state). Nothing else modified.
