# Sync Report — 2026-09-14-aa-only-scoring

Sync tip: `5526393` (branch `feat/aa-only-sync-canonical`, stacked on #88).
Local runtime: Node `v24.20.0`, Vitest `v1.6.1`, pnpm `9.0.0`.

## Scope

Single-file commit of `openspec/specs/model-picker/spec.md` (871+/106−):
the prior archived change's benchlm-clamp sync (uncommitted dirt, preserved
verbatim) plus this change's AA-only delta (3 ADDED + 13 MODIFIED with the
`weighted-sum → benchlm-clamp → II-only` chain + 2 REMOVED records).
Coherence audit: 39 requirement headers, zero duplicates, dead scenarios
absent outside REMOVED. No code, test, or data changes in this slice.

## Re-attestation gate on the sync tip (distinct verification evidence)

The sync tip adds only spec prose and prior committed docs/reports on top of
the S3e-verified tree (no test reads spec/evidence markdown — proven); the
gate was re-run here to bind fresh evidence to this exact tree:

- Full `pnpm test`: **43 passed files / 3 failed-to-collect (46);
  667/667 collected tests passed**. Only the known pre-existing collection
  failures (`availability-matrix`, `data-integrity`,
  `propagate-provider-availability` — vitest-1.6.1 vs `.mjs` import,
  identical pre/post change; CI Node 20 governs).
- `pnpm build`: **PASS** — esbuild 4/4; `dist/index.html` + `dist/data/`.
- Buckets on tip: 73/0/15 = 88 (unchanged — no data touched).

## Outstanding (owned elsewhere)

- CI Node 20 checklist (verify-report.md): collection of the 3 suites +
  full green + build — required before merge; open.
- Pre-existing dirt still out of every commit: `.atl/*`, `.gitignore`
  (other stack's scope), `.pi/` (local-only, never commit), archive dirs
  (prior changes, human-owned).
- `data-sync.js` envelope without `catalogRevision` (safe full refetch,
  follow-up, not a blocker).

## Next

Archive the change (copy change dir to `openspec/changes/archive/`,
stack-neutral docs move; no code). Then the merge sequence is human-owned
(bottom-up #72 → #89) with CI green as the merge gate.
