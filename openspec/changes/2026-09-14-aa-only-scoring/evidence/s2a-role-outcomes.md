# S2a role outcomes — frozen thresholds over the II snapshot (evidence, not ranking law)

Slice: **S2a (PR 2/6)** · Date: **2026-09-13** · Strategy in table: **balanced** (`tier-based` identical per `applyStrategy`; `min-cost` tightens every ceiling ×0.5; `max-quality`/`experimental` add +10 to every threshold).
Snapshot: **provider-filtered union `chatgpt-plus` + `anthropic` = 43 models**, only S2a-backed **finite-II rows admitted** (post-S2a all 43 finite; method reads `intelligenceIndex` directly, never the still-benchlm public `compositeScore`).
Live capture reuse: **2026-09-13T03:53:18.345Z, 646 items** (manifest `aa-live-manifest.md` §S2a). No number without its `sources[]` tuple; no `benchlm` fallback anywhere.

## Reference identity old → new (recomputed at test time, recorded here as snapshot)

| Scope | Old ref (benchlm-era, public scorer) | New ref (II-era, finite-II max, lifecycle priority kept) | Identity change | Numeric ceiling delta |
|---|---|---|---|---|
| all-enabled (88) | `opus48` (benchlm 78.34) | `opus48` (II 42) | same | **0** (same model + same 5/25 pricing) |
| chatgpt-plus (28) | `gpt55` (benchlm 38.6) | `gpt55` (II 38.6) | same | **0** |
| anthropic (15) | `opus48` (benchlm 78.34) | `opus48` (II 42) | same | **0** |
| S2a union snapshot (43) | `opus48` (benchlm 78.34) | `opus48` (II 42) | same | **0 for all 18 roles** |

An identity flip always triggers recomputation, but a gate moves only when its numeric ceiling changes — here **no ceiling moves** (Fable/Astra share 10/50 pricing and are not the reference; the reference stays `opus48` 5/25 in every scope).
The churn below is therefore **pure threshold rescaling** (D2 frozen thresholds calibrated to another scale), not a cost-gate move. Honest signal, not failure.

## 18-role table — balanced, S2a union snapshot, II reference `opus48`

`thr` = frozen `minReasoning` (balanced, unchanged). `ceil` = `costRatio × costEstimate(opus48, profile)` in USD.
`n` = normal finite-II candidates (`active` + II ≥ thr + cost ≤ ceil). `cc` = general finite-II cost-clearing pool (`active` + finite II + cost ≤ ceil).
Classification: `assigned` (n > 0) / `soft:designated` (n = 0, designated clears) / `soft:cost` (fallthrough cost-clearing) / `unassigned` (empty).
`sel` = selected id under the same rule (normal II-desc winner, else designated, else best cost-clearing II-desc).

| Role | thr | ceil (USD) | n | cc | class | sel |
|---|---|---:|---:|---|---|---|
| gentle-orchestrator | 95 | 0.070000 | 0 | 28 | soft:cost | claudeOpus5 |
| sdd-init | 60 | 0.001300 | 0 | 6 | soft:cost | gpt56luna |
| sdd-explore | 70 | 0.017000 | 0 | 14 | soft:cost | sonnet5 |
| sdd-propose | 85 | 0.062000 | 0 | 23 | soft:cost | gpt56terra |
| sdd-spec | 80 | 0.052500 | 0 | 23 | soft:cost | gpt56terra |
| sdd-design | 88 | 0.074000 | 0 | 23 | soft:cost | gpt56terra |
| sdd-tasks | 65 | 0.018000 | 0 | 8 | soft:cost | gpt56luna |
| sdd-apply | 75 | 0.117500 | 0 | 28 | soft:cost | claudeOpus5 |
| sdd-verify | 80 | 0.045500 | 0 | 23 | soft:cost | gpt56terra |
| sdd-archive | 50 | 0.000850 | 0 | 6 | soft:cost | gpt56luna |
| sdd-onboard | 60 | 0.009000 | 0 | 6 | soft:cost | gpt56luna |
| jd-judge-a | 90 | 0.048875 | 0 | 23 | soft:cost | gpt56terra |
| jd-judge-b | 90 | 0.048875 | 0 | 23 | soft:cost | gpt56terra |
| jd-fix-agent | 80 | 0.071750 | 0 | 23 | soft:cost | gpt56terra |
| review-risk | 85 | 0.027500 | 0 | 23 | soft:cost | gpt56terra |
| review-readability | 70 | 0.021000 | 0 | 14 | soft:cost | sonnet5 |
| review-reliability | 80 | 0.026250 | 0 | 20 | soft:cost | gpt56terra |
| review-resilience | 78 | 0.026250 | 0 | 20 | soft:cost | gpt56terra |

Notes:

- All 18 normal sets are empty at the observed II range (active max `gpt6astra` 52.8 < every threshold except `sdd-archive` 50, which still empties on its 5% cost ceiling). Seventeen roles flip from benchlm-era normal assignments to soft fallback; `sdd-archive` flips on cost despite clearing the II threshold on raw score.
- `gentle-orchestrator` designated (`gpt56sol`, cost 0.08) does **not** clear its 0.07 ceiling → falls through to `soft:cost` like every other role. No `soft:designated` fires in this snapshot; no role is `unassigned` (every cost-clearing pool is non-empty here).
- Twin-judge equality holds: `jd-judge-a` === `jd-judge-b` (`gpt56terra`).
- The acceptance test (`tests/aa-effort.test.js`, S2a role-outcome block) recomputes maxima, pools, ceilings, and classifications from `data/models.json` at test time and asserts invariants only — no hardcoded winner key or II value. This table is the review snapshot; the test is the law.
