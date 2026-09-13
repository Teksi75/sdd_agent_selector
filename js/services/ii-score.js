// js/services/ii-score.js
// S3a (change 2026-09-14-aa-only-scoring) — DARK II scoring core.
//
// Final contract (design §5.1): accept only a finite numeric
// `model.intelligenceIndex`, clamp it to [0, 100], otherwise return `null`
// (never 0 — null renders as "unavailable", never a stale zero bar).
//
// DARK BOUNDARY (design §10.2): nothing imports this module in S3a. The
// public runtime (`compositeScore` in model-scorer.js and every surface)
// stays fully benchlm. Activation belongs to S3b only.
//
// Purity: no benchlm/sister-benchmark reads, no I/O, no surface imports,
// no input mutation.

/**
 * Clamp `value` to [min, max]. Single clamp path for the whole module.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Score a model by its Artificial Analysis Intelligence Index only.
 *
 * @param {Object} model - LLM model record (one entry from data/models.json)
 * @returns {number|null} `intelligenceIndex` clamped to [0, 100], or `null`
 *   when the model is not an object or its II is missing/non-finite.
 */
export function iiScore(model) {
  if (!model || typeof model !== 'object') return null;

  const score = model.intelligenceIndex;
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;

  return clamp(score, 0, 100);
}
