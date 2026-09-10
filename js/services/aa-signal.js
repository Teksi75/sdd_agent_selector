// js/services/aa-signal.js
// Artificial Analysis signal helpers shared by catalog views.

const FINITE_AA_FIELDS = Object.freeze([
  'codingIndex',
  'mathIndex',
  'term',
  'outputTokensPerSecond',
  'timeToFirstTokenSeconds',
  'timeToFirstAnswerTokenSeconds',
]);

function hasNonEmptyEvaluations(evaluations) {
  if (Array.isArray(evaluations)) return evaluations.length > 0;
  if (!evaluations || typeof evaluations !== 'object') return false;
  return Object.keys(evaluations).length > 0;
}

/**
 * Return true when a model carries any Artificial Analysis signal.
 *
 * Broad signal contract:
 *   - non-empty `evaluations`
 *   - finite AA metric/latency/index fields
 *   - AA-owned pricing provenance (`pricingSource: "artificialanalysis"`)
 *
 * Pricing-only AA provenance counts as a signal.
 *
 * @param {Object|null|undefined} model
 * @returns {boolean}
 */
export function hasAaSignal(model) {
  if (!model || typeof model !== 'object') return false;
  if (model.pricingSource === 'artificialanalysis') return true;
  if (hasNonEmptyEvaluations(model.evaluations)) return true;
  return FINITE_AA_FIELDS.some((field) => Number.isFinite(model[field]));
}

/**
 * Split keyed model rows into AA-signal and no-AA-signal buckets while
 * preserving the incoming order inside each bucket.
 *
 * @template T
 * @param {Array<T>} rows
 * @param {(row: T) => Object|null|undefined} modelOf
 * @returns {{ withAa: Array<T>, withoutAa: Array<T> }}
 */
export function splitByAaSignal(rows, modelOf) {
  const withAa = [];
  const withoutAa = [];
  for (const row of rows || []) {
    if (hasAaSignal(modelOf(row))) withAa.push(row);
    else withoutAa.push(row);
  }
  return { withAa, withoutAa };
}
