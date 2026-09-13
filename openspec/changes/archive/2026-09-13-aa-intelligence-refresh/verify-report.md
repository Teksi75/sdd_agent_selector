# Verify report — 2026-09-13-aa-intelligence-refresh

Fecha: 2026-09-13 · Fase: verify (read-only, compilado por parent desde reporte inline de `sdd-verify`; cero modificaciones de código) · skill_resolution: none
Veredicto: **needs-fixes → entrega parcial**: implementación y specs verificados; `pnpm test` nominal exit 1 solo por toolchain local (Node 24 vs CI Node 20); merge de PRs en manos del humano.

## Evidencia de comandos

- `pnpm test` → Test Files 3 failed (collection) | 42 passed (45); Tests **607 passed (607)**; exit 1. Fallas solo al colectar: `availability-matrix`, `data-integrity`, `propagate-provider-availability` (`SyntaxError Invalid or unexpected token` en `node:vm`, bajo Node v24.20.0 + vitest 1.6.1). Pre-existente y probado: `git show HEAD:tests/data-integrity.test.js` como suite temporal falla IDÉNTICO; CI fija Node 20.
- `pnpm build` → rc=0, `dist/index.html` 122911 bytes, 0 xrefs http externas. Autocontenido OK, <30s.
- Foco: 12 suites (aa-effort, effort-tag, model-scorer, twin-judge, model-card, hero-stats, workflow-table, cli-mirror-table, config-selector, ref-table, justification-ui, composite-chart) → **223/223**; scraper 4 suites → **84/84**.
- `pnpm test:coverage` → mismo exit 1 ambiental; aislado `js/services/model-scorer.js` 96.89% lines / 76.66% branches / 100% funcs (≥80% OK).
- Leak scan → solo nombre de env `AA_API_KEY`, cero valores en repo.
- Out-of-scope intacto → workflow-table y pricing-chart conservan tier; `index.html` glossary intacto (non-goal); tokens tier/soft huérfanos eliminados.

## Cobertura del delta (4 ADDED / 6 MODIFIED / 5 REMOVED, 44 escenarios)

- ADDED AA Intelligence Index Field → `scrape-artificialanalysis.test.js` VERDE.
- ADDED Backfill sources[] → `aa-effort` + `data-integrity` (verde en slice; `data-integrity` no colecta en Node24, evidencia slice + harness 1:1).
- ADDED Fail-Closed + matriz → suites + harness directo (0 celdas faltantes, propagate up to date).
- ADDED Model Card effort-only → `model-card` 20/20 VERDE.
- MODIFIED compositeScore / getBestFor+G1 / justification / ref-table / cli-mirror / exporter → suites VERDE (G1: Astra 52.8 > Sol 47.1 > Terra 42.3 > 39 > 38.6 > 37.5).
- REMOVED x5 → asserts de ausencia VERDE (p2-polish/v2-polish 49/49, composite-chart 21/21 neutral).

## Gates

- G3 CERRADO (path live `evaluations.artificial_analysis_intelligence_index`, 646/646; fixture live 2026-09-13).
- G1 CERRADO (máximo real test-time, Astra 52.8 primera chatgpt-plus; 53→52.8/50.7/48.2 documentado).
- G2 DISPARADO y RESUELTO por humano: PR-A = A1→A2a→A2b, PR-B = B1→B2→B3→B4 (todos ≤400). PRs #72–#78 OPEN/MERGEABLE/CLEAN, merge en manos del humano.

## No-regresiones

twin-judge 7/7; cli-mirror 18 filas; justification 18 cards; workflow 9 filas; config 5 botones; hero-stats `X de Y visibles`. Strict TDD OK (RED/GREEN/TRIANGULATE/REFACTOR por slice, sin tautologías).

## Blockers de archive al emitir

4.5 merge stacked #72–#78 (humano, en GitHub); 4.1 plena sujeta a CI Node 20. Resto de 4.x con evidencia arriba.
