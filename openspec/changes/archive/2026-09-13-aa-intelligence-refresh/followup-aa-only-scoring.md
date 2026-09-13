# Follow-up — Ranking solo-AA (hilo nuevo, este change queda archivado)

Fecha: 2026-09-13 · Estado: pendiente, para change nuevo (nombre propuesto: `2026-09-14-aa-only-scoring`) · skill_resolution: none
Autoridad: screenshot usuario 2026-09-13 (ranking con filas sin datos) + auditoría en datos + memoria `sdd/aa-only-scoring`.

## Estado de desajuste actual (verificado, no opinado)

- Catálogo `data/models.json`: **88 modelos**. Solo **8** con `intelligenceIndex`. **58** con `benchlm.score` null. **58 sin NINGÚN score** (ni benchlm ni II), entre ellos `qwen38max`, `glm53`, `glm53flash`, `qwen38flash`, `grok46`, `kimik3`, `musespark13contributor`, `omenalpha`, `longcat20`, `hy4preview` y todas las variantes effort de GPT-5.x (`gpt55/56terra/luna/sol` High/Medium/Low/NonReasoning/Xhigh) y Claude (`sonnet5*`, `claudeOpus5*`, `haiku45Reasoning`).
- Upstream AA live (`api/v2/data/llms/models`, HTTP 200): **646 items**, path `evaluations.artificial_analysis_intelligence_index` confirmado en 646/646. `data/aa-aliases.json`: **71 slugs**. Brecha de mapeo ≈ cientos de items AA sin alias.
- Ranking vigente: `compositeScore` = `benchlm.score` clamp (contrato syncado al canónico en este change, 34 requisitos). Consecuencia: `claudeFable5` benchlm **83.68** (sin II, sin chatgpt-plus) tapa a `gpt6astra` benchlm **52.8** en toda vista global; con filtro chatgpt-plus Astra sí es primera (G1 verde de este change).
- Síntoma visible: el ranking muestra decenas de filas sin datos y excluye modelos que en AA sí existen → desvirtúa la comparación. De nada sirve la presencia sin datos.

## Medidas a tomar (próximo change, en este orden)

1. **Mapeo masivo de aliases** (71 → cubrir intersección catálogo ∩ 646 AA) con effort explícito por slug, nunca inferido; availability fail-closed para altas nuevas + gate de matriz verde.
2. **Backfill de `intelligenceIndex`** con `sources[]` {url AA, fecha, scraper} por número; live exacto manda sobre redondeo de chart (precedente 53→52.8); cero sintetizados.
3. **Switch del scorer a AA-only**: `compositeScore` lee `intelligenceIndex`; benchlm/coding/math/term pasan a inertes. REVierte el contrato benchlm-clamp recién syncado → requiere MODIFIED explícito en el delta y re-verificación de todas las superficies de ranking (ref-table, composite-chart, cli-mirror, justification, exporter).
4. **Regla para filas sin datos** (decisión de producto, no inferir): ocultar del ranking vs sección separada "sin evaluación". Prohibido "presente sin datos".
5. **Regla fail-soft/staleness**: el ranking depende del sync AA cada 5 días; definir comportamiento si el sync falla o un modelo pierde su II (null+nota vs último valor finito — cambio de contrato si es lo segundo).
6. **Caso Fable**: `claudeFable5` hoy no tiene II → con ranking AA-only cae a null/unavailable salvo que se mapee. Decisión explícita, no hallazgo tardío.
7. Entrega con budget 400/PR, stacked-to-main, pnpm, vitest; CI Node 20 manda (3 suites no colectan bajo Node 24 local, pre-existente).

## No-go de este change archivado

Nada de lo de arriba toca este change. El scorer benchlm-clamp, el backfill benchlm y effort-only quedan como están en PRs #72–#78.
