// js/services/provider-filter.js
// V5 slice 2 — pure provider predicate shared by every surface.
//
// Contract (delta spec "Hard Provider Filter — applyProviderFilter"):
//   eligible(model) = enabledSet non-empty
//                     AND ∃ enabled provider with
//                         availability[modelId][providerId] === true
//   - Union of subscriptions: a model available in P and Q survives while at
//     least one of them is enabled.
//   - Missing map, missing model key, unknown provider id and non-boolean
//     values are all `false` (fail-closed).
//   - Pure: no DOM, no storage, no scorer import. Returns a NEW object keyed
//     by model id, preserves insertion order and record identity, never
//     mutates inputs. `pricingSource`/`name`/`tier`/`lifecycle` are never
//     consulted.

/**
 * Is `modelId`'s availability map granted by at least one enabled provider?
 *
 * @param {Object<string, unknown>|null|undefined} availabilityMap
 *   `availability[modelId]` — a `{ "<provider-id>": boolean }` map.
 * @param {Iterable<string>} enabledSet - enabled provider ids (registry order).
 * @returns {boolean} true ONLY when an enabled provider explicitly maps `true`.
 */
export function isModelAvailable(availabilityMap, enabledSet) {
  if (!availabilityMap || typeof availabilityMap !== 'object') return false;
  if (!enabledSet || typeof enabledSet[Symbol.iterator] !== 'function') return false;
  for (const providerId of enabledSet) {
    if (availabilityMap[providerId] === true) return true;
  }
  return false;
}

/**
 * Project `models` down to the models eligible under `enabledSet`.
 *
 * @param {Object<string, Object>} models - full catalog keyed by model id.
 * @param {Object<string, Object>} availability - `{ [modelId]: providerMap }`.
 * @param {Iterable<string>} enabledSet - enabled provider ids.
 * @returns {Object<string, Object>} new object, same order and record refs.
 */
export function applyProviderFilter(models, availability, enabledSet) {
  const eligible = {};
  if (!models || typeof models !== 'object') return eligible;
  const maps = availability && typeof availability === 'object' ? availability : {};
  for (const modelId of Object.keys(models)) {
    if (isModelAvailable(maps[modelId], enabledSet)) {
      eligible[modelId] = models[modelId];
    }
  }
  return eligible;
}
