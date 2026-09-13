# Sync Report — 2026-09-13-aa-intelligence-refresh

Fecha: 2026-09-13 · Fase: sync · Store: openspec · Modo: repo-local
Change: `2026-09-13-aa-intelligence-refresh` · Dominio: `model-picker`
Autoridad: delta `openspec/changes/2026-09-13-aa-intelligence-refresh/specs/model-picker/spec.md` (4 ADDED / 6 MODIFIED / 5 REMOVED) + canónico `openspec/specs/model-picker/spec.md`
Delivery: stacked-to-main · NO commit · NO archive (archive es otra fase)

## Status

**status: synced** (specs-only, working tree, sin commit)

El merge se aplicó encima del working tree actual, preservando intacta la modificación pre-existente no commiteada del sync V5 (+448). No se tocó código (`scripts/`, `js/`, `css/`, `data/`, `tests/`), no se movió el change a archive, no se commiteó.

Nota de guardrail: el status nativo marcaba `sync: blocked` por `verifyReport: missing` y 6 tareas 4.x unchecked. El parent autorizó explícitamente el sync solo-de-SPECS con verificación sustituta (PRs #72–#78 stacked-to-main verificados OPEN/MERGEABLE/CLEAN, código en ramas NO en main, apply-progress Fase 4 con caveat Node 24). Este reporte documenta ese override y los riesgos. Sin ese override explícito, el estado correcto habría sido `blocked`.

## Domains synced

- `model-picker` (único dominio del delta)

## Canonical files updated

- `openspec/specs/model-picker/spec.md`: **30 → 34 requisitos** (6 reemplazados in-place, 4 agregados al final, 0 eliminados, resto intacto)

Conteo verificado:

```text
Antes: 30 (grep ^### Requirement:)
Después: 34 (30 - 0 + 4)
ADDED: 4 · MODIFIED: 6 · REMOVED: 0 eliminaciones canónicas (ver sección REMOVED)
```

## ADDED Requirements (4, agregados al final con `---`)

1. `AA Intelligence Index Field` — campo `intelligenceIndex: number | null`, scraper `FIELD_MAP` + `buildAaPatch` read-modify-write preservando `availability`, inerte al scorer, fixture + test.
2. `AA Chart Backfill 2026-09-13 with sources[]` — backfill trazado desde payload live 2026-09-13T01:11:12.045Z (Astra 52.8 exacto / chart redondeado 53, Spark 48.2 / 48, Opus 50.7 / 51), `sources[] {url, date, scraper}` por número, Astra-primera como consecuencia de datos con máximo real computado, sin bajar candidatos sin evidencia, sin tocar fórmula del scorer.
3. `New Chart Models Fail-Closed with Green Matrix` — altas con `availability: {}` o `false` explícito salvo `sourceOfTruth`, gate matriz `families × providers` verde (cli-mirror 18, workflow 9, 5 configs, hero `"X de Y visibles"`), reconciliación DeepSeek/MiniMax sin duplicados.
4. `UI Component — Model Card (effort-only)` — **renombrado en el merge** desde el título del delta `Model Card Effort-Only (no canonical predecessor)` al nombre final de diseño D2 `UI Component — Model Card (effort-only)`. Anexo dentro de `model-picker` (no dominio nuevo). Solo tag effort (`data-effort`, vocabulario cerrado), sin tier/soft/color por tier.

## MODIFIED Requirements (6, bloques completos reemplazados)

1. `Scoring Service — compositeScore` — reemplazo íntegro del weighted 30/30/20/20 por el contrato ejecutable BenchLM-clamp: única entrada `model.benchlm.score`, finito → clamp `[0,100]`, ausente/no-finito → `null` (nunca `0`), pura, `arena`/`swePro`/`sweVer`/`term`/`intelligenceIndex` inertes. La ponderada queda declarada obsoleta en el bloque con nota `Previously:` + aclaración de que `js/services/model-scorer.js` ya implementa el contrato y no se toca.
2. `Scoring Service — getBestFor (Hybrid Role-Aware Matching)` — preserva firma y pre-filtro `applyProviderFilter` de V5, suma Astra-first-como-consecuencia-de-datos (máximo real del eligible `chatgpt-plus` computado en test-time, nunca hardcodeado), scorer-intacto, `intelligenceIndex` inerte, sin rama especial de ranking.
3. `Justification UI` — 18 cards effort-only (`data-effort` cerrado), sin tier/soft/banner/columna Estado, fallback = solo nombre, alternativas solo del eligible set, firma y `unassigned` intactos.
4. `UI Component — Reference Table (pilot)` — columna `Tier` → `Esfuerzo` (`data-effort`), sin `tierCell`/`[data-tier]`/export `Tier`, eligible-only + `isNew`-pin preservados.
5. `UI Component — CLI Mirror Table` — 18 filas, celda asignada effort-only, sin `.tier-tag`/`data-tier`/`softBadge`/`~`, fallback = solo nombre, `unassigned` intacto.
6. `Filtered Export` — vista filtrada por defecto + header providers+timestamp + flag full-catalog preservados, cuerpo sin `Tier` ni fragmento `(tier · score · costo)`.

Todos los MODIFIED se reemplazaron como bloques completos (heading → antes del `---` separador), preservando los separadores y el resto del canónico.

## REMOVED Requirements (5, cero eliminaciones canónicas)

Delta lista:

1. `Tier Column and Header Display`
2. `Tier Badge Elements (.tier-tag, .model-tier-tag, data-tier)` — migración ampliada a `composite-chart` (`tierOf`/`barColor`, `data-tier`, leyenda, columna `Tier` del markdown, token neutral `--composite-score-fill`), conservando `.tier-tag`/shapes y `--pricing-tier-*` que workflow-table/pricing-chart todavía usan (non-goal).
3. `Soft Fallback Badge (.soft-badge, ~ prefix)`
4. `Soft Summary Banner and Estado Column ([data-test=soft-summary], soft fallback)`
5. `Exporter (tier · score · costo) Fragment`

**Tratamiento:** ninguno de los 5 existe como `### Requirement:` en el canónico (verificado por búsqueda exacta). Son remociones a nivel código/UI, no requisitos canónicos a borrar. Por semántica nativa (`REMOVED` borra bloques coincidentes por nombre exacto), no corresponde borrar nada. Su intención ya está capturada por los 6 MODIFIED effort-only de este mismo sync. Aplicar borrado por aproximación habría sido destructivo y se evitó por regla (si hubiera habido conflicto real, se reportaba como blocker en vez de destruir).

## Active same-domain collisions

- Ninguna. Único change activo que toca `specs/model-picker/spec.md` es este (`ls openspec/changes/*/specs/model-picker/spec.md` = 1 hit). `relationships.sameDomainActiveChanges: []`. No se requiere orden archive/sync.

## Destructive sync approvals

- Sync destructivo potencial: 5 REMOVED + 6 MODIFIED grandes (bloques completos, ej. getBestFor 6k chars).
- Aprobación explícita del parent (prompt de esta fase): "Aplicar el delta al canónico según el formato del repo (bloques completos en MODIFIED, anexo 'UI Component — Model Card (effort-only)' dentro de model-picker, MODIFIED compositeScore benchlm-clamp con ponderada declarada obsoleta, migración REMOVED Tier Badge Elements incluyendo composite-chart)".
- Se interpreta como aprobación explícita para MODIFIED completos + migración REMOVED como notas de código (sin borrado canónico). No se infirió `size:exception`, no se tocó código, no se commiteó.

## V5 preservation (advertencia del parent)

- Canónico pre-sync: working tree con +448 no commiteados del sync V5 anterior (`git diff --stat` base: `openspec/specs/model-picker/spec.md | 448 +++`).
- Post-sync: `openspec/specs/model-picker/spec.md | 649 +++` (601 insertions, 48 deletions vs HEAD) = V5 + delta, sin reversiones.
- Verificado: `availability` (29 hits), `applyProviderFilter` (6), `eligible set` (22), `DATA_FILES` (5), Twin Judge, Workflow Table con tag por tier (non-goal retenido), Pricing Chart intacto, Composite Chart intacto (el canónico nunca mencionó tier; la fuga era de implementación, cubierta por la migración REMOVED).
- Conflicto real V5 vs delta: ninguno. El delta ya estaba escrito contra el canónico post-V5 (pre-filtro, eligible-only, `Previously:` coincidentes). No se resolvió nada destruyendo.

## Validation commands / checks performed

```text
grep -c ^### Requirement: openspec/specs/model-picker/spec.md → 30 antes, 34 después
grep ^### Requirement: (lista completa antes/después, 6 MODIFIED con mismo nombre, 4 ADDED nuevos)
Búsqueda exacta MODIFIED en canónico: 6/6 OK
Búsqueda exacta REMOVED en canónico: 5/5 NOT-FOUND (esperado, sin borrado)
ls openspec/changes/*/specs/model-picker/spec.md → solo este change (sin colisiones)
git diff --stat -- openspec/specs/model-picker/spec.md → 649 líneas (V5 448 + delta)
grep intelligenceIndex → 12 hits · benchlm.score → 9 hits · data-effort → 9 hits
grep tier → 35 hits (retenidos por non-goals: Data Layer tier, tier-based, workflow, pricing)
git status --short → canónico modificado en working tree + change dir untracked, sin commits, sin archive
```

No se corrió `pnpm test` / `pnpm build` en esta fase (sync solo-docs por orden explícita; la evidencia de tests vive en apply-progress Fases 1–3 + PRs #72–#78 + caveat Node 24 para 3 suites que solo colectan en CI Node 20).

## Structured status & actionContext findings

- Consumido: status nativo `change: 2026-09-13-aa-intelligence-refresh`, `artifactStore: openspec`, `artifacts: proposal done, specs done, design done, tasks done (32/38), applyProgress done, verifyReport missing, syncReport missing`, `dependencies: apply ready, verify ready, sync blocked, archive blocked`, `actionContext.mode: repo-local`, `workspaceRoot: D:\Proyectos\sdd_agent_selector`, `allowedEditRoots: [D:\Proyectos\sdd_agent_selector]`, sin `blockedReasons`, sin warnings, `sameDomainActiveChanges: []`, `nextRecommended: sdd-apply`.
- Hallazgos: rutas canónicas dentro del workspace y de `allowedEditRoots` (OK para `repo-local`); `artifactStore: openspec` → sync filesystem + `sync-report.md` (este archivo); `RENAMED` ausente (OK); `config.yaml` con `strict_tdd/test_command/build_command/coverage_threshold` leído (no aplica a sync docs, se deja constancia).
- Desvío documentado: `verify-report.md` ausente + 6 tareas 4.x unchecked (`4.1–4.6` entrega). El parent sustituye con PRs #72–#78 (OPEN/MERGEABLE/CLEAN, ramas, no main) + apply-progress Fase 4. El sync avanza solo-docs bajo ese override; `sdd-archive` deberá exigir CI verde + 4.x cerrados.

## Next recommended phase

- `sdd-archive` (previa verificación de CI en Node 20 + cierre de 4.1–4.6 + decisión G2 ask-on-risk por budget >400 en PR-A 873 / PR-B ~1064). No archivar desde este sync.

## Risks

- Sin `verify-report.md` en el change dir: la trazabilidad formal de verificación vive en PRs y apply-progress, no en el artefacto canónico que `sdd-archive` exige.
- 4.x unchecked = entrega pendiente (tests full, build, conteos vivos, medición G2, stacked-to-main, archive). El canónico ya refleja el contrato aunque el código siga en ramas.
- G2 budget: PR-A 873 / PR-B ~1064 superan 400; abrir PRs requiere tercer/cuarto eslabón o `size:exception` explícito del humano (nunca inferido).
- Node 24 local vs CI Node 20: 3 suites (`availability-matrix`, `data-integrity`, `propagate-provider-availability`) no colectan localmente; la autoridad es CI.
- `index.html` glossary aún menciona tier/soft como texto educativo (fuera de scope PR-B, observado en apply-progress); si se quiere limpiar, ampliar superficie explícitamente.
