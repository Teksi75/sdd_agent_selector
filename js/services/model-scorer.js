// js/services/model-scorer.js
// Phase 1 scoring service — pure functions (no DOM, no fetch).
//
// Implements the 5 exported APIs from design.md:
//   - compositeScore(model)        — weighted benchmark score in [0, 100]
//   - costEstimate(model, profile?) — USD cost of a single request
//   - findReferenceModel(models)   — tier:reference or highest-scoring fallback
//   - applyStrategy(role, strat)   — modify role by config strategy
//   - getBestFor(agent, ...)       — pick the best model for an agent
//
// Scoring weights are documented in tasks.md 1.11 + spec "Scoring Service".
// The pure-function contract enables deterministic testing and lets the
// justification UI in Phase 2 reuse the same scoring math.

// js/services/model-scorer.js
// PR3 (benchlm-replace-custom-scoring) — compositeScore now reads
// `benchlm.score` directly per the benchlm-score-contract (spec).
// The 4-benchmark weighted-average math from Phase 1 is removed; the
// legacy `arena`/`swePro`/`sweVer`/`term` fields stay in `data/models.json`
// for reference but are NOT consulted by `compositeScore` anymore.
//
// Public API (unchanged signatures):
//   - compositeScore(model)         — benchlm.score clamped to [0,100]
//   - costEstimate(model, profile?) — USD cost of a single request
//   - findReferenceModel(models)    — tier:reference or highest benchlm
//   - applyStrategy(role, strat)    — modify role by config strategy
//   - getBestFor(agent, ...)        — pick the best model for an agent
//
// Removed in PR3: `SCORING_WEIGHTS`, `ARENA_NORMALIZATION_MAX`, and the
// weighted-average / weight-redistribution branch in compositeScore. See
// spec "REMOVED Requirements — 4-benchmark weighted average scoring".

/**
 * Default request profile (per spec "costEstimate default"). Used when
 * no profile is supplied.
 *
 * @type {{inputTokens: number, outputTokens: number}}
 */
const DEFAULT_REQUEST_PROFILE = Object.freeze({
  inputTokens: 1000,
  outputTokens: 500,
});

/**
 * Clamp `value` to [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Compute the composite score for a model, in [0, 100].
 *
 * PR3 contract (spec "Scoring Service — compositeScore", benchlm-score-contract):
 *   - Returns `model.benchlm.score` clamped to [0, 100].
 *   - Returns `null` when benchlm data is missing/non-finite (NOT 0; the
 *     chart + readers render null as an "unavailable" placeholder to honor
 *     the benchlm-fail-soft contract — never a stale zero bar).
 *   - Pure: deterministic, no side effects on the input.
 *
 * The legacy 4-benchmark weighted average (arena/swePro/sweVer/term) is
 * intentionally removed. Legacy fields remain in `data/models.json` for
 * reference but are inert to this function.
 *
 * @param {Object} model - LLM model record (one entry from data/models.json)
 * @returns {number|null} score in [0, 100], or null when BenchLM data missing
 */
export function compositeScore(model) {
  if (!model || typeof model !== 'object') return null;

  const score = model.benchlm?.score;
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;

  return clamp(score, 0, 100);
}

/**
 * Estimate the USD cost of a single request against `model`.
 *
 * Formula: (inputPrice / 1e6) * inputTokens + (outputPrice / 1e6) * outputTokens
 *
 * @param {Object} model - model record with `input` (price $/1M input tokens)
 *                          and `output` (price $/1M output tokens)
 * @param {{inputTokens: number, outputTokens: number}} [requestProfile]
 * @returns {number} cost in USD (non-negative)
 */
export function costEstimate(
  model,
  requestProfile = DEFAULT_REQUEST_PROFILE
) {
  if (!model || typeof model !== 'object') return 0;
  const inputPrice = Number.isFinite(model.input) ? model.input : 0;
  const outputPrice = Number.isFinite(model.output) ? model.output : 0;
  const inputTokens = Math.max(0, Number(requestProfile?.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(requestProfile?.outputTokens) || 0);
  return (inputPrice / 1e6) * inputTokens + (outputPrice / 1e6) * outputTokens;
}

/**
 * Find the reference model in `models`.
 *
 * Per spec: prefers tier:reference (closed-source frontier benchmarks).
 * Falls back to the highest compositeScore when no reference tier exists.
 * Returns null for an empty `models` object.
 *
 * Deterministic tie-breaker: among multiple reference models we pick the
 * one with the higher compositeScore; among multiple non-reference models
 * the same rule applies.
 *
 * @param {Object<string, Object>} models - keyed by model id (e.g. 'glm52')
 * @returns {Object|null} the reference model, or null
 */
export function findReferenceModel(models) {
  if (!models || typeof models !== 'object') return null;
  const list = Object.values(models).filter((m) => m && typeof m === 'object');
  if (list.length === 0) return null;

  // First pass: prefer tier:reference.
  const refs = list.filter((m) => m.tier === 'reference' || m.isReference === true);
  if (refs.length > 0) {
    return refs.reduce((best, m) =>
      compositeScore(m) > compositeScore(best) ? m : best
    );
  }

  // Fallback: highest compositeScore.
  return list.reduce((best, m) =>
    compositeScore(m) > compositeScore(best) ? m : best
  );
}

/**
 * Apply a config strategy to a role requirement.
 *
 * Spec table:
 *   min-cost      → costRatio *= 0.5   (tighter cost)
 *   max-quality   → minReasoning += 10 (tighter reasoning)
 *   experimental  → max-quality + skip isNew filter at higher layers
 *   balanced      → no change
 *   tier-based    → no change (tier logic handled in the higher-level filter)
 *
 * Returns a NEW object — does not mutate `roleReq` (so callers can reuse
 * the original matrix entry across strategies).
 *
 * @param {{minReasoning: number, costRatio: number, role: string}} roleReq
 * @param {'min-cost'|'balanced'|'max-quality'|'tier-based'|'experimental'} strategy
 * @returns {{minReasoning: number, costRatio: number, role: string}}
 */
export function applyStrategy(roleReq, strategy) {
  if (!roleReq || typeof roleReq !== 'object') {
    throw new TypeError('applyStrategy: roleReq must be an object');
  }
  // Spread the FULL roleReq first so opt-in fields like `referenceModelId`
  //   (gentle-orchestrator's per-role designated reference) survive every
  //   strategy. Earlier versions only copied minReasoning/costRatio/role,
  //   which silently dropped referenceModelId and left the role-designated
  //   soft-fallback path in getBestFor unreachable.
  const base = { ...roleReq };

  switch (strategy) {
    case 'min-cost':
      return { ...base, costRatio: base.costRatio * 0.5 };
    case 'max-quality':
      return { ...base, minReasoning: base.minReasoning + 10 };
    case 'experimental':
      // experimental == max-quality (the isNew filter is layered above, in
      //   the matching service / Phase 2 selectConfig flow).
      return { ...base, minReasoning: base.minReasoning + 10 };
    case 'tier-based':
    case 'balanced':
    default:
      return { ...base };
  }
}

/**
 * Pick the best model for an agent, considering role + strategy + cost.
 *
 * Decision flow (per design.md "getBestFor decision flow"):
 *   1. roleReq = roleMatrix[agent], optionally modified by applyStrategy
 *   2. refModel = findReferenceModel(models) || highest compositeScore
 *   3. agentProfile = profiles[agent]
 *   4. effectiveMaxCost = costRatio * costEstimate(refModel, agentProfile)
 *   5. eligible = models without `isReference`
 *                 where compositeScore(m) >= minReasoning
 *                   and costEstimate(m, agentProfile) <= effectiveMaxCost
 *   6. If eligible is empty → return { key: null, reason, effectiveMaxCost }
 *      Else → return { key, model, score, cost, effectiveMaxCost, alternatives }
 *
 * @param {string} agent
 * @param {Object<string, Object>} models
 * @param {Object<string, {minReasoning:number, costRatio:number, role:string}>} roleMatrix
 * @param {Object<string, {inputTokens:number, outputTokens:number}>} agentRequestProfiles
 * @param {'min-cost'|'balanced'|'max-quality'|'tier-based'|'experimental'} strategy
 * @returns {{
 *   key: string|null,
 *   model?: Object,
 *   score?: number,
 *   cost?: number,
 *   effectiveMaxCost: number,
 *   alternatives?: Array<{key: string, model: Object, score: number, cost: number}>,
 *   reason?: string
 * }}
 */
export function getBestFor(
  agent,
  models,
  roleMatrix,
  agentRequestProfiles,
  strategy
) {
  const roleReq = roleMatrix?.[agent];
  if (!roleReq) {
    // Spec does not explicitly cover this edge case, but downstream components
    //   need a stable shape for an unknown agent — return the "no qualify"
    //   shape with an explanatory reason rather than throwing.
    return {
      key: null,
      effectiveMaxCost: 0,
      reason: `Unknown agent: "${agent}"`,
    };
  }

  const modified = applyStrategy(roleReq, strategy);
  const profile = agentRequestProfiles?.[agent] ?? DEFAULT_REQUEST_PROFILE;

  // Find the reference model. If `models` is empty the chain still works:
  //   findReferenceModel returns null → effectiveMaxCost = 0 → no model qualifies.
  const refModel = findReferenceModel(models);
  const refCost = refModel ? costEstimate(refModel, profile) : 0;
  const effectiveMaxCost = modified.costRatio * refCost;

  const list = models && typeof models === 'object' ? Object.entries(models) : [];
  const eligible = [];
  for (const [key, m] of list) {
    if (!m || typeof m !== 'object') continue;
    if (m.isReference === true || m.tier === 'reference') continue;
    const score = compositeScore(m);
    const cost = costEstimate(m, profile);
    if (score >= modified.minReasoning && cost <= effectiveMaxCost) {
      eligible.push({ key, model: m, score, cost });
    }
  }

  if (eligible.length === 0) {
    // Soft fallback #1 (role-designated reference): if the role explicitly
    //   opts into a per-role reference (referenceModelId), and that
    //   reference clears the role's hard cost ceiling, surface it as a
    //   'soft-recommended' pick so the UI doesn't show a no-models critical
    //   warning for roles like gentle-orchestrator where the user has
    //   designated a specific reference by hand.
    const roleRefKey = modified.referenceModelId;
    if (roleRefKey && models && models[roleRefKey]) {
      const roleRefModel = models[roleRefKey];
      const roleRefScore = compositeScore(roleRefModel);
      const roleRefCost = costEstimate(roleRefModel, profile);
      if (roleRefCost <= effectiveMaxCost) {
        const scoreStr = roleRefScore == null ? 'unavailable' : roleRefScore.toFixed(1);
        return {
          key: roleRefKey,
          model: roleRefModel,
          score: roleRefScore,
          cost: roleRefCost,
          effectiveMaxCost,
          softFallback: true,
          reason: `Soft fallback to role-designated reference (${roleRefKey}); score ${scoreStr} < minReasoning ${modified.minReasoning} but cost within ceiling`,
          alternatives: [],
        };
      }
    }

    // Soft fallback #2 (general): when no model meets the modified reasoning
    //   floor (e.g., max-quality strategy raises the floor above the top
    //   non-reference composite score), but at least one non-reference model
    //   still clears the cost ceiling, surface the highest-scoring one as
    //   a soft fallback. This converts the "Sin modelo elegible" critical
    //   stop into an actionable recommendation when the user has explicitly
    //   asked for the most-strict preset.
    //
    //   We drop the reasoning filter (which is what emptied `eligible`) but
    //   keep the cost ceiling sacred — if the user can't afford ANY model
    //   in the role's budget, no soft fallback is possible and we return
    //   null with an explicit reason.
    const costClearing = [];
    for (const [key, m] of list) {
      if (!m || typeof m !== 'object') continue;
      if (m.isReference === true || m.tier === 'reference') continue;
      const cost = costEstimate(m, profile);
      if (cost <= effectiveMaxCost) {
        costClearing.push({ key, model: m, score: compositeScore(m), cost });
      }
    }
    if (costClearing.length > 0) {
      costClearing.sort((a, b) => {
        // Null scores sort AFTER any numeric score (so the soft fallback
        // prefers a model with a real score over one whose BenchLM data
        // is missing).
        const aS = a.score;
        const bS = b.score;
        if (aS == null && bS == null) return a.cost - b.cost;
        if (aS == null) return 1;
        if (bS == null) return -1;
        return bS - aS || a.cost - b.cost;
      });
      const [best, ...rest] = costClearing;
      const scoreStr = best.score == null ? 'unavailable' : best.score.toFixed(1);
      return {
        key: best.key,
        model: best.model,
        score: best.score,
        cost: best.cost,
        effectiveMaxCost,
        softFallback: true,
        reason: `Soft fallback: no model meets minReasoning=${modified.minReasoning}, surfacing best cost-clearing model (${best.key}, score=${scoreStr})`,
        alternatives: rest.slice(0, 3).map(({ key, model, score, cost }) => ({
          key,
          model,
          score,
          cost,
        })),
      };
    }

    // Distinguish "only reference models" vs "threshold not met" so UI can
    //   render an actionable message.
    const onlyRefs =
      list.length > 0 && list.every(([, m]) => m.isReference === true || m?.tier === 'reference');
    return {
      key: null,
      effectiveMaxCost,
      reason: onlyRefs
        ? 'No non-reference models available'
        : `No model meets minReasoning=${modified.minReasoning} within costRatio=${modified.costRatio}`,
    };
  }

  eligible.sort((a, b) => b.score - a.score || a.cost - b.cost);
  const [best, ...rest] = eligible;
  return {
    key: best.key,
    model: best.model,
    score: best.score,
    cost: best.cost,
    effectiveMaxCost,
    alternatives: rest.slice(0, 3).map(({ key, model, score, cost }) => ({
      key,
      model,
      score,
      cost,
    })),
  };
}
