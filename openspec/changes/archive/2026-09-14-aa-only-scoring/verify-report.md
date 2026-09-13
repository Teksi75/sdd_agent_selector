# Verification Report — 2026-09-14-aa-only-scoring

Revision 2 — PASS (S3e `c521910` remediated the Revision 1 blocker; re-verified below).

Verified tip (Rev 1): `c6262bd5c582c98edd4324bd66f497425d0db288`
Re-verified tip (Rev 2): `c521910` — chain `7643bf3 → c0a53fd → 33b061c → c6262bd → c521910`
Local runtime: Node `v24.20.0`, Vitest `v1.6.1`, pnpm `9.0.0`
Mode: fallback verification (sdd-verify role infra-blocked: package-local-binary-missing;
same scope, parent-adjudicated; read-only, no repo mutation by the verifier).

## Verdict

**PASS**

Revision 2: the single Revision 1 blocker (F2-export) was remediated in S3e
and re-verified green — see “Revision 2 Addendum” at the end of this file.
The original FAIL record is preserved below for audit.

Superseded FAIL verdict (Revision 1):

**FAIL**

One blocking defect remains from F2: the ref-table DOM satisfies the ranked projection
and 10-column contract, but its filtered markdown export still includes a `Lifecycle`
column/value and reference rows. This contradicts the requirement that the default
export reproduce the visible ranked set.

Blocking evidence:

- `js/components/ref-table.js:172` adds `lifecycleOf(m)` to each export row.
- `js/components/ref-table.js:187` declares the `Lifecycle` header.
- `order.groupedRows` includes ranked non-active/reference rows.
- `tests/ref-table.test.js:689-692` explicitly expects the stale Lifecycle column.
- Direct probe observed `hasLifecycle: true`, `hasReference: true`.

DOM portion of F2 is correct (active finite-II only, exact 10 columns, no Tier,
no lifecycle/BenchLM cells, no Con-AA/Sin-AA sections).

## Gates

| Gate | Command | Observed result |
|---|---|---|
| Unified tip | `git rev-parse HEAD` | `c6262bd5c582c98edd4324bd66f497425d0db288` |
| Full tests | `pnpm test` | **43 passed / 3 failed-to-collect files (46); 666/666 collected tests passed**. Only the known `availability-matrix`, `data-integrity`, `propagate-provider-availability` collection failures remain (pre-existing vitest-1.6.1 vs `.mjs` import; identical pre/post change; CI Node 20 governs). |
| Build | `pnpm build` | **PASS** — esbuild 4/4; `dist/index.html` + `dist/data/` generated. |
| S3b focused | full 14-suite focused command | **13 passed / 1 failed-to-collect files; 258/258 collected tests passed**. |
| Data-integrity mirror | Standalone Node mirror | **PASS** — II wiring, 73/0/15 buckets, Astra 52.8, Fable 49.7, preservation, DATA_FILES 6, 18/9/5 counts. |
| Availability mirror | Standalone Node mirror | **PASS** — 88 models × 10 providers, zero missing cells. |
| Propagation mirror | Standalone Node pure-function mirror | **PASS**. CLI side-effect case not mirrored (verifier prohibited file writes). |
| DOM/export probe | Standalone jsdom probe | DOM **PASS**; export **FAIL** (Lifecycle + reference rows). |
| Buckets / preservation | Node probe vs `7674ae6` | **73/0/15 = 88**; 0 BenchLM diffs, 0 availability diffs, providers blob unchanged, 0 minReasoning diffs, schema 5. |
| Hidden-note equality | jsdom probe | Identical across ref-table, composite-chart, filtered export. |
| Worktree identity | `git status` before/after | Identical pre-existing dirt; no mutation by the verifier. |

## Prior Finding Resolution (first verify FAIL → S3d)

| Finding | Status at this revision |
|---|---|
| F1 — stale dark assert | **Verified** — old no-importer assertion gone; exactly one production importer (`model-scorer.js`). |
| F2 — ref-table contract | **Partially open** — DOM correct; filtered export still Lifecycle-bearing with reference rows (the blocker above). |
| F3 — all-hidden empty-state note | **Verified** — N>0 renders note; N=0 does not. Full-catalog export carries no note per the adjudicated spec reading. |
| F4 — catalogRevision envelope | **Verified** — store + compare wired (reuse/refetch/fail-soft); 24/24 loader tests. |
| F5 — S3b TDD table | **Verified** — reconstructed with honest provenance label. |

## Slice Confirmation

- **S1** — 74 alias rows; fail-closed mapping; unknown slugs unmapped.
- **S2a/S2b** — 73/0/15 buckets; every finite II with AA source tuple; Astra top chatgpt-plus (52.8); Fable ranked (49.7).
- **S3a/S3b** — scorer delegates to `ii-score.js`; finite-II guards on pool + fallbacks + alternatives; hidden-not-dimmed surfaces; ranked exports with shared note; freshness on AA lastRun.
- **S3c** — aa-signal/lifecycle/provider-filter/twin-judge green (5/5, 32/32, 3/3, 7/7); Sin-AA sections removed.
- **S3d** — wiring pin, ref-table DOM rebuild, empty-state note, loader envelope, TDD table (522 lines, accepted exception).
- **S4** — operator notes (D1/D2/D3/D5 + rollback order); canonical spec layered worktree-only (commit owned by sync phase).
- **JD-A-001** — proposal claim remains bucket-scoped; 5 WARNINGs stand as design-neutralized (informational).

## TDD and Assertion Quality

- No added tautologies or mock-heavy assertions found. One semantic assertion defect remains: `tests/ref-table.test.js:689-692` pins the forbidden Lifecycle export column (fixed in the S3e remediation).
- S3b TDD evidence reconstructed with provenance limitation; S3c/S3d carry task-level RED→GREEN records.
- Coverage not executed (outside authorized command set); no lint/typecheck scripts declared.

## Reservations

1. Three suites do not collect locally (pre-existing); CI Node 20 is authoritative — checklist below.
2. One transient single-test flake seen once across many runs, never reproduced.
3. S3d prose says `≤300` but measures 522 (accepted exception resolves delivery; prose stale).
4. `ii-score.js` retains stale S3a DARK commentary (non-executable docs debt).
5. No normative II values hardcoded anywhere (52.8/49.7/44.9 appear as data examples only).

## Required Remediation (done in S3e — see Revision 2)

Remove Lifecycle from ref-table export rows/headers, restrict the filtered/default
export to the visible active finite-II rows, replace the stale test expectation.

## CI Node 20 Checklist (still open — required before merge)

1. The 3 non-collecting suites collect and execute.
2. Full `pnpm test` all green.
3. `pnpm build` green.
4. Re-run S3b focused command + DOM/export probe.

---

## Revision 2 Addendum — PASS (2026-09-14, tip `c521910`)

S3e remediated the single Revision 1 blocker with strict TDD (RED named the
6-col Lifecycle header + reference row; GREEN 34/34; TRIANGULATE ref-exclusion
md+JSON, note N=0/N=1, full-catalog unchanged; no REFACTOR needed):

- `buildExportPayload` is now scope-conditional — filtered scope projects
  `rankedActive` with the 10 DOM contract columns (no Lifecycle/Tier, no
  reference rows); full-catalog keeps its existing 6-column projection.
- Stale pinning test replaced by two contract tests (zero expects weakened).
- New files: none beyond the S3e commit (2 pure functions in ref-table).

Re-verification evidence (parent-observed on tip `c521910`):

- Full `pnpm test`: **667/667 passed** (43 files; 3 pre-existing collection
  failures only, identical pre/post, CI governs).
- Focused `ref-table + aa-signal + composite-chart + exporter`: **86/86**.
- DOM/export probe pattern re-run by the worker: **11/11** (filtered 10-col,
  no Lifecycle, no ref/II-less rows, note iff N>0 both ways, full-catalog
  unchanged).
- S3e commit `c521910`: 3 files, 79+/8− = 87 lines (≤300 rescope cap, no
exception needed).

Prior FAIL verdict is therefore **lifted**. Reservations carried forward:
CI Node 20 checklist above (unchanged — still required before merge),
transient-flake watch, stale S3d `≤300` prose, DARK comments in ii-score.js.
**Next SDD action: sync** (canonical-spec commit decision), then archive.
