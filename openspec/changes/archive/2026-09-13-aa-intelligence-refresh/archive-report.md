# Archive Report — 2026-09-13-aa-intelligence-refresh

## Status

**ARCHIVED — partial delivery, with explicit human override.** The change is archived without re-running verification, re-merging, or committing. The archive is intentionally honest about the remaining human-owned delivery action and the local Node 24 toolchain caveat.

The parent explicitly authorized archiving despite the pending human merge of PRs #72–#78. That exception applies to archive readiness only; it does not claim that the stacked delivery has already landed in `main`.

## Artifacts read

- `proposal.md`
- `specs/model-picker/spec.md`
- `design.md`
- `tasks.md` (re-read immediately before this report was written)
- `apply-progress.md`
- `verify-report.md`
- `sync-report.md`
- `openspec/config.yaml`
- `openspec/specs/model-picker/spec.md`

## Canonical sync

- Domain synced: `model-picker`.
- Sync was already completed; no re-merge was performed.
- Canonical `openspec/specs/model-picker/spec.md` verified at **34 requirements**.
- Canonical result: 4 requirements added, 6 requirements modified in full, and 0 canonical requirement blocks deleted.
- The 5 `REMOVED` entries were delta-level UI removals whose exact requirement headings did not exist canonically; they were retained as migration intent without destructive approximate deletion.
- No active same-domain change collision was found at archive time.

### ADDED requirements

1. `AA Intelligence Index Field`
2. `AA Chart Backfill 2026-09-13 with sources[]`
3. `New Chart Models Fail-Closed with Green Matrix`
4. `UI Component — Model Card (effort-only)`

### MODIFIED requirements

1. `Scoring Service — compositeScore`
2. `Scoring Service — getBestFor (Hybrid Role-Aware Matching)`
3. `Justification UI`
4. `UI Component — Reference Table (pilot)`
5. `UI Component — CLI Mirror Table`
6. `Filtered Export`

### REMOVED delta entries

1. `Tier Column and Header Display`
2. `Tier Badge Elements (.tier-tag, .model-tier-tag, data-tier)`
3. `Soft Fallback Badge (.soft-badge, ~ prefix)`
4. `Soft Summary Banner and Estado Column ([data-test=soft-summary], soft fallback)`
5. `Exporter (tier · score · costo) Fragment`

## Phase and gate resolution

- **Fase 0 — contrato y evidencia:** completada. Delta final 4/6/5; manifest AA trazado.
- **Fase 1 — scraper, fixture y schema 5:** completada. Path live de Intelligence Index confirmado y write-guard documentado.
- **Fase 2 — aliases, backfill y matriz:** completada. Astra `52.8` fue el máximo real de `chatgpt-plus`; entradas y `sources[]` quedaron trazadas.
- **Fase 3 — effort-only y chart neutral:** completada. Las superficies y exports afectados quedaron sin tier/soft, preservando los usos fuera de alcance.
- **Fase 4 — cierre y entrega:** archivada parcialmente bajo el override humano explicitado abajo.

### G1 — Astra / máximo real

**CERRADO.** El conjunto elegible `chatgpt-plus`, ordenado por el scorer intacto, dio Astra (`gpt6astra`) `52.8` como máximo real. No se agregó una rama especial de ranking ni se bajaron candidatos sin evidencia AA.

### G2 — presupuesto de revisión

**DISPARADO Y RESUELTO POR DECISIÓN HUMANA.** PR-A fue dividido como `A1 → A2a → A2b` y PR-B como `B1 → B2 → B3 → B4`; la cadena resultante mantiene cada PR dentro del presupuesto declarado. No se infirió `size:exception`.

### G3 — path de Intelligence Index

**CERRADO.** La captura live autenticada confirmó `evaluations.artificial_analysis_intelligence_index` en 646/646 items y se regeneró la fixture sin inventar valores.

## PR chain and human-owned delivery

Al archivar, según `verify-report.md` y el override del parent, los siete PRs estaban:

| PR | Slice | Estado al archivar |
|---|---|---|
| #72 | A1 | `OPEN / MERGEABLE / CLEAN` |
| #73 | A2a | `OPEN / MERGEABLE / CLEAN` |
| #74 | A2b | `OPEN / MERGEABLE / CLEAN` |
| #75 | B1 | `OPEN / MERGEABLE / CLEAN` |
| #76 | B2 | `OPEN / MERGEABLE / CLEAN` |
| #77 | B3 | `OPEN / MERGEABLE / CLEAN` |
| #78 | B4 | `OPEN / MERGEABLE / CLEAN` |

**Task 4.5 remains human-owned and pending:** the human must merge the stacked chain in GitHub, PR-A before PR-B, with the documented independent rollback boundaries. That pending merge is explicitly **not an archive blocker** for this partial documentation close. No merge or rebase was performed by this phase.

## Verification caveat and risks

- `pnpm test` had exit 1 because three suites fail during collection under local Node 24.20.0 / Vitest 1.6.1: `availability-matrix`, `data-integrity`, and `propagate-provider-availability`.
- The verify report attributes this to the Node 24 versus CI Node 20 toolchain difference; 607/607 collected tests passed, and the focused suites, build, matrix harness, and scorer evidence were green.
- `pnpm test:coverage` carried the same environmental exit condition; isolated scorer line coverage was 96.89% (branch coverage 76.66%, functions 100%).
- `pnpm build` was previously evidenced at 1.58s with a self-contained `dist/index.html` and no external HTTP references.
- The persisted `tasks.md` still contains six unchecked Phase 4 implementation markers (`4.1`–`4.6`). They were not mechanically changed because this archive was instructed to move files and write this report only. Tasks `4.1`–`4.4` have the evidence described in `verify-report.md` / `apply-progress.md`; `4.1` retains the Node 24/CI Node 20 caveat; `4.5` is explicitly human-owned and pending; `4.6` is the archive operation recorded here.
- This is a partial archive, not a claim of a clean CI result or completed GitHub delivery.

## Archived path

`openspec/changes/archive/2026-09-13-aa-intelligence-refresh/`

No commit was created.
